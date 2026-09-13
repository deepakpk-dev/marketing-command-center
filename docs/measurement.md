# Measurement contract

All dates are UTC calendar buckets and all monetary values are EUR. Currency conversion is intentionally outside this MVP.

| Metric                | Formula                                           | Source / limitation                                                                       |
| --------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| ROAS                  | Sum attributed revenue / sum media spend          | Ad-platform attribution; can overlap across channels                                      |
| CPA                   | Sum spend / sum ad conversions                    | Google conversion settings and Meta purchase action definition must be aligned            |
| CTR                   | Sum clicks / sum impressions                      | Click definitions can differ; Meta contract must consistently use the chosen click metric |
| Ad CVR                | Sum ad conversions / sum ad clicks                | Google fractional conversions are supported                                               |
| Site CVR              | Sum GA4 purchases / sum GA4 sessions              | Event-based purchases, not a unique-user conversion rate                                  |
| Modeled marketing CAC | Sum ad spend / sum supplied first-time purchasers | Coverage required for every ad campaign/date; excludes non-media acquisition costs        |

Zero denominators and unavailable customer coverage return `null`, displayed as N/A. A zero numerator with a positive denominator is a real zero. Daily ratios are never averaged. Revenue from GA4 is shown independently and never added to ad revenue. Google conversion value and Meta purchase value may each attribute the same sale, so their sum is a reported platform portfolio measure, not deduplicated business revenue.

GA4’s new-user count does not identify new customers. A real first-time purchaser field must be computed from customer/order history, assigned once to an acquisition campaign, and exported at the same date and attribution grain. If this is not available, send `firstTimePurchasers: null`; CAC is withheld. The fixture’s purchaser assignments are modeled and its CAC is explicitly labeled.

Periods are equal adjacent 7, 14 or 28 days, anchored to the latest advertising fact in the workspace. Campaigns with incomplete current or previous daily advertising coverage do not produce anomaly flags. Sparse observations and zero baselines do not produce percentage-change alerts. Data-lag and zero-day completeness remain source integration responsibilities.

| Alert | Deterioration threshold | Minimum in both windows             |
| ----- | ----------------------- | ----------------------------------- |
| CPA   | Increase ≥25%           | ≥20 conversions and ≥EUR 100 spend  |
| ROAS  | Decrease ≥20%           | ≥20 conversions and ≥EUR 100 spend  |
| CTR   | Decrease ≥20%           | ≥10,000 impressions and ≥100 clicks |
| CVR   | Decrease ≥25%           | ≥300 clicks and ≥20 conversions     |

A relative change of at least 40% is marked critical. These are transparent heuristic rules, not confidence intervals or causal attribution. Holidays, promotional changes, stock availability, tracking failures and delayed conversions can all explain a flagged window. Live integrations should align attribution settings, load complete calendar buckets, and replay recent dates to account for conversion lag.
