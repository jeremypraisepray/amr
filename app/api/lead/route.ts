import { NextRequest, NextResponse } from 'next/server';

/* ---------------------------------------------------------------------------
   POST /api/lead
   Server-side lead handler for the AMR Free Roof Inspection funnel.

   - Never exposes GoHighLevel (LeadConnector) credentials to the browser.
   - Forwards a normalized payload to the GHL Inbound Webhook (Option A) at
     process.env.GHL_WEBHOOK_URL.
   - Honeypot bot trap, server-side validation, and basic in-memory rate limit.

   Runs on the Node.js runtime (needs env access + outbound fetch).
--------------------------------------------------------------------------- */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---- Basic in-memory rate limiting -----------------------------------------
// Per-instance only (serverless instances aren't shared), so this is a
// best-effort guard against bursts / naive scripts — not a distributed limiter.
const RATE_LIMIT_MAX = 5; // requests
const RATE_LIMIT_WINDOW_MS = 60_000; // per 60s per IP
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = (hits.get(ip) || []).filter((t) => t > windowStart);
  recent.push(now);
  hits.set(ip, recent);

  // Opportunistic cleanup so the Map doesn't grow unbounded.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => t <= windowStart)) hits.delete(k);
    }
  }
  return recent.length > RATE_LIMIT_MAX;
}

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

// ---- Helpers ----------------------------------------------------------------
const EMAIL_RE = /^\S+@\S+\.\S+$/;

/** Normalize a US phone number to E.164 (+1XXXXXXXXXX) when possible. */
function toE164(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  // Fall back to a "+"-prefixed digit string for anything else.
  return digits ? `+${digits}` : '';
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export async function POST(req: NextRequest) {
  // 1) Rate limit
  if (rateLimited(clientIp(req))) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests. Please wait a moment and try again.' },
      { status: 429 },
    );
  }

  // 2) Parse body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  }

  // 3) Honeypot — bots fill the hidden "company" field. Pretend success and drop.
  if (str(body.company)) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // 4) Server-side validation (mirrors the client rules)
  const first = str(body.first);
  const last = str(body.last);
  const email = str(body.email);
  const phoneRaw = str(body.phone);
  const address = str(body.address);
  const city = str(body.city);
  const zip = str(body.zip);
  const concern = str(body.concern);
  const timing = str(body.timing);
  const offers = Array.isArray(body.offers) ? body.offers.filter((o) => typeof o === 'string') : [];
  const urgentLeak = body.urgentLeak === true || concern === 'Active leak or water stain';

  if (!first) return bad('Please enter your first name.');
  if (!last) return bad('Please enter your last name.');
  if (phoneRaw.replace(/\D/g, '').length < 10) return bad('Please enter a valid mobile phone number.');
  if (!EMAIL_RE.test(email)) return bad('Please enter a valid email address.');
  if (address.length < 5) return bad('Please enter your street address.');
  if (!/^\d{5}$/.test(zip)) return bad('Please enter a valid 5-digit ZIP code.');

  const phone = toE164(phoneRaw);

  // 5) Build the GHL payload (matches the handoff's documented shape)
  const payload = {
    firstName: first,
    lastName: last,
    phone,
    email,
    address1: address,
    city,
    postalCode: zip,
    state: 'TX',
    concern,
    timing,
    offerInterests: offers.join(', '),
    urgentLeak,
    source: 'Free Inspection Funnel',
  };

  // 6) Forward to GoHighLevel
  const webhookUrl = process.env.GHL_WEBHOOK_URL;
  if (!webhookUrl) {
    // Misconfiguration: fail loudly in logs, but don't leak details to the client.
    console.error('GHL_WEBHOOK_URL is not set — lead was not forwarded.');
    return NextResponse.json(
      { ok: false, error: 'We can’t submit right now. Please call us and we’ll get you scheduled.' },
      { status: 500 },
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error('GHL webhook returned non-OK status:', res.status);
      return NextResponse.json(
        { ok: false, error: 'Something went wrong sending your request. Please try again.' },
        { status: 502 },
      );
    }
  } catch (err) {
    console.error('Failed to reach GHL webhook:', err);
    return NextResponse.json(
      { ok: false, error: 'Something went wrong sending your request. Please try again.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

function bad(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}
