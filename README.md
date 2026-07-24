# AMR Free Roof Inspection Funnel

A single-purpose, form-only lead-capture funnel for **American Master Roofing**
(Houston, TX). The multi-step form *is* the site — there is no scrolling
marketing page. Leads are delivered to GoHighLevel (LeadConnector) via a
serverless API route.

Built with **Next.js (App Router) + TypeScript**, `next/font/google`
(Barlow, Barlow Condensed, IBM Plex Mono), and `next/image`.

## Flow

`intro → concern → timing → address → offers → contact → confirmation`

Single-select steps auto-advance; the address and contact steps are real
`<form>`s with plain-language validation and Enter-to-submit. In-progress
answers auto-save to `localStorage` (`amr-funnel-draft`) and clear on submit.

## Structure

| Path | What it is |
| --- | --- |
| `app/layout.tsx` | Root layout, fonts, metadata |
| `app/page.tsx` | Renders the funnel |
| `app/globals.css` | Reset, keyframes, responsive layout, focus/reduced-motion |
| `components/Funnel.tsx` | The one client component holding all funnel state |
| `app/api/lead/route.ts` | Serverless lead handler → GoHighLevel |
| `public/assets/` | Optimized WebP imagery |

## Lead submission

The browser POSTs the form state to `/api/lead`. The route validates
server-side, drops honeypot/bot submissions, rate-limits per IP, normalizes the
phone to E.164, and forwards a mapped payload to `process.env.GHL_WEBHOOK_URL`.
GoHighLevel credentials are never exposed to the client.

## Getting started

```bash
npm install
cp .env.example .env.local   # set GHL_WEBHOOK_URL
npm run dev
```

See **[SETUP.md](./SETUP.md)** for GoHighLevel setup, GitHub, Vercel, env vars,
and pointing your domain.

## Accessibility

Real form semantics with labels on every input, `aria-live` error announcements,
visible focus rings, 44px minimum hit targets, and full animation opt-out under
`prefers-reduced-motion`.
