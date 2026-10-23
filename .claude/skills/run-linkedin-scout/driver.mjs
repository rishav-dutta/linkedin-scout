#!/usr/bin/env node
// Drives the LinkedIn Scout web app in Chromium with the backend MOCKED by default.
// Every real search spends Apify credits and counts against the n8n-proxy rate
// limit, so the Supabase Edge Function and RPC calls are answered here unless --live.
//
//   node .claude/skills/run-linkedin-scout/driver.mjs [options]
//
//   --url <url>          app to drive (default http://localhost:5173)
//   --data demo|worst    demo people, or worst-case data (long/odd names, broken photo,
//                        unscored person, score 0 and 100). Default demo.
//   --device desktop|phone|both   (default desktop)
//   --scheme light|dark  (default light)
//   --company <name>     company to search (special values below)
//   --out <dir>          screenshots folder (default /tmp/linkedin-scout-shots)
//   --headed             open a visible window and leave it open for manual clicking
//   --live               DON'T mock: real search + scoring (spends Apify/Gemini credits)
//
// Mocked special companies: "nobody" -> {"status":"no_results"};
// "ratelimit" -> HTTP 429 with an error message, like the real Edge Function.

import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const flag = (name) => args.includes(`--${name}`);

const url = opt('url', 'http://localhost:5173');
const dataName = opt('data', 'demo');
const device = opt('device', 'desktop');
const scheme = opt('scheme', 'light');
const out = opt('out', '/tmp/linkedin-scout-shots');
const headed = flag('headed');
const live = flag('live');

// Playwright from the project if present, else the global install
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  const require = createRequire(execSync('npm root -g').toString().trim() + '/');
  ({ chromium } = require('playwright'));
}

const P = (id, o) => ({
  id, company: 'Acme Cloud', linkedin_url: `https://www.linkedin.com/in/sample-${id}`, profile_image_url: null,
  search_description: '', similarity_score: 0, scoring_reasoning: null,
  created_at: `2026-10-06T00:00:${String(id).padStart(2, '0')}Z`, enriched: true, ...o,
});
const DATA = {
  demo: [
    P(1, { full_name: 'Maya Chen', job_title: 'Senior Product Manager, Data Platform at Acme Cloud', search_description: 'Leads the data platform roadmap. Previously product at a B2B analytics startup; background in SQL and experimentation.', similarity_score: 88, scoring_reasoning: 'Maya Chen and the candidate both own B2B data products end to end, with hands-on SQL, experimentation and roadmap work. Her move from a startup into platform product mirrors the candidate\'s path, which makes her a strong first contact.' }),
    P(2, { full_name: 'Daniel Okafor', job_title: 'Product Manager, Growth at Acme Cloud', search_description: 'Runs onboarding and activation experiments for self-serve customers.', similarity_score: 74, scoring_reasoning: 'Daniel Okafor\'s growth and activation work overlaps with the candidate\'s experimentation experience, though his focus is self-serve onboarding rather than platform features.' }),
    P(3, { full_name: 'Priya Raman', job_title: 'Group Product Manager at Acme Cloud', search_description: 'Manages a team of PMs across integrations and the partner ecosystem.', similarity_score: 66, scoring_reasoning: 'Priya Raman is more senior and focused on partner integrations, so the overlap is mainly in cross-functional leadership.' }),
    P(4, { full_name: 'Lucas Martin', job_title: 'Technical Program Manager at Acme Cloud', search_description: 'Coordinates infrastructure launches across engineering teams.', similarity_score: 52, scoring_reasoning: 'Lucas Martin\'s program management role shares delivery and coordination skills with the candidate, but has less product ownership.' }),
  ],
  worst: [
    P(1, { full_name: 'Aleksandra Wiśniewska-Kowalczyk', job_title: 'Senior Product Manager, Enterprise Platform & Developer Experience | Ex-Google, Ex-Stripe | Building AI-powered workflows at International Business Machines Corporation', company: 'International Business Machines Corporation', profile_image_url: 'https://broken.invalid/photo.jpg', search_description: 'Leads the enterprise platform and developer experience org (APIs, SDKs, admin console and billing), previously led AI-assisted workflow products at two Series B startups and spent four years in consulting before moving into product.', similarity_score: 100, scoring_reasoning: 'Closest match of anyone here: platform ownership, developer-facing APIs, enterprise billing and a consulting-to-product path that mirrors the candidate\'s almost exactly.' }),
    P(2, { full_name: 'Jo', job_title: '', similarity_score: 0, scoring_reasoning: 'Too little profile information to compare.' }),
    P(3, { full_name: 'Nguyễn Thị Minh Khai', job_title: 'PM', enriched: false }),
    P(4, { full_name: 'José María García de la Fuente III', job_title: 'Group Product Manager at International Business Machines Corporation', company: 'International Business Machines Corporation', similarity_score: 7, scoring_reasoning: 'Very different domain.' }),
    P(5, { full_name: '李华 (Hua Li)', job_title: '产品经理 · Product Manager, Cloud', similarity_score: 55, scoring_reasoning: 'Some overlap in cloud product work.' }),
    P(6, { full_name: 'Dr. Bartholomew Fitzgerald-Montgomery, PhD, MBA, PMP', job_title: 'Principal Technical Program Manager', similarity_score: 61, scoring_reasoning: 'Strong program overlap.' }),
  ],
};
const people = DATA[dataName] ?? DATA.demo;
const company = opt('company', dataName === 'worst' ? 'International Business Machines Corporation' : 'Acme Cloud');
const role = dataName === 'worst' ? 'Senior Staff Product Manager, Machine Learning Platform' : 'Product Manager';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mockBackend(ctx) {
  // Full profiles "arrive" 3.5 s after the first read. Time-based on purpose: React
  // StrictMode runs effects twice in dev, so counting calls skips the loading state.
  let firstRead = 0;
  await ctx.route('**/_vercel/insights/**', (r) => r.abort());
  await ctx.route('https://broken.invalid/**', (r) => r.abort());
  await ctx.route('**/functions/v1/n8n-proxy/*', async (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: cors });
    const isSearch = r.request().url().includes('find-leads');
    const searched = isSearch ? (r.request().postDataJSON()?.company_name ?? '') : '';
    await sleep(isSearch ? 500 : 1000);
    if (/ratelimit/i.test(searched)) {
      return r.fulfill({ status: 429, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ error: 'Too many searches from your connection. Please try again in an hour.' }) });
    }
    const status = /^nobody$/i.test(searched) ? 'no_results' : 'success';
    if (isSearch) firstRead = 0;
    r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/plain' }, body: JSON.stringify({ status }) });
  });
  await ctx.route('**/rest/v1/rpc/get_leads_for_search**', (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: cors });
    if (!firstRead) firstRead = Date.now();
    const byScore = r.request().url().includes('similarity_score.desc');
    const loading = !byScore && Date.now() - firstRead < 3500;
    const rows = people.map((p) => ({ ...p, enriched: loading ? false : p.enriched, scoring_reasoning: byScore ? p.scoring_reasoning : null }));
    if (byScore) rows.sort((a, c) => (c.similarity_score ?? 0) - (a.similarity_score ?? 0));
    r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(rows) });
  });
}

