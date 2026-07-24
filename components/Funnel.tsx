'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import Image from 'next/image';

/* ---------------------------------------------------------------------------
   AMR Free Roof Inspection Funnel
   One client component holds all funnel state. Styling is inline to preserve
   pixel-for-pixel fidelity with the approved prototype; responsive layout and
   hover/focus/reduced-motion behavior live in globals.css.
--------------------------------------------------------------------------- */

// Fonts (loaded via next/font/google in app/layout.tsx, exposed as CSS vars).
const FONT_BODY = 'var(--font-barlow), sans-serif';
const FONT_COND = 'var(--font-barlow-condensed), sans-serif';
const FONT_MONO = 'var(--font-plex-mono), monospace';

// Business constants (were DC editor props in the prototype).
const FINANCING_MONTHS = 24;
const BIZ_PHONE = '(346) 680-3564';
const BIZ_PHONE_HREF = 'tel:+13466803564';
const FINANCE_OFFER = `$0 Down + No Interest for Up to ${FINANCING_MONTHS} Months`;
const KEN_BURNS = true;

const DRAFT_KEY = 'amr-funnel-draft';

type State = {
  screen: number; // 0 = intro, 1..5 = steps
  submitted: boolean;
  concern: string | null;
  timing: string | null;
  address: string;
  city: string;
  zip: string;
  offers: string[];
  first: string;
  last: string;
  phone: string;
  email: string;
  company: string; // honeypot — never persisted, never shown
  error: string;
  submitting: boolean;
};

const INITIAL: State = {
  screen: 0,
  submitted: false,
  concern: null,
  timing: null,
  address: '',
  city: '',
  zip: '',
  offers: [],
  first: '',
  last: '',
  phone: '',
  email: '',
  company: '',
  error: '',
  submitting: false,
};

// Subset of state persisted to the localStorage draft.
type Draft = Pick<
  State,
  'screen' | 'concern' | 'timing' | 'address' | 'city' | 'zip' | 'offers' | 'first' | 'last' | 'phone' | 'email'
>;

