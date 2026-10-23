import { ArrowRight } from 'lucide-react';

// Filling the form from an example doesn't run a search, so it costs nothing
const EXAMPLES = [
  { company: 'Airtable', role: 'Product Manager' },
  { company: 'Stripe', role: 'Data Scientist' },
  { company: 'Notion', role: 'Designer' },
];

export function IdleState({ onPick }: { onPick: (company: string, role: string) => void }) {
  return (
    <div className="rounded-lg border border-line bg-bg fade-in">
      <div className="px-4 py-4 border-b border-line">
        <h2 className="text-[15px] font-semibold">Find who to reach out to at a company</h2>
        <p className="mt-1 text-muted text-[13px] max-w-xl">
          Search a company and a role to see who works there. Then add your resume, and everyone is ranked by how
          closely their background matches yours, with a reason for each score.
        </p>
      </div>
      <div className="px-4 pt-3 pb-1 text-[12px] text-muted">Try an example</div>
      <ul className="pb-2">
        {EXAMPLES.map((example) => (
          <li key={example.company}>
            <button
              type="button"
              onClick={() => onPick(example.company, example.role)}
              className="group w-full flex items-center justify-between gap-3 px-4 py-2 text-left hover:bg-hover"
            >
              <span>
                {example.company} <span className="text-faint">·</span> <span className="text-muted">{example.role}</span>
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-faint group-hover:text-ink" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
