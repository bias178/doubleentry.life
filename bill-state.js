// bill-state.js
// Single source of truth. Update only when a new episode is published.

var BILL_STATE = {
  episode: "EP.32",
  fy:      "FY 2026",
  date:    "6 Oct 2026",
  concept: "Lease Liability Measurement",

  // Drives the "Next entry" link on every episode page. Update this to the
  // new episode's own number/url/title each time a new episode is
  // published. Every past episode page compares its own number against
  // latestEpisode.number and resolves its "Next entry" link automatically:
  // no need to reopen and edit the previous episode's file by hand.
  latestEpisode: {
    number: 32,
    url:    "ep-32.html",
    title:  "The contract runs 4 years. The liability does not."
  },

  // Homepage BillBoard "Insight" panel (index.html). Previously hardcoded in
  // the markup, which is how it drifted: it read "Lifestyle Inflation Impact /
  // EP.26", pairing EP.26's number with EP.19's concept. Now it lives here and
  // updates with everything else.
  insight: {
    label: "Lease Liability Measurement / EP.32",
    html:  "Bill signs a 48-month lease at 750 a month. 48 x 750 is <strong>36,000</strong>. What lands on his balance sheet is <strong>12,016</strong>.<br><br>IFRS 16 measures the lease term, not the contract. Bill cannot leave before month 18 and nothing makes staying beyond it reasonably certain, so the term is 18 months. That judgement alone removes <strong>22,500</strong>.<br><br>Discounting the remaining 13,500 at his own borrowing rate of 8 per cent removes a further <strong>734</strong>.<br><br><strong>Settle the term before you argue about the rate.</strong>"
  },


  // FY2026 is the only open fiscal year. Update this by 1 each time a new
  // episode is published. FY2024 (9 EP) and FY2025 (11 EP) are closed and
  // stay static everywhere else in the site.
  fy2026EpisodeCount: 12,
  fy2024EpisodeCount: 9,
  fy2025EpisodeCount: 11,

  // Current period: monthly (EP.28, Aug 2026). EP.28 splits housing to make the
  // energy variance readable. Rent 600 was "bills included" (EP.16); the ~90
  // utilities share is now shown as its own line. Rent 510 + utilities 90 still
  // equals the 600 lease payment (EP.17 obligation 7,200 unchanged). The price
  // variance (+25, structural, market-driven) lifts utilities to 115 and drops
  // the typical monthly surplus permanently from 185 to 160. The consumption
  // variance (+17, one-off) is not baselined: it hits August only.
  //
  // EP.31 (22 Sep 2026) does NOT touch this block. The new contract runs from
  // 1 Oct 2026: 1,740 net and rent 750 (rent only, utilities excluded, so it
  // stays comparable with the 510 split out in EP.28). Nothing is earned or
  // owed until October, so the current period stays on the September numbers
  // and is rewritten when the first month in the new configuration is closed.
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
    eyebrow:  "Incremental analysis",
    headline: "Bill got a 340 euro raise. He keeps 100 of it.",
    body: [
      "For the last few weeks Bill was open to work. In September he signs a permanent contract: 1,740 net a month from October, after two years and three months on 1,400. On its own that is a raise of 340, and it is the number anyone would lead with.",
      "The job is in another city, and the flat that comes with it costs 750 in rent against the 510 he pays now, rent only in both. Incremental analysis keeps the lines that differ and ignores the rest: what changes in his month is 100. The contract itself creates no entry. The deposit on the new flat, paid the same day, does: 2,250 leaves cash for a recoverable asset, so net assets hold at 7,013.50 while his liquidity nearly halves."
    ],
    rows: [
      { label: "Salary increase (1,400 to 1,740)", val: "+340",      tone: "pos" },
      { label: "Rent increase (510 to 750)",       val: "-240",      tone: "neg" },
      { label: "Incremental monthly result",       val: "+100",      tone: "pos", divider: true },
      { label: "New deposit paid (3 x 750)",       val: "-2,250",    tone: "neg" },
      { label: "Cash after deposit",               val: "2,462",     tone: "" },
      { label: "Security deposits (recoverable)",  val: "3,450",     tone: "" },
      { label: "Net assets",                       val: "7,013.50",  tone: "", divider: true }
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
  //
  // EP.31 (22 Sep 2026): same solar month as EP.30, so no second monthly accrual
  // is posted, and signing the employment contract creates no entry at all: no
  // income is earned and nothing is owed until the job starts on 1 Oct.
  //  - Deposit: the new lease deposit, three months at 750, is transferred on
  //    22 Sep. Cash 4,712 -> 2,462, security deposits 1,200 -> 3,450. A deposit
  //    is recoverable, so this is asset to asset: total current assets stay at
  //    5,912 and net assets stay at 7,013.50. Only liquidity moves.
  //  - Bill therefore closes September holding two deposits. The old 1,200 is
  //    refunded on 1 Oct, when the keys go back, and is posted next time.
  savings:    3072,
  deposit:    2250,
  intangible: 1375.00,
  phoneBookValue: 103,
  bnplPayable: 450,

  // Lease (EP.32, 1 Oct 2026). First time the running balance sheet carries a
  // lease: EP.17 recognised a right-of-use asset and a liability inside its own
  // episode ledger, but the figures were never carried into this file, so the
  // homepage balance sheet has been showing neither. A 48-month contract makes
  // that omission untenable, and the two lines enter here permanently.
  // Term 18 months (non-cancellable period; no extension is reasonably certain),
  // incremental borrowing rate 8.0%. Liability is the PV of the 17 payments
  // still outstanding after the 1 Oct payment; the ROU asset is that liability
  // plus the 750 paid at commencement. Split: 8,340 current, 3,676 non-current.
  // Monthly from October: depreciation 709 + interest on the liability.
  rouAsset:               12766,
  leaseLiability:         12016,
  leaseLiabCurrent:        8340,
  leaseLiabNonCurrent:     3676,

  // Balance sheet - prior year close (FY2025, Dec 2025)
  prior_savings: 4544,
  prior_deposit: 1200,
  prior_intangible: 0,
  prior_phoneBookValue: 213,
  prior_bnplPayable: 0,
  prior_rouAsset: 0,
  prior_leaseLiability: 0,

  // Vitals (EP.32). Cash 31 -> 36: the old 1,200 deposit is back and September's
  // surplus is banked, so the buffer rises 2,462 -> 3,072 against an income that
  // is now 1,740. Equity 56 -> 44 without Bill gaining or losing anything: net
  // assets move only +86.50, but recognising the lease adds 12,766 of assets and
  // 12,016 of liabilities, so the same net worth now sits on a balance sheet
  // three times the size. This is the IFRS 16 gross-up, and it is the number a
  // lender reads first. Stress 65 -> 64: rent goes 625 all-in to 750 rent-only
  // against 340 more income, so the ratio improves slightly, but the new city's
  // utilities are still unknown and 8,340 of the lease falls due within twelve
  // months. Future 66 -> 69: permanent contract, higher income, and a housing
  // horizon that is now measured rather than assumed.
  cash:   36,
  equity: 44,
  stress: 64,
  future: 69,

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
BILL_STATE.totalAssets  = BILL_STATE.savings + BILL_STATE.deposit + BILL_STATE.intangible + BILL_STATE.phoneBookValue + BILL_STATE.rouAsset;
BILL_STATE.totalLiab    = BILL_STATE.bnplPayable + BILL_STATE.leaseLiability;
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
BILL_STATE.prior_totalAssets = BILL_STATE.prior_savings + BILL_STATE.prior_deposit + BILL_STATE.prior_intangible + BILL_STATE.prior_phoneBookValue + BILL_STATE.prior_rouAsset;
BILL_STATE.prior_totalLiab   = BILL_STATE.prior_bnplPayable + BILL_STATE.prior_leaseLiability;
BILL_STATE.prior_netAssets   = BILL_STATE.prior_totalAssets - BILL_STATE.prior_totalLiab;

// Update log
// Each new episode: bump fy2026EpisodeCount by 1, update latestEpisode to
// the new episode's own number/url/title, in addition to the usual figures.
// EP.32 6 Oct 2026: lease liability measurement (IFRS 16). Bill has the keys and
//   the job has started. 48-month lease at 750, rent only. Lease term assessed at
//   18 months (cannot terminate before month 18, 6 months notice; furnished flat,
//   no penalty, nothing makes a longer stay reasonably certain). IBR 8.0%.
//   ROU 12,766 / lease liability 12,016 (8,340 current, 3,676 non-current), cash
//   -750 for the 1 Oct payment, which sits in the asset as rent paid in advance.
//   Gap to the 36,000 contract commitment: 22,500 from the term judgement, 734
//   from discounting. Monthly cost from October is 709 depreciation + interest,
//   789 in October against 750 of cash.
//   Also posted, September accrual (last complete month on the old structure):
//   cash +160, smartphone -11 (114 -> 103), certification -62.50 (1,437.50 ->
//   1,375.00). Old deposit refunded 1 Oct: cash +1,200, deposits 3,450 -> 2,250.
//   Net assets 7,013.50 -> 7,100.00. Total assets 7,013.50 -> 19,566, total
//   liabilities 450 -> 12,466.
//   Monthly blocks (current and prior) deliberately untouched: October is not
//   closed, so the current period still shows September on the old structure and
//   is rewritten at EP.34, the first close in the new configuration.
//   NOTE: this publication touched four files, not three. index.html gained two
//   balance-sheet rows (right-of-use asset, lease liability) because its rows are
//   hardcoded. From EP.33 the usual three-file rule applies again.
//   OPEN ITEM: EP.17's own page shows ROU 7,200 / lease liability 7,200, so the
//   short-term exemption was never used there; the editorial calendar says it
//   was. The calendar is wrong and needs correcting.
// EP.31 22 Sep 2026: incremental analysis (job change). Permanent contract
//   signed, 1,740 net a month from 1 Oct against 1,400 today (+340). Rent rises
//   510 -> 750, rent only in both (+240). Incremental monthly result +100, other
//   costs held constant until they can be measured in the new city. No entry is
//   posted: signing is not a transaction, nothing is earned or owed until
//   October, and EP.30 is the same solar month so no second accrual either.
//   Same day, the new lease deposit is transferred: 3 x 750 = 2,250. Cash 4,712
//   -> 2,462, security deposits 1,200 -> 3,450. Asset to asset, so total current
//   assets hold at 5,912 and net assets hold at 7,013.50; only liquidity moves.
//   Cash 46 -> 31, stress 63 -> 65, future 61 -> 66. Bill closes September with
//   two deposits on the balance sheet. Pending for the next publication: old
//   deposit 1,200 refunded 1 Oct at the handover, and the 48-month lease running
//   from 1 Oct 2026 at 750 a month, rent only.
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
