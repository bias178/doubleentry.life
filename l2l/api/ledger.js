// Language to Ledger — serverless endpoint (Vercel)
// Architecture v2, per spec v2.0.
//
// All prompts and treatment cards live here, server-side, and never reach the
// browser. The client may only choose a role and supply the entity profile it
// is holding for the session; it can never supply a system prompt.
//
// Card scheme: one card per topic (LEA, REV, INV, PPE, ...), each with a common
// core plus a branch per reporting framework. Only the selected framework's
// branch enters the prompt, which keeps the context small and prevents one
// framework's treatment from bleeding into another.

const ALLOWED_ORIGINS = [
  "https://l2l.doubleentry.life",
  "https://doubleentry.life",
];

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = { prepare: 1200, review: 800 };

// ---- Cost instrumentation ----
// Rates in USD per million tokens, checked 2 Aug 2026. Re-verify before use.
const PRICE_PER_MTOK = { input: 3.0, output: 15.0, cacheRead: 0.3 };
const ROUTER_MODEL = "claude-haiku-4-5-20251001";
const ROUTER_PRICE_PER_MTOK = { input: 1.0, output: 5.0, cacheRead: 0.1 };

function logUsage(role, usage, price = PRICE_PER_MTOK, model = MODEL) {
  if (!usage) {
    console.log(`LEDGER_COST role=${role} usage=unavailable`);
    return;
  }
  const inTok = usage.input_tokens || 0;
  const outTok = usage.output_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;
  const cacheWrite = usage.cache_creation_input_tokens || 0;
  const usd =
    (inTok * price.input + outTok * price.output + cacheRead * price.cacheRead) / 1e6;
  console.log(
    `LEDGER_COST role=${role} model=${model} in=${inTok} out=${outTok} ` +
      `cache_read=${cacheRead} cache_write=${cacheWrite} usd=${usd.toFixed(5)}`
  );
}

// ---- Rate limit (per IP, per serverless instance) ----
const WINDOW_MS = 60 * 60 * 1000;
const MAX_CALLS = 40;
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.start > WINDOW_MS) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  rec.count += 1;
  if (hits.size > 5000) hits.clear();
  return rec.count > MAX_CALLS;
}

// ---- Reporting frameworks ----
// Three options, never four: IAS are not a separate body, they are the standards
// issued up to 2001 and together with the IFRSs they form the IFRS Standards.
const FRAMEWORKS = {
  IFRS: "IFRS Standards",
  USGAAP: "US GAAP",
  OIC: "OIC (Italian GAAP)",
};

// ---- Entity profile fields ----
// Collected by accumulation, never as an opening questionnaire. Each card asks
// only for what it needs, and the answer is reused for the rest of the session.
const PROFILE_FIELDS = {
  functionalCurrency: "Functional currency",
  yearEnd: "Financial year end",
  capitalisationThreshold: "Capitalisation threshold",
  inventoryCostFormula: "Inventory cost formula",
  ppeMeasurementModel: "Measurement model for property, plant and equipment",
  leaseShortTermExemption: "Short-term lease exemption (12 months or less)",
  leaseLowValueExemption: "Low-value asset lease exemption and threshold",
  incrementalBorrowingRate: "Incremental borrowing rate",
  goodwillAmortisationPeriod: "Goodwill amortisation period",
  developmentCostPolicy: "Capitalisation policy for development costs",
};

// ---- Treatment cards ----
// Common core is framework independent. Branches carry the divergence.

