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
// Ceilings, not targets. The brevity rules in the prompts keep normal responses
// well below these; the headroom exists because a truncated answer forces a full
// retry, which costs several times the tokens it would have saved.
const MAX_TOKENS = { prepare: 1400, review: 900 };

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

// ---- Deterministic finance arithmetic ----
//
// A language model cannot compute an annuity factor reliably, and a second model
// asked to check the first anchors on the first one's figure instead of
// recomputing. Both were observed: the preparer produced a factor of 34.3851
// where the correct value is 35.1860, and the reviewer "independently
// recomputed" 34.3856, so a 360 unit error passed while a 0.20 rounding
// difference was flagged.
//
// The model therefore no longer computes. It declares what it needs computed,
// this code computes it, and the model builds the entries from the figures
// returned. The class of error is removed rather than corrected.

function monthlyRate(annualRate, convention) {
  if (convention === "simple") return annualRate / 12;
  return Math.pow(1 + annualRate, 1 / 12) - 1; // compounded, the default
}

function annuityFactor(periods, ratePerPeriod, timing) {
  if (ratePerPeriod === 0) return periods;
  const factor = (1 - Math.pow(1 + ratePerPeriod, -periods)) / ratePerPeriod;
  return timing === "advance" ? factor * (1 + ratePerPeriod) : factor;
}

const round2 = (x) => Math.round(x * 100) / 100;