const DEVICES = {
  desktop: { viewport: { width: 1280, height: 860 } },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

mkdirSync(out, { recursive: true });
if (live) console.warn('LIVE MODE: this runs a real search and scoring (Apify + Gemini credits, rate limits).');
const browser = await chromium.launch({ headless: !headed });

if (headed) {
  const ctx = await browser.newContext({ viewport: null, colorScheme: scheme });
  if (!live) await mockBackend(ctx);
  const page = await ctx.newPage();
  await page.goto(url);
  console.log(`Window open at ${url}${live ? '' : ' (mocked backend)'}. Close it to exit.`);
  page.on('close', () => browser.close().then(() => process.exit(0)));
} else {
  let failed = false;
  for (const name of device === 'both' ? ['desktop', 'phone'] : [device]) {
    const ctx = await browser.newContext({ ...DEVICES[name], colorScheme: scheme });
    if (!live) await mockBackend(ctx);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && !m.text().includes('ERR_FAILED') && errors.push(m.text()));
    const slug = opt('company') ? `-${company.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : '';
    const tag = `${dataName}${slug}-${name}-${scheme}`;
    const shot = async (step) => {
      const path = `${out}/${tag}-${step}.png`;
      await page.screenshot({ path, fullPage: true });
      console.log('  screenshot', path);
    };
    try {
      console.log(`[${tag}]`);
      await page.goto(url);
      await page.waitForSelector('#company');
      await shot('1-idle');
      await page.fill('#company', company);
      await page.fill('#role', role);
      await page.click('button[type=submit]');
      // Error paths end here: no-results or rate-limit message under the search bar
      const outcome = await Promise.race([
        page.waitForSelector('text=Loading full profiles', { timeout: 20000 }).then(() => 'loading'),
        page.waitForSelector('[role=alert]', { timeout: 20000 }).then(() => 'alert'),
      ]);
      if (outcome === 'alert') {
        console.log('  alert:', await page.locator('[role=alert]').innerText());
        await shot('2-alert');
        // The app console.errors failed requests on purpose; expected on this path
        errors.length = 0;
      } else {
        await shot('2-loading');
        await page.waitForSelector('text=Choose PDF', { timeout: live ? 180000 : 15000 });
        await shot('3-found');
        // The file input is hidden; setInputFiles works on it directly
        await page.setInputFiles('#resume-upload', { name: 'resume.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%mock\n') });
        await page.waitForSelector('text=Ranked against', { timeout: live ? 120000 : 15000 });
        await shot('4-ranked');
        if (name === 'desktop') {
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('Enter');
          await shot('5-keyboard');
        }
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      console.log(`  horizontal overflow: ${overflow}px, console errors: ${errors.length ? errors.join(' | ') : 'none'}`);
      if (overflow > 0 || errors.length) failed = true;
    } catch (e) {
      failed = true;
      console.error('  FAILED:', e.message.split('\n')[0]);
      await shot('error').catch(() => {});
    }
    await ctx.close();
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
}