const CARDS = {
  "LEA-01": {
    title: "Leases, lessee accounting",
    trigger:
      "The entity obtains the right to use an identified asset for a period of time in exchange for consideration: property rental, vehicle or equipment hire, finance lease, or a service contract that embeds the use of a specified asset.",
    facts:
      "Asset under contract; contractual term and any renewal, termination or purchase options; amount and frequency of payments; variable payments and their basis; prepayments, incentives received, initial direct costs; purchase option price if any; commencement date.",
    entityPolicies:
      "leaseShortTermExemption (whether the entity elects the 12-month exemption, by class of asset; available under IFRS and US GAAP); leaseLowValueExemption (whether the entity elects it and the threshold adopted; AVAILABLE ONLY UNDER IFRS); capitalisationThreshold where relevant.",
    managementEstimates:
      "Lease term including options whose exercise is reasonably certain, which is a management judgement and not a contractual fact, and must be asked whenever the contract contains options. Discount rate: the rate implicit in the lease if determinable, otherwise the entity's incremental borrowing rate. Under US GAAP, for the classification tests: fair value of the asset and its economic life. None of these may be produced by the model.",
    core:
      "A lease exists when the contract conveys the right to control the use of an identified asset for a period of time. Control requires both the right to obtain substantially all the economic benefits from use and the right to direct how and for what purpose the asset is used. If the supplier holds a substantive substitution right, there is no identified asset and no lease: the contract is a service and the consideration is an expense of the period. This qualification is common to the three frameworks in substance. What follows it is not.",
    branches: {
      IFRS:
        "Single model. At commencement recognise a lease liability at the present value of the unpaid lease payments, discounted at the rate implicit in the lease or, if not determinable, at the incremental borrowing rate supplied by management. Recognise a right-of-use asset equal to the liability, increased by prepayments, initial direct costs and dismantling obligations, and reduced by incentives received. Subsequently depreciate the right-of-use asset over the lease term, or over the asset's useful life when the contract transfers ownership or a purchase option is reasonably certain to be exercised. Unwind the liability recognising interest and reducing it by payments made. Two optional exemptions: leases of 12 months or less, and leases of low-value assets. Both are entity policy elections and, when taken, the payments are recognised as an expense over the term. The low-value exemption has no monetary threshold in the standard: the threshold is entity policy. Expense profile is front-loaded, because interest decreases while depreciation is even. Reference: IFRS 16.",
      USGAAP:
        "Dual model retained for the lessee. A right-of-use asset and a lease liability are recognised in both cases, but classification drives the expense profile. The lease is a finance lease if any one of these holds: ownership transfers by the end of the term; there is a purchase option reasonably certain to be exercised; the term covers the major part of the asset's remaining economic life; the present value of payments amounts to substantially all of the asset's fair value; the asset is so specialised it has no alternative use to the lessor. Otherwise it is an operating lease. In a finance lease, amortisation and interest are presented separately and total cost decreases over the term. In an operating lease a single straight-line lease cost is recognised over the term, with the right-of-use asset adjusted as the balancing figure. The 12-month exemption is available as a policy election by class of asset. THERE IS NO LOW-VALUE EXEMPTION: this is the divergence from IFRS that is most often applied by mistake. Reference: ASC 842.",
      OIC:
        "Patrimonial method. The asset is not recognised among assets and no liability is recognised for future payments: the payments are costs of the period, allocated on an accrual basis over the term of the contract. An initial larger payment is a prepaid expense released over the term. On exercise of the purchase option the asset enters property, plant and equipment at the option price and follows ordinary depreciation from that point. The notes require disclosure of the effects the financial method would have produced: present value of remaining payments, finance charge for the period, asset value and notional depreciation. Produce that supplementary schedule only if management supplies the discount rate, because it is the same estimate the IFRS branch requires. Reference: OIC 12 and the Civil Code for the note disclosure.",
    },
    exits:
      "If the supplier holds a substantive substitution right, or the entity does not direct the use of the asset, this is not a lease: the contract is a service and the consideration is an expense of the period. Lessor accounting is outside this card. An asset acquired on exercise of a purchase option leaves this card and enters PPE. Impairment of a right-of-use asset is treated in IMP. A later contract modification that changes scope or consideration requires a remeasurement and stays in this card.",
    errors:
      "Applying the low-value exemption under US GAAP, where it does not exist. Recognising the asset on the balance sheet under OIC. Deriving a discount rate instead of asking for it. Assuming the lease term equals the contractual term when options exist, without asking for management's judgement. Under US GAAP, applying the finance lease expense profile to a lease classified as operating. Depreciating the right-of-use asset over the asset's useful life when ownership does not transfer and the purchase option is not reasonably certain.",
  },
};

// Domain map shown in the interface. Status drives what the router may select.
const DOMAINS = [
  { id: "LEA", name: "Leases", status: "covered" },
  { id: "REV", name: "Revenue", status: "planned" },
  { id: "INV", name: "Inventory", status: "planned" },
  { id: "PPE", name: "Property, plant and equipment", status: "planned" },
  { id: "EMP", name: "Employee benefits", status: "planned" },
  { id: "INT", name: "Intangible assets", status: "planned" },
  { id: "IMP", name: "Impairment", status: "planned" },
  { id: "PRO", name: "Provisions", status: "planned" },
  { id: "FIN", name: "Financial instruments", status: "planned" },
  { id: "FX", name: "Foreign currency", status: "planned" },
  { id: "TAX", name: "Income taxes", status: "planned" },
  { id: "GRP", name: "Business combinations and consolidation", status: "planned" },
  { id: "EVT", name: "Events after the reporting period, changes and errors", status: "planned" },
];

