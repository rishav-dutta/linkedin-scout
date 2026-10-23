import { AlertCircle } from 'lucide-react';
import { useState } from 'react';

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger text-left"
    >
      <AlertCircle className="w-4 h-4 mt-px shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`${className} inline-block rounded-full border-2 border-line border-t-accent animate-spin [animation-duration:600ms]`}
    />
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

const HONORIFICS = /^(dr|mr|mrs|ms|mx|prof|sir)\.?$/i;
const SUFFIXES = /^(jr|sr|ii|iii|iv|v)\.?$/i;

// First and last word, by grapheme so accented letters and emoji stay whole.
// Skips "Dr." and "III", credentials after a comma, and bracketed nicknames.
function initialsOf(name: string): string {
  const core = name.split(',')[0].replace(/\([^)]*\)/g, ' ');
  const words = core
    .trim()
    .split(/\s+/)
    .filter((word) => word && !HONORIFICS.test(word) && !SUFFIXES.test(word));
  if (words.length === 0) return '?';
  const first = (word: string) => {
    // Older browsers without Intl.Segmenter fall back to the first code point
    const letter =
      typeof Intl.Segmenter === 'function'
        ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(word)][0]?.segment
        : Array.from(word)[0];
    return (letter ?? '').toUpperCase();
  };
  return words.length === 1 ? first(words[0]) : first(words[0]) + first(words[words.length - 1]);
}

// Profile photo, or the person's initials when there's no photo or it fails to load
export function Avatar({ name, src, className = 'w-8 h-8 text-[11px]' }: { name: string; src: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={`${className} rounded-full shrink-0 overflow-hidden bg-hover text-muted font-medium flex items-center justify-center`}>
      {src && !failed ? (
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{initialsOf(name)}</span>
      )}
    </div>
  );
}
