// bill-state.js
// Single source of truth. Update only when a new episode is published.

var BILL_STATE = {
  episode: "EP.29",
  fy:      "FY 2026",
  date:    "25 Aug 2026",
  concept: "Intangible Asset Recognition",

  // Drives the "Next entry" link on every episode page. Update this to the
  // new episode's own number/url/title each time a new episode is
  // published. Every past episode page compares its own number against
  // latestEpisode.number and resolves its "Next entry" link automatically:
  // no need to reopen and edit the previous episode's file by hand.
  latestEpisode: {
    number: 29,
    url:    "ep-29.html",
    title:  "Bill just did something IAS 38 would never allow."
  },

  // Homepage BillBoard "Insight" panel (index.html). Previously hardcoded in
  // the markup, which is how it drifted: it read "Lifestyle Inflation Impact /
  // EP.26", pairing EP.26's number with EP.19's concept. Now it lives here and
  // updates with everything else.
  insight: {
    label: "Intangible Asset Recognition / EP.29",
    html:  "Bill capitalises a <strong>1,500</strong> certification that IAS 38 would force a company to expense. The reason is control: an employer cannot hold an employee who resigns, but Bill cannot resign from himself.<br><br>The cost becomes an asset, amortised <strong>62.50</strong> a month over 24 months. This month the income statement carries 62.50, not 1,500.<br><br><strong>Capitalising is a claim about the future, written where it can be checked.</strong>"
  },

  // FY2026 is the only open fiscal year. Update this by 1 each time a new
  // episode is published. FY2024 (9 EP) and FY2025 (11 EP) are closed and
  // stay static everywhere else in the site.
  fy2026EpisodeCount: 9,
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
    eyebrow:  "Intangible assets",
    headline: "Bill capitalized a 1,500 certification. IAS 38 would not let a company do it.",
    body: [
      "In August Bill pays 1,500 euro for a certification tied to how his role is changing under AI tools. A company would expense it in full the day it is paid, because IAS 38 will not let it capitalize training: it cannot control an employee who resigns tomorrow.",
      "Bill can, because he cannot resign from himself. The cost becomes an intangible asset, amortized 62.50 a month over 24 months. This month's income statement carries 62.50, not 1,500. The other 1,437.50 sits on the balance sheet as a bet the ledger will return to verify."
    ],
    rows: [
      { label: "Certification (cost)",          val: "1,500.00",  tone: "" },
      { label: "Amortization, month 1",         val: "-62.50",    tone: "neg", divider: true },
      { label: "Intangible asset (net)",        val: "1,437.50",  tone: "pos" },
      { label: "Cash after payment",            val: "4,569",     tone: "neg" },
      { label: "Income statement impact",       val: "-62.50",    tone: "neg", divider: true },
      { label: "Net assets",                    val: "7,331.50",  tone: "" }
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
  // Net assets 11 Aug: 7,220 -> 7,394 (cash +185, depreciation -11).
  //
  // EP.29 (25 Aug 2026), same solar month, so the monthly accrual is NOT posted
  // again; only the certification moves. Bill pays 1,500 for a certification and
  // capitalises it under IAS 38 (control test met, he cannot resign from
  // himself), amortised straight-line 62.50/month over 24 months. Cash 6,069 ->
  // 4,569; intangible 0 -> 1,437.50 (1,500 less first amortisation 62.50).
  // Net assets 7,394 -> 7,331.50 (only the 62.50 consumed this month).
  savings:    4569,
  deposit:    1200,
  intangible: 1437.50,
  phoneBookValue: 125,

  // Balance sheet - prior year close (FY2025, Dec 2025)
  prior_savings: 4544,
  prior_deposit: 1200,
  prior_intangible: 0,
  prior_phoneBookValue: 213,

  // Vitals (EP.29). Cash down 50 -> 45: 1,500 of liquidity committed to the
  // certification. Equity flat at 58: net assets fall only 62.50, the first
  // amortisation. Stress flat at 60: no new recurring fixed commitment, the
  // 1,500 is a one-off outlay. Future up 60 -> 62: the certification is an
  // investment in future earning capacity.
  cash:   45,
  equity: 58,
  stress: 60,
  future: 62,

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
BILL_STATE.totalAssets  = BILL_STATE.savings + BILL_STATE.deposit + BILL_STATE.intangible + BILL_STATE.phoneBookValue;
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
BILL_STATE.prior_totalAssets = BILL_STATE.prior_savings + BILL_STATE.prior_deposit + BILL_STATE.prior_intangible + BILL_STATE.prior_phoneBookValue;
BILL_STATE.prior_netAssets   = BILL_STATE.prior_totalAssets;

// Update log
// Each new episode: bump fy2026EpisodeCount by 1, update latestEpisode to
// the new episode's own number/url/title, in addition to the usual figures.
// EP.29 25 Aug 2026: intangible asset (IAS 38). Certification 1,500 capitalised,
//   amortised 62.50/month over 24 months. Cash 6,069 -> 4,569; intangible 1,437.50.
//   Same solar month as EP.28, so no second monthly accrual. Net assets 7,394 ->
//   7,331.50 (only the 62.50 first amortisation).
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
