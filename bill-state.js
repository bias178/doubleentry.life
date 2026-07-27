// bill-state.js
// Single source of truth. Update only when a new episode is published.

var BILL_STATE = {
  episode: "EP.27",
  fy:      "FY 2026",
  date:    "28 Jul 2026",
  concept: "Real vs Nominal Rate Analysis",

  // Drives the "Next entry" link on every episode page. Update this to the
  // new episode's own number/url/title each time a new episode is
  // published. Every past episode page compares its own number against
  // latestEpisode.number and resolves its "Next entry" link automatically:
  // no need to reopen and edit the previous episode's file by hand.
  latestEpisode: {
    number: 27,
    url:    "ep-27.html",
    title:  "The savings account pays 2.10 percent. Bill still loses money."
  },

  // Homepage BillBoard "Insight" panel (index.html). Previously hardcoded in
  // the markup, which is how it drifted: it read "Lifestyle Inflation Impact /
  // EP.26", pairing EP.26's number with EP.19's concept. Now it lives here and
  // updates with everything else.
  insight: {
    label: "Real vs Nominal Rate Analysis / EP.27",
    html:  "On 23 July the ECB <strong>held</strong> its rates. Bill nearly scrolled past.<br><br>But a hold freezes only the nominal number. His account pays <strong>2.10%</strong> against <strong>3.0%</strong> expected inflation: a real rate of <strong>negative 0.9%</strong>.<br><br><strong>Nothing changed is exactly what keeps the gap open.</strong>"
  },

  // FY2026 is the only open fiscal year. Update this by 1 each time a new
  // episode is published. FY2024 (9 EP) and FY2025 (11 EP) are closed and
  // stay static everywhere else in the site.
  fy2026EpisodeCount: 7,
  fy2024EpisodeCount: 9,
  fy2025EpisodeCount: 11,

  // Current period: monthly (EP.27, Jul 2026). Untouched by EP.27: the
  // episode reallocates the balance sheet, it does not change monthly flows.
  income:     1400,
  rent:       -600,
  food:       -250,
  transport:  -80,
  phone:      -25,
  subs:       -30,
  social:     -150,
  misc:       -80,

  // Prior period: monthly (Jul 2025, same month prior year)
  prior_income:     900,
  prior_rent:       0,
  prior_food:       -80,
  prior_transport:  -120,
  prior_phone:      -25,
  prior_subs:       -30,
  prior_social:     -150,
  prior_misc:       0,

  // Homepage feature section (index.html). Rewritten at every publication so
  // the home reflects the latest entry instead of one fixed narrative. The
  // ledger card header (episode + concept) is filled from the fields above;
  // only eyebrow, headline, body and rows are written here.
  //   rows: label, val, tone ("pos" | "neg" | "" for neutral)
  //   divider: true inserts a rule above that row
  homeFeature: {
    eyebrow:  "The real rate",
    headline: "The ECB held rates. Bill's money is still shrinking.",
    body: [
      "On 23 July 2026 the ECB left its rates unchanged, six weeks after June's first increase in nearly three years. Bill had just parked the 3,000 euro from his liquidated index fund on a savings account at 2.10 percent. A held rate reads like a non-event, the kind of headline most people scroll past.",
      "But holding freezes only the nominal number. The real rate, what money is actually worth, moves with inflation regardless of what the central bank decides. On a savings account at 2.10 percent against 3.0 percent expected inflation, nothing changing is exactly what keeps the gap open."
    ],
    rows: [
      { label: "ECB deposit facility rate (held)", val: "2.25%", tone: "" },
      { label: "Savings account (nominal)",     val: "2.10%",  tone: "pos" },
      { label: "Eurozone inflation 2026 (proj.)", val: "3.0%", tone: "neg" },
      { label: "Real rate",                     val: "-0.9%",  tone: "neg", divider: true },
      { label: "Moved to savings account",      val: "3,000",  tone: "pos" },
      { label: "Operating buffer retained",     val: "2,884",  tone: "" }
    ]
  },

  // Balance sheet - current (EP.27, Jul 2026). Total unchanged at 5,884:
  // 3,000 (the proceeds of the index fund liquidated in June) moved into a
  // savings account at 2.10% nominal, 2,884 kept in the current account as
  // operating buffer. Both remain cash equivalents, so the single "savings"
  // line still holds. Reallocation at delta zero.
  savings:    5884,
  deposit:    1200,
  phoneBookValue: 136,

  // Balance sheet - prior year close (FY2025, Dec 2025)
  prior_savings: 4544,
  prior_deposit: 1200,
  prior_phoneBookValue: 213,

  // Vitals (EP.27). Cash edges down: 3,000 moved out of the current account
  // into savings, both still liquid. Equity flat: the reallocation is delta
  // zero. Stress down and future up, the money finally carries a rate.
  cash:   51,
  equity: 58,
  stress: 58,
  future: 59,

  // Label for the homepage vitals panel. The comparison is always the close
  // of the last completed fiscal year against the current state. Change this
  // only when a fiscal year closes, never for an individual episode.
  priorFYLabel: "FY2025 close",

  // Prior vitals (FY2025 closing)
  prior_cash:   48,
  prior_equity: 55,
  prior_stress: 62,
  prior_future: 52
};

// Derived - current
BILL_STATE.surplus = BILL_STATE.income + BILL_STATE.rent + BILL_STATE.food +
                     BILL_STATE.transport + BILL_STATE.phone + BILL_STATE.subs +
                     BILL_STATE.social + BILL_STATE.misc;
BILL_STATE.totalAssets  = BILL_STATE.savings + BILL_STATE.deposit + BILL_STATE.phoneBookValue;
BILL_STATE.totalLiab    = 0;
BILL_STATE.netAssets    = BILL_STATE.totalAssets;
BILL_STATE.totalEpisodes = BILL_STATE.fy2024EpisodeCount +
                           BILL_STATE.fy2025EpisodeCount +
                           BILL_STATE.fy2026EpisodeCount;

// Derived - prior
BILL_STATE.prior_surplus = BILL_STATE.prior_income + BILL_STATE.prior_rent +
                           BILL_STATE.prior_food + BILL_STATE.prior_transport +
                           BILL_STATE.prior_phone + BILL_STATE.prior_subs +
                           BILL_STATE.prior_social + BILL_STATE.prior_misc;
BILL_STATE.prior_totalAssets = BILL_STATE.prior_savings + BILL_STATE.prior_deposit + BILL_STATE.prior_phoneBookValue;
BILL_STATE.prior_netAssets   = BILL_STATE.prior_totalAssets;

// Update log
// Each new episode: bump fy2026EpisodeCount by 1, update latestEpisode to
// the new episode's own number/url/title, in addition to the usual figures.
// EP.27 28 Jul 2026: reallocation at delta zero. 3,000 (liquidated fund proceeds)
//   to a savings account at 2.10% nominal, 2,884 kept as operating buffer.
//   Net assets unchanged at 7,220.
//   Prior monthly block untouched: EP.26 and EP.27 are both July, so the YoY
//   reference stays Jul 2025.
// EP.26 14 Jul 2026: savings 5884, phone book value 136 (restated, see batch-3 audit). Prior period = Jul 2025 (900 income, parents home).
// EP.21 19 Jan 2026: FY2025 closing. savings 4544, deposit 1200 (restated, see audit).
// Sep 2025: relocation -1600. New job 1400/mo, rent 600. Surplus 185.
// Jun 2024 - Aug 2025: first job 900/mo, parents home. Surplus 495.
// Apr 2024: 1000 graduation gift.
