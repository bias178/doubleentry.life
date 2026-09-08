// bill-state.js
// Single source of truth. Update only when a new episode is published.

var BILL_STATE = {
  episode: "EP.30",
  fy:      "FY 2026",
  date:    "8 Sep 2026",
  concept: "Recurring Liability Exposure",

  // Drives the "Next entry" link on every episode page. Update this to the
  // new episode's own number/url/title each time a new episode is
  // published. Every past episode page compares its own number against
  // latestEpisode.number and resolves its "Next entry" link automatically:
  // no need to reopen and edit the previous episode's file by hand.
  latestEpisode: {
    number: 30,
    url:    "ep-30.html",
    title:  "Bill spent 450 in September. His bank balance did not move."
  },

  // Homepage BillBoard "Insight" panel (index.html). Previously hardcoded in
  // the markup, which is how it drifted: it read "Lifestyle Inflation Impact /
  // EP.26", pairing EP.26's number with EP.19's concept. Now it lives here and
  // updates with everything else.
  insight: {
    label: "Recurring Liability Exposure / EP.30",
    html:  "Bill buys <strong>450</strong> of work clothes on Buy Now, Pay Later: three interest-free instalments, the first due in November. No cash moves in September.<br><br>Yet the full <strong>450</strong> lands as a debt the day he signs. Current liabilities go from <strong>0</strong> to 450, and net worth falls by the whole amount, not the first instalment.<br><br><strong>A deferred payment is still a payment.</strong>"
  },

  // FY2026 is the only open fiscal year. Update this by 1 each time a new
  // episode is published. FY2024 (9 EP) and FY2025 (11 EP) are closed and
  // stay static everywhere else in the site.
  fy2026EpisodeCount: 10,
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
    eyebrow:  "Recurring liability exposure",
    headline: "Bill spent 450 in September. His bank balance did not move.",
    body: [
      "In September Bill buys 450 euro of work clothes on Buy Now, Pay Later: three interest-free instalments of 150, the first not due until November. Nothing leaves his account, so it feels close to free.",
      "The ledger disagrees. The day he signs, 450 of debt lands on his balance sheet, and his net worth falls by the full amount, not the 150 he has not even paid. For the first time, Bill's current liabilities are not zero. They are 450."
    ],
    rows: [
      { label: "Work clothes (BNPL, 3 x 150)",  val: "450",       tone: "neg" },
      { label: "Cash paid in September",        val: "0",         tone: "" },
      { label: "BNPL payable (current, new)",   val: "450",       tone: "neg", divider: true },
      { label: "Cash (Aug surplus +143)",       val: "4,712",     tone: "pos" },
      { label: "Current liabilities",           val: "-450",      tone: "neg", divider: true },
      { label: "Net assets",                    val: "7,013.50",  tone: "" }
    ]
  },

  // Balance sheet - current (as at 11 Aug 2026). Updated on the solar month, not
  // per episode. Two effects run in parallel and both must be posted:
  //  - Cash: July's salary landed at month end and July's surplus (185, the old
  //    baseline; the utilities split takes effect from August) is banked, so
  //    savings rise 5,884 -> 6,069. Depreciation: smartphone amortises 11/month.
  // Net assets 11 Aug: 7,220 -> 7,394.
  //
  // EP.29 (25 Aug 2026): certification 1,500 capitalised under IAS 38, first
  // amortisation 62.50 booked at recognition -> intangible 1,437.50. Cash 6,069
  // -> 4,569. Net assets 7,394 -> 7,331.50.
  //
  // EP.30 (8 Sep 2026): new solar month, so the August accrual is posted, and
  // Bill's first liability is recognised.
  //  - Cash: August surplus (143, the actual figure, below the 160 baseline
  //    because August carried the one-off consumption variance) is banked:
  //    4,569 -> 4,712.
  //  - Depreciation: smartphone posts August, 125 -> 114. The intangible does
  //    NOT amortise here: its August rateo was already booked at recognition on
  //    25 Aug, so posting it now would double-count August. From October both
  //    assets amortise together each month.
  //  - Liability: 450 of work clothes bought on BNPL, 3 interest-free
  //    instalments of 150, first due 1 Nov. Booked in full now as clothing
  //    expense 450 and BNPL payable 450. No cash moves until November. Instalment
  //    schedule: 1 Nov / 1 Dec / 1 Jan, each -150, clearing the debt by January.
  // Net assets 7,331.50 -> 7,013.50 (cash +143, depreciation -11, clothes -450).
  savings:    4712,
  deposit:    1200,
  intangible: 1437.50,
  phoneBookValue: 114,
  bnplPayable: 450,

  // Balance sheet - prior year close (FY2025, Dec 2025)
  prior_savings: 4544,
  prior_deposit: 1200,
  prior_intangible: 0,
  prior_phoneBookValue: 213,
  prior_bnplPayable: 0,

  // Vitals (EP.30). Cash up 45 -> 46: August's surplus lands and the BNPL takes
  // no cash this month, so liquidity is marginally higher. Equity down 58 -> 56:
  // net assets fall 318 (surplus +143, depreciation -11, clothes -450). Stress
  // up 60 -> 63: Bill's first debt, three instalments ahead. Future down 62 ->
  // 61: taking on consumption debt, mildly negative even for needed clothes.
  cash:   46,
  equity: 56,
  stress: 63,
  future: 61,

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
BILL_STATE.totalLiab    = BILL_STATE.bnplPayable;
BILL_STATE.netAssets    = BILL_STATE.totalAssets - BILL_STATE.totalLiab;
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
BILL_STATE.prior_totalLiab   = BILL_STATE.prior_bnplPayable;
BILL_STATE.prior_netAssets   = BILL_STATE.prior_totalAssets - BILL_STATE.prior_totalLiab;

// Update log
// Each new episode: bump fy2026EpisodeCount by 1, update latestEpisode to
// the new episode's own number/url/title, in addition to the usual figures.
// EP.30 8 Sep 2026: recurring liability exposure (BNPL). Bill buys 450 of work
//   clothes on Buy Now, Pay Later, 3 x 150 interest-free, first instalment 1 Nov.
//   Booked in full: clothing expense 450, BNPL payable 450. No cash movement in
//   September. September update posts August: cash +143 (August actual surplus),
//   smartphone -11 (114); intangible unchanged (August already amortised at
//   EP.29). First liability on the balance sheet: net assets 7,331.50 -> 7,013.50.
//   Instalment schedule: 1 Nov / 1 Dec / 1 Jan, each -150 to cash and payable.
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
