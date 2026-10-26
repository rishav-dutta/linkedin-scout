import { Check, ChevronDown, FileUp, Linkedin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { functionErrorMessage, isScored, supabase, type LinkedInLead } from '../lib/supabase';
import { useLeads, type DetailsStatus } from '../lib/useLeads';
import { track } from '../lib/analytics';
import { Button } from './Button';
import { Avatar, ErrorBanner, Kbd, Spinner } from './Feedback';

// Same limit the n8n-proxy Edge Function enforces
const MAX_RESUME_BYTES = 5 * 1024 * 1024;

interface ResultsProps {
  searchId: string;
  company: string;
  role: string;
  // True once a resume has been scored: rows come back ordered by score
  ranked: boolean;
  resumeName: string | null;
  onScored: (fileName: string) => void;
}

// Titles from search results often already name the company ("PM at Stripe"),
// so only add "@ Company" when they don't
function titleWithCompany(lead: LinkedInLead): string {
  const mentionsCompany = lead.company && lead.job_title?.toLowerCase().includes(lead.company.toLowerCase());
  return [lead.job_title, mentionsCompany ? null : lead.company].filter(Boolean).join(' @ ');
}

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

// A focused button or link handles Enter itself (opening that row, following that link)
function isControl(target: EventTarget | null) {
  return target instanceof HTMLElement && target.closest('a, button, label') !== null;
}

export function Results({ searchId, company, role, ranked, resumeName, onScored }: ResultsProps) {
  // Before scoring, people show as soon as the web search is saved and the
  // full profiles (needed for scoring) arrive a little later, so uploading waits for them
  const { leads: rows, isLoading, loadFailed, details, reload } = useLeads(
    searchId,
    ranked ? 'similarity_score' : 'created_at',
    !ranked
  );
  // Scored leads first (already sorted by score), then any Gemini skipped
  const leads = ranked ? [...rows.filter(isScored), ...rows.filter((lead) => !isScored(lead))] : rows;

  const [selected, setSelected] = useState<number | null>(null);
  // 'top' opens the best match's reasoning until the visitor opens or closes one themselves
  const [expandedId, setExpandedId] = useState<number | 'top' | null>(ranked ? 'top' : null);
  const listRef = useRef<HTMLOListElement>(null);

  const isExpanded = (lead: LinkedInLead, index: number) =>
    expandedId === 'top' ? index === 0 && isScored(lead) : expandedId === lead.id;
  const toggle = (lead: LinkedInLead, index: number) => {
    setSelected(index);
    setExpandedId(isExpanded(lead, index) ? null : lead.id);
  };

  // ↑/↓ (or j/k) move through people, Enter opens or closes the selected one.
  // No animation on any of it: these are repeated many times in a row.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey || leads.length === 0) return;
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        setSelected((i) => (i === null ? 0 : Math.min(i + 1, leads.length - 1)));
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        setSelected((i) => (i === null ? 0 : Math.max(i - 1, 0)));
      } else if (e.key === 'Enter' && selected !== null && leads[selected] && !isControl(e.target)) {
        e.preventDefault();
        toggle(leads[selected], selected);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (selected === null) return;
    listRef.current?.children[selected]?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const missingDetails = !ranked && details === 'ready' ? leads.filter((lead) => lead.enriched === false).length : 0;
  const scoredCount = leads.filter(isScored).length;

  return (
    <div className="space-y-3 fade-in">
      <ResumeBar
        searchId={searchId}
        company={company}
        count={leads.length}
        details={ranked ? 'ready' : details}
        hasLeads={!isLoading && leads.length > 0}
        resumeName={ranked ? resumeName : null}
        onScored={onScored}
      />
      {missingDetails > 0 && (
        <p className="text-muted text-[13px]">
          Profile details couldn't be loaded for {missingDetails} of {leads.length} people, so they won't be scored.
        </p>
      )}

      <div className="rounded-lg border border-line bg-bg overflow-hidden">
        <div className="hidden sm:grid grid-cols-[1.5rem_1fr_7.5rem_2rem] gap-3 px-4 py-2 border-b border-line bg-panel text-[12px] text-muted">
          <span className="text-right">#</span>
          <span>Person</span>
          <span>{ranked ? 'Match' : ''}</span>
          <span />
        </div>

        {isLoading ? (
          <SkeletonRows />
        ) : loadFailed ? (
          <div className="px-4 py-10 text-center">
            <p className="text-muted mb-3">Couldn’t load the people for this search.</p>
            <Button onClick={reload}>Try again</Button>
          </div>
        ) : leads.length === 0 ? (
          <p className="px-4 py-10 text-center text-muted">No one found for this search. Try a different company or a broader role.</p>
        ) : (
          <ol ref={listRef} className="divide-y divide-line">
            {leads.map((lead, index) => (
              <PersonRow
                key={lead.id}
                lead={lead}
                rank={ranked ? (isScored(lead) ? index + 1 : null) : index + 1}
                ranked={ranked}
                loadingProfile={!ranked && details === 'loading' && lead.enriched === false}
                selected={selected === index}
                expanded={isExpanded(lead, index)}
                onToggle={() => toggle(lead, index)}
              />
            ))}
          </ol>
        )}

        <div className="flex items-center justify-between gap-4 px-4 py-2 border-t border-line bg-panel text-[12px] text-muted">
          <span className="truncate">
            {isLoading
              ? `Searching ${company} for “${role}”…`
              : ranked
                ? `${scoredCount} of ${leads.length} ranked against ${resumeName ?? 'your resume'}`
                : `${leads.length} ${leads.length === 1 ? 'person' : 'people'} at ${company} for “${role}”`}
          </span>
          <span className="hidden sm:flex items-center gap-3 shrink-0 pointer-coarse:hidden">
            <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
            <span className="flex items-center gap-1"><Kbd>↵</Kbd> details</span>
            <span className="flex items-center gap-1"><Kbd>/</Kbd> search</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <ol aria-label="Loading" className="divide-y divide-line">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <span className="w-6" />
          <span className="w-8 h-8 rounded-full bg-hover" />
          <span className="flex-1 space-y-1.5">
            <span className="block h-3 w-32 rounded bg-hover" />
            <span className="block h-3 w-56 max-w-full rounded bg-hover" />
          </span>
        </li>
      ))}
    </ol>
  );
}

