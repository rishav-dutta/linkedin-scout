// Anonymous event counts in GoatCounter (linkedin-scout.goatcounter.com, loaded in index.html).
// Send fixed event names only: never the searched company, a file name or anything typed.
// A no-op when count.js hasn't loaded yet, is blocked, or the page runs on localhost.
interface GoatCounter {
  count?: (vars: { path: string; event: boolean }) => void;
}

export type AnalyticsEvent =
  | 'search'
  | 'search-no-results'
  | 'search-error'
  | 'example-picked'
  | 'profiles-failed'
  | 'resume-upload'
  | 'resume-ranked'
  | 'resume-error'
  | 'linkedin-profile'
  | 'docs-link'
  | 'github-link'
  | 'author-linkedin';

export function track(event: AnalyticsEvent) {
  (window as Window & { goatcounter?: GoatCounter }).goatcounter?.count?.({ path: event, event: true });
}