function persist(s: State) {
  try {
    const draft: Draft = {
      screen: s.screen,
      concern: s.concern,
      timing: s.timing,
      address: s.address,
      city: s.city,
      zip: s.zip,
      offers: s.offers,
      first: s.first,
      last: s.last,
      phone: s.phone,
      email: s.email,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

const CONCERNS = [
  'Active leak or water stain',
  'Missing or damaged shingles',
  'Recent storm, wind, or hail',
  'Roof is getting older',
  'Buying or selling a home',
  'General inspection',
  "I'm not sure",
];

const TIMINGS = [
  'As soon as possible',
  'Within the next few days',
  'Within 1–2 weeks',
  "I'm gathering information",
];

const OFFERS = [
  '$0-down financing',
  'No-interest payment options',
  '50-year warranty protection',
  'Veteran or military discount',
  'First responder discount',
  'Teacher discount',
  'Homeowner age 55+ discount',
  "I'm not sure yet",
];

// Per-slot photo caption metadata (index = screen; 6 = confirmation).
type Meta = { label: string; tag: string };
const DESKTOP_META: Meta[] = [
  { label: 'VERIFIED GOOGLE REVIEW · 5 STARS', tag: 'HOUSTON, TX' },
  { label: 'INSPECTION PHOTO · RIDGE VENT', tag: 'DOCUMENTED' },
  { label: 'FIELD DETAIL · FLASHING & RIDGE', tag: 'CRAFTSMANSHIP' },
  { label: 'COMPLETED SYSTEM · AERIAL', tag: 'DOCUMENTED' },
  { label: 'JOB SITE · $0 DOWN FINANCING', tag: 'HOUSTON, TX' },
  { label: 'COMPLETED SYSTEM · DETAIL', tag: 'HOUSTON, TX' },
  { label: 'BEFORE / AFTER · FULL REPLACEMENT', tag: 'THANK YOU' },
];
const MOBILE_META: Meta[] = DESKTOP_META.map((m, i) =>
  i === 0
    ? { label: 'THE AMR CREW · ON THE JOB', tag: 'HOUSTON, TX' }
    : i === 1
      ? { label: 'BEFORE / AFTER · HAPPY HOMEOWNER', tag: 'THANK YOU' }
      : m,
);

// Photo layers. Slots 0 & 1 differ by breakpoint (CSS toggles which is shown).
type Layer = {
  slot: number;
  src: string;
  alt: string;
  fit: 'cover' | 'contain';
  pos?: string;
  cls?: string; // 'only-desktop' | 'only-mobile'
  priority?: boolean;
};
const LAYERS: Layer[] = [
  { slot: 0, src: '/assets/desktop1.webp', alt: 'Verified five-star Google review: outstanding work, zero down', fit: 'contain', cls: 'only-desktop', priority: true },
  { slot: 0, src: '/assets/mobile1.webp', alt: 'AMR crew installing a roof and posing on a completed job site', fit: 'cover', cls: 'only-mobile', priority: true },
  { slot: 1, src: '/assets/roof-ridge.webp', alt: 'Ridge vent and shingles photographed during a roof inspection', fit: 'cover', cls: 'only-desktop' },
  { slot: 1, src: '/assets/mobile2.webp', alt: 'Before and after: homeowners with their completed roof replacement', fit: 'contain', cls: 'only-mobile' },
  { slot: 2, src: '/assets/flashing.webp', alt: 'Roofer securing new flashing along a shingle ridge', fit: 'cover' },
  { slot: 3, src: '/assets/aerial.webp', alt: 'Aerial view of a completed American Master Roofing shingle roof', fit: 'contain' },
  { slot: 4, src: '/assets/yard-sign.webp', alt: 'Job site with $0-down financing yard sign in front of a re-roof in progress', fit: 'cover' },
  { slot: 5, src: '/assets/finished-roof.webp', alt: 'Completed premium roof, dormer and copper detail', fit: 'cover', pos: '82% center' },
  { slot: 6, src: '/assets/before-after.webp', alt: 'Before and after of a completed full roof replacement', fit: 'contain' },
];

const PHOTO_SIZES = '(max-width: 859px) 100vw, 45vw';

export default function Funnel() {
  const [s, setS] = useState<State>(INITIAL);

  // save = setState + persist the draft (mirrors the prototype's save()).
  const save = useCallback((patch: Partial<State>) => {
    setS((prev) => {
      const next = { ...prev, ...patch };
      persist(next);
      return next;
    });
  }, []);

  // Restore draft on mount (client-only; avoids hydration mismatch).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && typeof d === 'object') {
          setS((prev) => ({ ...prev, ...d, submitted: false, error: '', submitting: false }));
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const activeIdx = s.submitted ? 6 : s.screen;
  const urgent = s.concern === 'Active leak or water stain';

  // ---- Field setters ----
  const set = (field: keyof State) => (e: { target: { value: string } }) =>
    save({ [field]: e.target.value, error: '' } as Partial<State>);

  // ---- Navigation ----
  const start = () => save({ screen: 1 });
  const back = () => save({ screen: Math.max(0, s.screen - 1), error: '' });

  const selectSingle = (field: 'concern' | 'timing', label: string, next: number) => {
    save({ [field]: label, error: '' } as Partial<State>);
    setTimeout(() => save({ screen: next }), 240);
  };

  const toggleOffer = (label: string) => {
    const sel = s.offers.includes(label);
    save({ offers: sel ? s.offers.filter((o) => o !== label) : s.offers.concat(label), error: '' });
  };

  const next3 = () => {
    if (s.address.trim().length < 5) return save({ error: 'Please enter your street address.' });
    if (!/^\d{5}$/.test(s.zip.trim())) return save({ error: 'Please enter a valid 5-digit ZIP code.' });
    save({ screen: 4, error: '' });
  };

  const next4 = () => save({ screen: 5, error: '' });

  const submit = async () => {
    if (!s.first.trim()) return save({ error: 'Please enter your first name.' });
    if (!s.last.trim()) return save({ error: 'Please enter your last name.' });
    if (s.phone.replace(/\D/g, '').length < 10) return save({ error: 'Please enter a valid mobile phone number.' });
    if (!/^\S+@\S+\.\S+$/.test(s.email.trim())) return save({ error: 'Please enter a valid email address.' });

    setS((prev) => ({ ...prev, submitting: true, error: '' }));
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first: s.first,
          last: s.last,
          phone: s.phone,
          email: s.email,
          address: s.address,
          city: s.city,
          zip: s.zip,
          concern: s.concern,
          timing: s.timing,
          offers: s.offers,
          urgentLeak: urgent,
          company: s.company, // honeypot
        }),
      });
      if (res.ok) {
        setS((prev) => ({ ...prev, submitted: true, submitting: false, error: '' }));
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {
          /* ignore */
        }
      } else {
        setS((prev) => ({
          ...prev,
          submitting: false,
          error: `Something went wrong sending your request. Please try again, or call us at ${BIZ_PHONE}.`,
        }));
      }
    } catch {
      setS((prev) => ({
        ...prev,
        submitting: false,
        error: 'We couldn’t send your request. Please check your connection and try again.',
      }));
    }
  };

  // ---- Shared styles ----
  const cardStyle = (sel: boolean): CSSProperties => ({
    display: 'block',
    width: '100%',
    textAlign: 'left',
    boxSizing: 'border-box',
    padding: '16px 20px',
    marginBottom: '9px',
    minHeight: 44,
    borderRadius: '10px',
    cursor: 'pointer',
    fontFamily: FONT_BODY,
    fontSize: '17.5px',
    fontWeight: 600,
    lineHeight: 1.25,
    color: sel ? '#fff' : '#18213d',
    background: sel ? '#1b2a5b' : '#ffffff',
    border: sel ? '2px solid #1b2a5b' : '2px solid #e3e0d8',
    transition: 'background .15s ease, border-color .15s ease, transform .15s ease',
  });

  const inputStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    padding: '15px 16px',
    marginBottom: '9px',
    borderRadius: '10px',
    border: '2px solid #e3e0d8',
    fontFamily: FONT_BODY,
    fontSize: '17px',
    color: '#18213d',
    background: '#fff',
    minHeight: 44,
  };
  const inputFlexStyle: CSSProperties = { ...inputStyle, flex: 1, width: 'auto', minWidth: 0 };
  const zipStyle: CSSProperties = { ...inputStyle, flex: 'none', width: '112px' };

  const backTextBtn: CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#6a7186',
    fontFamily: FONT_BODY,
    fontSize: '15.5px',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '10px 0',
    minHeight: 44,
    display: 'inline-flex',
    alignItems: 'center',
  };
  const backBoxBtn: CSSProperties = {
    flex: 'none',
    background: '#ffffff',
    border: '2px solid #e3e0d8',
    borderRadius: '10px',
    padding: '13px 16px',
    fontFamily: FONT_BODY,
    fontSize: '16.5px',
    fontWeight: 600,
    color: '#5b6275',
    cursor: 'pointer',
    minHeight: 44,
  };
  const continueBtn: CSSProperties = {
    flex: 1,
    background: '#d7222b',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '14px',
    fontFamily: FONT_BODY,
    fontWeight: 700,
    fontSize: '17.5px',
    cursor: 'pointer',
    minHeight: 44,
    transition: 'transform .15s ease, background .15s ease',
  };

  const showProgress = !s.submitted && s.screen > 0;
  const stepPct = Math.round((s.screen / 5) * 100) + '%';

  const captionBar = (meta: Meta, cls: string) => (
    <div
      className={cls}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        padding: '16px 20px',
        justifyContent: 'space-between',
        gap: '12px',
        alignItems: 'baseline',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px',
          alignItems: 'baseline',
        }}
      >
        <div
          key={meta.label}
          style={{
            fontFamily: FONT_MONO,
            fontSize: '13px',
            letterSpacing: '0.12em',
            color: '#ffffff',
            display: 'flex',
            gap: '9px',
            alignItems: 'center',
            animation: 'capIn .6s ease both',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              background: '#d7222b',
              display: 'inline-block',
              animation: 'blink 2.4s ease infinite',
            }}
          />
          {meta.label}
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: '13px', letterSpacing: '0.12em', color: '#ffb3b7' }}>
          {meta.tag}
        </div>
      </div>
    </div>
  );

  return (
    <div className="amr-root">
      {/* ---------------- Photo panel ---------------- */}
      <div className="amr-photo-panel">
        {LAYERS.map((l, i) => {
          const active = l.slot === activeIdx;
          const style: CSSProperties = {
            objectFit: l.fit,
            objectPosition: l.pos || 'center',
            padding: l.fit === 'contain' ? '46px 18px' : 0,
            boxSizing: 'border-box',
            opacity: active ? 1 : 0,
            transform: active && KEN_BURNS && l.fit !== 'contain' ? 'scale(1.09)' : 'scale(1.0)',
            transition: 'opacity .9s ease, transform 7s ease-out',
            willChange: 'opacity, transform',
          };
          return (
            <Image
              key={i}
              className={`kb-img ${l.cls || ''}`.trim()}
              src={l.src}
              alt={l.alt}
              fill
              sizes={PHOTO_SIZES}
              style={style}
              priority={l.priority}
            />
          );
        })}

        {/* Dark gradient overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg,rgba(12,20,46,0.35) 0%,rgba(12,20,46,0) 35%,rgba(12,20,46,0.72) 100%)',
          }}
        />

        {/* Bottom caption bars (breakpoint-specific text, CSS-toggled) */}
        {captionBar(DESKTOP_META[activeIdx], 'only-desktop')}
        {captionBar(MOBILE_META[activeIdx], 'only-mobile')}

        {/* Top strip */}
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 20,
            right: 20,
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: FONT_MONO,
            fontSize: '11.5px',
            letterSpacing: '0.14em',
            color: 'rgba(255,255,255,0.65)',
          }}
        >
          <span>AMERICAN MASTER ROOFING</span>
          <span>29.76&deg;N 95.36&deg;W</span>
        </div>
      </div>

      {/* ---------------- Content column ---------------- */}
      <div className="amr-content">
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            padding: '14px 24px',
            borderBottom: '1px solid #eceae3',
            background: '#ffffff',
            flex: 'none',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/logo.png"
            alt="American Master Roofing"
            style={{ height: 58, width: 'auto', margin: '-8px 0' }}
          />
          <a
            href={BIZ_PHONE_HREF}
            style={{
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '17px',
              color: '#1b2a5b',
              whiteSpace: 'nowrap',
              minHeight: 44,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            Call {BIZ_PHONE}
          </a>
        </div>

        {/* Progress bar */}
        {showProgress && (
          <div style={{ padding: '14px 24px 0', flex: 'none' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                fontFamily: FONT_MONO,
                fontSize: '13px',
                letterSpacing: '0.12em',
                color: '#6a7186',
                marginBottom: '8px',
              }}
            >
              <span>STEP {s.screen} OF 5</span>
              <span style={{ color: '#d7222b' }}>{stepPct}</span>
            </div>
            <div style={{ height: 5, background: '#eceae3', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  height: 5,
                  background: '#d7222b',
                  borderRadius: 3,
                  width: `${(s.screen / 5) * 100}%`,
                  transition: 'width .5s cubic-bezier(.22,1,.36,1)',
                }}
              />
            </div>
          </div>
        )}

        {/* Scrollable step area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            padding: '28px 24px',
          }}
        >
          <div style={{ maxWidth: 560, width: '100%', margin: 'auto' }}>
            {/* ---- Intro ---- */}
            {!s.submitted && s.screen === 0 && (
              <div style={{ animation: 'stepIn .55s cubic-bezier(.22,1,.36,1) both' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontFamily: FONT_MONO,
                    fontSize: '13.5px',
                    letterSpacing: '0.14em',
                    color: '#d7222b',
                    animation: 'riseIn .5s .05s ease both',
                  }}
                >
                  <span style={{ width: 9, height: 9, background: '#d7222b', display: 'inline-block' }} />
                  HOUSTON, TX &middot; FREE ROOF INSPECTION
                </div>
                <h1
                  style={{
                    fontFamily: FONT_COND,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    fontSize: 'clamp(44px,5vw,64px)',
                    lineHeight: 0.98,
                    margin: '16px 0 14px',
                    animation: 'riseIn .5s .1s ease both',
                  }}
                >
                  Your roof, inspected free.
                </h1>
                <p
                  style={{
                    fontSize: '18.5px',
                    lineHeight: 1.55,
                    color: '#3a415a',
                    margin: '0 0 20px',
                    animation: 'riseIn .5s .16s ease both',
                  }}
                >
                  A trained inspector walks your roof, photographs every finding, and gives you a straight answer:
                  maintenance, repair, replacement — or nothing at all.
                </p>
                <div
                  style={{
                    border: '1px solid #e3e0d8',
                    background: '#ffffff',
                    borderRadius: '12px',
                    padding: '14px 18px',
                    marginBottom: '22px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '4px 14px',
                    alignItems: 'baseline',
                    animation: 'riseIn .5s .22s ease both',
                  }}
                >
                  <span style={{ fontFamily: FONT_MONO, fontSize: '12.5px', letterSpacing: '0.14em', color: '#d7222b' }}>
                    LIMITED-TIME FINANCING
                  </span>
                  <span
                    style={{
                      fontFamily: FONT_COND,
                      fontWeight: 700,
                      fontSize: '26px',
                      textTransform: 'uppercase',
                      color: '#1b2a5b',
                    }}
                  >
                    {FINANCE_OFFER}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={start}
                  className="amr-cta"
                  style={{
                    width: '100%',
                    background: '#d7222b',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '18px 26px',
                    fontFamily: FONT_BODY,
                    fontWeight: 700,
                    fontSize: '19px',
                    cursor: 'pointer',
                    boxShadow: '0 14px 34px rgba(215,34,43,0.35)',
                    transition: 'transform .15s ease, background .15s ease',
                    animation: 'riseIn .5s .28s ease both',
                    minHeight: 44,
                  }}
                >
                  Start My Free Inspection &rarr;
                </button>
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: '14.5px',
                    color: '#5b6275',
                    marginTop: '10px',
                    animation: 'riseIn .5s .32s ease both',
                  }}
                >
                  Under 60 seconds &middot; No pressure, no obligation
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px 20px',
                    marginTop: '22px',
                    animation: 'riseIn .5s .38s ease both',
                  }}
                >
                  {['Every finding photo-documented', 'Insured & bonded', 'Warranties up to 50 years'].map((t) => (
                    <div key={t} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', fontSize: '15px', color: '#4a5165' }}>
                      <span style={{ width: 6, height: 6, background: '#d7222b', flex: 'none' }} />
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ---- Step 1: Concern ---- */}
            {!s.submitted && s.screen === 1 && (
              <div style={{ animation: 'stepIn .5s cubic-bezier(.22,1,.36,1) both' }}>
                <h2 style={stepHeading}>What made you want your roof inspected?</h2>
                <p style={stepSub}>
                  Choose whatever fits best — you don&rsquo;t need to be sure. Finding out is what the inspection is for.
                </p>
                {CONCERNS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    className="amr-option"
                    onClick={() => selectSingle('concern', label, 2)}
                    style={cardStyle(s.concern === label)}
                  >
                    {label}
                  </button>
                ))}
                <button type="button" onClick={back} style={backTextBtn}>
                  &larr; Back
                </button>
              </div>
            )}

            {/* ---- Step 2: Timing ---- */}
            {!s.submitted && s.screen === 2 && (
              <div style={{ animation: 'stepIn .5s cubic-bezier(.22,1,.36,1) both' }}>
                {urgent && (
                  <div style={urgentBadge}>ACTIVE LEAK — WE&rsquo;LL PRIORITIZE YOUR REQUEST</div>
                )}
                <h2 style={stepHeading}>When would you like the inspection?</h2>
                <p style={stepSub}>This helps us plan our routes — nothing is locked in until you confirm.</p>
                {TIMINGS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    className="amr-option"
                    onClick={() => selectSingle('timing', label, 3)}
                    style={cardStyle(s.timing === label)}
                  >
                    {label}
                  </button>
                ))}
                <button type="button" onClick={back} style={backTextBtn}>
                  &larr; Back
                </button>
              </div>
            )}

            {/* ---- Step 3: Address ---- */}
            {!s.submitted && s.screen === 3 && (
              <div style={{ animation: 'stepIn .5s cubic-bezier(.22,1,.36,1) both' }}>
                <h2 style={stepHeading}>Where should we inspect?</h2>
                <p style={{ ...stepSub, margin: '0 0 16px' }}>
                  Your address lets us confirm coverage and study your roofline before we ever arrive.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    next3();
                  }}
                >
                  <label htmlFor="f-address" className="sr-only">
                    Street address
                  </label>
                  <input
                    id="f-address"
                    value={s.address}
                    onChange={set('address')}
                    placeholder="Street address"
                    autoComplete="street-address"
                    style={inputStyle}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <label htmlFor="f-city" className="sr-only">
                        City
                      </label>
                      <input
                        id="f-city"
                        value={s.city}
                        onChange={set('city')}
                        placeholder="City"
                        autoComplete="address-level2"
                        style={{ ...inputFlexStyle, width: '100%' }}
                      />
                    </div>
                    <div style={{ flex: 'none' }}>
                      <label htmlFor="f-zip" className="sr-only">
                        ZIP code
                      </label>
                      <input
                        id="f-zip"
                        value={s.zip}
                        onChange={set('zip')}
                        placeholder="ZIP code"
                        inputMode="numeric"
                        autoComplete="postal-code"
                        maxLength={5}
                        style={zipStyle}
                      />
                    </div>
                  </div>
                  {!!s.error && (
                    <div role="alert" aria-live="polite" style={errorStyle}>
                      {s.error}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                    <button type="button" onClick={back} style={backBoxBtn}>
                      &larr; Back
                    </button>
                    <button type="submit" className="amr-btn-primary" style={continueBtn}>
                      Continue &rarr;
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ---- Step 4: Offers ---- */}
            {!s.submitted && s.screen === 4 && (
              <div style={{ animation: 'stepIn .5s cubic-bezier(.22,1,.36,1) both' }}>
                <h2 style={stepHeading}>Which options would you like us to explain?</h2>
                <p style={stepSub}>
                  Select any you&rsquo;re curious about — this is not a financing application, just a conversation.
                </p>
                {OFFERS.map((label) => {
                  const sel = s.offers.includes(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      className="amr-option-offer"
                      aria-pressed={sel}
                      onClick={() => toggleOffer(label)}
                      style={cardStyle(sel)}
                    >
                      <span
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: '10px',
                          alignItems: 'center',
                        }}
                      >
                        {label}
                        <span style={{ fontSize: '16px', color: '#ffb3b7' }}>{sel ? '✓' : ''}</span>
                      </span>
                    </button>
                  );
                })}
                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <button type="button" onClick={back} style={backBoxBtn}>
                    &larr; Back
                  </button>
                  <button type="button" onClick={next4} className="amr-btn-primary" style={continueBtn}>
                    Continue &rarr;
                  </button>
                </div>
                <p style={finePrint}>
                  Financing is subject to credit approval, lender terms, project eligibility, and promotional
                  conditions. Discount eligibility verification may be required.
                </p>
              </div>
            )}

            {/* ---- Step 5: Contact ---- */}
            {!s.submitted && s.screen === 5 && (
              <div style={{ animation: 'stepIn .5s cubic-bezier(.22,1,.36,1) both' }}>
                <h2 style={stepHeading}>Last step — who are we scheduling for?</h2>
                <p style={{ ...stepSub, margin: '0 0 16px' }}>
                  We&rsquo;ll call or text to confirm a time that works for you. That&rsquo;s the only reason we ask.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                  }}
                >
                  {/* Honeypot — hidden from users, catches bots */}
                  <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
                    <label htmlFor="f-company">Company</label>
                    <input
                      id="f-company"
                      name="company"
                      tabIndex={-1}
                      autoComplete="off"
                      value={s.company}
                      onChange={(e) => setS((prev) => ({ ...prev, company: e.target.value }))}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <label htmlFor="f-first" className="sr-only">
                        First name
                      </label>
                      <input
                        id="f-first"
                        value={s.first}
                        onChange={set('first')}
                        placeholder="First name"
                        autoComplete="given-name"
                        style={{ ...inputFlexStyle, width: '100%' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <label htmlFor="f-last" className="sr-only">
                        Last name
                      </label>
                      <input
                        id="f-last"
                        value={s.last}
                        onChange={set('last')}
                        placeholder="Last name"
                        autoComplete="family-name"
                        style={{ ...inputFlexStyle, width: '100%' }}
                      />
                    </div>
                  </div>
                  <label htmlFor="f-phone" className="sr-only">
                    Mobile phone number
                  </label>
                  <input
                    id="f-phone"
                    value={s.phone}
                    onChange={set('phone')}
                    placeholder="Mobile phone number"
                    inputMode="tel"
                    type="tel"
                    autoComplete="tel"
                    style={inputStyle}
                  />
                  <label htmlFor="f-email" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="f-email"
                    value={s.email}
                    onChange={set('email')}
                    placeholder="Email address"
                    inputMode="email"
                    type="email"
                    autoComplete="email"
                    style={inputStyle}
                  />
                  {!!s.error && (
                    <div role="alert" aria-live="polite" style={{ ...errorStyle, marginTop: '4px' }}>
                      {s.error}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                    <button type="button" onClick={back} style={backBoxBtn}>
                      &larr; Back
                    </button>
                    <button
                      type="submit"
                      className="amr-submit"
                      disabled={s.submitting}
                      style={{
                        flex: 1,
                        background: '#d7222b',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '15px',
                        fontFamily: FONT_BODY,
                        fontWeight: 700,
                        fontSize: '17.5px',
                        cursor: s.submitting ? 'default' : 'pointer',
                        opacity: s.submitting ? 0.75 : 1,
                        boxShadow: '0 12px 28px rgba(215,34,43,0.3)',
                        transition: 'transform .15s ease, background .15s ease',
                        minHeight: 44,
                      }}
                    >
                      {s.submitting ? 'Sending…' : 'Request My Free Roof Inspection'}
                    </button>
                  </div>
                </form>
                <p style={finePrint}>
                  Submitting this request does not obligate you to purchase roofing services or apply for financing. By
                  submitting, you agree that American Master Roofing may contact you by call or text regarding your
                  inspection request. Consent is not a condition of purchase. Message and data rates may apply.
                </p>
                <details style={{ marginTop: '8px' }}>
                  <summary style={{ cursor: 'pointer', fontSize: '13px', color: '#6a7186', fontWeight: 600 }}>
                    Privacy Policy &amp; Terms
                  </summary>
                  <p style={{ fontSize: '13px', color: '#6a7186', lineHeight: 1.5, margin: '6px 0 0' }}>
                    Information submitted through this page is used only to coordinate your inspection request and
                    related follow-up by American Master Roofing; it is not sold to third parties. Free inspection
                    carries no obligation to purchase. Warranty coverage depends on the selected roofing system and
                    manufacturer terms. Discount availability and combinability may vary.
                  </p>
                </details>
              </div>
            )}

            {/* ---- Confirmation ---- */}
            {s.submitted && (
              <div style={{ animation: 'stepIn .5s cubic-bezier(.22,1,.36,1) both' }}>
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: 210,
                    borderRadius: 12,
                    overflow: 'hidden',
                    marginBottom: 16,
                    animation: 'riseIn .5s .05s ease both',
                  }}
                >
                  <Image
                    src="/assets/aerial-header.webp"
                    alt="Aerial view of a completed American Master Roofing shingle roof"
                    fill
                    sizes={PHOTO_SIZES}
                    style={{ objectFit: 'cover' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      flex: 'none',
                      borderRadius: '50%',
                      background: '#1b2a5b',
                      color: '#fff',
                      fontSize: '22px',
                      lineHeight: '44px',
                      textAlign: 'center',
                      animation: 'tickIn .5s .1s ease both',
                    }}
                  >
                    &#10003;
                  </div>
                  <h2
                    style={{
                      fontFamily: FONT_COND,
                      fontSize: 'clamp(34px,3.6vw,48px)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      lineHeight: 1,
                      margin: 0,
                    }}
                  >
                    Request received{s.first.trim() ? `, ${s.first.trim()}` : ''}
                  </h2>
                </div>
                {urgent && <div style={{ ...urgentBadge, marginBottom: '10px' }}>ACTIVE LEAK — PRIORITY SCHEDULING</div>}
                <p style={{ fontSize: '17px', color: '#3a415a', lineHeight: 1.55, margin: '0 0 20px' }}>
                  Our Houston team is reviewing your request now and will reach out shortly to confirm a time.
                  Here&rsquo;s how it works from here:
                </p>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    marginBottom: '20px',
                  }}
                >
                  {[
                    { n: '01', t: 'We inspect', d: '.15s' },
                    { n: '02', t: 'We document', d: '.25s' },
                    { n: '03', t: 'We explain', d: '.35s' },
                    { n: '04', t: 'You decide', d: '.45s' },
                  ].map((c) => (
                    <div
                      key={c.n}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e3e0d8',
                        borderRadius: '10px',
                        padding: '12px 14px',
                        animation: `riseIn .4s ${c.d} ease both`,
                      }}
                    >
                      <div style={{ fontFamily: FONT_MONO, fontSize: '11.5px', letterSpacing: '0.12em', color: '#d7222b', marginBottom: '3px' }}>
                        {c.n}
                      </div>
                      <div style={{ fontFamily: FONT_COND, fontWeight: 700, fontSize: '20px', textTransform: 'uppercase' }}>
                        {c.t}
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    border: '1px solid #e3e0d8',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    background: '#fff',
                    marginBottom: '18px',
                    maxWidth: 420,
                    animation: 'riseIn .4s .5s ease both',
                  }}
                >
                  <div style={{ position: 'relative', width: '100%', height: 240 }}>
                    <Image
                      src="/assets/mobile2.webp"
                      alt="Before and after: homeowners with their completed roof replacement"
                      fill
                      sizes="420px"
                      style={{ objectFit: 'cover' }}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '9px 14px',
                      fontFamily: FONT_MONO,
                      fontSize: '11.5px',
                      letterSpacing: '0.1em',
                      color: '#6a7186',
                    }}
                  >
                    <span>ANOTHER HAPPY HOMEOWNER</span>
                    <span style={{ color: '#d7222b' }}>HOUSTON, TX</span>
                  </div>
                </div>
                <a
                  href={BIZ_PHONE_HREF}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: '#ffffff',
                    border: '2px solid #e3e0d8',
                    borderRadius: '10px',
                    padding: '13px 18px',
                    fontWeight: 700,
                    fontSize: '16.5px',
                    textDecoration: 'none',
                    color: '#1b2a5b',
                    minHeight: 44,
                  }}
                >
                  Need it faster? Call {BIZ_PHONE}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Footer strip */}
        <div
          style={{
            flex: 'none',
            padding: '12px 24px',
            borderTop: '1px solid #eceae3',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px 18px',
            justifyContent: 'space-between',
            fontSize: '13px',
            color: '#6a7186',
            background: '#ffffff',
          }}
        >
          <span>&copy; 2026 American Master Roofing &middot; Houston, TX</span>
          <span>Free inspection &middot; No obligation to purchase</span>
        </div>
      </div>
    </div>
  );
}

// ---- Static style objects reused across steps ----
const stepHeading: CSSProperties = {
  fontFamily: FONT_COND,
  fontSize: 'clamp(32px,3.4vw,44px)',
  fontWeight: 700,
  textTransform: 'uppercase',
  lineHeight: 1.02,
  margin: '0 0 6px',
};
const stepSub: CSSProperties = {
  fontSize: '16.5px',
  color: '#4a5165',
  margin: '0 0 18px',
};
const errorStyle: CSSProperties = {
  color: '#b81b23',
  fontSize: '15px',
  fontWeight: 600,
  marginTop: '10px',
  animation: 'riseIn .3s ease both',
};
const finePrint: CSSProperties = {
  fontSize: '13px',
  color: '#6a7186',
  lineHeight: 1.5,
  margin: '14px 0 0',
};
const urgentBadge: CSSProperties = {
  display: 'inline-block',
  background: '#fdeceb',
  color: '#b81b23',
  fontFamily: FONT_MONO,
  fontSize: '12.5px',
  letterSpacing: '0.12em',
  padding: '6px 12px',
  borderRadius: '6px',
  marginBottom: '12px',
  animation: 'tickIn .4s ease both',
};
