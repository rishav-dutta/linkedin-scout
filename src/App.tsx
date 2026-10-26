import { useEffect, useRef, useState } from 'react';
import { IdleState } from './components/IdleState';
import { Results } from './components/Results';
import { SearchBar } from './components/SearchBar';
import { ErrorBanner } from './components/Feedback';
import { supabase, functionErrorMessage } from './lib/supabase';
import { track } from './lib/analytics';

const DOCS_URL = 'https://rishav-dutta.github.io/linkedin-scout/';
const REPO_URL = 'https://github.com/rishav-dutta/linkedin-scout';

interface Search {
  id: string;
  company: string;
  role: string;
}

// One workspace: the search bar stays at the top and the results, resume upload
// and ranking all happen in the list below it
function App() {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [search, setSearch] = useState<Search | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  // Set once a resume has been scored for the current search; a new upload bumps the version
  const [resume, setResume] = useState<{ name: string; version: number } | null>(null);
  const companyRef = useRef<HTMLInputElement>(null);

  // "/" jumps to the search bar from anywhere, unless you're already typing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        companyRef.current?.focus();
        companyRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSearch = async () => {
    const next: Search = { id: crypto.randomUUID(), company: company.trim(), role: role.trim() };
    setSearchError(null);
    setIsSearching(true);
    track('search');

    let status: unknown;
    try {
      // Goes through the n8n-proxy Edge Function, which validates, rate-limits
      // and forwards to n8n with a secret the browser never sees
      const { data, error } = await supabase.functions.invoke('n8n-proxy/find-leads', {
        body: { company_name: next.company, role: next.role, search_id: next.id },
      });
      if (error) throw error;

      // n8n replies with a text/plain body, so the JSON may arrive as a string
      try {
        status = (typeof data === 'string' ? JSON.parse(data) : data)?.status;
      } catch {
        status = undefined;
      }
    } catch (error) {
      console.error('Search failed:', error);
      track('search-error');
      setSearchError(await functionErrorMessage(error, 'The search didn’t go through. Check your connection and try again in a minute.'));
      setIsSearching(false);
      return;
    }
    setIsSearching(false);

    // The web search found nobody (e.g. a misspelled company): keep the current results
    if (status === 'no_results') {
      track('search-no-results');
      setSearchError(
        `No LinkedIn profiles found for “${next.company}” (${next.role}). Check the spelling or try a broader role.`
      );
      return;
    }

    // n8n only replies with a status; the results list loads the saved leads itself
    setSearch(next);
    setResume(null);
  };

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b border-line">
        <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between">
          <h1 className="flex items-center gap-2 font-semibold">
            <span className="w-3.5 h-3.5 rounded-[4px] bg-accent" aria-hidden="true" />
            LinkedIn Scout
          </h1>
          <nav className="flex items-center gap-4 text-[13px] text-muted">
            <a href={DOCS_URL} onClick={() => track('docs-link')} className="hover:text-ink pointer-coarse:inline-flex pointer-coarse:items-center pointer-coarse:h-11">How it works</a>
            <a href={REPO_URL} onClick={() => track('github-link')} className="hover:text-ink pointer-coarse:inline-flex pointer-coarse:items-center pointer-coarse:h-11">GitHub</a>
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-5 sm:py-8 space-y-4">
        <SearchBar
          ref={companyRef}
          company={company}
          role={role}
          onCompanyChange={setCompany}
          onRoleChange={setRole}
          onSubmit={handleSearch}
          isSearching={isSearching}
          primary={!search || resume !== null || company.trim() !== search.company || role.trim() !== search.role}
        />
        {searchError && <ErrorBanner message={searchError} />}

        {search ? (
          <Results
            key={`${search.id}-${resume?.version ?? 0}`}
            searchId={search.id}
            company={search.company}
            role={search.role}
            ranked={resume !== null}
            resumeName={resume?.name ?? null}
            onScored={(name) => setResume((current) => ({ name, version: (current?.version ?? 0) + 1 }))}
          />
        ) : (
          <IdleState
            onPick={(pickedCompany, pickedRole) => {
              setCompany(pickedCompany);
              setRole(pickedRole);
              setSearchError(null);
              track('example-picked');
              companyRef.current?.focus();
            }}
          />
        )}
      </main>

      <footer className="max-w-3xl w-full mx-auto px-4 pb-5 pt-2 text-[12px] text-muted space-y-1">
        <p>
          Built by{' '}
          <a
            href="https://linkedin.com/in/duttarishav"
            onClick={() => track('author-linkedin')}
            className="underline underline-offset-2 hover:text-ink"
          >
            Rishav Dutta
          </a>
        </p>
        <p>Visits are counted anonymously, without cookies. Uploaded resumes are stored privately and used only for ranking.</p>
      </footer>
    </div>
  );
}

export default App;
