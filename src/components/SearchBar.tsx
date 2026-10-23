import { CornerDownLeft, Search } from 'lucide-react';
import { forwardRef } from 'react';
import { Spinner } from './Feedback';

interface SearchBarProps {
  company: string;
  role: string;
  onCompanyChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onSubmit: () => void;
  isSearching: boolean;
}

// One bar with two fields, like a command bar. The ref goes to the company
// field so "/" can focus it from anywhere.
export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(function SearchBar(
  { company, role, onCompanyChange, onRoleChange, onSubmit, isSearching },
  companyRef
) {
  const fieldClass =
    'min-w-0 flex-1 bg-transparent px-3 py-2.5 placeholder:text-faint focus:outline-hidden';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (company.trim() && role.trim() && !isSearching) onSubmit();
      }}
      className="flex flex-col sm:flex-row sm:items-center rounded-lg border border-line bg-bg shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-within:border-faint transition-colors"
    >
      <div className="flex items-center flex-1 min-w-0 pl-3">
        <Search className="w-4 h-4 text-faint shrink-0" aria-hidden="true" />
        <label htmlFor="company" className="sr-only">
          Company
        </label>
        <input
          ref={companyRef}
          id="company"
          value={company}
          onChange={(e) => onCompanyChange(e.target.value)}
          placeholder="Company, e.g. Google"
          autoComplete="organization"
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
          value={role}
          onChange={(e) => onRoleChange(e.target.value)}
          placeholder="Role or team, e.g. Product"
          enterKeyHint="search"
          className={fieldClass}
          required
        />
      </div>
      <div className="p-1.5 border-t sm:border-t-0 border-line">
        <button
          type="submit"
          disabled={isSearching}
          className="pressable w-full sm:w-auto h-8 px-3 rounded-md bg-ink text-on-ink text-[13px] font-medium inline-flex items-center justify-center gap-2 disabled:opacity-70"
        >
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
        </button>
      </div>
    </form>
  );
});
