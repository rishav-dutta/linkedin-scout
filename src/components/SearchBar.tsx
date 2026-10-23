import { CornerDownLeft, Search } from 'lucide-react';
import { forwardRef } from 'react';
import { Button } from './Button';
import { Spinner } from './Feedback';

interface SearchBarProps {
  company: string;
  role: string;
  onCompanyChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onSubmit: () => void;
  isSearching: boolean;
  // False once results are showing for these inputs, so the next step (adding a resume) leads
  primary: boolean;
}

// One bar with two fields, like a command bar. The ref goes to the company
// field so "/" can focus it from anywhere.
export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(function SearchBar(
  { company, role, onCompanyChange, onRoleChange, onSubmit, isSearching, primary },
  companyRef
) {
  const fieldClass =
    'min-w-0 flex-1 bg-transparent px-3 py-2.5 placeholder:text-muted focus:outline-hidden';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (company.trim() && role.trim() && !isSearching) onSubmit();
      }}
      className="flex flex-col sm:flex-row sm:items-center rounded-lg border border-line bg-bg focus-within:border-faint transition-colors"
    >
      <div className="flex items-center flex-1 min-w-0 pl-3">
        <Search className="w-4 h-4 text-faint shrink-0" aria-hidden="true" />
        <label htmlFor="company" className="sr-only">
          Company
        </label>
        <input
          ref={companyRef}
          id="company"
          name="company"
          value={company}
          onChange={(e) => onCompanyChange(e.target.value)}
          placeholder="Company, e.g. Google"
          // "organization" would suggest the visitor's own employer, not the one they're researching
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="next"
          className={fieldClass}
          required
        />
      </div>
      <div className="flex items-center flex-1 min-w-0 border-t sm:border-t-0 sm:border-l border-line">
        <label htmlFor="role" className="sr-only">
          Role or team
        </label>
        <input
          id="role"
          name="role"
          value={role}
          onChange={(e) => onRoleChange(e.target.value)}
          placeholder="Role or team, e.g. Product"
          autoComplete="off"
          enterKeyHint="search"
          className={fieldClass}
          required
        />
      </div>
      <div className="p-1.5 border-t sm:border-t-0 border-line">
        <Button type="submit" variant={primary ? 'primary' : 'secondary'} disabled={isSearching} className="w-full sm:w-auto">
          {isSearching ? (
            <>
              <Spinner className="w-3.5 h-3.5" />
              Finding…
            </>
          ) : (
            <>
              Find people
              <CornerDownLeft className="w-3.5 h-3.5 opacity-60 hidden sm:block" aria-hidden="true" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
});
