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
  { label: "Office lease", text: "We signed a five year lease on an office at 2,000 euro per month, payable monthly in advance, with no purchase option." },
  { label: "Car lease with option", text: "We leased a company car for 36 months at 450 euro per month, with an option to buy it at the end for 6,000 euro." },
  { label: "Low value lease", text: "We lease a coffee machine for the office at 40 euro per month on a four year contract." },
  { label: "Short lease", text: "We rented a warehouse for eight months at 1,500 euro per month." },
  { label: "Lease, no rate given", text: "We leased a machine for four years at 900 euro per month. The contract does not state an interest rate." },
  { label: "Service, not a lease", text: "We pay a supplier 1,200 euro a month to store our goods. They decide which warehouse and can move our pallets whenever they want." },
  { label: "Out of scope", text: "We impaired goodwill from an acquisition by 400,000 euro." },
  { label: "Advice request", text: "Should we lease the machine or buy it outright?" },
  { label: "Input in Italian", text: "Abbiamo firmato un leasing di quattro anni per un macchinario, canone 1.100 euro al mese." },
];

const FRAMEWORKS = [
  { id: "IFRS", label: "IFRS" },
  { id: "USGAAP", label: "US GAAP" },
  { id: "OIC", label: "OIC" },
];

// Coverage map, always visible. A declared perimeter reads as professional;
// an incomplete one left unsaid reads as abandoned.
const DOMAINS = [
  { id: "LEA", name: "Leases", covered: true },
  { id: "REV", name: "Revenue", covered: false },
  { id: "INV", name: "Inventory", covered: false },
  { id: "PPE", name: "Property, plant and equipment", covered: false },
  { id: "EMP", name: "Employee benefits", covered: false },
  { id: "INT", name: "Intangible assets", covered: false },
  { id: "IMP", name: "Impairment", covered: false },
  { id: "PRO", name: "Provisions", covered: false },
  { id: "FIN", name: "Financial instruments", covered: false },
  { id: "FX", name: "Foreign currency", covered: false },
  { id: "TAX", name: "Income taxes", covered: false },
  { id: "GRP", name: "Combinations and consolidation", covered: false },
  { id: "EVT", name: "Events after reporting, changes, errors", covered: false },
];

const PROFILE_LABELS = {
  functionalCurrency: "Functional currency",
  yearEnd: "Financial year end",
  capitalisationThreshold: "Capitalisation threshold",
  inventoryCostFormula: "Inventory cost formula",
  ppeMeasurementModel: "PPE measurement model",
  leaseShortTermExemption: "Short-term lease exemption",
  leaseLowValueExemption: "Low-value lease exemption",
  incrementalBorrowingRate: "Incremental borrowing rate",
  goodwillAmortisationPeriod: "Goodwill amortisation period",
  developmentCostPolicy: "Development cost policy",
};

