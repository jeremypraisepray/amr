/* ---------------------------------------------------------------------------
   Marketing attribution capture for the AMR Free Roof Inspection funnel.

   - Reads UTM params + ad-platform click IDs off the landing-page URL.
   - Persists the FIRST touch in localStorage for 90 days: once a visitor has an
     unexpired record, later visits never overwrite it. Someone who first lands
     from Meta, leaves, and returns directly stays attributed to Meta.
   - Maps utm_source into the agreed source vocabulary (lead_source), which is
     what GoHighLevel reports on.

   Browser-only (touches window/localStorage) — call from a useEffect.
--------------------------------------------------------------------------- */

export type Attribution = {
  lead_source: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  landing_page: string;
  click_id: string;
  referrer: string;
};

export const EMPTY_ATTRIBUTION: Attribution = {
  lead_source: '',
  utm_source: '',
  utm_medium: '',
  utm_campaign: '',
  utm_content: '',
  utm_term: '',
  landing_page: '',
  click_id: '',
  referrer: '',
};

const STORAGE_KEY = 'amr-attribution';
const TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const VERSION = 1;

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

// Ad-platform click IDs, in priority order (first one present wins).
const CLICK_ID_KEYS = ['fbclid', 'ttclid', 'gclid', 'msclkid'] as const;

/** utm_source -> the source vocabulary GoHighLevel reports on. */
const SOURCE_MAP: Record<string, string> = {
  meta: 'meta-landing-page',
  facebook: 'meta-landing-page',
  tiktok: 'tiktok-landing-page',
  google: 'google-landing-page',
};

const DEFAULT_SOURCE = 'organic-direct';

/** Map a raw utm_source into the agreed vocabulary. Unknown/absent -> organic-direct. */
export function mapLeadSource(utmSource: string): string {
  return SOURCE_MAP[utmSource.trim().toLowerCase()] || DEFAULT_SOURCE;
}

type StoredRecord = { v: number; ts: number; data: Attribution };

function isFresh(rec: StoredRecord): boolean {
  return (
    rec.v === VERSION &&
    typeof rec.ts === 'number' &&
    Date.now() - rec.ts < TTL_MS &&
    !!rec.data &&
    typeof rec.data === 'object'
  );
}

/** Read the stored first-touch record, or null if absent, malformed, or expired. */
function readStored(): Attribution | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as StoredRecord;
    if (!isFresh(rec)) return null;
    return { ...EMPTY_ATTRIBUTION, ...rec.data };
  } catch {
    return null; // private mode / corrupt JSON
  }
}

function writeStored(data: Attribution): void {
  try {
    const rec: StoredRecord = { v: VERSION, ts: Date.now(), data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

/** Read the current URL's attribution params. */
function readFromUrl(): Attribution {
  const params = new URLSearchParams(window.location.search);
  const get = (k: string) => (params.get(k) || '').trim();

  const utm_source = get('utm_source');

  let click_id = '';
  for (const k of CLICK_ID_KEYS) {
    const v = get(k);
    if (v) {
      click_id = v;
      break;
    }
  }

  // landing_page = current page URL with the query string stripped.
  const landing_page = `${window.location.origin}${window.location.pathname}`;

  // Ignore self-referrals — a same-origin referrer isn't a traffic source.
  let referrer = '';
  try {
    const ref = document.referrer || '';
    if (ref && new URL(ref).origin !== window.location.origin) referrer = ref;
  } catch {
    /* malformed referrer */
  }

  return {
    lead_source: mapLeadSource(utm_source),
    utm_source,
    utm_medium: get('utm_medium'),
    utm_campaign: get('utm_campaign'),
    utm_content: get('utm_content'),
    utm_term: get('utm_term'),
    landing_page,
    click_id,
    referrer,
  };
}

/**
 * Return this visitor's FIRST-TOUCH attribution, capturing and storing it on the
 * first visit. An unexpired stored record is returned as-is and never overwritten,
 * so later visits (direct or from another campaign) don't clobber the original.
 */
export function captureAttribution(): Attribution {
  if (typeof window === 'undefined') return EMPTY_ATTRIBUTION;

  const stored = readStored();
  if (stored) return stored;

  const fresh = readFromUrl();
  writeStored(fresh);
  return fresh;
}
