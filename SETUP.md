# Setup & Deploy — AMR Free Roof Inspection Funnel

A production Next.js (App Router, TypeScript) lead-capture funnel for American
Master Roofing. The multi-step form submits to a serverless route
(`app/api/lead/route.ts`) that forwards leads to GoHighLevel (LeadConnector).
GoHighLevel is **never** called from the browser.

---

## 1. Run locally

```bash
npm install
cp .env.example .env.local     # then fill in GHL_WEBHOOK_URL (step 3)
npm run dev                    # http://localhost:3000
```

Production build check:

```bash
npm run build && npm start
```

---

## 2. Push to GitHub

The project already lives in this repo. To publish it to a fresh GitHub repo
instead, from the project root:

```bash
git init                       # only if not already a git repo
git add -A
git commit -m "AMR free roof inspection funnel"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

`.env*.local` is gitignored — real secrets never get committed.

---

## 3. Create the GoHighLevel Inbound Webhook (Option A — recommended)

1. In GoHighLevel: **Automation → Workflows → Create Workflow**.
2. Add a trigger: **Inbound Webhook**. Copy the generated webhook URL — this is
   your `GHL_WEBHOOK_URL`.
3. Submit one test lead through the funnel (or `npm run dev` locally with the URL
   set), then in the workflow trigger click **"Check for new requests"** to
   capture the sample payload and map the fields below.
4. Add workflow actions:
   - **Create/Update Contact** (map `firstName`, `lastName`, `phone`, `email`,
     `address1`, `city`, `postalCode`, `state`).
   - **Add Tag** `inspection-request`.
   - **If/Else** on `urgentLeak = true` → **Add Tag** `active-leak-priority`.
   - Optional: **Create Opportunity** in your pipeline, plus an internal
     notification / SMS autoresponder.

The route POSTs this JSON shape to the webhook:

```json
{
  "firstName": "...", "lastName": "...", "phone": "+1XXXXXXXXXX", "email": "...",
  "address1": "...", "city": "...", "postalCode": "...", "state": "TX",
  "concern": "...", "timing": "...", "offerInterests": "a, b, c",
  "urgentLeak": true, "source": "Free Inspection Funnel"
}
```

> Phone is normalized to E.164 (`+1XXXXXXXXXX`) server-side before it is sent.

**Option B (API v2 direct upsert)** is documented in the design handoff. If you
prefer it, swap the webhook `fetch` in `app/api/lead/route.ts` for a call to
`POST https://services.leadconnectorhq.com/contacts/upsert` with
`Authorization: Bearer <GHL_TOKEN>` and `Version: 2021-07-28`, and set
`GHL_TOKEN` + `GHL_LOCATION_ID` as env vars instead of `GHL_WEBHOOK_URL`.

---

## 4. Import into Vercel

1. Go to **vercel.com → Add New → Project** and import the GitHub repo.
2. Framework preset auto-detects **Next.js**. Leave build/output defaults
   (already pinned in `vercel.json`).
3. Under **Environment Variables**, add:

   | Name              | Value                                   | Environments               |
   | ----------------- | --------------------------------------- | -------------------------- |
   | `GHL_WEBHOOK_URL` | *(your GHL Inbound Webhook URL)*        | Production, Preview, Dev   |

4. Click **Deploy**.

To change env vars later: **Project → Settings → Environment Variables**, then
**redeploy** (env changes require a new deployment to take effect).

---

## 5. Point your domain at Vercel

1. In Vercel: **Project → Settings → Domains → Add**, e.g.
   `inspect.americanmasterroofing.com`.
2. Vercel shows the DNS record to create. For a subdomain, add a **CNAME**:

   | Type  | Name      | Value                  |
   | ----- | --------- | ---------------------- |
   | CNAME | `inspect` | `cname.vercel-dns.com` |

   (For a root/apex domain, use the **A record** Vercel provides instead.)
3. Add the record at your DNS provider. Vercel verifies and issues HTTPS
   automatically — usually within minutes.
4. Optional: set `NEXT_PUBLIC_SITE_URL` to the final URL (e.g.
   `https://inspect.americanmasterroofing.com`) so page metadata uses it, then
   redeploy.

---

## Notes

- **Images:** large source PNGs were converted to WebP under `public/assets/`
  (`mobile1` 6.7 MB → ~0.36 MB, etc.). `next/image` further serves AVIF/WebP at
  responsive sizes per request. On Vercel the `sharp` optimizer is provided
  automatically — no action needed.
- **Anti-spam:** the API route includes a hidden honeypot field, full
  server-side validation, and a basic per-IP in-memory rate limit (5 requests /
  60s). The rate limit is per serverless instance (best-effort); for stronger
  protection put the route behind Vercel's rate limiting / a KV-backed limiter.
- **Draft persistence:** in-progress answers auto-save to `localStorage`
  (`amr-funnel-draft`) and clear on successful submit.