// The engine speaks the v2 schema (impact as a flat array; questions as fields
// with key, scope and options carrying label and consequence). The view was
// written against an earlier shape. Normalise once here rather than duplicating
// the mapping across the view.
function normaliseResult(parsed) {
  if (!parsed) return parsed;

  // The server resolves a "calculate" response internally by running the
  // arithmetic and calling the model back, so one should never reach here. If it
  // does, fail loudly rather than rendering an empty screen.
  if (parsed.status === "calculate") {
    throw new Error(
      "ENGINE:The engine asked for a calculation that was not carried out. Post the transaction again."
    );
  }

  // Entry results: the engine returns impact as a flat array, the view renders
  // a statement plus rows.
  if (parsed.status === "entry" && Array.isArray(parsed.impact)) {
    parsed = {
      ...parsed,
      impact: {
        statement: parsed.impactStatement || "Balance sheet",
        rows: parsed.impact,
      },
    };
  }

  if (parsed.status !== "question") return parsed;
  const src = Array.isArray(parsed.fields) ? parsed.fields : parsed.missing;
  if (!Array.isArray(src)) return parsed;
  return {
    ...parsed,
    question: parsed.message || parsed.question || "",
    missing: src.map((f, i) => ({
      id: f.key || f.id || `field_${i}`,
      label: f.label || "",
      hint: f.hint || "",
      scope: f.scope || "transaction",
      options:
        Array.isArray(f.options) && f.options.length > 0
          ? f.options.map((o, j) => ({
              value: o.value || `opt_${j}`,
              label: o.label || "",
              explanation: o.consequence || o.explanation || "",
              standard: o.common === true || o.standard === true,
            }))
          : null,
    })),
  };
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
  const [lastPosted, setLastPosted] = useState("");
  const [framework, setFramework] = useState("IFRS");
  const [profile, setProfile] = useState({});
  // Management estimates persist across a change of framework: they belong to the
  // transaction and to management's judgement, not to the reporting framework.
  const [estimates, setEstimates] = useState({});
  const [history, setHistory] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});
  const [review, setReview] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [frameworkChanged, setFrameworkChanged] = useState(false);
  const outRef = useRef(null);

  function submitFields(missing) {
    // Answers whose scope is "entity" are accounting policies, not facts about
    // this transaction: they are kept in the entity profile and reused.
    const nextProfile = { ...profile };
    const nextEstimates = { ...estimates };
    const parts = missing
      .map((m) => {
        const v = (fields[m.id] || "").trim();
        if (!v) return null;
        let spoken;
        if (m.options && m.options.length > 0) {
          if (v === "assume") {
            spoken = `${m.label}: assume, apply the standard treatment and declare it.`;
          } else {
            const opt = m.options.find((o) => o.value === v);
            spoken = `${m.label}: ${opt ? opt.label : v}.`;
          }
        } else {
          spoken = `${m.label}: ${v}.`;
        }
        const chosen = m.options && m.options.find((o) => o.value === v);
        if (m.scope === "entity" && v !== "assume" && PROFILE_LABELS[m.id]) {
          nextProfile[m.id] = chosen ? chosen.label : v;
        }
        if (m.scope === "estimate" && v !== "assume") {
          nextEstimates[m.label || m.id] = chosen ? chosen.label : v;
        }
        return spoken;
      })
      .filter(Boolean);
    if (parts.length === 0) return;
    if (Object.keys(nextProfile).length !== Object.keys(profile).length) {
      setProfile(nextProfile);
    }
    if (Object.keys(nextEstimates).length !== Object.keys(estimates).length) {
      setEstimates(nextEstimates);
    }
    setFields({});
    post(parts.join(" "), 0, null, nextProfile, nextEstimates);
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

    // Cross-block consistency. Each entry balancing on its own says nothing about
    // whether the impact table describes the same transaction: a figure can be
    // right inside an entry and contradict the impact row for the same account.
    // Match on account and item names and compare the magnitudes.
    const norm = (x) =>
      String(x || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const posted = new Map();
    parsed.entries.forEach((en) => {
      (en.lines || []).forEach((l) => {
        const k = norm(l.account);
        if (!k) return;
        const amt = (typeof l.debit === "number" ? l.debit : 0) + (typeof l.credit === "number" ? l.credit : 0);
        posted.set(k, Math.max(posted.get(k) || 0, Math.abs(amt)));
      });
    });
    ((parsed.impact && parsed.impact.rows) || []).forEach((r) => {
      const k = norm(r.item);
      if (!k || !posted.has(k)) return;
      const inEntries = posted.get(k);
      const inImpact = Math.abs(typeof r.change === "number" ? r.change : r.current);
      if (!isFinite(inImpact) || inImpact === 0 || inEntries === 0) return;
      // Tolerate a rounding unit, flag anything larger.
      if (Math.abs(inImpact - inEntries) > 1.01) {
        errors.push(
          `"${r.item}" is ${inEntries.toFixed(2)} in the entries but ${inImpact.toFixed(2)} in the impact table. The same quantity must carry one value in both.`
        );
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
      "Preparer policy register: " + JSON.stringify(parsed.policyRegister || []) + "\n" +
      "Preparer output: " + JSON.stringify({ framework: parsed.framework, concept: parsed.concept, entries: parsed.entries, impact: parsed.impact });
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "review",
          framework,
          profile,
          estimates,
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

  async function post(text, attempt = 0, baseMsgs = null, profileOverride = null, estimatesOverride = null) {
    const trimmed = text.trim();
    if (!trimmed || (loading && attempt === 0)) return;
    setLoading(true);
    setError(null);
    if (attempt === 0) { setReview(null); setReviewing(false); setFrameworkChanged(false); }
    const msgs = [...(baseMsgs !== null ? baseMsgs : history), { role: "user", content: trimmed }];
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "prepare",
          framework,
          profile: profileOverride || profile,
          estimates: estimatesOverride || estimates,
          messages: msgs,
        }),
      });
      if (!response.ok) {
        const status = response.status;
        let detail = "";
        try {
          const errBody = await response.json();
          detail = errBody?.detail ? " (" + errBody.detail + ")" : "";
        } catch (_) {}
        throw new Error(
          "ENGINE:" +
            (status === 429
              ? "Too many requests in a short time. Please wait a moment and try again."
              : "The engine could not be reached. Status " + status + detail + ".")
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
            [...msgs, { role: "assistant", content: clean || "(invalid output)" }],
            profileOverride,
            estimatesOverride
          );
        }
        throw new Error(
          "ENGINE:The engine returned something that is not valid JSON. What came back: " +
            (clean ? clean.slice(0, 300) : "(empty response, no text block)")
        );
      }
      parsed = normaliseResult(parsed);
      // The deterministic checks and the correction cycle now run on the server,
      // where a failure is logged and a retry does not cross the network. What
      // arrives here has already passed them, or has exhausted its two attempts.
      const checkErrors = validateResult(parsed);
      if (checkErrors.length > 0) {
        setError(
          "The engine produced an entry that failed the accounting checks: " +
            checkErrors.join(" ") +
            " Nothing unbalanced is ever shown. Post the transaction again."
        );
        return;
      }
      setResult(parsed);
      if (parsed.status === "question") {
        setHistory([...msgs, { role: "assistant", content: clean }]);
      } else {
        setHistory([]);
      }
      setLastPosted(trimmed);
      setInput("");
      if (parsed.status === "entry") {
        runReview(parsed);
      }
    } catch (e) {
      const msg = e && e.message ? e.message : "";
      setError(
        msg.startsWith("ENGINE:")
          ? msg.slice(7)
          : "The engine returned an invalid response and retries did not fix it. Post the transaction again, splitting it into smaller steps if it is complex."
      );
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    // The entity profile deliberately survives a reset: accounting policies are
    // properties of the entity, not of the transaction being recorded.
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
        .l2l-content { max-width: 1080px; margin: 0 auto; padding: 2.25rem 2rem 2rem; }
        .l2l-prose { text-align: justify; hyphens: auto; }
        @media (max-width: 720px) { .l2l-content { padding: 1.75rem 1.25rem 1.5rem; } }
        .l2l-input { caret-color: ${C.teal}; }
        .l2l-input::placeholder { font-style: italic; color: ${C.neutral}; opacity: 1; }
        .l2l-topbar { border-bottom: 1px solid ${C.rule}; position: sticky; top: 0; z-index: 100; background: ${C.bg}; }
        .l2l-topbar-inner { max-width: 1080px; margin: 0 auto; padding: 1.15rem 2rem 1rem; display: flex; align-items: baseline; gap: 0.4rem 0.7rem; flex-wrap: wrap; }
        .l2l-wordmark { font-family: ${F.mono}; font-size: 1.02rem; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: ${C.ink}; }
        .l2l-wordmark .tl { color: ${C.teal}; }
        .l2l-wordmark .tk { color: ${C.ink}; }
        .l2l-poweredby { font-family: ${F.mono}; font-size: 0.62rem; letter-spacing: 0.14em; text-transform: uppercase; color: ${C.neutral}; }
        .l2l-poweredby a { color: ${C.teal}; }
        .l2l-poweredby a .pk { color: ${C.ink}; }
        .l2l-poweredby a:hover { opacity: 0.7; }
        .l2l-footer { border-top: 1px solid ${C.rule}; background: ${C.bg}; margin-top: 28px; }
        .l2l-footer-inner { max-width: 1080px; margin: 0 auto; padding: 3rem 2rem; display: flex; justify-content: space-between; align-items: flex-start; gap: 2rem; }
        .l2l-footer-brand-name { font-family: ${F.mono}; font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; color: ${C.teal}; margin-bottom: 0.5rem; }
        .l2l-footer-brand-desc { font-size: 0.8rem; color: ${C.neutral}; line-height: 1.6; max-width: 440px; }
        .l2l-footer-bottom { border-top: 1px solid ${C.rule}; padding: 1.25rem 2rem; max-width: 1080px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
        .l2l-footer-copy { font-family: ${F.mono}; font-size: 0.6rem; color: ${C.neutral}; }
        .l2l-footer-connect-links { display: flex; gap: 1rem; }
        .l2l-footer-linkedin { font-family: ${F.mono}; font-size: 0.6rem; color: ${C.teal}; transition: opacity 0.15s; }
        .l2l-footer-linkedin:hover { opacity: 0.7; }
        @media (max-width: 720px) {
          .l2l-topbar-inner { padding: 1rem 1.25rem 0.9rem; }
          .l2l-footer-inner { flex-direction: column; }
          .l2l-footer-brand-desc { max-width: none; }
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

      <div className="l2l-content">
        {/* Intro */}
        <header style={{ marginBottom: 36 }}>
          <p className="l2l-prose" style={{ fontSize: 15, color: C.muted, lineHeight: 1.7 }}>
            Describe a transaction in plain words, in English, Spanish, French, German or Italian. The engine reads it the way an accountant would and replies in English under the framework you select: a named concept, a double entry, every assumption declared, and a register of the accounting policies the entry rests on. What the standard leaves to the entity or to management, it asks for rather than deciding.
          </p>
        </header>

        {/* Reporting framework and entity profile */}
        <section style={{ marginBottom: 26 }}>
          <Eyebrow>Reporting framework</Eyebrow>
          <div style={{
            display: "inline-flex", border: `1px solid ${C.tealMid}`, background: C.bg,
            padding: 4, gap: 4, borderRadius: 2, marginTop: 6,
          }}>
            {FRAMEWORKS.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  if (f.id === framework) return;
                  setFramework(f.id);
                  // Clear the previous entry, which belonged to the old framework,
                  // but keep what the user typed so the same transaction can be
                  // re-posted on identical inputs.
                  const carried = input || lastPosted;
                  reset();
                  setInput(carried);
                  setFrameworkChanged(true);
                }}
                aria-pressed={framework === f.id}
                style={{
                  padding: "9px 18px", border: "none",
                  background: framework === f.id ? C.teal : "transparent",
                  color: framework === f.id ? "white" : C.neutral,
                  fontFamily: F.mono, fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className="l2l-prose" style={{ fontSize: 12.5, color: C.neutral, marginTop: 10, fontFamily: F.mono, letterSpacing: "0.02em" }}>
            The same transaction is recorded differently under each framework. Changing it clears the entry.
          </p>

          {/* Entity profile: built by accumulation, never asked as a questionnaire */}
          {Object.keys(profile).length > 0 && (
            <div style={{ marginTop: 16, border: `1px solid ${C.rule}`, background: "white", padding: "12px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: C.neutral }}>
                  Entity profile
                </span>
                <button
                  onClick={() => setProfile({})}
                  style={{ background: "none", border: "none", padding: 0, fontFamily: F.mono, fontSize: 10, color: C.teal, letterSpacing: "0.06em", textTransform: "uppercase" }}
                >
                  Clear
                </button>
              </div>
              {Object.entries(profile).map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 10, paddingTop: 6, fontSize: 13 }}>
                  <span style={{ color: C.neutral, minWidth: 190 }}>{PROFILE_LABELS[k] || k}</span>
                  <span style={{ color: C.ink }}>{v}</span>
                </div>
              ))}
              <p style={{ fontFamily: F.mono, fontSize: 10, color: C.neutral, marginTop: 10 }}>
                Accounting policies you declared. Reused for every transaction in this session, never stored.
              </p>
            </div>
          )}

          {frameworkChanged && (
            <div style={{ marginTop: 12, border: `1px solid ${C.tealMid}`, background: C.tealLight, padding: "12px 16px" }}>
              <p style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.7 }}>
                Framework changed. The previous entry belonged to the framework you left, so it has been cleared. Your transaction text and the estimates on file have been kept: post it again to see how it is recorded under {FRAMEWORKS.find((f) => f.id === framework)?.label}.
              </p>
            </div>
          )}

          {/* Management estimates: kept so the same transaction can be compared
              across frameworks on identical inputs. */}
          {Object.keys(estimates).length > 0 && (
            <div style={{ marginTop: 12, border: `1px solid ${C.rule}`, borderLeft: `3px solid ${C.orange}`, background: "white", padding: "12px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: C.neutral }}>
                  Management estimates
                </span>
                <button
                  onClick={() => setEstimates({})}
                  style={{ background: "none", border: "none", padding: 0, fontFamily: F.mono, fontSize: 10, color: C.teal, letterSpacing: "0.06em", textTransform: "uppercase" }}
                >
                  Clear
                </button>
              </div>
              {Object.entries(estimates).map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 10, paddingTop: 6, fontSize: 13 }}>
                  <span style={{ color: C.neutral, minWidth: 190 }}>{k}</span>
                  <span style={{ color: C.ink }}>{v}</span>
                </div>
              ))}
              <p style={{ fontFamily: F.mono, fontSize: 10, color: C.neutral, marginTop: 10 }}>
                Judgements you supplied as management. Held across a change of framework so the same transaction is compared on identical inputs.
              </p>
            </div>
          )}
        </section>

        {/* Input */}
        <section style={{ background: "white", border: `1px solid ${C.rule}`, padding: 20, marginBottom: 16 }}>
          <Eyebrow>{awaitingAnswer ? "Your answer" : "The transaction"}</Eyebrow>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            autoFocus
            className="l2l-input"
            placeholder={awaitingAnswer ? "Answer the question below the form" : "Write what happened, in your own words."}
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

        <div ref={outRef} />

        {/* Error */}
        {error && (
          <section style={{ background: "white", borderLeft: `3px solid ${C.red}`, border: `1px solid ${C.rule}`, padding: 20, marginBottom: 24 }}>
            <Eyebrow>Engine error</Eyebrow>
            <p className="l2l-prose" style={{ fontSize: 14.5, lineHeight: 1.7, color: C.ink }}>{error}</p>
          </section>
        )}

        {/* Question: guided completion */}
        {result && result.status === "question" && (
          <section style={{ background: C.tealLight, borderLeft: `3px solid ${C.teal}`, padding: 20, marginBottom: 24 }}>
            <Eyebrow>Complete the entry</Eyebrow>
            {result.reading && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: C.neutral, marginBottom: 4 }}>On file</div>
                <p className="l2l-prose" style={{ fontSize: 13.5, lineHeight: 1.7, color: C.ink }}>{result.reading}</p>
                {Array.isArray(result.onFile) && result.onFile.length > 0 && (
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                    {result.onFile.map((o, i) => (
                      <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: C.muted }}>{o}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 14 }}>{result.question}</p>
            {result.missing && result.missing.length > 0 ? (
              <div>
                {result.missing.map((m) => (
                  <div key={m.id} style={{ marginBottom: 16 }}>
                    <label htmlFor={"f-" + m.id} style={{ display: "block", marginBottom: 6 }}>
                      <span style={{ fontFamily: F.mono, fontSize: 11.5, color: C.tealDark }}>{m.label}</span>
                      {m.scope && m.scope !== "transaction" && (
                        <span style={{
                          fontFamily: F.mono, fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase",
                          color: m.scope === "estimate" ? C.orange : C.neutral, marginLeft: 8,
                        }}>
                          {m.scope === "estimate" ? "Management estimate" : "Entity policy"}
                        </span>
                      )}
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
                <p className="l2l-prose" style={{ fontSize: 14.5, lineHeight: 1.7, color: C.ink }}>{result.reading}</p>
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
              <p className="l2l-prose" style={{ fontSize: 14.5, lineHeight: 1.75, color: C.muted }}>{result.concept?.definition}</p>
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

            {/* Policy register: which entity accounting policies this entry rests on,
                and whether the entity actually declared them. */}
            {result.policyRegister && result.policyRegister.length > 0 && (
              <section style={{ background: "white", border: `1px solid ${C.rule}`, borderLeft: `3px solid ${C.orange}`, padding: 20, marginBottom: 14 }}>
                <Eyebrow>Policy register</Eyebrow>
                <p className="l2l-prose" style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.7, margin: "4px 0 14px" }}>
                  Accounting policies this entry relies on, and where each one came from.
                </p>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.rule}` }}>
                      <th style={{ textAlign: "left", padding: "0 8px 6px 0", fontFamily: F.mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: C.neutral, fontWeight: 400 }}>Policy</th>
                      <th style={{ textAlign: "left", padding: "0 8px 6px 0", fontFamily: F.mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: C.neutral, fontWeight: 400 }}>Applied</th>
                      <th style={{ textAlign: "left", padding: "0 0 6px 0", fontFamily: F.mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: C.neutral, fontWeight: 400 }}>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.policyRegister.map((r, i) => {
                      const undeclared = r.source === "undeclared";
                      return (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.rule}` }}>
                          <td style={{ padding: "8px 8px 8px 0", color: C.ink }}>{r.policy}</td>
                          <td style={{ padding: "8px 8px 8px 0", fontFamily: F.mono, fontSize: 12.5, color: C.ink }}>{r.value}</td>
                          <td style={{ padding: "8px 0", fontFamily: F.mono, fontSize: 10.5, letterSpacing: "0.05em", textTransform: "uppercase", color: undeclared ? C.orange : C.neutral, fontWeight: undeclared ? 500 : 400 }}>
                            {r.source === "entity"
                              ? "Declared by entity"
                              : r.source === "management"
                              ? "Supplied by management"
                              : r.source === "contract"
                              ? "Stated in the contract"
                              : r.source === "framework"
                              ? "Required by framework"
                              : "Not declared"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {result.policyRegister.some((r) => r.source === "undeclared") && (
                  <p className="l2l-prose" style={{ fontSize: 13, color: C.ink, lineHeight: 1.7, marginTop: 14 }}>
                    The policies marked as not declared were applied at their most common treatment so that the entry could be produced. Check them against the entity accounting manual before treating this record as final.
                  </p>
                )}
              </section>
            )}

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
                    <p className="l2l-prose" style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.7, marginTop: 6 }}>
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

        {/* Coverage map: a declared perimeter reads as professional,
            an incomplete one left unsaid reads as abandoned. */}
        <section style={{ marginTop: 40, paddingTop: 22, borderTop: `1px solid ${C.rule}` }}>
          <Eyebrow>Coverage</Eyebrow>
          <p className="l2l-prose" style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.7, margin: "4px 0 14px" }}>
            One card per topic, each carrying a common core and a separate branch for IFRS, US GAAP and OIC. Recognition and measurement are in scope; presentation and disclosure are not, and that is a stated boundary rather than a gap.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 8 }}>
            {DOMAINS.map((d) => (
              <div
                key={d.id}
                style={{
                  border: `1px solid ${d.covered ? C.tealMid : C.rule}`,
                  background: d.covered ? C.tealLight : C.bg,
                  padding: "8px 10px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontFamily: F.mono, fontSize: 11, color: d.covered ? C.tealDark : C.neutral }}>{d.id}</span>
                  <span style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: d.covered ? C.green : C.neutral }}>
                    {d.covered ? "Live" : "Planned"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.4, marginTop: 3 }}>{d.name}</div>
              </div>
            ))}
          </div>
        </section>

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