function cardText(id, framework) {
  const c = CARDS[id];
  if (!c) return null;
  const branch = c.branches[framework];
  return [
    `${id} ${c.title}`,
    `Trigger: ${c.trigger}`,
    `Facts required: ${c.facts}`,
    `Entity policies this card relies on: ${c.entityPolicies}`,
    `Management estimates this card requires: ${c.managementEstimates}`,
    `Common core: ${c.core}`,
    `Treatment under ${FRAMEWORKS[framework]}: ${branch}`,
    `Exit conditions and routing: ${c.exits}`,
    `Errors to prevent: ${c.errors}`,
  ].join("\n");
}

function buildMatrix(ids, framework) {
  const chosen = (ids || []).filter((id) => CARDS[id]);
  const list = chosen.length ? chosen : Object.keys(CARDS);
  return list.map((id) => cardText(id, framework)).join("\n\n");
}

const CARD_INDEX = Object.entries(CARDS)
  .map(([id, c]) => `${id} ${c.title}. ${c.trigger}`)
  .join("\n");

const COVERED_DOMAINS = DOMAINS.filter((d) => d.status === "covered")
  .map((d) => d.id)
  .join(", ");
const PLANNED_DOMAINS = DOMAINS.filter((d) => d.status !== "covered")
  .map((d) => `${d.id} ${d.name}`)
  .join("; ");

function profileText(profile) {
  const known = Object.entries(PROFILE_FIELDS)
    .filter(([k]) => profile && profile[k])
    .map(([k, label]) => `${label}: ${profile[k]}`);
  if (!known.length) return "Nothing on file yet beyond the reporting framework.";
  return known.join("\n");
}

// ---- Prompts ----

const SYSTEM_PROMPT = (matrix, framework, profile) => `You are Language to Ledger, an educational demonstration by Double Entry Life. You translate a transaction, described in natural language, into a rigorous double-entry accounting record under a stated reporting framework.

Reporting framework in force for this session: ${FRAMEWORKS[framework]}. Apply it and no other. Never mix treatments across frameworks.

Entity profile on file for this session:
${profileText(profile)}

THE GOVERNING PRINCIPLE OF THIS SYSTEM.
Accounting standards do not say what to record in a specific case. They say on what conditions an item is recognised and how it is measured. Between the condition and the entry there is always a step the standard itself assigns to someone: to management when it is an estimate, to the entity when it is an accounting policy it must have adopted.
You never fill that step with a judgement of your own. You identify it, name it, and ask for it. If it cannot be obtained, you apply the most common treatment and declare it as such, never as a fact.
A general model fills gaps. This system names them.

THREE KINDS OF MISSING INFORMATION, handled differently.
1. FACTS of the transaction: amounts, dates, terms, contractual rates. Ask for them together. Without them, produce no entry.
2. ENTITY ACCOUNTING POLICIES: thresholds, cost formulas, measurement models, exemptions elected. These are choices the entity must have adopted. Ask once; they are held in the entity profile above and reused. If not declared, apply the most common treatment and record it in the policy register as not declared.
3. MANAGEMENT ESTIMATES: value in use, useful life, net realisable value, standalone selling price, incremental borrowing rate, the reasonably certain term of an option. The standard assigns these to management. NEVER produce one, not even as an order of magnitude, not even if the user asks you to. If missing, do not write the entry: say which estimate is missing and whose it is.

Respond ONLY with a single minified JSON object, no markdown, no fences, English only, in one of two shapes.

When you can produce the record:
{"status":"entry","framework":string,"reading":string,"concept":{"name":string,"reference":string or null,"ruleId":string,"definition":string},"entries":[{"title":string,"lines":[{"account":string,"debit":number or null,"credit":number or null}]}],"assumptions":[string],"policyRegister":[{"policy":string,"value":string,"source":"entity"|"management"|"undeclared"}],"impact":[{"item":string,"prior":number or null,"current":number or null,"change":number or null}],"closing":string}

When something essential is missing:
{"status":"question","reading":string,"message":string,"onFile":[string],"fields":[{"key":string,"label":string,"hint":string,"scope":"transaction"|"entity"|"estimate","options":[{"label":string,"consequence":string,"common":boolean}] or null}]}

Rules.
1. GROUNDING. "reading" restates the transaction exactly as given, plus the framework applied. Every figure in the entries must trace back to the reading, to a declared assumption, or to the policy register. A figure that traces to none of these is invented and must never appear.
2. Ask for all missing items at once, never one at a time. "onFile" lists what the user has already given, including profile values, so nothing looks lost. Never ask again for something already provided.
3. "scope" tells the interface what kind of gap it is: "transaction" for a fact, "entity" for an accounting policy that will be stored in the profile, "estimate" for a management judgement. Set it correctly: it drives where the answer is kept.
4. Where the standard permits alternative treatments, do not use a free field. Give at most three options, each with a short label and a one-sentence plain-language consequence in the accounts, one marked common. Describing consequences is not advice; never say which option is preferable.
5. POLICY REGISTER. List every entity accounting policy the entry relies on. "source" is "entity" when the user declared it, "management" when it is a figure management supplied, "undeclared" when you applied the most common treatment because nothing was declared. If the entry relies on no policy, return an empty array.
6. TRACEABILITY. Apply the treatment card below and set concept.ruleId to its ID. Covered domains: ${COVERED_DOMAINS}. If the transaction belongs to a domain not yet covered (${PLANNED_DOMAINS}), do not force the nearest card onto it: set ruleId to "none", say plainly in the reading that the domain is not yet covered, and record only what general recognition principles support.
7. Once you have asked for data on a transaction you are committed: when the data arrives, produce the entry. Gathering data and then refusing is forbidden.
8. A transaction described in the future is never refused: produce it as a prospective simulation and say so in the reading.
9. Size limits, to prevent truncation: minified JSON, at most three entries of five lines each, for financing and instalments only initial recognition plus the first payment, at most four assumptions, at most six impact rows.

TREATMENT CARD IN FORCE.
${matrix}

Style: no em dash, no en dash, no exclamation marks, direct tone, no unsolicited advice, no motivational language. Amounts as plain numbers, no currency symbol.`;

