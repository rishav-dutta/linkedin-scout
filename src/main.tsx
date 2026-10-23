import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { inject } from '@vercel/analytics';
import './index.css';

// Vercel Web Analytics (enabled in the Vercel project): page views, no cookies
inject();

const root = createRoot(document.getElementById('root')!);

// The Supabase client throws as soon as it's created without these, which left a
// blank page, so check them before loading the app (see .env.example)
const missingEnv = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter(
  (name) => !import.meta.env[name]
);

if (missingEnv.length > 0) {
  root.render(
    <div className="min-h-dvh bg-bg flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-lg text-center">
        <h1 className="text-lg font-semibold text-ink mb-2">App not configured</h1>
        <p className="text-muted">
          Missing environment variables: {missingEnv.join(', ')}. Add them to .env.local
          (development) or the Vercel project settings, then rebuild.
        </p>
      </div>
    </div>
  );
} else {
  import('./App.tsx').then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  });
}
