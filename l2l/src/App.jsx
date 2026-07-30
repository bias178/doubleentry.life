import { useState, useRef, useEffect } from "react";

/* Double Entry Life / Language to Ledger — Production Version */

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

// Se hai i testi estesi dei tuoi prompt/matrici originali, sostituiscili a queste costanti
const MATRIX = `Treatment Matrix (personal module, authoritative)...`;

const SYSTEM_PROMPT = `You are Language to Ledger, an educational demonstration by Double Entry Life. Translate transactions into accounting JSON following strict rules.
${MATRIX}`;

const REVIEWER_PROMPT = `You are the reviewer in Language to Ledger. Perform an independent check on the proposed entry.
${MATRIX}`;

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

/**
 * Parser JSON resiliente a testo extra generato dall'LLM
 */
function safeParseJSON(rawText) {
  if (!rawText) return null;
  const startIdx = rawText.indexOf("{");
  const endIdx = rawText.lastIndexOf("}");
  
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const jsonCandidate = rawText.slice(startIdx, endIdx + 1);
    try {
      return JSON.parse(jsonCandidate);
    } catch (e) {
      console.error("JSON parsing failed:", e);
    }
  }
  return null;
}

/**
 * Chiamata API sicura all'endpoint serverless /api/ledger
 */
async function fetchLedgerAPI(system, messages, maxTokens = 1000) {
  const res = await fetch("/api/ledger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, messages, maxTokens }),
  });

  if (!res.ok) {
    throw new Error(`Server returned status ${res.status}`);
  }

  const data = await res.json();
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

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

export default function App() {
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
      const raw = await fetchLedgerAPI(REVIEWER_PROMPT, [{ role: "user", content: payload }], 700);
      const verdict = safeParseJSON(raw);
      if (verdict) {
        setReview(verdict);
      } else {
        setReview({ status: "unavailable" });
      }
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
      const raw = await fetchLedgerAPI(SYSTEM_PROMPT, msgs, 1000);
      const parsed = safeParseJSON(raw);

      if (!parsed) {
        if (attempt < 2) {
          return post(
            "Your previous output was invalid or cut off. Produce the same result again as minified JSON, more concise: fewer impact rows, shorter prose, first installment only.",
            attempt + 1,
            [...msgs, { role: "assistant", content: raw || "(invalid output)" }]
          );
        }
        throw new Error("Unable to parse JSON after retries.");
      }

      const checkErrors = validateResult(parsed);
      if (checkErrors.length > 0) {
        if (attempt < 2) {
          return post(
            "Deterministic checks rejected your output. Fix exactly these errors and return the corrected minified JSON, changing nothing else: " + checkErrors.join(" "),
            attempt + 1,
            [...msgs, { role: "assistant", content: raw }]
          );
        }
        setError("The engine produced an entry that failed the accounting checks twice: " + checkErrors.join(" ") + " Nothing unbalanced is ever shown. Post the transaction again.");
        return;
      }

      setResult(parsed);
      if (parsed.status === "question") {
        setHistory([...msgs, { role: "assistant", content: raw }]);
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
        <header style={{ marginBottom: 36 }}>
          <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.7, maxWidth: 560 }}>
            Describe a transaction in plain words, in English, Spanish, French, German or Italian. The engine reads it the way an accountant would and replies in English: a named concept, a double entry, its assumptions declared, and the impact on your statements.
          </p>
        </header>

        <section style={{ marginBottom: 28 }}>
          <div style={{ display: "inline-flex", border: `1px solid ${C.tealMid}`, background: C.bg, padding: 4, gap: 4, borderRadius: 2 }}>
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
            <section style={{ background: "white", border: `1px solid ${C.rule}`, padding: 20, marginBottom: 16 }}>
              <Eyebrow>{awaitingAnswer ? "Your answer" : "The transaction"}</Eyebrow>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={3}
                placeholder={awaitingAnswer ? "Answer the question below the form" : "I bought a laptop for 900 euro, paying 12 monthly installments of 75 euro."}
                style={{
                  width: "100%", border: `1px solid ${C.tealMid}`, background: C.bg,
       
