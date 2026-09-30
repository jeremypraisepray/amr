/* ---------------------------------------------------------------------------
   Marketing attribution capture for the AMR Free Roof Inspection funnel.

   Tracks BOTH ends of the journey and sends both to GoHighLevel:

   - FIRST touch (utm_*, lead_source): the campaign that introduced this
     visitor. Written once and never overwritten inside the 90-day window, so
     someone who first lands from Meta stays attributed to Meta even if they
     return directly or via another campaign later.
   - LAST touch (last_utm_*, last_lead_source): the most recent campaign click.
     Updated whenever the visitor arrives with a campaign signal on the URL.
     A direct return is not a touch and leaves it alone.

   First visit: both are the same. Together they answer "which channel found
   this homeowner" and "which ad brought them back to convert".

   Browser-only (touches window/localStorage) — call from a useEffect.
--------------------------------------------------------------------------- */

/** One arrival's worth of attribution. */
export type Touch = {
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

/** The flat shape sent to /api/lead: first touch at top level, last touch prefixed. */
export type Attribution = Touch & {
  last_lead_source: string;
  last_utm_source: string;
  last_utm_medium: string;
  last_utm_campaign: string;
  last_utm_content: string;
  last_utm_term: string;
  last_click_id: string;
};

const EMPTY_TOUCH: Touch = {
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

export const EMPTY_ATTRIBUTION: Attribution = {
  ...EMPTY_TOUCH,
  last_lead_source: '',
  last_utm_source: '',
  last_utm_medium: '',
  last_utm_campaign: '',
  last_utm_content: '',
  last_utm_term: '',
  last_click_id: '',
};

const STORAGE_KEY = 'amr-attribution';
const TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days, measured from the FIRST touch
const VERSION = 2;

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

/**
 * Did this arrival carry a campaign signal — any utm_* param or a click ID?
 * Direct and organic arrivals don't count as a touch, so they never displace
 * the recorded last touch.
 */
function hasCampaignSignal(t: Touch): boolean {
  return !!(t.utm_source || t.utm_medium || t.utm_campaign || t.utm_content || t.utm_term || t.click_id);
}

type Record2 = { v: 2; ts: number; first: Touch; last: Touch };
type Record1 = { v: 1; ts: number; data: Touch }; // pre-last-touch format
type Stored = {
  ts: number;
  first: Touch;
  last: Touch;
  /** True when the record was read from the older v1 format and needs rewriting. */
  migrated?: boolean;
};

/** Read the stored record, or null if absent, malformed, or past the 90-day window. */
function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as Record1 | Record2;
    if (!rec || typeof rec.ts !== 'number' || Date.now() - rec.ts >= TTL_MS) return null;

    // v1 records only stored one touch — treat it as both first and last.
    if (rec.v === 1 && rec.data && typeof rec.data === 'object') {
      const t = { ...EMPTY_TOUCH, ...rec.data };
      return { ts: rec.ts, first: t, last: t, migrated: true };
    }
    if (rec.v === VERSION && rec.first && rec.last) {
      return {
        ts: rec.ts,
        first: { ...EMPTY_TOUCH, ...rec.first },
        last: { ...EMPTY_TOUCH, ...rec.last },
      };
    }
    return null;
  } catch {
    return null; // private mode / corrupt JSON
  }
}

function writeStored(s: Stored): void {
  try {
    const rec: Record2 = { v: VERSION, ts: s.ts, first: s.first, last: s.last };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

/** Read this arrival's attribution off the current URL. */
function readFromUrl(): Touch {
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

/** Flatten a first/last pair into the payload shape. */
function flatten(first: Touch, last: Touch): Attribution {
  return {
    ...first,
    last_lead_source: last.lead_source,
    last_utm_source: last.utm_source,
    last_utm_medium: last.utm_medium,
    last_utm_campaign: last.utm_campaign,
    last_utm_content: last.utm_content,
    last_utm_term: last.utm_term,
    last_click_id: last.click_id,
  };
}

/**
 * Return this visitor's first- and last-touch attribution, updating storage as
 * needed. First touch is captured once and preserved for 90 days; last touch
 * advances on every arrival that carries a campaign signal.
 */
export function captureAttribution(): Attribution {
  if (typeof window === 'undefined') return EMPTY_ATTRIBUTION;

  const now = readFromUrl();
  const stored = readStored();

  // New visitor (or the 90-day window lapsed): this arrival is both touches.
  if (!stored) {
    writeStored({ ts: Date.now(), first: now, last: now });
    return flatten(now, now);
  }

  // Known visitor: first touch is frozen; advance last touch on a campaign click.
  const last = hasCampaignSignal(now) ? now : stored.last;

  // Write on a new touch, and once more to upgrade a legacy v1 record in place.
  if (last !== stored.last || stored.migrated) {
    writeStored({ ts: stored.ts, first: stored.first, last });
  }

  return flatten(stored.first, last);
}