const REVIEWER_PROMPT = (matrix, framework, profile) => `You are the reviewer in Language to Ledger. A first model, the preparer, has read a transaction and produced a double-entry record under ${FRAMEWORKS[framework]}. Your job is an independent second pass, the four-eyes principle: you judge the preparer's work, you do NOT rewrite it and you never produce entries yourself.

Entity profile on file:
${profileText(profile)}

You receive the preparer's grounded restatement, its declared assumptions, its policy register and its full output. Review on three fronts.

ARITHMETIC beyond the automated checks. A deterministic layer has already confirmed that debits equal credits and that impact deltas are internally consistent, so do not re-flag those. Review what those checks cannot see: present value and discounting, depreciation and amortisation schedules, the split of a payment between principal and interest, and any figure whose derivation the preparer should have shown.

ACCOUNTING MERIT. Was the correct card applied, and does concept.ruleId match what the case calls for? Was the card's rule for THIS framework followed, rather than the rule of another framework? Cross-framework contamination is a specific and serious finding: for example applying the low-value lease exemption outside IFRS, or recognising a leased asset on the balance sheet under OIC.

GROUNDING AND POLICY DISCIPLINE. Does every amount trace back to the reading, to a declared assumption, or to the policy register? A figure that appears in the entries but nowhere else is an invented number and is the most serious finding. Separately: did the preparer produce a figure that the standard reserves to management, such as a discount rate, a useful life or a recoverable amount, instead of asking for it? That is equally serious. And does the policy register list every entity policy the entry actually relies on, with the right source?

Use the card below as your authority. You receive in full only the card the routing stage selected, plus the trigger line of every card in the system. If the preparer cited a card you did not receive in full, and the index suggests another fits better, raise it as a finding.

${matrix}

Trigger index, every card in the system:
${CARD_INDEX}

Respond ONLY with a single minified JSON object, no markdown, no fences, English only:
{"status":"clean"|"issues","findings":[{"severity":"error"|"warning","area":string,"detail":string}]}

"clean" with an empty findings array means the work is sound. Use "issues" when anything is wrong. "error" is a real accounting, grounding or framework fault; "warning" is a defensible but questionable choice or a missing declaration. "area" is a short tag, for example "Grounding", "Framework", "Policy register", "Discounting". "detail" is one plain sentence naming the problem specifically. Maximum four findings, most important first. Do not invent problems to appear thorough: if the work is sound, say so.`;

const ROUTER_PROMPT = `You route a transaction to the treatment card that governs it. You produce no accounting judgement, no entries and no explanation. You return card IDs only.

Below is the trigger line of every card currently in the system.

${CARD_INDEX}

Domains not yet covered by any card: ${PLANNED_DOMAINS}

Read the transaction and decide which card governs it.

Respond ONLY with a single minified JSON object, no markdown, no fences:
{"ids":[string],"confident":boolean}

Rules.
Return the single best card with "confident": true when one card clearly governs the case.
When two cards could plausibly govern it, return both, most likely first, with "confident": false. Never more than two.
When the transaction is a follow-up answer to a question, route on the original transaction it refers to.
When the transaction belongs to a domain not yet covered, return {"ids":[],"confident":false}. Do not route it to the nearest resembling card: forcing the wrong card produces a wrong treatment.
Prefer returning two cards, or none, over guessing one.`;

