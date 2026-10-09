// blog/posts.js
// Single list of blog posts, newest first. Used by blog/index.html and by the
// "Latest from the blog" block on the home page. Independent from bill-state.js.
// To publish a post: add its page in /blog/, then add one entry at the TOP here.
//
// {
//   title: "Post title",
//   note:  "01",
//   date:  "12 Nov 2026",
//   url:   "post-slug.html",
//   desc:  "One or two sentences on what the post looks at."
// }
var BLOG_POSTS = [
  {
    title: "Profit up, cash down.",
    note:  "09",
    date:  "10 Oct 2026",
    topic: "IAS 7, working capital",
    type:  "illustrative",
    url:   "note-09-profit-up-cash-down.html",
    desc:  "Sales and profit grow while operating cash turns negative. The difference sits in one line of the cash flow statement: trade receivables."
  },
  {
    title: "A write-down is the income statement catching up with the cash.",
    note:  "08",
    date:  "9 Oct 2026",
    topic: "IAS 2",
    type:  "illustrative",
    url:   "note-08-inventory-write-down.html",
    desc:  "Under IAS 2 inventory is carried at the lower of cost and net realisable value. 40 comes out of profit, and no cash moves."
  },
  {
    title: "Deferred revenue is cash already taken and still owed in service.",
    note:  "07",
    date:  "7 Oct 2026",
    topic: "IFRS 15",
    type:  "illustrative",
    url:   "note-07-deferred-revenue.html",
    desc:  "Under IFRS 15 revenue on day one is zero. Cash is up 1,200 and a contract liability sits on the balance sheet, released 100 a month."
  },
  {
    title: "Same development spend, a different margin.",
    note:  "06",
    date:  "1 Oct 2026",
    topic: "IAS 38",
    type:  "illustrative",
    url:   "note-06-capitalize-or-expense.html",
    desc:  "One expenses development, the other capitalizes it under IAS 38. Cash is identical; year one EBITDA differs by the full 100."
  },
  {
    title: "Goodwill is a price paid years ago, tested against today.",
    note:  "05",
    date:  "29 Sep 2026",
    topic: "IFRS 3 / IAS 36",
    type:  "illustrative",
    url:   "note-05-goodwill.html",
    desc:  "Under IFRS goodwill is not amortized. It stays on the balance sheet until an impairment test says the business is worth less."
  },
  {
    title: "The dividend never appears in the income statement.",
    note:  "04",
    date:  "25 Sep 2026",
    topic: "IAS 1, equity",
    type:  "illustrative",
    url:   "note-04-dividends-and-equity.html",
    desc:  "A dividend is a distribution of profit, not an expense. It goes straight to equity: the income statement stops at profit."
  },
  {
    title: "Same rent, same cash, a different EBITDA.",
    note:  "03",
    date:  "16 Sep 2026",
    topic: "IFRS 16 / ASC 842",
    type:  "illustrative",
    url:   "note-03-leases-ebitda.html",
    desc:  "IFRS 16 against ASC 842: the same shop, the same rent, and an EBITDA that is not comparable until both sides are on the same lease basis."
  },
  {
    title: "A share price says nothing about how the company got there.",
    note:  "02",
    date:  "10 Sep 2026",
    topic: "Earnings quality",
    type:  "concept",
    url:   "note-02-same-net-income.html",
    desc:  "Same earnings per share, same P/E, different quality. The difference sits in the cash flow statement, the notes and the accounting policies."
  },
  {
    title: "Behind every price, financial statements.",
    note:  "01",
    date:  "2 Sep 2026",
    topic: "Reading financial statements",
    type:  "concept",
    url:   "note-01-behind-every-price.html",
    desc:  "Accounting will not tell you where the market goes next. It shows what you are buying, what you are paying for it, and which risks sit outside the price."
  }
];
