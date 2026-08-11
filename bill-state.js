// bill-state.js
// Single source of truth. Update only when a new episode is published.

var BILL_STATE = {
  episode: "EP.28",
  fy:      "FY 2026",
  date:    "11 Aug 2026",
  concept: "Budget Variance Analysis",

  // Drives the "Next entry" link on every episode page. Update this to the
  // new episode's own number/url/title each time a new episode is
  // published. Every past episode page compares its own number against
  // latestEpisode.number and resolves its "Next entry" link automatically:
  // no need to reopen and edit the previous episode's file by hand.
  latestEpisode: {
    number: 28,
    url:    "ep-28.html",
    title:  "The energy bill came in at 132 against a budget of 90. Whose fault is it?"
  },

  // Homepage BillBoard "Insight" panel (index.html). Previously hardcoded in
  // the markup, which is how it drifted: it read "Lifestyle Inflation Impact /
  // EP.26", pairing EP.26's number with EP.19's concept. Now it lives here and
  // updates with everything else.
  insight: {
    label: "Budget Variance Analysis / EP.28",
    html:  "The energy bill came in at <strong>132</strong> against a budget of <strong>90</strong>. A 42 overrun looks like one problem.<br><br>Split, it is two: <strong>25</strong> of price variance the market drove, structural, so the baseline drops to <strong>160</strong>; <strong>17</strong> of consumption variance Bill can fix.<br><br><strong>React to the total and you mismanage both.</strong>"
  },

  // FY2026 is the only open fiscal year. Update this by 1 each time a new
  // episode is published. FY2024 (9 EP) and FY2025 (11 EP) are closed and
  // stay static everywhere else in the site.
  fy2026EpisodeCount: 8,
  fy2024EpisodeCount: 9,
  fy2025EpisodeCount: 11,

  // Current period: monthly (EP.28, Aug 2026). EP.28 splits housing to make the
  // energy variance readable. Rent 600 was "bills included" (EP.16); the ~90
  // utilities share is now shown as its own line. Rent 510 + utilities 90 still
  // equals the 600 lease payment (EP.17 obligation 7,200 unchanged). The price
  // variance (+25, structural, market-driven) lifts utilities to 115 and drops
  // the typical monthly surplus permanently from 185 to 160. The consumption
  // variance (+17, one-off) is not baselined: it hits August only.
  income:     1400,
  rent:       -510,
  utilities:  -115,
  food:       -250,
  transport:  -80,
  phone:      -25,
  subs:       -30,
  social:     -150,
  misc:       -80,

  // Prior period: monthly (Aug 2025, same month prior year). Bill still lived at
  // his parents' (EP.16: nothing changes until September). Same pre-move
  // structure as Jul 2025: 900 in, 405 out, surplus 495 (EP.03). No rent, no
  // utilities of his own.
  prior_income:     900,
  prior_rent:       0,
  prior_utilities:  0,
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
    eyebrow:  "Budget variance",
    headline: "The energy bill was 42 over budget. Only 17 was Bill's to fix.",
    body: [
      "In August the energy bill came in at 132 euro against a budget of 90. The easy reading is one number, 42 over, and one response: spend less. A controller does the opposite and splits it before reacting.",
      "Twenty-five of the overrun is price variance: the market rate rose, not Bill's decision, and it is structural, so the monthly baseline drops permanently from 185 to 160. Seventeen is consumption variance: he used more than planned, a one-off he can actually fix. React to the total and you mismanage both."
    ],
    rows: [
      { label: "Energy bill (actual)",          val: "132",   tone: "neg" },
      { label: "Utilities budget",              val: "90",    tone: "" },
      { label: "Total variance",                val: "-42",   tone: "neg", divider: true },
      { label: "Price variance (structural)",   val: "25",    tone: "neg" },
      { label: "Consumption variance (one-off)", val: "17",   tone: "neg", divider: true },
      { label: "New monthly baseline",          val: "160",   tone: "" }
    ]
  },

  // Balance sheet - current (as at 11 Aug 2026). Updated on the solar month, not
  // per episode. Two effects run in parallel and both must be posted:
  //  - Cash: July's salary landed at month end and July's surplus (185, the old
  //    baseline; the utilities split takes effect from August) is banked, so
  //    savings rise 5,884 -> 6,069. The August energy bill is received but paid
  //    at month end, so it does not touch cash yet.
  //  - Depreciation: the smartphone amortises 11/month straight-line (213 at
  //    Jan 2026 close to 136 at Jul, over 7 months). One month accrues, so book
  //    value 136 -> 125.
  // Net assets: 7,220 -> 7,394 (cash +185, depreciation -11).
  savings:    6069,
  deposit:    1200,
  phoneBookValue: 125,

  // Balance sheet - prior year close (FY2025, Dec 2025)
  prior_savings: 4544,
  prior_deposit: 1200,
  prior_phoneBookValue: 213,

  // Vitals (EP.28). Cash edges down: the bill takes 42 more than planned this
  // month. Equity flat. Stress up: an over-budget surprise. Future up: naming
  // the controllable half gives Bill a target he can act on.
  cash:   50,
  equity: 58,
  stress: 60,
  future: 60,

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
BILL_STATE.surplus = BILL_STATE.income + BILL_STATE.rent + BILL_STATE.utilities +
                     BILL_STATE.food + BILL_STATE.transport + BILL_STATE.phone +
                     BILL_STATE.subs + BILL_STATE.social + BILL_STATE.misc;
BILL_STATE.totalAssets  = BILL_STATE.savings + BILL_STATE.deposit + BILL_STATE.phoneBookValue;
BILL_STATE.totalLiab    = 0;
BILL_STATE.netAssets    = BILL_STATE.totalAssets;
BILL_STATE.totalEpisodes = BILL_STATE.fy2024EpisodeCount +
                           BILL_STATE.fy2025EpisodeCount +
                           BILL_STATE.fy2026EpisodeCount;

// Derived - prior
BILL_STATE.prior_surplus = BILL_STATE.prior_income + BILL_STATE.prior_rent +
                           BILL_STATE.prior_utilities + BILL_STATE.prior_food +
                           BILL_STATE.prior_transport + BILL_STATE.prior_phone +
                           BILL_STATE.prior_subs + BILL_STATE.prior_social +
                           BILL_STATE.prior_misc;
BILL_STATE.prior_totalAssets = BILL_STATE.prior_savings + BILL_STATE.prior_deposit + BILL_STATE.prior_phoneBookValue;
BILL_STATE.prior_netAssets   = BILL_STATE.prior_totalAssets;

// Update log
// Each new episode: bump fy2026EpisodeCount by 1, update latestEpisode to
// the new episode's own number/url/title, in addition to the usual figures.
// EP.28 11 Aug 2026: budget variance (energy). Housing split into rent 510 +
//   utilities 90 (was 600 bills-included). Price variance +25 (structural)
//   lifts utilities to 115 and drops the typical surplus 185 -> 160. Consumption
//   variance +17 is one-off (August actual 143, not baselined). Prior block moves
//   to Aug 2025 (parents home, 900 in / 405 out / 495 surplus). Balance sheet
//   Cash +185 (July surplus banked), smartphone depreciation -11. Net assets 7,394.
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
