import crypto from 'node:crypto';

/* ---------------------------------------------------------------------------
   Meta Conversions API — server-side "Lead" event.

   Called from /api/lead only AFTER the lead was forwarded to GoHighLevel
   successfully. Deduplicates with the browser Pixel Lead via event_id
   (metaEventId generated in the browser, sent with the lead).

   - Token comes only from process.env.META_CAPI_ACCESS_TOKEN (never committed).
   - Never throws; never logs personal data or the token.
--------------------------------------------------------------------------- */

const PIXEL_ID = '1326142483056853';
const GRAPH_VERSION = 'v26.0'; // Current Graph API version as of Nov 2026 (released 2026-07-29).

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

const hashed = (value: unknown): string[] | undefined => {
  const clean = String(value ?? '').trim().toLowerCase();
  return clean ? [sha256(clean)] : undefined;
};

const hashedPhone = (value: unknown): string[] | undefined => {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 10) digits = '1' + digits;
  return digits ? [sha256(digits)] : undefined;
};

const hashedCity = (value: unknown) => hashed(String(value ?? '').replace(/[^a-zA-Z]/g, ''));
const hashedZip = (value: unknown) => hashed(String(value ?? '').replace(/\D/g, '').slice(0, 5));

const s = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function sendMetaLead(body: Record<string, unknown>, headers: Headers): Promise<void> {
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!token) {
    console.error('Meta CAPI skipped: META_CAPI_ACCESS_TOKEN is not set');
    return;
  }
  const eventId = s(body.metaEventId, 100);
  if (!eventId) {
    console.error('Meta CAPI skipped: metaEventId is missing');
    return;
  }

  const ip = (headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const ua = headers.get('user-agent') || '';

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: 'Lead',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'website',
        event_source_url: s(body.pageUrl, 2000) || undefined,
        user_data: {
          em: hashed(body.email),
          ph: hashedPhone(body.phone),
          fn: hashed(body.first),
          ln: hashed(body.last),
          ct: hashedCity(body.city),
          st: hashed('tx'),
          zp: hashedZip(body.zip),
          country: hashed('us'),
          client_ip_address: ip || undefined,
          client_user_agent: ua || undefined,
          fbp: s(body.fbp, 200) || undefined,
          fbc: s(body.fbc, 500) || undefined,
        },
        custom_data: { content_name: 'Free Roof Inspection' },
      },
    ],
  };

  if (process.env.META_TEST_EVENT_CODE) {
    payload.test_event_code = process.env.META_TEST_EVENT_CODE;
  }

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) console.error('Meta CAPI request failed with status', res.status);
  } catch (err) {
    console.error('Meta CAPI request error:', (err as Error)?.name || 'unknown');
  }
}
