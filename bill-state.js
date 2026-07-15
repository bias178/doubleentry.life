// bill-state.js
// Single source of truth. Update only when a new episode is published.

var BILL_STATE = {
  episode: "EP.26",
  fy:      "FY 2026",
  date:    "14 Jul 2026",
  concept: "Cash Flow vs Income - Multi-Year Perspective",

  // Drives the "Next entry" link on every episode page. Update this to the
  // new episode's own number/url/title each time a new episode is
  // published. Every past episode page compares its own number against
  // latestEpisode.number and resolves its "Next entry" link automatically:
  // no need to reopen and edit the previous episode's file by hand.
  latestEpisode: {
    number: 26,
    url:    "ep-26.html",
    title:  "1,000 euro, two years later: what does the ledger say?"
  },

  // FY2026 is the only open fiscal year. Update this by 1 each time a new
  // episode is published. FY2024 (9 EP) and FY2025 (11 EP) are closed and
  // stay static everywhere else in the site.
  fy2026EpisodeCount: 6,
  fy2024EpisodeCount: 9,
  fy2025EpisodeCount: 11,

  // Current period: monthly (EP.26, Jul 2026)
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

  // Balance sheet - current (EP.26, Jul 2026)
  savings:    7265,
  deposit:    1200,

  // Balance sheet - prior year close (FY2025, Dec 2025)
  prior_savings: 4544,
  prior_deposit: 1200,

  // Vitals
  cash:   52,
  equity: 58,
  stress: 60,
  future: 55,

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
BILL_STATE.totalAssets  = BILL_STATE.savings + BILL_STATE.deposit;
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
BILL_STATE.prior_totalAssets = BILL_STATE.prior_savings + BILL_STATE.prior_deposit;
BILL_STATE.prior_netAssets   = BILL_STATE.prior_totalAssets;

// Update log
// Each new episode: bump fy2026EpisodeCount by 1, update latestEpisode to
// the new episode's own number/url/title, in addition to the usual figures.
// EP.26 14 Jul 2026: savings 7265. Prior period = Jul 2025 (900 income, parents home).
// EP.21 19 Jan 2026: FY2025 closing. savings 4544, deposit 1200 (restated, see audit).
// Sep 2025: relocation -1600. New job 1400/mo, rent 600. Surplus 185.
// Jun 2024 - Aug 2025: first job 900/mo, parents home. Surplus 495.
// Apr 2024: 1000 graduation gift.