// ---- Routing stage ----

async function routeCards(messages) {
  // With a single card in the system a routing call would cost more than it
  // saves, so skip it. The mechanism stays in place for when the matrix grows.
  const ids = Object.keys(CARDS);
  if (ids.length <= 1) {
    console.log(`LEDGER_ROUTE skipped=single-card ids=${ids.join(",")}`);
    return ids;
  }
  const userText = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n")
    .slice(0, 4000);
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ROUTER_MODEL,
        max_tokens: 60,
        system: ROUTER_PROMPT,
        messages: [{ role: "user", content: userText }],
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("Router upstream error", response.status, data?.error?.type);
      return null;
    }
    logUsage("route", data.usage, ROUTER_PRICE_PER_MTOK, ROUTER_MODEL);
    const raw = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .replace(/```json|```/g, "")
      .trim();
    const parsed = JSON.parse(raw);
    const picked = Array.isArray(parsed.ids)
      ? parsed.ids.filter((id) => CARDS[id]).slice(0, 2)
      : [];
    console.log(`LEDGER_ROUTE ids=${picked.join(",") || "none"} confident=${!!parsed.confident}`);
    return picked;
  } catch (e) {
    console.error("Router failed", e?.message);
    return null;
  }
}

// ---- Handler ----

export default async function handler(req, res) {
  const origin = req.headers.origin || "";

  let sameOrigin = false;
  try {
    sameOrigin = origin ? new URL(origin).host === req.headers.host : false;
  } catch (_) {}
  const allowed = sameOrigin || ALLOWED_ORIGINS.includes(origin);

  if (allowed && origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (origin && !allowed) {
    return res.status(403).json({ error: "Origin not allowed", detail: "origin_rejected" });
  }

  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  if (rateLimited(ip)) {
    return res.status(429).json({ error: "Too many requests. Try again later." });
  }

  try {
    const { role, messages, framework, profile } = req.body || {};

    if (role !== "prepare" && role !== "review") {
      return res.status(400).json({ error: "Invalid role" });
    }
    if (!FRAMEWORKS[framework]) {
      return res.status(400).json({ error: "Invalid or missing reporting framework" });
    }
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 12) {
      return res.status(400).json({ error: "Invalid messages" });
    }
    const totalChars = messages.reduce(
      (n, m) => n + (typeof m?.content === "string" ? m.content.length : 0),
      0
    );
    if (totalChars > 12000) {
      return res.status(413).json({ error: "Payload too large" });
    }
    const clean = messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? "").slice(0, 6000),
    }));

    // Accept only known profile keys, as short strings.
    const safeProfile = {};
    if (profile && typeof profile === "object") {
      for (const key of Object.keys(PROFILE_FIELDS)) {
        if (typeof profile[key] === "string" && profile[key].trim()) {
          safeProfile[key] = profile[key].trim().slice(0, 200);
        }
      }
    }

    // Card selection. The preparer routes; the reviewer reads the cited Rule ID
    // from the output it is judging, so no second routing call is needed.
    let cardIds;
    if (role === "prepare") {
      cardIds = await routeCards(clean);
    } else {
      const cited = (JSON.stringify(clean).match(/[A-Z]{3}-\d\d/g) || [])
        .filter((id, i, a) => a.indexOf(id) === i)
        .filter((id) => CARDS[id])
        .slice(0, 2);
      cardIds = cited.length ? cited : null;
      console.log(`LEDGER_ROUTE role=review cited=${cited.join(",") || "none"}`);
    }
    const matrixText = buildMatrix(cardIds, framework);

    const system =
      role === "prepare"
        ? SYSTEM_PROMPT(matrixText, framework, safeProfile)
        : REVIEWER_PROMPT(matrixText, framework, safeProfile);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS[role],
        system,
        messages: clean,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Upstream error", response.status, data?.error?.type, data?.error?.message);
      return res.status(502).json({
        error: "Upstream error",
        detail: String(data?.error?.type || response.status),
      });
    }
    logUsage(role, data.usage);
    return res.status(200).json({ content: data.content });
  } catch (error) {
    console.error("Handler error", error?.message);
    return res.status(500).json({ error: "Server error" });
  }
}