function computeLeaseMeasurement(req) {
  const payment = Number(req.payment);
  const periods = Math.round(Number(req.periods));
  const annualRate = Number(req.annualRate);
  const timing = req.timing === "advance" ? "advance" : "arrears";
  const convention = req.rateConvention === "simple" ? "simple" : "compounded";
  const optionAmount = req.optionAmount ? Number(req.optionAmount) : 0;
  const includeOption = req.includeOption === true && optionAmount > 0;

  if (!isFinite(payment) || payment <= 0) return { error: "invalid payment" };
  if (!isFinite(periods) || periods <= 0 || periods > 600) return { error: "invalid periods" };
  if (!isFinite(annualRate) || annualRate < 0 || annualRate > 1) {
    return { error: "invalid annual rate: express it as a decimal, 0.015 for 1.5 percent" };
  }

  const i = monthlyRate(annualRate, convention);
  const factor = annuityFactor(periods, i, timing);
  const pvPayments = payment * factor;
  const pvOption = includeOption ? optionAmount / Math.pow(1 + i, periods) : 0;
  const liability = pvPayments + pvOption;

  // With payments in advance the first payment falls at commencement, so
  // interest accrues on the balance net of it.
  const balanceForInterest = timing === "advance" ? liability - payment : liability;
  const firstInterest = balanceForInterest * i;
  const firstPrincipal = timing === "advance" ? payment : payment - firstInterest;

  return {
    ok: true,
    monthlyRate: i,
    annuityFactor: factor,
    presentValueOfPayments: round2(pvPayments),
    presentValueOfOption: round2(pvOption),
    liabilityAtCommencement: round2(liability),
    firstPeriodInterest: round2(firstInterest),
    firstPeriodPrincipal: round2(firstPrincipal),
    liabilityAfterFirstPeriod: round2(
      timing === "advance" ? liability - payment + firstInterest : liability - firstPrincipal
    ),
    straightLineDepreciationPerPeriod: round2(liability / periods),
    workings:
      `Monthly rate from ${(annualRate * 100).toFixed(3)} percent per annum, ` +
      `${convention === "simple" ? "simple division by 12" : "compounded as (1+r)^(1/12)-1"}: ` +
      `${i.toFixed(9)}. Annuity factor for ${periods} periods ` +
      `${timing === "advance" ? "in advance" : "in arrears"}: ${factor.toFixed(6)}. ` +
      `Present value of payments ${round2(pvPayments).toFixed(2)}` +
      (includeOption
        ? `, present value of the ${optionAmount} option at period ${periods} ${round2(pvOption).toFixed(2)}`
        : "") +
      `. Liability at commencement ${round2(liability).toFixed(2)}. ` +
      `First period interest ${round2(firstInterest).toFixed(2)}, principal ${round2(firstPrincipal).toFixed(2)}. ` +
      `Computed in code, not by the model.`,
  };
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

// Management estimates are properties of the transaction and of management's
// judgement, not of the reporting framework. They persist across a change of
// framework so that the same transaction can be compared on identical inputs.
function estimatesText(estimates) {
  const known = Object.entries(estimates || {}).map(([k, v]) => `${k}: ${v}`);
  if (!known.length) return "None supplied yet.";
  return known.join("\n");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ---- Prompts ----

const SYSTEM_PROMPT = (matrix, framework, profile, estimates) => `You are Language to Ledger, an educational demonstration by Double Entry Life. You translate a transaction, described in natural language, into a rigorous double-entry accounting record under a stated reporting framework.

Reporting framework in force for this session: ${FRAMEWORKS[framework]}. Apply it and no other. Never mix treatments across frameworks.

Today's date: ${today()}.

Entity profile on file for this session:
${profileText(profile)}

Management estimates already supplied for this transaction:
${estimatesText(estimates)}

THE GOVERNING PRINCIPLE. Standards do not say what to record in a specific case; they say on what conditions an item is recognised and how it is measured. Between the condition and the entry there is always a step the standard assigns to someone: to management when it is an estimate, to the entity when it is a policy it must have adopted. You never fill that step with a judgement of your own. You identify it, name it, and ask for it. If it cannot be obtained you apply the most common treatment and declare it as such, never as a fact. A general model fills gaps; this system names them.

THREE KINDS OF MISSING INFORMATION.
1. FACTS of the transaction: amounts, dates, terms, contractual rates. Ask for them together; without them, no entry.
2. ENTITY ACCOUNTING POLICIES: thresholds, cost formulas, measurement models, exemptions elected. Choices the entity must have adopted. Ask once, they are held in the profile above and reused. If not declared, apply the most common treatment and record it in the policy register as not declared.
3. MANAGEMENT ESTIMATES: value in use, useful life, net realisable value, standalone selling price, incremental borrowing rate, the reasonably certain term of an option. NEVER produce one, not even as an order of magnitude, not even if asked. If missing, write no entry: say which estimate is missing and whose it is.

Respond ONLY with a single minified JSON object, no markdown, no fences, English only, in one of two shapes.

When you can produce the record:
{"status":"entry","framework":string,"reading":string,"concept":{"name":string,"reference":string or null,"ruleId":string,"definition":string},"entries":[{"title":string,"lines":[{"account":string,"debit":number or null,"credit":number or null}]}],"assumptions":[string],"policyRegister":[{"policy":string,"value":string,"source":"entity"|"management"|"framework"|"undeclared"}],"impactStatement":string,"impact":[{"item":string,"prior":number or null,"current":number or null,"change":number or null}],"closing":string}

When the treatment requires a present value, an annuity or an unwind schedule, do not compute it. Ask the code to compute it and stop:
{"status":"calculate","reading":string,"request":{"kind":"lease","payment":number,"periods":number,"annualRate":number,"timing":"arrears"|"advance","rateConvention":"compounded"|"simple","optionAmount":number or null,"includeOption":boolean}}
The rate is a decimal: 0.015 for 1.5 percent. "periods" is the number of payment periods, months for a monthly lease. "includeOption" is true only when management judged exercise reasonably certain. You will be called again with the computed figures and will then produce the entry using them unchanged.

When something essential is missing:
{"status":"question","reading":string,"message":string,"onFile":[string],"fields":[{"key":string,"label":string,"hint":string,"scope":"transaction"|"entity"|"estimate","options":[{"label":string,"consequence":string,"common":boolean}] or null}]}

Rules.
1. GROUNDING. "reading" restates the transaction as given, plus the framework. Every figure in the entries must trace to the reading, a declared assumption, or the policy register. A figure tracing to none of these is invented.
2. ONE QUESTION ROUND, NEVER TWO. You get a single opportunity to ask. Before asking, walk the card's three lists in order, required facts, entity policies, management estimates, and put EVERY item you do not already hold into "fields", even those you think you could infer. Asking for four things at once is correct; asking for two now and two later is a failure. If the conversation already contains one assistant question, you have used your round: do not ask again. Produce the entry with what you have, and for anything still missing apply the most common treatment, record it in the policy register as undeclared, and say so in the assumptions. "onFile" lists what you already hold, including profile and estimates. Never re-ask for something already provided; if a figure you hold is ambiguous, do not open a new round to clarify it, state the reading you adopted in the assumptions instead.
3. "scope" marks each requested item: "transaction" for a fact, "entity" for an accounting policy (stored in the profile), "estimate" for a management judgement. Set it correctly; it drives where the answer is kept.
4. Where the framework permits alternatives, give at most three options, each with a short label and a one-sentence consequence in the accounts, one marked common. Describing consequences is not advice; never say which is preferable.
5. POLICY REGISTER. List every policy the entry relies on. "source" is one of four: "entity" (the user declared it), "management" (a figure management supplied), "framework" (the treatment is imposed and the entity has no choice, for example the patrimonial method for OIC lessees), "undeclared" (alternatives exist, none declared, you applied the most common). Never mark as undeclared what the framework mandates. And do not list as a policy something that is a fact of the contract: a rate stated in the lease agreement is a transaction fact, not an entity election, so the policy line is the choice of WHICH rate to use, not the rate itself.
6. TRACEABILITY. Apply the card below; set concept.ruleId to its ID. Covered: ${COVERED_DOMAINS}. If the transaction belongs to an uncovered domain (${PLANNED_DOMAINS}), do not force the nearest card: set ruleId "none", say so in the reading, and record only what general recognition principles support.
7. Once you have asked for data you are committed: when it arrives, produce the entry.
8. DATES. Today is given above; judge past and future against it. If a date the treatment depends on is missing, ask for it rather than choosing one; if you adopt one to illustrate, say so in the assumptions. A genuinely future transaction is produced as a prospective simulation, declared in the reading.
9. YOU DO NOT DO ARITHMETIC OF THIS KIND. Never compute a present value, an annuity factor, a discount rate conversion, an interest and principal split or a depreciation charge yourself. You are demonstrably unreliable at it: a factor you compute can be wrong by two percent and look plausible. Return status "calculate" with the request instead, and wait. When the figures come back, use them EXACTLY as given, to the cent, in the entries, the impact table and the closing line, and reproduce the supplied "workings" text as one of your assumptions without rewriting it. Never adjust, re-derive or round a figure the code returned. Simple addition and subtraction of figures already given to you is fine; anything involving a rate, a power or a series is not.
10. ENTRIES MUST NOT OVERLAP. Each entry covers a distinct period or event. Never show a single period and then an aggregate including it. Aggregates belong in the impact table, not in journal entries.
11. ASSUMPTIONS ARE CONCLUSIONS, NOT WORKING. Each assumption states what you assumed and why, as a finished sentence. Never show deliberation: no "wait", no "recalculated", no corrected figure followed by a better one, no alternative computations. If you change your mind while computing, only the final position appears. A reader must never see the model thinking.
12. FIGURES MUST AGREE ACROSS BLOCKS. The same quantity carries one value everywhere: a liability of X in an entry is X in the impact table, in the closing line and in the assumptions. Before responding, check the entries against the impact table figure by figure. A disagreement between blocks is a defect, not a rounding difference.
13. BE BRIEF. Output length is a constraint, not a style choice, and a truncated answer is worse than a terse one. "reading" is at most 45 words and states facts, never the arithmetic behind them. "closing" is one sentence of at most 25 words. Each assumption is one sentence; at most three. Policy register values are at most 8 words. At most 2 entries of 4 lines, and for financing or instalments only initial recognition plus the first payment. At most 4 impact rows. Show a calculation only where the figure could not otherwise be derived, and then once.
14. Minified JSON, no line breaks inside strings.

TREATMENT CARD IN FORCE.
${matrix}

Style: no em dash, no en dash, no exclamation marks, direct tone, no unsolicited advice, no motivational language. Amounts as plain numbers, no currency symbol.`;

const REVIEWER_PROMPT = (matrix, framework, profile, estimates) => `You are the reviewer in Language to Ledger. A first model, the preparer, has read a transaction and produced a double-entry record under ${FRAMEWORKS[framework]}. Your job is an independent second pass, the four-eyes principle: you judge the preparer's work, you do NOT rewrite it and you never produce entries yourself.

Today's date: ${today()}.

Entity profile on file:
${profileText(profile)}

Management estimates on file:
${estimatesText(estimates)}

You receive the preparer's restatement, assumptions, policy register and output. Review on three fronts.

FIGURES ARE NOT YOURS TO CHECK. Present values, annuity factors, rate conversions, interest and principal splits and depreciation charges are computed in code before the entry is written, not by the preparer. Do not recompute them and do not raise findings about them: you are no better at that arithmetic than the preparer was, and in testing you reproduced its error while flagging a trivial rounding difference. What you must check instead is whether the figures the code returned were used unchanged: if a number in the entries, the impact table or the closing line differs from the computed figure, or if the same quantity carries two values in different blocks, that is a finding. Whether the calculation was the right one to request, the correct term, timing and inclusion of an option, is accounting merit and belongs below.

ACCOUNTING MERIT. Correct card, correct ruleId, and the rule of THIS framework rather than another. Cross-framework contamination is serious: the low-value lease exemption outside IFRS, or a leased asset on the balance sheet under OIC.
BEFORE MARKING "error", find the sentence in the card that the treatment contradicts. If there is none it is at most a "warning", and if the card supports the preparer raise nothing. A false error destroys trust in every other finding. Note in particular: under US GAAP an operating lease recognises a single straight-line cost while the liability still accretes and the right-of-use asset absorbs the balance, so an accretion figure and a right-of-use reduction in one entry is correct operating-lease mechanics, not finance-lease mechanics.

GROUNDING AND POLICY DISCIPLINE. Does every amount trace to the reading, an assumption, or the policy register? A figure appearing nowhere else is invented, the most serious finding. Did the preparer produce a figure the standard reserves to management, a discount rate, useful life or recoverable amount, instead of asking? Equally serious. Does the register list every policy relied on, with the right source, and does it avoid marking as undeclared what the framework mandates?

Use the card below as your authority. You receive in full only the card the routing stage selected, plus the trigger line of every card in the system. If the preparer cited a card you did not receive in full, and the index suggests another fits better, raise it as a finding.

${matrix}

Trigger index, every card in the system:
${CARD_INDEX}

Respond ONLY with a single minified JSON object, no markdown, no fences, English only:
{"status":"clean"|"issues","findings":[{"severity":"error"|"warning","area":string,"detail":string}]}  (findings: maximum 3)

"clean" with an empty findings array means the work is sound. "error" is a real accounting, grounding or framework fault; "warning" is a defensible but questionable choice or a missing declaration. "area" is a short tag such as "Grounding", "Framework", "Policy register", "Discounting".

HARD OUTPUT LIMITS. These are not stylistic preferences: exceeding them truncates the response and the whole review is lost, which is worse than any finding you might add.
"detail" is ONE sentence, at most 35 words, naming the problem and carrying your recomputed figure where relevant. Never two sentences, never a paragraph, never an explanation of why the rule exists.
At most THREE findings. Report the three most serious and stop, even if you noticed more.
Your entire response must stay under 250 words. Count as you go.
Fewer, sharper findings beat more: two well-founded beat three of which one is wrong. Do not invent problems to appear thorough. Do not restate the preparer's work back to it. Do not preface findings with context.`;

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


function textOf(content) {
  return (content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

// Returns the calculation request if the model asked for one, otherwise null.
function parseCalculationRequest(content) {
  try {
    const raw = textOf(content).replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(raw);
    if (parsed && parsed.status === "calculate" && parsed.request) return parsed.request;
  } catch (_) {}
  return null;
}

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
    const { role, messages, framework, profile, estimates } = req.body || {};

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

    // Management estimates: free-form keys, so cap count and length instead.
    const safeEstimates = {};
    if (estimates && typeof estimates === "object") {
      for (const [k, v] of Object.entries(estimates).slice(0, 12)) {
        if (typeof v === "string" && v.trim()) {
          safeEstimates[String(k).slice(0, 60)] = v.trim().slice(0, 200);
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
        ? SYSTEM_PROMPT(matrixText, framework, safeProfile, safeEstimates)
        : REVIEWER_PROMPT(matrixText, framework, safeProfile, safeEstimates);

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

    let data = await response.json();
    if (!response.ok) {
      console.error("Upstream error", response.status, data?.error?.type, data?.error?.message);
      return res.status(502).json({
        error: "Upstream error",
        detail: String(data?.error?.type || response.status),
      });
    }
    logUsage(role, data.usage);

    // If the preparer asked for a calculation, run it here and call the model
    // back with the figures. This stays inside the one request the client made:
    // the arithmetic round trip is invisible from outside, and the model never
    // gets the chance to compute the figure itself.
    if (role === "prepare") {
      const asked = parseCalculationRequest(data.content);
      if (asked) {
        const computed = computeLeaseMeasurement(asked);
        if (computed.error) {
          console.error("Calculation rejected", computed.error, JSON.stringify(asked));
        }
        console.log(
          `LEDGER_CALC kind=${asked.kind || "lease"} ` +
            (computed.ok
              ? `liability=${computed.liabilityAtCommencement} factor=${computed.annuityFactor.toFixed(6)}`
              : `error=${computed.error}`)
        );
        const followUp = computed.ok
          ? "Computed figures, to be used exactly as given:\n" +
            JSON.stringify(computed) +
            "\nNow produce the entry with status \"entry\". Use these figures unchanged, " +
            "and include the \"workings\" text as one of your assumptions, verbatim."
          : "The calculation request was rejected: " +
            computed.error +
            ". Correct the request and return status \"calculate\" again, or if the fault " +
            "cannot be corrected return status \"question\" asking the user for the figure.";

        const second = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: MAX_TOKENS.prepare,
            system,
            messages: [
              ...clean,
              { role: "assistant", content: textOf(data.content) },
              { role: "user", content: followUp },
            ],
          }),
        });
        const secondData = await second.json();
        if (!second.ok) {
          console.error("Upstream error on calc follow-up", second.status, secondData?.error?.type);
          return res.status(502).json({
            error: "Upstream error",
            detail: String(secondData?.error?.type || second.status),
          });
        }
        logUsage("prepare-post-calc", secondData.usage);
        data = secondData;
      }
    }

    return res.status(200).json({ content: data.content });
  } catch (error) {
    console.error("Handler error", error?.message);
    return res.status(500).json({ error: "Server error" });
  }
}