interface PersonRowProps {
  lead: LinkedInLead;
  rank: number | null;
  ranked: boolean;
  loadingProfile: boolean;
  selected: boolean;
  expanded: boolean;
  onToggle: () => void;
}

function PersonRow({ lead, rank, ranked, loadingProfile, selected, expanded, onToggle }: PersonRowProps) {
  const scored = isScored(lead);
  const score = Math.max(0, Math.min(100, lead.similarity_score ?? 0));
  const hasDetails = Boolean(lead.search_description || lead.scoring_reasoning);

  return (
    <li className={selected ? 'bg-selected' : undefined}>
      <div className="grid grid-cols-[1.5rem_1fr_auto_2rem] sm:grid-cols-[1.5rem_1fr_7.5rem_2rem] items-start gap-3 px-4 py-3 hover:bg-hover">
        <span className="pt-2 text-right text-[12px] text-muted tabular-nums">{rank ?? '–'}</span>

        <button
          type="button"
          onClick={onToggle}
          disabled={!hasDetails}
          aria-expanded={hasDetails ? expanded : undefined}
          className="flex items-start gap-3 min-w-0 text-left disabled:cursor-default"
        >
          <Avatar name={lead.full_name} src={lead.profile_image_url} />
          <span className="min-w-0">
            <span className="flex items-center gap-1 font-medium leading-5 break-words">
              {lead.full_name}
              {hasDetails && (
                <ChevronDown
                  className={`hidden sm:block w-3.5 h-3.5 text-faint shrink-0 ${expanded ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              )}
            </span>
            <span className="text-[13px] text-muted leading-5 line-clamp-2 break-words" title={titleWithCompany(lead) || undefined}>
              {titleWithCompany(lead) || 'No title listed'}
            </span>
          </span>
        </button>

        <span className="pt-1.5">
          {ranked ? (
            scored ? (
              <span className="flex items-center justify-end sm:justify-start gap-2">
                <span className="text-[13px] font-medium tabular-nums w-6 text-right">{score}</span>
                <span className="hidden sm:block h-1.5 w-16 rounded-full bg-line overflow-hidden" aria-hidden="true">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${score}%` }} />
                </span>
              </span>
            ) : (
              <span className="text-[12px] text-muted whitespace-nowrap">Not scored</span>
            )
          ) : loadingProfile ? (
            <span className="flex items-center gap-1.5 text-[12px] text-muted whitespace-nowrap">
              <Spinner className="w-3 h-3" />
              <span className="hidden sm:inline">Loading profile</span>
            </span>
          ) : null}
        </span>

        <a
          href={lead.linkedin_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('linkedin-profile')}
          aria-label={`${lead.full_name} on LinkedIn`}
          title="Open on LinkedIn"
          className="pressable relative mt-1 w-7 h-7 rounded-md inline-flex items-center justify-center text-muted hover:text-ink hover:bg-hover pointer-coarse:after:absolute pointer-coarse:after:-inset-2 pointer-coarse:after:content-['']"
        >
          <Linkedin className="w-4 h-4" aria-hidden="true" />
        </a>
      </div>

      {expanded && hasDetails && (
        <div className="px-4 pb-4 sm:pl-[5.75rem] space-y-2 text-[13px] leading-relaxed">
          {lead.scoring_reasoning && (
            <p className="border-l-2 border-accent pl-3">{lead.scoring_reasoning}</p>
          )}
          {lead.search_description && <p className="text-muted">{lead.search_description}</p>}
        </div>
      )}
    </li>
  );
}

// Long file names ("Jane_Doe_Resume_2026_FINAL_v3.pdf") shrink with "…" instead of wrapping
function FileName({ name }: { name: string }) {
  return (
    <span className="inline-block max-w-[12rem] sm:max-w-[22rem] truncate align-bottom font-medium" title={name}>
      {name}
    </span>
  );
}

