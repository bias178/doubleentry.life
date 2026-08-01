import { useState, useRef, useEffect } from "react";

/* Double Entry Life / Language to Ledger — prototype per spec v1.2 (21 Jul 2026)
   Site palette A, DM Serif Display + Inter + IBM Plex Mono, stateless engine. */

const C = {
  teal: "#2a7a7a",
  tealDark: "#1f5e5e",
  tealLight: "#e6f2f2",
  tealMid: "#c0dede",
  bg: "#fafaf8",
  bgAlt: "#f7f5f2",
  ink: "#1a1a1a",
  muted: "#5a5a6a",
  neutral: "#6b6b7a",
  rule: "#e2e2e0",
  red: "#c0392b",
  orange: "#d4840a",
  green: "#1a6b3c",
};

const F = {
  serif: "'DM Serif Display', Georgia, serif",
  body: "'Inter', -apple-system, sans-serif",
  mono: "'IBM Plex Mono', 'Courier New', monospace",
};

// The engine endpoint. Prompts and the treatment matrix live server-side in
// api/ledger.js and are never shipped to the browser.
const ENDPOINT = "/api/ledger";

const EXAMPLES = [
  { label: "Certification course", text: "I paid 1,200 euro for a professional certification course that lasts two years." },
  { label: "Gym membership", text: "I signed a 12 month gym membership at 45 euro per month." },
  { label: "Laptop in installments", text: "I bought a laptop for 900 euro, paying 12 monthly installments of 75 euro." },
  { label: "Ambiguous setup", text: "I spent 300 euro on my computer setup." },
  { label: "Missing amount", text: "I want to record my new phone." },
  { label: "Advice request", text: "Should I put 5,000 euro into an index fund or pay off my loan?" },
  { label: "The cat", text: "Record my cat as an intangible asset." },
  { label: "Input in Italian", text: "Ho comprato una bici usata per 250 euro, pagata subito." },
  { label: "House with mortgage", text: "I bought a house for 120,000 euro and took out a 90,000 euro mortgage." },
  { label: "Sold old phone", text: "I sold my old phone for 80 euro on a marketplace. I had bought it years ago and never recorded it." },
  { label: "Lent to a friend", text: "I lent 500 euro to a friend, to be paid back in three months." },
];

const B_SERIES = [
  { id: "B-01", topic: "Revenue", ref: "IFRS 15" },
  { id: "B-02", topic: "Inventory", ref: "IAS 2" },
  { id: "B-03", topic: "Employee benefits", ref: "IAS 19" },
  { id: "B-04", topic: "Property, plant, equipment", ref: "IAS 16" },
  { id: "B-05", topic: "Intangible assets", ref: "IAS 38" },
  { id: "B-06", topic: "Leases", ref: "IFRS 16" },
  { id: "B-07", topic: "Financial instruments", ref: "IFRS 9 / IAS 32" },
  { id: "B-08", topic: "Borrowing costs", ref: "IAS 23" },
  { id: "B-09", topic: "Provisions", ref: "IAS 37" },
  { id: "B-10", topic: "Government grants", ref: "IAS 20" },
  { id: "B-11", topic: "Foreign currency", ref: "IAS 21" },
  { id: "B-12", topic: "Investment property", ref: "IAS 40" },
  { id: "B-13", topic: "Impairment, CGU", ref: "IAS 36" },
  { id: "B-14", topic: "Events after reporting", ref: "IAS 10" },
  { id: "B-15", topic: "Policies, estimates, errors", ref: "IAS 8" },
  { id: "B-16", topic: "Assets held for sale", ref: "IFRS 5" },
  { id: "B-17", topic: "Business combinations", ref: "IFRS 3" },
  { id: "B-18", topic: "Consolidation", ref: "IFRS 10 / IAS 27, 28" },
  { id: "B-19", topic: "Income taxes", ref: "IAS 12" },
  { id: "B-20", topic: "Agriculture", ref: "IAS 41" },
];

function IconPerson({ color }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function IconFactory({ color }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21V9l6 4V9l6 4V6l6 3v12z" />
      <line x1="3" y1="21" x2="21" y2="21" />
    </svg>
  );
}

function fmt(n) {
  if (n === null || n === undefined) return "";
  const neg = n < 0;
  const abs = Math.abs(n);
  const s = abs % 1 === 0
    ? abs.toLocaleString("en-US")
    : abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return neg ? "-" + s : s;
}

function Eyebrow({ children }) {
  return (
    <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.teal, marginBottom: 10 }}>
      {children}
    </div>
  );
}

