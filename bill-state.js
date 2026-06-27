// bill-state.js
// Single source of truth. Only numbers and short strings.
// Images are embedded directly in index.html and start.html.
// Update only when a new episode is published.

var BILL_STATE = {
  episode: "EP.26",
  fy:      "FY 2026",
  date:    "14 Jul 2026",
  concept: "Cash Flow vs Income - Multi-Year Perspective",

  // Monthly income statement
  income:     1400,
  rent:       -600,
  food:       -250,
  transport:  -80,
  phone:      -25,
  subs:       -30,
  social:     -150,
  misc:       -80,

  // Balance sheet
  savings:    7265,
  deposit:    1200,

  // Vitals
  cash:   52,
  equity: 58,
  stress: 60,
  future: 55
};

// Derived
BILL_STATE.surplus   = BILL_STATE.income + BILL_STATE.rent + BILL_STATE.food +
                       BILL_STATE.transport + BILL_STATE.phone + BILL_STATE.subs +
                       BILL_STATE.social + BILL_STATE.misc;
BILL_STATE.netWorth  = BILL_STATE.savings + BILL_STATE.deposit;
BILL_STATE.overallScore = (BILL_STATE.cash + BILL_STATE.equity +
                           (100 - BILL_STATE.stress) + BILL_STATE.future) / 4;

// Update log
// EP.26 14 Jul 2026: savings 7265. Surplus 185/mo. Post-relocation stable state.
// EP.21 19 Jan 2026: FY2025 closing. savings 5970, deposit 1200.
// Sep 2025: relocation -1600. New job 1400/mo, rent 600. Surplus 185.
// Jun 2024 - Aug 2025: first job 900/mo, parents home. Surplus 495.
// Apr 2024: 1000 graduation gift. May 2024: 800 remaining after jobsearch.