interface ResumeBarProps {
  searchId: string;
  company: string;
  count: number;
  details: DetailsStatus;
  hasLeads: boolean;
  resumeName: string | null;
  onScored: (fileName: string) => void;
}

function ResumeBar({ searchId, company, count, details, hasLeads, resumeName, onScored }: ResumeBarProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanningName, setScanningName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUpload = hasLeads && details === 'ready' && !isScanning;

  useEffect(() => {
    if (details === 'failed') track('profiles-failed');
  }, [details]);

  // A file dropped outside the upload bar would make the browser open it and lose this search
  useEffect(() => {
    const preventFileOpen = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', preventFileOpen);
    window.addEventListener('drop', preventFileOpen);
    return () => {
      window.removeEventListener('dragover', preventFileOpen);
      window.removeEventListener('drop', preventFileOpen);
    };
  }, []);

  const handleFileUpload = async (file: File) => {
    setUploadError(null);

    // Some systems leave the type empty for dropped files, so also accept a .pdf name;
    // the Edge Function checks the file contents either way
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Please upload a PDF file.');
      return;
    }
    if (file.size > MAX_RESUME_BYTES) {
      setUploadError('That file is over 5\u00a0MB. Please upload a smaller PDF.');
      return;
    }

    setIsScanning(true);
    setScanningName(file.name);
    track('resume-upload');

    const formData = new FormData();
    formData.append('resume', file);
    // The search_id tells the backend which people to score
    formData.append('search_id', searchId);
    formData.append('target_company', company);

    try {
      // Goes through the n8n-proxy Edge Function (validation, rate limit, secret)
      const { data: result, error } = await supabase.functions.invoke('n8n-proxy/score-resume', {
        body: formData,
      });
      if (error) throw error;

      // n8n replies with a text/plain body, so the JSON may arrive as a string
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      if (parsed?.status === 'success' || parsed?.message === 'success') {
        track('resume-ranked');
        onScored(file.name);
      } else {
        throw new Error(`Unexpected response: ${JSON.stringify(parsed)}`);
      }
    } catch (error) {
      console.error('Error during resume processing:', error);
      track('resume-error');
      setUploadError(await functionErrorMessage(error, 'Your resume couldn’t be scored. Upload it again in a minute.'));
    } finally {
      setIsScanning(false);
    }
  };

  let icon: React.ReactNode;
  let message: React.ReactNode;
  if (isScanning) {
    icon = <Spinner />;
    message = (
      <>
        Scoring against <FileName name={scanningName} />… <span className="text-muted">usually under 20 seconds</span>
      </>
    );
  } else if (!hasLeads) {
    icon = <FileUp className="w-4 h-4 text-faint" aria-hidden="true" />;
    message = <span className="text-muted">Add your resume once people are found</span>;
  } else if (details === 'loading') {
    icon = <Spinner />;
    message = (
      <>
        Loading full profiles… <span className="text-muted">you can add your resume in a moment (usually 7 to 35 seconds)</span>
      </>
    );
  } else if (details === 'failed') {
    icon = <FileUp className="w-4 h-4 text-faint" aria-hidden="true" />;
    message = <span className="text-muted">Full profiles didn’t load, so these people can’t be ranked. Search again to retry.</span>;
  } else if (isDragging) {
    icon = <FileUp className="w-4 h-4 text-accent" aria-hidden="true" />;
    message = 'Drop your resume to rank them';
  } else if (resumeName) {
    icon = <Check className="w-4 h-4 text-accent" aria-hidden="true" />;
    message = (
      <>
        Ranked against <FileName name={resumeName} />
      </>
    );
  } else {
    icon = <FileUp className="w-4 h-4 text-accent" aria-hidden="true" />;
    message = (
      <>
        Rank {count === 1 ? 'this person' : `these ${count} people`} against your resume
        <span className="text-muted pointer-coarse:hidden"> · drop a PDF here</span>
      </>
    );
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Clear the input so picking the same file again (e.g. after an error) fires onChange
          e.target.value = '';
          if (file) handleFileUpload(file);
        }}
        className="hidden"
        id="resume-upload"
        disabled={!canUpload}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (canUpload) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file && canUpload) handleFileUpload(file);
        }}
        className={`flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 transition-colors ${
          isDragging ? 'border-accent bg-accent-soft' : 'border-line bg-panel'
        }`}
      >
        {/* pointer-events-none stops child elements from firing dragleave on the bar */}
        <span className="shrink-0 pointer-events-none">{icon}</span>
        {/* Announced to screen readers as it changes: loading, ready to upload, scoring, ranked */}
        <p role="status" className="flex-1 min-w-0 text-[13px] pointer-events-none">
          {message}
        </p>
        {/* A button, not a label for the hidden input: labels can't be reached with Tab */}
        {canUpload && (
          <Button
            variant={resumeName ? 'secondary' : 'primary'}
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0"
          >
            {resumeName ? (
              <>
                Replace<span className="hidden sm:inline">&nbsp;resume</span>
              </>
            ) : (
              'Choose PDF'
            )}
          </Button>
        )}
      </div>
      {uploadError && <ErrorBanner message={uploadError} />}
    </div>
  );
}