export default function LanguageToLedger() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("personal");
  const [history, setHistory] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});
  const [review, setReview] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const outRef = useRef(null);

  function submitFields(missing) {
    const parts = missing
      .map((m) => {
        const v = (fields[m.id] || "").trim();
        if (!v) return null;
        if (m.options && m.options.length > 0) {
          if (v === "assume") return `${m.label}: assume, apply the standard treatment and declare it.`;
          const opt = m.options.find((o) => o.value === v);
          return `${m.label}: ${opt ? opt.label : v}.`;
        }
        return `${m.label}: ${v}.`;
      })
      .filter(Boolean);
    if (parts.length === 0) return;
    setFields({});
    post(parts.join(" "));
  }

  useEffect(() => {
    if ((result || error) && outRef.current) {
      outRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result, error]);

  function validateResult(parsed) {
    const errors = [];
    if (parsed.status !== "entry") return errors;
    if (!parsed.entries || parsed.entries.length === 0) {
      errors.push("Status is entry but no journal entries were produced.");
      return errors;
    }
    parsed.entries.forEach((en, i) => {
      let d = 0, c = 0;
      (en.lines || []).forEach((l) => {
        if (l.debit !== null && l.debit !== undefined) {
          if (typeof l.debit !== "number" || isNaN(l.debit) || l.debit < 0) errors.push(`Entry ${i + 1}: invalid debit on "${l.account}".`);
          else d += l.debit;
        }
        if (l.credit !== null && l.credit !== undefined) {
          if (typeof l.credit !== "number" || isNaN(l.credit) || l.credit < 0) errors.push(`Entry ${i + 1}: invalid credit on "${l.account}".`);
          else c += l.credit;
        }
      });
      if (Math.abs(d - c) > 0.005) {
        errors.push(`Entry ${i + 1} ("${en.title}") does not balance: total debits ${d.toFixed(2)}, total credits ${c.toFixed(2)}.`);
      }
    });
    ((parsed.impact && parsed.impact.rows) || []).forEach((r) => {
      if (r.prior !== null && r.prior !== undefined && r.current !== null && r.current !== undefined && typeof r.change === "number") {
        if (Math.abs(r.change - (r.current - r.prior)) > 0.005) {
          errors.push(`Impact row "${r.item}": change ${r.change} does not equal current minus prior (${(r.current - r.prior).toFixed(2)}).`);
        }
      }
    });
    return errors;
  }

  async function runReview(parsed) {
    setReviewing(true);
    setReview(null);
    const payload =
      "Preparer reading: " + (parsed.reading || "(none)") + "\n" +
      "Preparer assumptions: " + JSON.stringify(parsed.assumptions || []) + "\n" +
      "Preparer output: " + JSON.stringify({ concept: parsed.concept, entries: parsed.entries, impact: parsed.impact });
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "review",
          messages: [{ role: "user", content: payload }],
        }),
      });
      if (!response.ok) throw new Error("Reviewer request failed");
      const data = await response.json();
      const raw = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
      const clean = raw.replace(/```json|```/g, "").trim();
      const verdict = JSON.parse(clean);
      setReview(verdict);
    } catch (e) {
      setReview({ status: "unavailable" });
    } finally {
      setReviewing(false);
    }
  }

  async function post(text, attempt = 0, baseMsgs = null) {
    const trimmed = text.trim();
    if (!trimmed || (loading && attempt === 0)) return;
    setLoading(true);
    setError(null);
    if (attempt === 0) { setReview(null); setReviewing(false); }
    const msgs = [...(baseMsgs !== null ? baseMsgs : history), { role: "user", content: trimmed }];
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "prepare",
          messages: msgs,
        }),
      });
      if (!response.ok) {
        const status = response.status;
        throw new Error(
          status === 429
            ? "Too many requests in a short time. Please wait a moment and try again."
            : "The engine could not be reached. Please try again."
        );
      }
      const data = await response.json();
      const raw = (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      const clean = raw.replace(/```json|```/g, "").trim();
      let parsed;
      try {
        parsed = JSON.parse(clean);
      } catch (parseErr) {
        if (attempt < 2) {
          return post(
            "Your previous output was invalid or cut off. Produce the same result again as minified JSON, more concise: fewer impact rows, shorter prose, first installment only.",
            attempt + 1,
            [...msgs, { role: "assistant", content: clean || "(invalid output)" }]
          );
        }
        throw parseErr;
      }
      const checkErrors = validateResult(parsed);
      if (checkErrors.length > 0) {
        if (attempt < 2) {
          return post(
            "Deterministic checks rejected your output. Fix exactly these errors and return the corrected minified JSON, changing nothing else: " + checkErrors.join(" "),
            attempt + 1,
            [...msgs, { role: "assistant", content: clean }]
          );
        }
        setError("The engine produced an entry that failed the accounting checks twice: " + checkErrors.join(" ") + " Nothing unbalanced is ever shown. Post the transaction again.");
        return;
      }
      setResult(parsed);
      if (parsed.status === "question") {
        setHistory([...msgs, { role: "assistant", content: clean }]);
      } else {
        setHistory([]);
      }
      setInput("");
      if (parsed.status === "entry") {
        runReview(parsed);
      }
    } catch (e) {
      setError("The engine returned an invalid response and retries did not fix it. Post the transaction again, splitting it into smaller steps if it is complex.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setHistory([]);
    setResult(null);
    setError(null);
    setInput("");
    setFields({});
    setReview(null);
    setReviewing(false);
  }

  const awaitingAnswer = result && result.status === "question";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: F.body }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; }
        textarea:focus, input:focus, button:focus-visible { outline: 2px solid ${C.teal}; outline-offset: 2px; }
        button { cursor: pointer; }
        @media (prefers-reduced-motion: reduce) { * { transition: none; animation: none; } }
        a { text-decoration: none; }
        .l2l-topbar { border-bottom: 1px solid ${C.rule}; position: sticky; top: 0; z-index: 100; background: ${C.bg}; }
        .l2l-topbar-inner { max-width: 1080px; margin: 0 auto; padding: 0 2rem; min-height: 60px; display: flex; align-items: baseline; gap: 0.4rem 0.7rem; flex-wrap: wrap; }
        .l2l-wordmark { font-family: ${F.mono}; font-size: 1.02rem; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: ${C.ink}; }
        .l2l-wordmark .tl { color: ${C.teal}; }
        .l2l-wordmark .tk { color: ${C.ink}; }
        .l2l-poweredby { font-family: ${F.mono}; font-size: 0.62rem; letter-spacing: 0.14em; text-transform: uppercase; color: ${C.neutral}; }
        .l2l-poweredby a { color: ${C.teal}; }
        .l2l-poweredby a .pk { color: ${C.ink}; }
        .l2l-poweredby a:hover { opacity: 0.7; }
        .l2l-footer { border-top: 1px solid ${C.rule}; background: ${C.bg}; margin-top: 60px; }
        .l2l-footer-inner { max-width: 1080px; margin: 0 auto; padding: 3rem 2rem; display: flex; justify-content: space-between; align-items: flex-start; gap: 2rem; }
        .l2l-footer-brand-name { font-family: ${F.mono}; font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; color: ${C.teal}; margin-bottom: 0.5rem; }
        .l2l-footer-brand-desc { font-size: 0.8rem; color: ${C.neutral}; line-height: 1.6; max-width: 300px; }
        .l2l-footer-links { display: flex; gap: 2rem; }
        .l2l-footer-col-label { font-family: ${F.mono}; font-size: 0.58rem; letter-spacing: 0.1em; text-transform: uppercase; color: ${C.neutral}; margin-bottom: 1rem; }
        .l2l-footer-col ul { list-style: none; display: flex; flex-direction: column; gap: 0.6rem; }
        .l2l-footer-col a { font-size: 0.8rem; color: ${C.muted}; transition: color 0.15s; }
        .l2l-footer-col a:hover { color: ${C.teal}; }
        .l2l-footer-bottom { border-top: 1px solid ${C.rule}; padding: 1.25rem 2rem; max-width: 1080px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
        .l2l-footer-copy { font-family: ${F.mono}; font-size: 0.6rem; color: ${C.neutral}; }
        .l2l-footer-connect-links { display: flex; gap: 1rem; }
        .l2l-footer-linkedin { font-family: ${F.mono}; font-size: 0.6rem; color: ${C.teal}; transition: opacity 0.15s; }
        .l2l-footer-linkedin:hover { opacity: 0.7; }
        @media (max-width: 720px) {
          .l2l-footer-inner { flex-direction: column; }
          .l2l-footer-links { flex-direction: column; gap: 1.5rem; }
        }
      `}</style>

      {/* Standalone header */}
      <header className="l2l-topbar" role="banner">
        <div className="l2l-topbar-inner">
          <span className="l2l-wordmark">
            <span className="tl">Language</span>&nbsp;<span className="tk">to</span>&nbsp;<span className="tl">Ledger</span>
          </span>
          <span className="l2l-poweredby">
            powered by <a href="https://doubleentry.life" target="_blank" rel="noopener">Double <span className="pk">Entry</span> Life</a>
          </span>
        </div>
      </header>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px 80px" }}>
        {/* Intro */}
        <header style={{ marginBottom: 36 }}>
          <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.7, maxWidth: 560 }}>
            Describe a transaction in plain words, in English, Spanish, French, German or Italian. The engine reads it the way an accountant would and replies in English: a named concept, a double entry, its assumptions declared, and the impact on your statements.
          </p>
        </header>

        {/* Personal / Business toggle */}
        <section style={{ marginBottom: 28 }}>
          <div style={{
            display: "inline-flex", border: `1px solid ${C.tealMid}`, background: C.bg,
            padding: 4, gap: 4, borderRadius: 2,
          }}>
            <button
              onClick={() => { setMode("personal"); reset(); }}
              aria-pressed={mode === "personal"}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", border: "none",
                background: mode === "personal" ? C.teal : "transparent",
                color: mode === "personal" ? "white" : C.neutral,
                fontFamily: F.mono, fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              <IconPerson color={mode === "personal" ? "white" : C.neutral} />
              Personal
            </button>
            <button
              onClick={() => { setMode("business"); reset(); }}
              aria-pressed={mode === "business"}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", border: "none",
                background: mode === "business" ? C.teal : "transparent",
                color: mode === "business" ? "white" : C.neutral,
                fontFamily: F.mono, fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              <IconFactory color={mode === "business" ? "white" : C.neutral} />
              Business
            </button>
          </div>
          <p style={{ fontSize: 12.5, color: C.neutral, marginTop: 10, fontFamily: F.mono, letterSpacing: "0.02em" }}>
            {mode === "personal"
              ? "System running on the personal treatment matrix (Bill's ledger)."
              : "System pointed at the enterprise treatment matrix (IAS/IFRS company module)."}
          </p>
        </section>

        {mode === "business" ? (
          /* Business module: in development */
          <section style={{ background: "white", border: `1px solid ${C.rule}`, padding: 28, marginBottom: 40 }}>
            <Eyebrow>Enterprise module</Eyebrow>
            <h2 style={{ fontFamily: F.serif, fontSize: 24, fontWeight: 400, margin: "6px 0 12px" }}>
              In development
            </h2>
            <p style={{ fontSize: 14.5, color: C.muted, lineHeight: 1.75, maxWidth: 580, marginBottom: 22 }}>
              The personal module is live and answers now. The enterprise module applies the same method to full company reporting under IAS and IFRS, and is being built one treatment card at a time. It does not run yet, because the system never produces an entry it cannot ground in a written rule. The scope below is what it will cover.
            </p>
            <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: C.neutral, marginBottom: 12 }}>
              Planned coverage, 20 cards
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
              {B_SERIES.map((b) => (
                <div key={b.id} style={{ border: `1px solid ${C.rule}`, padding: "8px 10px", background: C.bg }}>
                  <div style={{ fontFamily: F.mono, fontSize: 11, color: C.teal }}>{b.id}</div>
                  <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.4, marginTop: 2 }}>{b.topic}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: C.neutral, marginTop: 3 }}>{b.ref}</div>
                </div>
              ))}
            </div>
          </section>
        ) : (
        <>
        {/* Input */}
        <section style={{ background: "white", border: `1px solid ${C.rule}`, padding: 20, marginBottom: 16 }}>
          <Eyebrow>{awaitingAnswer ? "Your answer" : "The transaction"}</Eyebrow>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            placeholder={awaitingAnswer ? "Answer the question below the form" : "I bought a laptop for 900 euro, paying 12 monthly installments of 75 euro."}
            style={{
              width: "100%", border: `1px solid ${C.tealMid}`, background: C.bg,
              padding: "12px 14px", fontFamily: F.body, fontSize: 15, lineHeight: 1.6,
              color: C.ink, resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => post(input)}
              disabled={loading || !input.trim()}
              style={{
                background: loading || !input.trim() ? C.tealMid : C.teal,
                color: "white", border: "none", padding: "10px 22px",
                fontFamily: F.mono, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase",
                transition: "background 0.15s",
              }}
            >
              {loading ? "Posting..." : awaitingAnswer ? "Send answer" : "Post to ledger"}
            </button>
            {(result || error) && (
              <button
                onClick={reset}
                style={{
                  background: "transparent", color: C.teal, border: `1px solid ${C.tealMid}`,
                  padding: "9px 16px", fontFamily: F.mono, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase",
                }}
              >
                New entry
              </button>
            )}
          </div>
        </section>

        {/* Example chips */}
        {!result && !loading && (
          <section style={{ marginBottom: 40 }}>
            <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: C.neutral, marginBottom: 10 }}>
              Test cases
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  onClick={() => { setInput(ex.text); }}
                  style={{
                    background: C.tealLight, border: `1px solid ${C.tealMid}`, color: C.tealDark,
                    padding: "6px 12px", fontFamily: F.mono, fontSize: 11.5,
                  }}
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </section>
        )}
        </>
        )}

        <div ref={outRef} />

        {/* Error */}
        {error && (
          <section style={{ background: "white", borderLeft: `3px solid ${C.red}`, border: `1px solid ${C.rule}`, padding: 20, marginBottom: 24 }}>
            <Eyebrow>Engine error</Eyebrow>
            <p style={{ fontSize: 14.5, lineHeight: 1.7, color: C.ink }}>{error}</p>
          </section>
        )}

        {/* Question: guided completion */}
        {result && result.status === "question" && (
          <section style={{ background: C.tealLight, borderLeft: `3px solid ${C.teal}`, padding: 20, marginBottom: 24 }}>
            <Eyebrow>Complete the entry</Eyebrow>
            {result.reading && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: C.neutral, marginBottom: 4 }}>On file</div>
                <p style={{ fontSize: 13.5, lineHeight: 1.7, color: C.ink }}>{result.reading}</p>
              </div>
            )}
            <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 14 }}>{result.question}</p>
            {result.missing && result.missing.length > 0 ? (
              <div>
                {result.missing.map((m) => (
                  <div key={m.id} style={{ marginBottom: 16 }}>
                    <label htmlFor={"f-" + m.id} style={{ display: "block", fontFamily: F.mono, fontSize: 11.5, color: C.tealDark, marginBottom: 6 }}>
                      {m.label}
                    </label>
                    {m.options && m.options.length > 0 ? (
                      <div>
                        {m.options.map((o) => {
                          const sel = fields[m.id] === o.value;
                          return (
                            <div
                              key={o.value}
                              onClick={() => setFields({ ...fields, [m.id]: o.value })}
                              style={{
                                border: `1px solid ${sel ? C.teal : C.rule}`,
                                borderLeft: `3px solid ${sel ? C.teal : C.rule}`,
                                background: sel ? C.tealLight : "white",
                                padding: "10px 14px", marginBottom: 8, cursor: "pointer",
                              }}
                            >
                              <div style={{ fontFamily: F.body, fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 2 }}>
                                {o.label}
                                {o.standard ? <span style={{ fontFamily: F.mono, fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: C.neutral, marginLeft: 8 }}>most common</span> : null}
                              </div>
                              <div style={{ fontSize: 12.5, lineHeight: 1.6, color: C.neutral }}>{o.explanation}</div>
                            </div>
                          );
                        })}
                        <div
                          onClick={() => setFields({ ...fields, [m.id]: "assume" })}
                          style={{
                            border: `1px dashed ${fields[m.id] === "assume" ? C.teal : C.rule}`,
                            background: fields[m.id] === "assume" ? C.tealLight : "transparent",
                            padding: "10px 14px", cursor: "pointer",
                          }}
                        >
                          <div style={{ fontFamily: F.body, fontSize: 13.5, color: C.ink }}>Not sure. Apply the most common treatment</div>
                          <div style={{ fontSize: 12, lineHeight: 1.6, color: C.neutral }}>The engine picks the standard option and declares the choice in the assumptions, so you can see it and change it.</div>
                        </div>
                      </div>
                    ) : (
                      <input
                        id={"f-" + m.id}
                        type="text"
                        value={fields[m.id] || ""}
                        onChange={(e) => setFields({ ...fields, [m.id]: e.target.value })}
                        placeholder={m.hint || ""}
                        style={{
                          width: "100%", border: `1px solid ${C.tealMid}`, background: "white",
                          padding: "9px 12px", fontFamily: F.body, fontSize: 14, color: C.ink,
                        }}
                      />
                    )}
                  </div>
                ))}
                <button
                  onClick={() => submitFields(result.missing)}
                  disabled={loading}
                  style={{
                    background: loading ? C.tealMid : C.teal, color: "white", border: "none",
                    padding: "10px 22px", fontFamily: F.mono, fontSize: 12,
                    letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 4,
                  }}
                >
                  {loading ? "Posting..." : "Complete the entry"}
                </button>
                <p style={{ fontFamily: F.mono, fontSize: 10.5, color: C.neutral, marginTop: 10 }}>
                  The engine never estimates figures on its own. If you want it to pick a standard value for a field, type "assume" in that field and it will declare the assumption.
                </p>
              </div>
            ) : (
              <p style={{ fontFamily: F.mono, fontSize: 11, color: C.neutral, marginTop: 10 }}>
                Answer in the box above to complete the entry.
              </p>
            )}
          </section>
        )}

        {/* Refusal */}
        {result && result.status === "refusal" && (
          <section style={{ background: "white", border: `1px solid ${C.rule}`, borderLeft: `3px solid ${C.ink}`, padding: 20, marginBottom: 24 }}>
            <Eyebrow>Not recorded</Eyebrow>
            <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: result.refusal?.alternative ? 10 : 0 }}>
              {result.refusal?.reason}
            </p>
            {result.refusal?.alternative && (
              <p style={{ fontSize: 14, lineHeight: 1.7, color: C.muted }}>{result.refusal.alternative}</p>
            )}
          </section>
        )}

        {/* Full entry */}
        {result && result.status === "entry" && (
          <div>
            {/* The transaction as read */}
            {result.reading && (
              <section style={{ background: C.bgAlt, border: `1px solid ${C.rule}`, padding: "16px 22px", marginBottom: 14 }}>
                <Eyebrow>The transaction as read</Eyebrow>
                <p style={{ fontSize: 14.5, lineHeight: 1.7, color: C.ink }}>{result.reading}</p>
                <p style={{ fontFamily: F.mono, fontSize: 10.5, color: C.neutral, marginTop: 8 }}>
                  If this does not match what you meant, rephrase the transaction. The entry below is built only on this reading.
                </p>
              </section>
            )}

            {/* The concept */}
            <section style={{ background: "white", border: `1px solid ${C.rule}`, padding: 22, marginBottom: 14 }}>
              <Eyebrow>The concept</Eyebrow>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                <h2 style={{ fontFamily: F.serif, fontSize: 24, fontWeight: 400 }}>{result.concept?.name}</h2>
                {result.concept?.reference && (
                  <span style={{ fontFamily: F.mono, fontSize: 11, background: C.tealLight, color: C.tealDark, padding: "3px 8px", border: `1px solid ${C.tealMid}` }}>
                    {result.concept.reference}
                  </span>
                )}
                {result.concept?.ruleId && result.concept.ruleId !== "none" && (
                  <span style={{ fontFamily: F.mono, fontSize: 11, background: C.ink, color: "white", padding: "3px 8px" }} title="Treatment matrix card applied">
                    {result.concept.ruleId}
                  </span>
                )}
                {result.concept?.ruleId === "none" && (
                  <span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.neutral, fontStyle: "italic" }} title="No matrix card covers this case">
                    no matrix rule
                  </span>
                )}
              </div>
              <p style={{ fontSize: 14.5, lineHeight: 1.75, color: C.muted }}>{result.concept?.definition}</p>
            </section>

            {/* The entry */}
            <section style={{ background: "white", border: `1px solid ${C.rule}`, padding: 22, marginBottom: 14 }}>
              <Eyebrow>The entry</Eyebrow>
              {(result.entries || []).map((en, i) => {
                const dSum = en.lines.reduce((s, l) => s + (l.debit || 0), 0);
                const cSum = en.lines.reduce((s, l) => s + (l.credit || 0), 0);
                return (
                  <div key={i} style={{ marginBottom: i < result.entries.length - 1 ? 24 : 0 }}>
                    <div style={{ fontFamily: F.mono, fontSize: 12, color: C.ink, fontWeight: 500, marginBottom: 8 }}>
                      {result.entries.length > 1 ? `${i + 1}. ` : ""}{en.title}
                    </div>
                    <div style={{ border: `1px solid ${C.rule}` }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px", padding: "7px 12px", borderBottom: `2px solid ${C.ink}`, gap: 8 }}>
                        <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: C.neutral }}>Account</span>
                        <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: C.neutral, textAlign: "right" }}>Debit</span>
                        <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: C.neutral, textAlign: "right" }}>Credit</span>
                      </div>
                      {en.lines.map((l, j) => (
                        <div key={j} style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px", padding: "8px 12px", borderBottom: `1px solid ${C.rule}`, gap: 8 }}>
                          <span style={{ fontSize: 13.5, paddingLeft: l.credit ? 14 : 0, color: C.ink }}>{l.account}</span>
                          <span style={{ fontFamily: F.mono, fontSize: 13, textAlign: "right" }}>{fmt(l.debit)}</span>
                          <span style={{ fontFamily: F.mono, fontSize: 13, textAlign: "right" }}>{fmt(l.credit)}</span>
                        </div>
                      ))}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px", padding: "8px 12px", gap: 8, borderTop: `1px solid ${C.ink}`, borderBottom: `3px double ${C.ink}` }}>
                        <span style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.neutral }}>Total</span>
                        <span style={{ fontFamily: F.mono, fontSize: 13, textAlign: "right", fontWeight: 500 }}>{fmt(dSum)}</span>
                        <span style={{ fontFamily: F.mono, fontSize: 13, textAlign: "right", fontWeight: 500 }}>{fmt(cSum)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Assumptions */}
            <section style={{ background: C.tealLight, borderLeft: `3px solid ${C.teal}`, padding: 20, marginBottom: 14 }}>
              <Eyebrow>Assumptions</Eyebrow>
              {result.assumptions && result.assumptions.length > 0 ? (
                result.assumptions.map((a, i) => (
                  <p key={i} style={{ fontSize: 14, lineHeight: 1.7, color: C.ink, marginBottom: i < result.assumptions.length - 1 ? 8 : 0 }}>{a}</p>
                ))
              ) : (
                <p style={{ fontSize: 14, color: C.muted }}>None.</p>
              )}
            </section>

            {/* Impact */}
            {result.impact && (
              <section style={{ border: `1px solid ${C.rule}`, background: "white", marginBottom: 14 }}>
                <div style={{ background: C.ink, padding: "10px 16px" }}>
                  <span style={{ display: "block", fontFamily: F.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.65)" }}>
                    {result.impact.statement} / transaction impact
                  </span>
                  <span style={{ fontFamily: F.mono, fontSize: 9, color: "rgba(255,255,255,0.4)" }}>EUR</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 70px", padding: "7px 16px", borderBottom: `2px solid ${C.ink}`, gap: 6 }}>
                  {["Line item", "Prior", "Current", "Change"].map((h, i) => (
                    <span key={h} style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: C.neutral, textAlign: i === 0 ? "left" : "right" }}>{h}</span>
                  ))}
                </div>
                {(result.impact.rows || []).map((r, i) => (
                  <div key={i} style={{
                    display: "grid", gridTemplateColumns: "1fr 80px 80px 70px", padding: "9px 16px", gap: 6,
                    borderBottom: `1px solid ${C.rule}`, background: r.highlight ? C.tealLight : "transparent",
                  }}>
                    <span style={{ fontSize: 13 }}>{r.item}</span>
                    <span style={{ fontFamily: F.mono, fontSize: 12.5, textAlign: "right", color: C.neutral }}>{fmt(r.prior)}</span>
                    <span style={{ fontFamily: F.mono, fontSize: 12.5, textAlign: "right" }}>{fmt(r.current)}</span>
                    <span style={{ fontFamily: F.mono, fontSize: 12.5, textAlign: "right", color: r.change > 0 ? C.green : r.change < 0 ? C.red : C.neutral }}>
                      {r.change > 0 ? "+" + fmt(r.change) : fmt(r.change)}
                    </span>
                  </div>
                ))}
              </section>
            )}

            {/* Closing */}
            <section style={{ padding: "18px 2px", borderTop: `2px solid ${C.ink}`, marginBottom: 8 }}>
              <p style={{ fontFamily: F.serif, fontSize: 17, lineHeight: 1.6, color: C.ink }}>{result.closing}</p>
            </section>

            {/* Deterministic checks */}
            <section style={{ background: "white", border: `1px solid ${C.rule}`, borderLeft: `3px solid ${C.green}`, padding: "16px 20px", marginBottom: 8 }}>
              <Eyebrow>Deterministic checks</Eyebrow>
              <p style={{ fontFamily: F.mono, fontSize: 12, lineHeight: 1.9, color: C.ink }}>
                <span style={{ color: C.green, fontWeight: 500 }}>PASS</span> Debits equal credits in {result.entries.length === 1 ? "the entry" : `all ${result.entries.length} entries`}.<br />
                <span style={{ color: C.green, fontWeight: 500 }}>PASS</span> All amounts are valid non negative figures.<br />
                <span style={{ color: C.green, fontWeight: 500 }}>PASS</span> Impact deltas are arithmetically consistent.
              </p>
              <p style={{ fontFamily: F.mono, fontSize: 10.5, color: C.neutral, marginTop: 8 }}>
                Verified in code, not by the model. An output that fails these checks is corrected or discarded, never shown.
              </p>
            </section>

            {/* Second-pass review (L2) */}
            {(reviewing || review) && (
              <section style={{
                background: "white",
                border: `1px solid ${C.rule}`,
                borderLeft: `3px solid ${reviewing ? C.tealMid : review.status === "clean" ? C.green : review.status === "issues" ? C.red : C.neutral}`,
                padding: "16px 20px", marginBottom: 8,
              }}>
                <Eyebrow>Second-pass review</Eyebrow>

                {reviewing && (
                  <p style={{ fontFamily: F.mono, fontSize: 12, color: C.neutral, marginTop: 2 }}>
                    An independent reviewer is checking the concept, the treatment and the arithmetic&hellip;
                  </p>
                )}

                {!reviewing && review && review.status === "clean" && (
                  <>
                    <p style={{ fontFamily: F.mono, fontSize: 12, lineHeight: 1.9, color: C.ink }}>
                      <span style={{ color: C.green, fontWeight: 500 }}>REVIEWED</span> No issues found.
                    </p>
                    <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.7, marginTop: 6 }}>
                      A second pass, independent from the one that wrote the entry, confirmed the treatment card, the rule applied, the grounding of every figure, and the arithmetic the automated checks do not cover.
                    </p>
                  </>
                )}

                {!reviewing && review && review.status === "issues" && (
                  <>
                    <p style={{ fontFamily: F.mono, fontSize: 12, color: C.ink, marginBottom: 10 }}>
                      <span style={{ color: C.red, fontWeight: 500 }}>FLAGGED</span> The reviewer raised {review.findings.length === 1 ? "one point" : `${review.findings.length} points`} on the entry above.
                    </p>
                    {(review.findings || []).map((f, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "7px 0", borderTop: i === 0 ? "none" : `1px solid ${C.rule}` }}>
                        <span style={{
                          fontFamily: F.mono, fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase",
                          color: f.severity === "error" ? C.red : C.orange, minWidth: 58,
                        }}>
                          {f.severity === "error" ? "Error" : "Warning"}
                        </span>
                        <span style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.6 }}>
                          <span style={{ fontFamily: F.mono, fontSize: 11.5, color: C.neutral }}>{f.area}. </span>
                          {f.detail}
                        </span>
                      </div>
                    ))}
                  </>
                )}

                {!reviewing && review && review.status === "unavailable" && (
                  <p style={{ fontFamily: F.mono, fontSize: 12, color: C.neutral }}>
                    The reviewer pass could not complete. The entry above still passed the deterministic checks.
                  </p>
                )}

                {!reviewing && review && review.status !== "unavailable" && (
                  <p style={{ fontFamily: F.mono, fontSize: 10.5, color: C.neutral, marginTop: 10 }}>
                    A separate reviewer pass, not the model that wrote the entry. This is the demonstration's four-eyes control.
                  </p>
                )}
              </section>
            )}
          </div>
        )}

        {/* Fixed disclaimer */}
        <footer style={{ marginTop: 36, paddingTop: 16, borderTop: `1px solid ${C.rule}` }}>
          <p style={{ fontFamily: F.mono, fontSize: 10.5, color: C.neutral, letterSpacing: "0.03em" }}>
            Educational demonstration. Not accounting, tax or investment advice. Nothing you type is stored.
          </p>
        </footer>
      </div>

      {/* Standalone footer */}
      <footer className="l2l-footer">
        <div className="l2l-footer-inner">
          <div>
            <p className="l2l-footer-brand-name">Language to Ledger</p>
            <p className="l2l-footer-brand-desc">
              A method for translating plain-language transactions into rigorous accounting records. Powered by <a href="https://doubleentry.life" target="_blank" rel="noopener" style={{ color: C.teal }}>Double Entry Life</a>.
            </p>
          </div>
          <div className="l2l-footer-links">
            <div className="l2l-footer-col">
              <p className="l2l-footer-col-label">Connect</p>
              <ul>
                <li><a href="https://www.linkedin.com/in/biagio-tozzo-913166138" target="_blank" rel="noopener">LinkedIn</a></li>
                <li><a href="https://substack.com/@doubleentrylife" target="_blank" rel="noopener">Substack</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="l2l-footer-bottom">
          <span className="l2l-footer-copy">&#169; 2026 Biagio Tozzo. Educational demonstration.</span>
          <div className="l2l-footer-connect-links">
            <a href="https://www.linkedin.com/in/biagio-tozzo-913166138" target="_blank" rel="noopener" className="l2l-footer-linkedin">LinkedIn</a>
            <a href="https://substack.com/@doubleentrylife" target="_blank" rel="noopener" className="l2l-footer-linkedin">Substack</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
