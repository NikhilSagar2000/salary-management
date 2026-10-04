# Pay bands research: seed data for the ACME demo (2025–2026)

Researched on 2026-10-04. Every page cited here was opened that day, with `curl` or a web fetch of the public page. No accounts were created, nothing was signed up for and nothing was paid for. Pages behind a login, paywall or lead form were skipped and are listed in §6.

## Read me first

**What the numbers are.** Annual **base** salary in the country's own currency. Bonus, commission, equity and allowances are excluded. Amounts are never converted between currencies. One caveat: levels.fyi stores pay in USD and shows it in local currency at its own exchange rate. The levels.fyi figures below are those local-currency figures exactly as the page shows them (stored USD × the page's `locationExchangeRate`). They are used only as a cross-check and to calculate the tech-company factor F.

**Labels.**
- **CONFIRMED** means the figure was read directly from a page I opened, including the data embedded in the page.
- **ESTIMATED** means the figure was derived: arithmetic on confirmed inputs, blending, interpolation or extrapolation. Every seed value in §1 is ESTIMATED because it combines two sources. The "How it was derived" column lists the CONFIRMED inputs with their links.
- **ESTIMATED (weak)** means the country had no usable role-specific source, so the value borrows pay ratios from other countries.

**Rounding.** USD, GBP, EUR and BRL are rounded to the nearest 1,000. INR and JPY are rounded to the nearest 10,000. Multipliers have 2 decimals.

**Country conventions.**
- **BR.** Brazil pays a statutory 13th salary. Payscale and levels.fyi do not say whether their self-reported Brazilian annual figures include it (UNCONFIRMED). To get a monthly salary, divide by 13 if the 13th salary is included, or by 12 if not. Código Fonte and CAGED report monthly pay, and this file annualises them as × 13.
- **JP.** Base means scheduled pay × 12 and excludes 賞与 (bonus). Japanese bonuses are often worth several months of pay, so total pay is well above these figures.
- **IN.** 1 lakh = 100,000 INR.

**Method in five steps.**
1. **Broad-market L3 for each role.** I took the Payscale role page for the country, in local currency, using base salary only (`compensation.salary`). L3 (3–5 years) is the geometric mean of Payscale's "1–4 years" and "5–9 years" medians. Cells need at least 30 profiles. Payscale covers all employers.
2. **Tech-company factor F for each country.** For every role that has both a Payscale cell (n ≥ 30) and a matching levels.fyi job family (n ≥ 20), f = √(levels.fyi base median ÷ Payscale median), and F is the median of those f values (Appendix A). levels.fyi data comes from tech companies but is weighted towards big tech. The square root puts a *mid-sized* tech company halfway between all employers and levels.fyi on a log scale. This is a modelling choice, not a measured fact.
3. **Seed L3 = Payscale L3 × F.**
4. **Gaps.** Some cells have fewer than 30 profiles, and India's "Account Executive" is an accounting title there. For these, value = another role in the same department × the geometric-mean ratio between those two roles in the other countries. In Brazil (BR), the ratio is blended (geometric mean) with local CAGED hiring medians where an occupation code fits. Japan (JP) uses US, GB and DE ratios only.
5. **† Manager roles follow two different rules.**
   - **Engineering Manager: the figure is already an L5 value** (first-line manager of a tech team), because Payscale's `Software_Engineering_Manager` is a tech-specific management title. Evidence: Software Engineer L3 × the Eng L5 multiplier matches the Engineering Manager figure within 10% in five countries (US 191k vs 187k, GB 102k vs 98k, DE 106k vs 104k, BR 309k vs 285k, JP ¥8.67M vs ¥9.14M); India is 19% apart (₹44.3L vs ₹52.9L). To place an Engineering Manager at level L, multiply by m(L) ÷ m(L5). Example: a US Engineering Manager at L6 = 187,000 × 1.57 ÷ 1.46 ≈ 201,000. Do **not** multiply by m(L) directly; that would double-count.
   - **Sales Manager, Marketing Manager and Support Manager: the figure is an L3 anchor.** Payscale's all-industry versions of these titles pay low, so the seed should place these managers at L4–L7 and multiply the anchor by the "Other departments" multiplier. Example: a US Sales Manager at L5 = 87,000 × 1.36 ≈ 118,000.

**Cross-checks.** The cross-check columns show each seed between the all-employer market (Payscale, AmbitionBox, CAGED) and the big-tech-weighted levels.fyi medians. That is the position this method aims for.

## 1. Mid-level (L3, 3–5 years) median annual base salary

### United States (US, USD)

Tech-company factor **F = 1.276** (median of 13 levels.fyi/Payscale pairs; tech-only pairs 1.269, other-department pairs 1.280; see Appendix A).

| Role | Department | L3 median base (USD) | Label | How it was derived (inputs are CONFIRMED) | Cross-check |
|---|---|---:|---|---|---|
| Software Engineer | Engineering | 131,000 | ESTIMATED | [Payscale `Software_Engineer`](https://www.payscale.com/research/US/Job=Software_Engineer/Salary) (n=24,077, updated 2026-07-14): √(1–4 y 95,107 × 5–9 y 110,646) = 102,583; × F 1.276 | levels.fyi `software-engineer` base median, all levels: 160,000 (n=51,030) [link](https://www.levels.fyi/t/software-engineer/locations/united-states) |
| Data Engineer | Engineering | 133,000 | ESTIMATED | [Payscale `Data_Engineer`](https://www.payscale.com/research/US/Job=Data_Engineer/Salary) (n=3,437, updated 2026-07-14): √(1–4 y 93,810 × 5–9 y 115,731) = 104,195; × F 1.276 | — |
| QA Engineer | Engineering | 107,000 | ESTIMATED | [Payscale `Quality_Assurance_(QA)_Engineer`](https://www.payscale.com/research/US/Job=Quality_Assurance_%28QA%29_Engineer/Salary) (n=2,911, updated 2026-07-13): √(1–4 y 78,714 × 5–9 y 89,711) = 84,033; × F 1.276 | — |
| Engineering Manager † | Engineering | 187,000 | ESTIMATED | [Payscale `Software_Engineering_Manager`](https://www.payscale.com/research/US/Job=Software_Engineering_Manager/Salary) (n=1,743, updated 2026-07-13): √(1–4 y 139,953 × 5–9 y 152,658) = 146,167; × F 1.276 | levels.fyi `software-engineering-manager` base median, all levels: 236,000 (n=3,430) [link](https://www.levels.fyi/t/software-engineering-manager/locations/united-states) |
| Product Manager | Product | 143,000 | ESTIMATED | [Payscale `Product_Manager,_Software`](https://www.payscale.com/research/US/Job=Product_Manager,_Software/Salary) (n=3,805, updated 2026-07-14): √(1–4 y 104,956 × 5–9 y 119,277) = 111,887; × F 1.276 | levels.fyi `product-manager` base median, all levels: 186,000 (n=5,384) [link](https://www.levels.fyi/t/product-manager/locations/united-states) |
| Product Designer | Design | 129,000 | ESTIMATED | [Payscale `Product_Designer`](https://www.payscale.com/research/US/Job=Product_Designer/Salary) (n=1,803, updated 2026-06-12): √(1–4 y 95,669 × 5–9 y 107,373) = 101,352; × F 1.276 | levels.fyi `product-designer` base median, all levels: 154,000 (n=1,751) [link](https://www.levels.fyi/t/product-designer/locations/united-states) |
| Sales Development Representative | Sales | 56,000 | ESTIMATED | [Payscale `Sales_Development_Representative`](https://www.payscale.com/research/US/Job=Sales_Development_Representative/Salary) (n=298, updated 2026-09-01): all-experience median 43,709 (no experience split); × F 1.276 | — |
| Account Executive | Sales | 88,000 | ESTIMATED | [Payscale `Account_Executive`](https://www.payscale.com/research/US/Job=Account_Executive/Salary) (n=3,048, updated 2026-07-14): √(1–4 y 63,360 × 5–9 y 74,380) = 68,649; × F 1.276 | levels.fyi `sales` base median, all levels: 115,000 (n=1,323) [link](https://www.levels.fyi/t/sales/locations/united-states) |
| Sales Manager † | Sales | 87,000 | ESTIMATED | [Payscale `Sales_Manager`](https://www.payscale.com/research/US/Job=Sales_Manager/Salary) (n=488, updated 2025-03-01): √(1–4 y 61,838 × 5–9 y 74,869) = 68,042; × F 1.276 | — |
| Marketing Specialist | Marketing | 79,000 | ESTIMATED | [Payscale `Marketing_Specialist`](https://www.payscale.com/research/US/Job=Marketing_Specialist/Salary) (n=3,858, updated 2026-07-14): √(1–4 y 58,777 × 5–9 y 65,328) = 61,966; × F 1.276 | — |
| Marketing Manager † | Marketing | 93,000 | ESTIMATED | [Payscale `Marketing_Manager`](https://www.payscale.com/research/US/Job=Marketing_Manager/Salary) (n=9,906, updated 2026-07-13): √(1–4 y 67,329 × 5–9 y 79,238) = 73,041; × F 1.276 | levels.fyi `marketing` base median, all levels: 159,000 (n=890) [link](https://www.levels.fyi/t/marketing/locations/united-states) |
| Support Specialist | Customer Support | 72,000 | ESTIMATED | [Payscale `Customer_Support_Specialist`](https://www.payscale.com/research/US/Job=Customer_Support_Specialist/Salary) (n=345, updated 2026-06-06): √(1–4 y 53,836 × 5–9 y 58,294) = 56,021; × F 1.276 | levels.fyi `customer-service` base median, all levels: 50,000 (n=164) [link](https://www.levels.fyi/t/customer-service/locations/united-states) |
| Support Manager † | Customer Support | 93,000 | ESTIMATED | [Payscale `Customer_Support_Manager`](https://www.payscale.com/research/US/Job=Customer_Support_Manager/Salary) (n=402, updated 2026-06-20): √(1–4 y 70,001 × 5–9 y 75,918) = 72,899; × F 1.276 | — |
| Accountant | Finance | 79,000 | ESTIMATED | [Payscale `Accountant`](https://www.payscale.com/research/US/Job=Accountant/Salary) (n=5,552, updated 2026-07-10): √(1–4 y 59,124 × 5–9 y 64,754) = 61,875; × F 1.276 | levels.fyi `accountant` base median, all levels: 98,000 (n=580) [link](https://www.levels.fyi/t/accountant/locations/united-states) |
| Financial Analyst | Finance | 95,000 | ESTIMATED | [Payscale `Financial_Analyst`](https://www.payscale.com/research/US/Job=Financial_Analyst/Salary) (n=7,825, updated 2026-07-10): √(1–4 y 69,708 × 5–9 y 78,795) = 74,112; × F 1.276 | levels.fyi `financial-analyst` base median, all levels: 116,000 (n=1,116) [link](https://www.levels.fyi/t/financial-analyst/locations/united-states) |
| HR Generalist | HR | 82,000 | ESTIMATED | [Payscale `Human_Resources_(HR)_Generalist`](https://www.payscale.com/research/US/Job=Human_Resources_%28HR%29_Generalist/Salary) (n=10,459, updated 2026-07-13): √(1–4 y 61,210 × 5–9 y 67,075) = 64,075; × F 1.276 | levels.fyi `human-resources` base median, all levels: 131,250 (n=312) [link](https://www.levels.fyi/t/human-resources/locations/united-states) |
| Recruiter | HR | 83,000 | ESTIMATED | [Payscale `Recruiter`](https://www.payscale.com/research/US/Job=Recruiter/Salary) (n=3,268, updated 2026-07-13): √(1–4 y 59,445 × 5–9 y 70,542) = 64,756; × F 1.276 | levels.fyi `recruiter` base median, all levels: 140,000 (n=707) [link](https://www.levels.fyi/t/recruiter/locations/united-states) |
| Operations Analyst | Operations | 89,000 | ESTIMATED | [Payscale `Operations_Analyst`](https://www.payscale.com/research/US/Job=Operations_Analyst/Salary) (n=1,813, updated 2026-07-06): √(1–4 y 66,590 × 5–9 y 73,284) = 69,857; × F 1.276 | levels.fyi `business-analyst` base median, all levels: 105,000 (n=997) [link](https://www.levels.fyi/t/business-analyst/locations/united-states) |
| IT Support Specialist | Operations | 74,000 | ESTIMATED | [Payscale `Information_Technology_(IT)_Support_Specialist`](https://www.payscale.com/research/US/Job=Information_Technology_%28IT%29_Support_Specialist/Salary) (n=2,175, updated 2026-07-14): √(1–4 y 54,636 × 5–9 y 61,801) = 58,108; × F 1.276 | levels.fyi `information-technologist` base median, all levels: 85,000 (n=893) [link](https://www.levels.fyi/t/information-technologist/locations/united-states) |

### India (IN, INR)

Tech-company factor **F = 1.484** (median of 12 levels.fyi/Payscale pairs; tech-only pairs 1.424, other-department pairs 1.629; see Appendix A).

| Role | Department | L3 median base (INR) | Label | How it was derived (inputs are CONFIRMED) | Cross-check |
|---|---|---:|---|---|---|
| Software Engineer | Engineering | 1,550,000 | ESTIMATED | [Payscale `Software_Engineer`](https://www.payscale.com/research/IN/Job=Software_Engineer/Salary) (n=4,917, updated 2026-07-12): √(1–4 y 755,491 × 5–9 y 1,437,234) = 1,042,025; × F 1.484 | levels.fyi `software-engineer` base median, all levels: 2,618,695 (n=23,674) [link](https://www.levels.fyi/t/software-engineer/locations/india); AmbitionBox 3–6 y, all industries: ₹9.3–10.3 lakh ([link](https://www.ambitionbox.com/profile/software-engineer-salary)) |
| Data Engineer | Engineering | 1,730,000 | ESTIMATED | [Payscale `Data_Engineer`](https://www.payscale.com/research/IN/Job=Data_Engineer/Salary) (n=1,278, updated 2026-07-14): √(1–4 y 811,562 × 5–9 y 1,666,470) = 1,162,946; × F 1.484 | AmbitionBox 3–6 y, all industries: ₹11.3–12.5 lakh ([link](https://www.ambitionbox.com/profile/data-engineer-salary)) |
| QA Engineer | Engineering | 920,000 | ESTIMATED | [Payscale `Quality_Assurance_(QA)_Engineer`](https://www.payscale.com/research/IN/Job=Quality_Assurance_%28QA%29_Engineer/Salary) (n=600, updated 2026-06-30): √(1–4 y 497,313 × 5–9 y 777,305) = 621,743; × F 1.484 | AmbitionBox 3–6 y, all industries: ₹6.3–7 lakh ([link](https://www.ambitionbox.com/profile/qa-engineer-salary)) |
| Engineering Manager † | Engineering | 5,290,000 | ESTIMATED | [Payscale `Software_Engineering_Manager`](https://www.payscale.com/research/IN/Job=Software_Engineering_Manager/Salary) (n=241, updated 2026-06-18): √(1–4 y 3,547,351 × 5–9 y 3,578,628) = 3,562,955; × F 1.484 | levels.fyi `software-engineering-manager` base median, all levels: 6,965,466 (n=1,080) [link](https://www.levels.fyi/t/software-engineering-manager/locations/india) |
| Product Manager | Product | 2,770,000 | ESTIMATED | [Payscale `Product_Manager,_Software`](https://www.payscale.com/research/IN/Job=Product_Manager,_Software/Salary) (n=478, updated 2026-06-28): √(1–4 y 1,544,410 × 5–9 y 2,258,812) = 1,867,761; × F 1.484 | levels.fyi `product-manager` base median, all levels: 4,009,522 (n=1,659) [link](https://www.levels.fyi/t/product-manager/locations/india); AmbitionBox 3–6 y, all industries: ₹19.6–21.6 lakh ([link](https://www.ambitionbox.com/profile/product-manager-salary)) |
| Product Designer | Design | 1,620,000 | ESTIMATED | [Payscale `Product_Designer`](https://www.payscale.com/research/IN/Job=Product_Designer/Salary) (n=247, updated 2026-06-26): √(1–4 y 796,388 × 5–9 y 1,499,946) = 1,092,950; × F 1.484 | levels.fyi `product-designer` base median, all levels: 2,069,407 (n=446) [link](https://www.levels.fyi/t/product-designer/locations/india); AmbitionBox 3–6 y, all industries: ₹14.1–15.6 lakh ([link](https://www.ambitionbox.com/profile/product-designer-salary)) |
| Sales Development Representative | Sales | 670,000 | ESTIMATED | [Payscale `Inside_Sales_Representative`](https://www.payscale.com/research/IN/Job=Inside_Sales_Representative/Salary) (n=134, updated 2026-03-13): √(1–4 y 401,686 × 5–9 y 506,797) = 451,191; × F 1.484 | AmbitionBox 3–6 y, all industries: ₹9–9.9 lakh ([link](https://www.ambitionbox.com/profile/sales-development-representative-salary)) |
| Account Executive | Sales | 830,000 | ESTIMATED (weak) | Payscale IN "Account Executive" is an accounting-clerk title in India (median INR 3.3 lakh), not a sales AE. = Sales Development Representative value × 1.243, the geometric-mean Account Executive/Sales Development Representative ratio of this table's Payscale-based values in US, GB, DE (3 countries) | levels.fyi `sales` base median, all levels: 1,365,977 (n=223) [link](https://www.levels.fyi/t/sales/locations/india) |
| Sales Manager † | Sales | 780,000 | ESTIMATED | [Payscale `Sales_Manager`](https://www.payscale.com/research/IN/Job=Sales_Manager/Salary) (n=173, updated 2024-11-23): √(1–4 y 427,532 × 5–9 y 651,274) = 527,675; × F 1.484 **(page last updated 2024-11-23, older than 2025)** | AmbitionBox 3–6 y, all industries: ₹4.6–5.1 lakh ([link](https://www.ambitionbox.com/profile/sales-manager-salary)) |
| Marketing Specialist | Marketing | 1,060,000 | ESTIMATED | [Payscale `Marketing_Specialist`](https://www.payscale.com/research/IN/Job=Marketing_Specialist/Salary) (n=162, updated 2025-10-24): √(1–4 y 574,830 × 5–9 y 882,701) = 712,322; × F 1.484 | AmbitionBox 3–6 y, all industries: ₹7.5–8.2 lakh ([link](https://www.ambitionbox.com/profile/marketing-specialist-salary)) |
| Marketing Manager † | Marketing | 1,140,000 | ESTIMATED | [Payscale `Marketing_Manager`](https://www.payscale.com/research/IN/Job=Marketing_Manager/Salary) (n=732, updated 2026-07-08): √(1–4 y 615,524 × 5–9 y 964,004) = 770,304; × F 1.484 | levels.fyi `marketing` base median, all levels: 1,579,510 (n=135) [link](https://www.levels.fyi/t/marketing/locations/india); AmbitionBox 3–6 y, all industries: ₹7.4–8.2 lakh ([link](https://www.ambitionbox.com/profile/marketing-manager-salary)) |
| Support Specialist | Customer Support | 620,000 | ESTIMATED | [Payscale `Customer_Support_Specialist`](https://www.payscale.com/research/IN/Job=Customer_Support_Specialist/Salary) (n=33, updated 2026-03-19): √(1–4 y 350,915 × 5–9 y 491,318) = 415,224; × F 1.484 | levels.fyi `customer-service` base median, all levels: 619,104 (n=50) [link](https://www.levels.fyi/t/customer-service/locations/india); AmbitionBox 3–6 y, all industries: ₹5.2–5.7 lakh ([link](https://www.ambitionbox.com/profile/customer-support-specialist-salary)) |
| Support Manager † | Customer Support | 810,000 | ESTIMATED | [Payscale `Customer_Service_Manager`](https://www.payscale.com/research/IN/Job=Customer_Service_Manager/Salary) (n=147, updated 2026-06-29): √(1–4 y 412,719 × 5–9 y 718,448) = 544,534; × F 1.484 | AmbitionBox 3–6 y, all industries: ₹5.1–5.6 lakh ([link](https://www.ambitionbox.com/profile/customer-support-manager-salary)) |
| Accountant | Finance | 480,000 | ESTIMATED | [Payscale `Accountant`](https://www.payscale.com/research/IN/Job=Accountant/Salary) (n=1,154, updated 2026-06-25): √(1–4 y 291,173 × 5–9 y 359,224) = 323,414; × F 1.484 | levels.fyi `accountant` base median, all levels: 984,597 (n=97) [link](https://www.levels.fyi/t/accountant/locations/india); AmbitionBox 3–6 y, all industries: ₹3.1–3.4 lakh ([link](https://www.ambitionbox.com/profile/accountant-salary)) |
| Financial Analyst | Finance | 930,000 | ESTIMATED | [Payscale `Financial_Analyst`](https://www.payscale.com/research/IN/Job=Financial_Analyst/Salary) (n=1,053, updated 2026-07-10): √(1–4 y 557,189 × 5–9 y 710,798) = 629,324; × F 1.484 | levels.fyi `financial-analyst` base median, all levels: 1,246,299 (n=258) [link](https://www.levels.fyi/t/financial-analyst/locations/india); AmbitionBox 3–6 y, all industries: ₹6.9–7.6 lakh ([link](https://www.ambitionbox.com/profile/financial-analyst-salary)) |
| HR Generalist | HR | 710,000 | ESTIMATED | [Payscale `Human_Resources_(HR)_Generalist`](https://www.payscale.com/research/IN/Job=Human_Resources_%28HR%29_Generalist/Salary) (n=667, updated 2026-07-02): √(1–4 y 378,658 × 5–9 y 599,172) = 476,320; × F 1.484 | levels.fyi `human-resources` base median, all levels: 1,885,080 (n=160) [link](https://www.levels.fyi/t/human-resources/locations/india); AmbitionBox 3–6 y, all industries: ₹4.4–4.8 lakh ([link](https://www.ambitionbox.com/profile/hr-generalist-salary)) |
| Recruiter | HR | 760,000 | ESTIMATED | [Payscale `Recruiter`](https://www.payscale.com/research/IN/Job=Recruiter/Salary) (n=307, updated 2026-04-29): √(1–4 y 357,544 × 5–9 y 735,219) = 512,712; × F 1.484 | levels.fyi `recruiter` base median, all levels: 1,960,977 (n=110) [link](https://www.levels.fyi/t/recruiter/locations/india); AmbitionBox 3–6 y, all industries: ₹4.7–5.2 lakh ([link](https://www.ambitionbox.com/profile/recruiter-salary)) |
| Operations Analyst | Operations | 820,000 | ESTIMATED | [Payscale `Operations_Analyst`](https://www.payscale.com/research/IN/Job=Operations_Analyst/Salary) (n=253, updated 2026-06-19): √(1–4 y 468,828 × 5–9 y 649,047) = 551,626; × F 1.484 | levels.fyi `business-analyst` base median, all levels: 1,638,244 (n=415) [link](https://www.levels.fyi/t/business-analyst/locations/india); AmbitionBox 3–6 y, all industries: ₹5.6–6.2 lakh ([link](https://www.ambitionbox.com/profile/operations-analyst-salary)) |
| IT Support Specialist | Operations | 780,000 | ESTIMATED | [Payscale `Information_Technology_(IT)_Support_Specialist`](https://www.payscale.com/research/IN/Job=Information_Technology_%28IT%29_Support_Specialist/Salary) (n=114, updated 2025-12-24): √(1–4 y 402,159 × 5–9 y 695,376) = 528,821; × F 1.484 | levels.fyi `information-technologist` base median, all levels: 1,016,349 (n=209) [link](https://www.levels.fyi/t/information-technologist/locations/india); AmbitionBox 3–6 y, all industries: ₹6.1–6.8 lakh ([link](https://www.ambitionbox.com/profile/it-support-specialist-salary)) |

### United Kingdom (GB, GBP)

Tech-company factor **F = 1.323** (median of 12 levels.fyi/Payscale pairs; tech-only pairs 1.340, other-department pairs 1.316; see Appendix A).

| Role | Department | L3 median base (GBP) | Label | How it was derived (inputs are CONFIRMED) | Cross-check |
|---|---|---:|---|---|---|
| Software Engineer | Engineering | 59,000 | ESTIMATED | [Payscale `Software_Engineer`](https://www.payscale.com/research/UK/Job=Software_Engineer/Salary) (n=1,765, updated 2026-07-08): √(1–4 y 39,678 × 5–9 y 50,288) = 44,669; × F 1.323 | levels.fyi `software-engineer` base median, all levels: 82,648 (n=5,051) [link](https://www.levels.fyi/t/software-engineer/locations/united-kingdom) |
| Data Engineer | Engineering | 67,000 | ESTIMATED | [Payscale `Data_Engineer`](https://www.payscale.com/research/UK/Job=Data_Engineer/Salary) (n=261, updated 2026-07-08): √(1–4 y 42,656 × 5–9 y 59,363) = 50,321; × F 1.323 | — |
| QA Engineer | Engineering | 49,000 | ESTIMATED | [Payscale `Quality_Assurance_(QA)_Engineer`](https://www.payscale.com/research/UK/Job=Quality_Assurance_%28QA%29_Engineer/Salary) (n=143, updated 2026-03-31): √(1–4 y 34,435 × 5–9 y 39,975) = 37,101; × F 1.323 | — |
| Engineering Manager † | Engineering | 98,000 | ESTIMATED | [Payscale `Software_Engineering_Manager`](https://www.payscale.com/research/UK/Job=Software_Engineering_Manager/Salary) (n=147, updated 2025-07-04): √(1–4 y 69,496 × 5–9 y 79,548) = 74,353; × F 1.323 | levels.fyi `software-engineering-manager` base median, all levels: 131,617 (n=287) [link](https://www.levels.fyi/t/software-engineering-manager/locations/united-kingdom) |
| Product Manager | Product | 77,000 | ESTIMATED | [Payscale `Product_Manager,_Software`](https://www.payscale.com/research/UK/Job=Product_Manager,_Software/Salary) (n=208, updated 2026-07-12): √(1–4 y 51,082 × 5–9 y 65,996) = 58,062; × F 1.323 | levels.fyi `product-manager` base median, all levels: 97,043 (n=434) [link](https://www.levels.fyi/t/product-manager/locations/united-kingdom) |
| Product Designer | Design | 50,000 | ESTIMATED | [Payscale `Product_Designer`](https://www.payscale.com/research/UK/Job=Product_Designer/Salary) (n=148, updated 2026-07-09): √(1–4 y 35,824 × 5–9 y 39,568) = 37,649; × F 1.323 | levels.fyi `product-designer` base median, all levels: 71,537 (n=126) [link](https://www.levels.fyi/t/product-designer/locations/united-kingdom) |
| Sales Development Representative | Sales | 35,000 | ESTIMATED | [Payscale `Inside_Sales_Representative`](https://www.payscale.com/research/UK/Job=Inside_Sales_Representative/Salary) (n=54, updated 2026-02-17): √(1–4 y 26,661 × 5–9 y 26,052) = 26,354; × F 1.323 | — |
| Account Executive | Sales | 38,000 | ESTIMATED | [Payscale `Account_Executive`](https://www.payscale.com/research/UK/Job=Account_Executive/Salary) (n=150, updated 2026-05-18): √(1–4 y 25,704 × 5–9 y 31,655) = 28,525; × F 1.323 | levels.fyi `sales` base median, all levels: 73,397 (n=152) [link](https://www.levels.fyi/t/sales/locations/united-kingdom) |
| Sales Manager † | Sales | 41,000 | ESTIMATED | [Payscale `Sales_Manager`](https://www.payscale.com/research/UK/Job=Sales_Manager/Salary) (n=91, updated 2024-01-03): √(1–4 y 29,249 × 5–9 y 33,154) = 31,140; × F 1.323 **(page last updated 2024-01-03, older than 2025)** | — |
| Marketing Specialist | Marketing | 43,000 | ESTIMATED | [Payscale `Marketing_Specialist`](https://www.payscale.com/research/UK/Job=Marketing_Specialist/Salary) (n=95, updated 2026-05-23): √(1–4 y 30,987 × 5–9 y 33,950) = 32,435; × F 1.323 | — |
| Marketing Manager † | Marketing | 50,000 | ESTIMATED | [Payscale `Marketing_Manager`](https://www.payscale.com/research/UK/Job=Marketing_Manager/Salary) (n=621, updated 2026-06-25): √(1–4 y 35,357 × 5–9 y 40,628) = 37,901; × F 1.323 | levels.fyi `marketing` base median, all levels: 59,736 (n=82) [link](https://www.levels.fyi/t/marketing/locations/united-kingdom) |
| Support Specialist | Customer Support | 40,000 | ESTIMATED | [Payscale `Technical_Support_Specialist`](https://www.payscale.com/research/UK/Job=Technical_Support_Specialist/Salary) (n=73, updated 2026-06-30): √(1–4 y 28,072 × 5–9 y 32,366) = 30,143; × F 1.323 | levels.fyi `customer-service` base median, all levels: 27,658 (n=16) [link](https://www.levels.fyi/t/customer-service/locations/united-kingdom) |
| Support Manager † | Customer Support | 46,000 | ESTIMATED | [Payscale `Customer_Support_Manager`](https://www.payscale.com/research/UK/Job=Customer_Support_Manager/Salary) (n=31, updated 2025-09-16): √(1–4 y 34,528 × 5–9 y 34,858) = 34,693; × F 1.323 | — |
| Accountant | Finance | 44,000 | ESTIMATED | [Payscale `Accountant`](https://www.payscale.com/research/UK/Job=Accountant/Salary) (n=445, updated 2026-07-09): √(1–4 y 30,088 × 5–9 y 36,535) = 33,155; × F 1.323 | levels.fyi `accountant` base median, all levels: 44,542 (n=50) [link](https://www.levels.fyi/t/accountant/locations/united-kingdom) |
| Financial Analyst | Finance | 50,000 | ESTIMATED | [Payscale `Financial_Analyst`](https://www.payscale.com/research/UK/Job=Financial_Analyst/Salary) (n=292, updated 2026-04-21): √(1–4 y 34,726 × 5–9 y 40,459) = 37,483; × F 1.323 | levels.fyi `financial-analyst` base median, all levels: 64,964 (n=81) [link](https://www.levels.fyi/t/financial-analyst/locations/united-kingdom) |
| HR Generalist | HR | 43,000 | ESTIMATED | [Payscale `Human_Resources_(HR)_Generalist`](https://www.payscale.com/research/UK/Job=Human_Resources_%28HR%29_Generalist/Salary) (n=198, updated 2026-01-30): √(1–4 y 30,738 × 5–9 y 34,539) = 32,583; × F 1.323 | levels.fyi `human-resources` base median, all levels: 75,691 (n=28) [link](https://www.levels.fyi/t/human-resources/locations/united-kingdom) |
| Recruiter | HR | 42,000 | ESTIMATED | [Payscale `Recruiter`](https://www.payscale.com/research/UK/Job=Recruiter/Salary) (n=101, updated 2025-09-01): √(1–4 y 28,083 × 5–9 y 36,253) = 31,907; × F 1.323 | levels.fyi `recruiter` base median, all levels: 76,418 (n=86) [link](https://www.levels.fyi/t/recruiter/locations/united-kingdom) |
| Operations Analyst | Operations | 46,000 | ESTIMATED | [Payscale `Operations_Analyst`](https://www.payscale.com/research/UK/Job=Operations_Analyst/Salary) (n=78, updated 2026-05-19): √(1–4 y 30,546 × 5–9 y 40,000) = 34,955; × F 1.323 | levels.fyi `business-analyst` base median, all levels: 49,337 (n=75) [link](https://www.levels.fyi/t/business-analyst/locations/united-kingdom) |
| IT Support Specialist | Operations | 41,000 | ESTIMATED | [Payscale `Information_Technology_(IT)_Support_Specialist`](https://www.payscale.com/research/UK/Job=Information_Technology_%28IT%29_Support_Specialist/Salary) (n=63, updated 2026-06-10): √(1–4 y 27,366 × 5–9 y 34,993) = 30,945; × F 1.323 | levels.fyi `information-technologist` base median, all levels: 48,360 (n=56) [link](https://www.levels.fyi/t/information-technologist/locations/united-kingdom) |

### Germany (DE, EUR)

Tech-company factor **F = 1.170** (median of 9 levels.fyi/Payscale pairs; tech-only pairs 1.165, other-department pairs 1.177; see Appendix A).

| Role | Department | L3 median base (EUR) | Label | How it was derived (inputs are CONFIRMED) | Cross-check |
|---|---|---:|---|---|---|
| Software Engineer | Engineering | 72,000 | ESTIMATED | [Payscale `Software_Engineer`](https://www.payscale.com/research/DE/Job=Software_Engineer/Salary) (n=933, updated 2026-07-13): √(1–4 y 57,950 × 5–9 y 66,094) = 61,888; × F 1.170 | levels.fyi `software-engineer` base median, all levels: 82,265 (n=3,177) [link](https://www.levels.fyi/t/software-engineer/locations/germany) |
| Data Engineer | Engineering | 74,000 | ESTIMATED | [Payscale `Data_Engineer`](https://www.payscale.com/research/DE/Job=Data_Engineer/Salary) (n=173, updated 2026-07-01): √(1–4 y 58,433 × 5–9 y 69,290) = 63,630; × F 1.170 | — |
| QA Engineer | Engineering | 62,000 | ESTIMATED | [Payscale `Quality_Assurance_(QA)_Engineer`](https://www.payscale.com/research/DE/Job=Quality_Assurance_%28QA%29_Engineer/Salary) (n=166, updated 2025-12-08): √(1–4 y 48,598 × 5–9 y 57,450) = 52,839; × F 1.170 | — |
| Engineering Manager † | Engineering | 104,000 | ESTIMATED | [Payscale `Software_Engineering_Manager`](https://www.payscale.com/research/DE/Job=Software_Engineering_Manager/Salary) (n=87, updated 2025-12-27): √(1–4 y 86,953 × 5–9 y 91,424) = 89,160; × F 1.170 | levels.fyi `software-engineering-manager` base median, all levels: 117,409 (n=219) [link](https://www.levels.fyi/t/software-engineering-manager/locations/germany) |
| Product Manager | Product | 76,000 | ESTIMATED | [Payscale `Product_Manager,_Software`](https://www.payscale.com/research/DE/Job=Product_Manager,_Software/Salary) (n=162, updated 2026-03-31): √(1–4 y 59,501 × 5–9 y 71,191) = 65,084; × F 1.170 | levels.fyi `product-manager` base median, all levels: 91,589 (n=252) [link](https://www.levels.fyi/t/product-manager/locations/germany) |
| Product Designer | Design | 65,000 | ESTIMATED | [Payscale `Product_Designer`](https://www.payscale.com/research/DE/Job=Product_Designer/Salary) (n=85, updated 2026-06-07): √(1–4 y 50,738 × 5–9 y 61,565) = 55,890; × F 1.170 | levels.fyi `product-designer` base median, all levels: 72,818 (n=98) [link](https://www.levels.fyi/t/product-designer/locations/germany) |
| Sales Development Representative | Sales | 57,000 | ESTIMATED | [Payscale `Inside_Sales_Representative`](https://www.payscale.com/research/DE/Job=Inside_Sales_Representative/Salary) (n=31, updated 2025-06-18): √(1–4 y 40,150 × 5–9 y 60,000) = 49,082; × F 1.170 | — |
| Account Executive | Sales | 65,000 | ESTIMATED | [Payscale `Account_Executive`](https://www.payscale.com/research/DE/Job=Account_Executive/Salary) (n=44, updated 2025-10-13): √(1–4 y 51,447 × 5–9 y 59,906) = 55,516; × F 1.170 | levels.fyi `sales` base median, all levels: 84,126 (n=87) [link](https://www.levels.fyi/t/sales/locations/germany) |
| Sales Manager † | Sales | 74,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = Sales Development Representative value × 1.291, the geometric-mean Sales Manager/Sales Development Representative ratio of this table's Payscale-based values in US, IN, GB (3 countries) | — |
| Marketing Specialist | Marketing | 53,000 | ESTIMATED | [Payscale `Marketing_Specialist`](https://www.payscale.com/research/DE/Job=Marketing_Specialist/Salary) (n=69, updated 2025-11-05): √(1–4 y 44,223 × 5–9 y 45,551) = 44,883; × F 1.170 | — |
| Marketing Manager † | Marketing | 60,000 | ESTIMATED | [Payscale `Marketing_Manager`](https://www.payscale.com/research/DE/Job=Marketing_Manager/Salary) (n=187, updated 2026-05-17): √(1–4 y 44,012 × 5–9 y 60,678) = 51,678; × F 1.170 | levels.fyi `marketing` base median, all levels: 69,436 (n=28) [link](https://www.levels.fyi/t/marketing/locations/germany) |
| Support Specialist | Customer Support | 44,000 | ESTIMATED | [Payscale `Customer_Service_Representative_(CSR)`](https://www.payscale.com/research/DE/Job=Customer_Service_Representative_%28CSR%29/Salary) (n=65, updated 2026-05-03): √(1–4 y 33,951 × 5–9 y 41,573) = 37,569; × F 1.170 | levels.fyi `customer-service` base median, all levels: 48,270 (n=15) [link](https://www.levels.fyi/t/customer-service/locations/germany) |
| Support Manager † | Customer Support | 53,000 | ESTIMATED | [Payscale `Customer_Service_Manager`](https://www.payscale.com/research/DE/Job=Customer_Service_Manager/Salary) (n=39, updated 2025-07-15): √(1–4 y 40,599 × 5–9 y 50,868) = 45,444; × F 1.170 | — |
| Accountant | Finance | 50,000 | ESTIMATED | [Payscale `Accountant`](https://www.payscale.com/research/DE/Job=Accountant/Salary) (n=68, updated 2025-10-23): √(1–4 y 40,500 × 5–9 y 45,851) = 43,092; × F 1.170 | levels.fyi `accountant` base median, all levels: 71,358 (n=13) [link](https://www.levels.fyi/t/accountant/locations/germany) |
| Financial Analyst | Finance | 69,000 | ESTIMATED | [Payscale `Financial_Analyst`](https://www.payscale.com/research/DE/Job=Financial_Analyst/Salary) (n=101, updated 2025-10-10): √(1–4 y 55,428 × 5–9 y 61,988) = 58,616; × F 1.170 | levels.fyi `financial-analyst` base median, all levels: 67,442 (n=26) [link](https://www.levels.fyi/t/financial-analyst/locations/germany) |
| HR Generalist | HR | 56,000 | ESTIMATED | [Payscale `Human_Resources_(HR)_Generalist`](https://www.payscale.com/research/DE/Job=Human_Resources_%28HR%29_Generalist/Salary) (n=41, updated 2026-03-03): √(1–4 y 46,226 × 5–9 y 49,831) = 47,995; × F 1.170 | levels.fyi `human-resources` base median, all levels: 73,957 (n=17) [link](https://www.levels.fyi/t/human-resources/locations/germany) |
| Recruiter | HR | 52,000 | ESTIMATED | [Payscale `Recruiter`](https://www.payscale.com/research/DE/Job=Recruiter/Salary) (n=90, updated 2025-05-09): √(1–4 y 40,880 × 5–9 y 48,608) = 44,577; × F 1.170 | levels.fyi `recruiter` base median, all levels: 62,553 (n=29) [link](https://www.levels.fyi/t/recruiter/locations/germany) |
| Operations Analyst | Operations | 61,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = IT Support Specialist value × 1.123, the geometric-mean Operations Analyst/IT Support Specialist ratio of this table's Payscale-based values in US, IN, GB (3 countries) | levels.fyi `business-analyst` base median, all levels: 62,959 (n=33) [link](https://www.levels.fyi/t/business-analyst/locations/germany) |
| IT Support Specialist | Operations | 54,000 | ESTIMATED | [Payscale `Information_Technology_(IT)_Support_Specialist`](https://www.payscale.com/research/DE/Job=Information_Technology_%28IT%29_Support_Specialist/Salary) (n=82, updated 2025-08-17): √(1–4 y 44,294 × 5–9 y 48,668) = 46,430; × F 1.170 | levels.fyi `information-technologist` base median, all levels: 62,120 (n=71) [link](https://www.levels.fyi/t/information-technologist/locations/germany) |

### Brazil (BR, BRL)

Tech-company factor **F = 1.295** (median of 1 levels.fyi/Payscale pairs; tech-only pairs 1.295, other-department pairs n/a; see Appendix A).

| Role | Department | L3 median base (BRL) | Label | How it was derived (inputs are CONFIRMED) | Cross-check |
|---|---|---:|---|---|---|
| Software Engineer | Engineering | 133,000 | ESTIMATED | [Payscale `Software_Engineer`](https://www.payscale.com/research/BR/Job=Software_Engineer/Salary) (n=78, updated 2026-04-09): √(1–4 y 85,480 × 5–9 y 124,323) = 103,088; × F 1.295 | levels.fyi `software-engineer` base median, all levels: 168,449 (n=2,577) [link](https://www.levels.fyi/t/software-engineer/locations/brazil); Código Fonte TV survey 2025, CLT *pleno* mean R$ 7,540/month (×13 = R$ 98,000) |
| Data Engineer | Engineering | 150,000 | ESTIMATED (weak) | = Software Engineer value × 1.121; ratio = √(reference ratio 1.070 from US, IN, GB, DE × local CAGED hiring-median ratio 1.174 ([salario.com.br](https://www.salario.com.br/profissao/administrador-de-banco-de-dados-cbo-212305/) R$ 8,808/month vs R$ 7,500/month for the developer CBO 2124-05)) | Payscale `Data_Engineer` median 98,428 (n=22, too small to use) |
| QA Engineer | Engineering | 102,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = Software Engineer value × 0.767, the geometric-mean QA Engineer/Software Engineer ratio of this table's Payscale-based values in US, IN, GB, DE (4 countries) | Payscale `Quality_Assurance_(QA)_Engineer` median 78,000 (n=11, too small to use) |
| Engineering Manager † | Engineering | 285,000 | ESTIMATED (weak) | = Software Engineer value × 2.136; ratio = √(reference ratio 1.849 from US, IN, GB, DE × local CAGED hiring-median ratio 2.468 ([salario.com.br](https://www.salario.com.br/profissao/gerente-de-desenvolvimento-de-sistemas-cbo-142510/) R$ 18,507/month vs R$ 7,500/month for the developer CBO 2124-05)) | levels.fyi `software-engineering-manager` base median, all levels: 324,131 (n=105) [link](https://www.levels.fyi/t/software-engineering-manager/locations/brazil); Payscale `Software_Engineering_Manager` median 351,000 (n=5, too small to use) |
| Product Manager | Product | 171,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = Software Engineer value × 1.279, the geometric-mean Product Manager/Software Engineer ratio of this table's Payscale-based values in US, IN, GB, DE (4 countries) | levels.fyi `product-manager` base median, all levels: 262,905 (n=105) [link](https://www.levels.fyi/t/product-manager/locations/brazil); Payscale `Product_Manager,_Software` median 137,400 (n=5, too small to use) |
| Product Designer | Design | 126,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = Software Engineer value × 0.942, the geometric-mean Product Designer/Software Engineer ratio of this table's Payscale-based values in US, IN, GB, DE (4 countries) | levels.fyi `product-designer` base median, all levels: 127,541 (n=45) [link](https://www.levels.fyi/t/product-designer/locations/brazil); Payscale `Product_Designer` median 77,511 (n=15, too small to use) |
| Sales Development Representative | Sales | 72,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = Software Engineer value × 0.542, the geometric-mean Sales Development Representative/Software Engineer ratio of this table's Payscale-based values in US, IN, GB, DE (4 countries) | Payscale `Inside_Sales_Representative` median 20,400 (n=3, too small to use) |
| Account Executive | Sales | 97,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = Software Engineer value × 0.726, the geometric-mean Account Executive/Software Engineer ratio of this table's Payscale-based values in US, IN, GB, DE (3 countries) | levels.fyi `sales` base median, all levels: 152,921 (n=28) [link](https://www.levels.fyi/t/sales/locations/brazil); Payscale `Account_Executive` median 110,000 (n=4, too small to use) |
| Sales Manager † | Sales | 82,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = Software Engineer value × 0.616, the geometric-mean Sales Manager/Software Engineer ratio of this table's Payscale-based values in US, IN, GB, DE (3 countries) | — |
| Marketing Specialist | Marketing | 80,000 | ESTIMATED (weak) | = Software Engineer value × 0.603; ratio = √(reference ratio 0.683 from US, IN, GB, DE × local CAGED hiring-median ratio 0.533 ([salario.com.br](https://www.salario.com.br/profissao/analista-de-marketing-cbo-142335/) R$ 3,995/month vs R$ 7,500/month for the developer CBO 2124-05)) | Payscale `Marketing_Specialist` median 60,000 (n=5, too small to use) |
| Marketing Manager † | Marketing | 115,000 | ESTIMATED (weak) | = Software Engineer value × 0.865; ratio = √(reference ratio 0.781 from US, IN, GB, DE × local CAGED hiring-median ratio 0.958 ([salario.com.br](https://www.salario.com.br/profissao/gerente-de-marketing-cbo-142315/) R$ 7,188/month vs R$ 7,500/month for the developer CBO 2124-05)) | levels.fyi `marketing` base median, all levels: 167,535 (n=17) [link](https://www.levels.fyi/t/marketing/locations/brazil); Payscale `Marketing_Manager` median 99,000 (n=14, too small to use) |
| Support Specialist | Customer Support | 62,000 | ESTIMATED (weak) | = Software Engineer value × 0.468; ratio = √(reference ratio 0.546 from US, IN, GB, DE × local CAGED hiring-median ratio 0.400 ([salario.com.br](https://www.salario.com.br/profissao/analista-de-suporte-tecnico-cbo-212420/) R$ 3,000/month vs R$ 7,500/month for the developer CBO 2124-05)) | levels.fyi `customer-service` base median, all levels: 92,156 (n=14) [link](https://www.levels.fyi/t/customer-service/locations/brazil); Payscale `Technical_Support_Specialist` median 126,000 (n=2, too small to use) |
| Support Manager † | Customer Support | 91,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = Software Engineer value × 0.678, the geometric-mean Support Manager/Software Engineer ratio of this table's Payscale-based values in US, IN, GB, DE (4 countries) | Payscale `Customer_Service_Manager` median 127,500 (n=2, too small to use) |
| Accountant | Finance | 77,000 | ESTIMATED (weak) | = Software Engineer value × 0.575; ratio = √(reference ratio 0.558 from US, IN, GB, DE × local CAGED hiring-median ratio 0.593 ([salario.com.br](https://www.salario.com.br/profissao/contador-cbo-252210/) R$ 4,450/month vs R$ 7,500/month for the developer CBO 2124-05)) | levels.fyi `accountant` base median, all levels: 91,812 (n=11) [link](https://www.levels.fyi/t/accountant/locations/brazil); Payscale `Accountant` median 64,000 (n=8, too small to use) |
| Financial Analyst | Finance | 85,000 | ESTIMATED (weak) | = Software Engineer value × 0.640; ratio = √(reference ratio 0.767 from US, IN, GB, DE × local CAGED hiring-median ratio 0.533 ([salario.com.br](https://www.salario.com.br/profissao/analista-de-planejamento-financeiro-cbo-252545/) R$ 4,000/month vs R$ 7,500/month for the developer CBO 2124-05)) | levels.fyi `financial-analyst` base median, all levels: 118,558 (n=25) [link](https://www.levels.fyi/t/financial-analyst/locations/brazil); Payscale `Financial_Analyst` median 43,379 (n=21, too small to use) |
| HR Generalist | HR | 75,000 | ESTIMATED (weak) | = Software Engineer value × 0.562; ratio = √(reference ratio 0.634 from US, IN, GB, DE × local CAGED hiring-median ratio 0.499 ([salario.com.br](https://www.salario.com.br/profissao/analista-de-recursos-humanos-cbo-252405/) R$ 3,742/month vs R$ 7,500/month for the developer CBO 2124-05)) | levels.fyi `human-resources` base median, all levels: 159,565 (n=13) [link](https://www.levels.fyi/t/human-resources/locations/brazil) |
| Recruiter | HR | 75,000 | ESTIMATED (weak) | = Software Engineer value × 0.562; ratio = √(reference ratio 0.632 from US, IN, GB, DE × local CAGED hiring-median ratio 0.499 ([salario.com.br](https://www.salario.com.br/profissao/analista-de-recursos-humanos-cbo-252405/) R$ 3,742/month vs R$ 7,500/month for the developer CBO 2124-05)) | levels.fyi `recruiter` base median, all levels: 106,981 (n=22) [link](https://www.levels.fyi/t/recruiter/locations/brazil); Payscale `Recruiter` median 20,500 (n=6, too small to use) |
| Operations Analyst | Operations | 80,000 | ESTIMATED (weak) | = Software Engineer value × 0.600; ratio = √(reference ratio 0.656 from US, IN, GB, DE × local CAGED hiring-median ratio 0.549 ([salario.com.br](https://www.salario.com.br/profissao/analista-de-negocios-cbo-253120/) R$ 4,115/month vs R$ 7,500/month for the developer CBO 2124-05)) | levels.fyi `business-analyst` base median, all levels: 134,292 (n=54) [link](https://www.levels.fyi/t/business-analyst/locations/brazil); Payscale `Operations_Analyst` median 60,000 (n=7, too small to use) |
| IT Support Specialist | Operations | 57,000 | ESTIMATED (weak) | = Software Engineer value × 0.429; ratio = √(reference ratio 0.622 from US, IN, GB, DE × local CAGED hiring-median ratio 0.295 ([salario.com.br](https://www.salario.com.br/profissao/monitorador-de-sistemas-e-suporte-ao-usuario-cbo-317210/) R$ 2,215/month vs R$ 7,500/month for the developer CBO 2124-05)) | levels.fyi `information-technologist` base median, all levels: 93,918 (n=36) [link](https://www.levels.fyi/t/information-technologist/locations/brazil); Payscale `Information_Technology_(IT)_Support_Specialist` median 50,172 (n=4, too small to use) |

### Japan (JP, JPY)

Tech-company factor **F = 1.455** (median of 1 levels.fyi/Payscale pairs; tech-only pairs 1.455, other-department pairs n/a; see Appendix A).

| Role | Department | L3 median base (JPY) | Label | How it was derived (inputs are CONFIRMED) | Cross-check |
|---|---|---:|---|---|---|
| Software Engineer | Engineering | 6,070,000 | ESTIMATED | [Payscale `Software_Engineer`](https://www.payscale.com/research/JP/Job=Software_Engineer/Salary) (n=135, updated 2026-07-10): √(1–4 y 3,905,040 × 5–9 y 4,447,573) = 4,167,487; × F 1.455 | levels.fyi `software-engineer` base median, all levels: 8,146,538 (n=433) [link](https://www.levels.fyi/t/software-engineer/locations/japan) |
| Data Engineer | Engineering | 6,400,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = Software Engineer value × 1.056, the geometric-mean Data Engineer/Software Engineer ratio of this table's Payscale-based values in US, GB, DE (3 countries) | Payscale `Data_Engineer` median 4,000,000 (n=11, too small to use) |
| QA Engineer | Engineering | 5,060,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = Software Engineer value × 0.834, the geometric-mean QA Engineer/Software Engineer ratio of this table's Payscale-based values in US, GB, DE (3 countries) | Payscale `Quality_Assurance_(QA)_Engineer` median 5,005,046 (n=5, too small to use) |
| Engineering Manager † | Engineering | 9,140,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = Software Engineer value × 1.506, the geometric-mean Engineering Manager/Software Engineer ratio of this table's Payscale-based values in US, GB, DE (3 countries) | levels.fyi `software-engineering-manager` base median, all levels: 13,378,906 (n=23) [link](https://www.levels.fyi/t/software-engineering-manager/locations/japan); Payscale `Software_Engineering_Manager` median 8,735,334 (n=6, too small to use) |
| Product Manager | Product | 6,930,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = Software Engineer value × 1.142, the geometric-mean Product Manager/Software Engineer ratio of this table's Payscale-based values in US, GB, DE (3 countries) | levels.fyi `product-manager` base median, all levels: 12,295,207 (n=38) [link](https://www.levels.fyi/t/product-manager/locations/japan); Payscale `Product_Manager,_Software` median 5,895,811 (n=18, too small to use) |
| Product Designer | Design | 5,520,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = Software Engineer value × 0.909, the geometric-mean Product Designer/Software Engineer ratio of this table's Payscale-based values in US, GB, DE (3 countries) | levels.fyi `product-designer` base median, all levels: 9,717,034 (n=15) [link](https://www.levels.fyi/t/product-designer/locations/japan); Payscale `Product_Designer` median 3,450,000 (n=6, too small to use) |
| Sales Development Representative | Sales | 3,540,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = Software Engineer value × 0.584, the geometric-mean Sales Development Representative/Software Engineer ratio of this table's Payscale-based values in US, GB, DE (3 countries) | — |
| Account Executive | Sales | 4,410,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = Software Engineer value × 0.726, the geometric-mean Account Executive/Software Engineer ratio of this table's Payscale-based values in US, GB, DE (3 countries) | levels.fyi `sales` base median, all levels: 9,903,920 (n=21) [link](https://www.levels.fyi/t/sales/locations/japan); Payscale `Account_Executive` median 5,056,518 (n=6, too small to use) |
| Sales Manager † | Sales | 4,120,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = Software Engineer value × 0.680, the geometric-mean Sales Manager/Software Engineer ratio of this table's Payscale-based values in US, GB, DE (2 countries) | — |
| Marketing Specialist | Marketing | 4,140,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = Software Engineer value × 0.683, the geometric-mean Marketing Specialist/Software Engineer ratio of this table's Payscale-based values in US, GB, DE (3 countries) | Payscale `Marketing_Specialist` median 3,600,000 (n=7, too small to use) |
| Marketing Manager † | Marketing | 4,830,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = Software Engineer value × 0.796, the geometric-mean Marketing Manager/Software Engineer ratio of this table's Payscale-based values in US, GB, DE (3 countries) | levels.fyi `marketing` base median, all levels: 12,003,894 (n=10) [link](https://www.levels.fyi/t/marketing/locations/japan); Payscale `Marketing_Manager` median 3,600,000 (n=21, too small to use) |
| Support Specialist | Customer Support | 3,680,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = Software Engineer value × 0.607, the geometric-mean Support Specialist/Software Engineer ratio of this table's Payscale-based values in US, GB, DE (3 countries) | levels.fyi `customer-service` base median, all levels: 8,939,995 (n=17) [link](https://www.levels.fyi/t/customer-service/locations/japan); Payscale `Technical_Support_Specialist` median 3,000,000 (n=5, too small to use) |
| Support Manager † | Customer Support | 4,490,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = Software Engineer value × 0.740, the geometric-mean Support Manager/Software Engineer ratio of this table's Payscale-based values in US, GB, DE (3 countries) | — |
| Accountant | Finance | 4,110,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = Software Engineer value × 0.678, the geometric-mean Accountant/Software Engineer ratio of this table's Payscale-based values in US, GB, DE (3 countries) | levels.fyi `accountant` base median, all levels: 10,177,784 (n=6) [link](https://www.levels.fyi/t/accountant/locations/japan); Payscale `Accountant` median 3,954,785 (n=12, too small to use) |
| Financial Analyst | Finance | 5,040,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = Software Engineer value × 0.831, the geometric-mean Financial Analyst/Software Engineer ratio of this table's Payscale-based values in US, GB, DE (3 countries) | levels.fyi `financial-analyst` base median, all levels: 11,112,290 (n=21) [link](https://www.levels.fyi/t/financial-analyst/locations/japan); Payscale `Financial_Analyst` median 4,500,000 (n=11, too small to use) |
| HR Generalist | HR | 4,290,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = Software Engineer value × 0.707, the geometric-mean HR Generalist/Software Engineer ratio of this table's Payscale-based values in US, GB, DE (3 countries) | levels.fyi `human-resources` base median, all levels: 10,899,639 (n=10) [link](https://www.levels.fyi/t/human-resources/locations/japan); Payscale `Human_Resources_(HR)_Generalist` median 4,211,656 (n=8, too small to use) |
| Recruiter | HR | 4,170,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = Software Engineer value × 0.687, the geometric-mean Recruiter/Software Engineer ratio of this table's Payscale-based values in US, GB, DE (3 countries) | levels.fyi `recruiter` base median, all levels: 8,140,428 (n=10) [link](https://www.levels.fyi/t/recruiter/locations/japan); Payscale `Recruiter` median 5,329,873 (n=11, too small to use) |
| Operations Analyst | Operations | 4,430,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = Software Engineer value × 0.730, the geometric-mean Operations Analyst/Software Engineer ratio of this table's Payscale-based values in US, GB, DE (2 countries) | levels.fyi `business-analyst` base median, all levels: 6,665,927 (n=14) [link](https://www.levels.fyi/t/business-analyst/locations/japan); Payscale `Operations_Analyst` median 4,850,000 (n=6, too small to use) |
| IT Support Specialist | Operations | 4,040,000 | ESTIMATED (weak) | no Payscale cell with n ≥ 30 in this country. = Software Engineer value × 0.665, the geometric-mean IT Support Specialist/Software Engineer ratio of this table's Payscale-based values in US, GB, DE (3 countries) | levels.fyi `information-technologist` base median, all levels: 7,459,128 (n=13) [link](https://www.levels.fyi/t/information-technologist/locations/japan) |


## 2. Level multipliers relative to L3

Levels: **L1** entry (0–1 y) · **L2** junior (1–3 y) · **L3** mid (3–5 y) · **L4** senior · **L5** staff/lead or first-line manager · **L6** principal or senior manager · **L7** director.

| Country | Group | Kind | L1 | L2 | L3 | L4 | L5 | L6 | L7 |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| US | Eng/Product/Design | raw | 0.79 | 0.93 | 1.00 | 1.29 | 1.46 | 1.57 | 1.72 |
| US | Eng/Product/Design | **use** | **0.79** | **0.93** | **1.00** | **1.29** | **1.46** | **1.57** | **1.72** |
| US | Other departments | raw | 0.82 | 0.94 | 1.00 | 1.30 | 1.29 | 1.72 | 1.77 |
| US | Other departments | **use** | **0.82** | **0.94** | **1.00** | **1.30** | **1.36** | **1.72** | **1.80** |
| IN | Eng/Product/Design | raw | 0.46 | 0.75 | 1.00 | 1.60 | 2.87 | 3.54 | 4.65 |
| IN | Eng/Product/Design | **use** | **0.46** | **0.75** | **1.00** | **1.60** | **2.87** | **3.54** | **4.65** |
| IN | Other departments | raw | 0.57 | 0.82 | 1.00 | 1.80 | 1.82 | 3.78 | 7.08 |
| IN | Other departments | **use** | **0.57** | **0.82** | **1.00** | **1.80** | **1.89** | **3.78** | **7.08** |
| GB | Eng/Product/Design | raw | 0.66 | 0.90 | 1.00 | 1.39 | 1.72 | 1.70 | 2.14 |
| GB | Eng/Product/Design | **use** | **0.66** | **0.90** | **1.00** | **1.39** | **1.72** | **1.81** | **2.14** |
| GB | Other departments | raw | 0.74 | 0.91 | 1.00 | 1.27 | 1.29 | 1.74 | 2.42 |
| GB | Other departments | **use** | **0.74** | **0.91** | **1.00** | **1.27** | **1.34** | **1.74** | **2.42** |
| DE | Eng/Product/Design | raw | 0.78 | 0.92 | 1.00 | 1.24 | 1.46 | 1.51 | 1.95 |
| DE | Eng/Product/Design | **use** | **0.78** | **0.92** | **1.00** | **1.24** | **1.46** | **1.53** | **1.95** |
| DE | Other departments | raw | 0.74 | 0.95 | 1.00 | 1.36 | 1.18 | 1.46 | 2.20 |
| DE | Other departments | **use** | **0.74** | **0.95** | **1.00** | **1.36** | **1.42** | **1.49** | **2.20** |
| BR | All departments | raw | 0.56 | 0.75 | 1.00 | 1.79 | 2.31 | 2.46 | 3.02 |
| BR | All departments | **use** | **0.56** | **0.75** | **1.00** | **1.79** | **2.31** | **2.46** | **3.02** |
| JP | All departments | raw | 0.87 | 0.93 | 1.00 | 1.12 | 1.43 | 1.89 | 2.28 |
| JP | All departments | **use** | **0.87** | **0.93** | **1.00** | **1.12** | **1.43** | **1.89** | **2.28** |

**How each row was built.** The inputs are CONFIRMED; the ratios and the "use" rows are ESTIMATED.
- **US, IN, GB, DE (Payscale).**
  - L1 and L2 are the geometric-mean ratios of the Payscale "less than 1 year" and "1–4 years" medians to each role's L3 value, taken across the group's roles.
  - L4–L7 are Payscale title medians divided by an L3 anchor. Engineering uses the Software Engineer ladder: Senior → Staff/Lead → Principal/Senior Engineering Manager → Director/VP of Engineering. Other departments use the geometric mean of three ladders: Accountant → Senior Accountant → Accounting Manager → Financial Controller → Finance Director; Marketing Specialist → Marketing Manager → Senior Marketing Manager → Marketing Director; HR Generalist → HR Business Partner → HR Manager → HR Director.
  - Every title, median and n is in Appendix B.
- **BR (Brazil).** Payscale's Brazilian ladders have n < 30, so I used the [Código Fonte TV *Pesquisa Salarial de Programadores 2025*, CLT filter](https://pesquisa.codigofonte.com.br/2025/modelo/clt). It reports CLT means per month from 8,468 respondents, surveyed March–July 2025 (CONFIRMED): Júnior R$ 4,230.86 · Pleno R$ 7,539.50 · Sênior R$ 13,474.53 · Especialista/Tech Lead/Principal R$ 17,429.95.
  - L1 = Júnior ÷ Pleno, L2 = √L1, L4 = Sênior ÷ Pleno and L5 = Especialista ÷ Pleno.
  - L6 and L7 are extrapolated using the median steps of US, IN, GB and DE: × 1.063 and × 1.227.
  - No Brazilian ladder for other departments was found, so the same row applies to all departments (ESTIMATED (weak)).
- **JP (Japan).** Source: MHLW [令和7年賃金構造基本統計調査](https://www.mhlw.go.jp/toukei/itiran/roudou/chingin/kouzou/z2025/index.html), all industries, scheduled monthly pay in thousand yen (CONFIRMED).
  - By age ([第2表](https://www.mhlw.go.jp/toukei/itiran/roudou/chingin/kouzou/z2025/dl/02.pdf)): 20–24 = 242.8, 25–29 = 279.4 (used as L3), 30–34 = 312.3.
  - By position ([第8表](https://www.mhlw.go.jp/toukei/itiran/roudou/chingin/kouzou/z2025/dl/08.pdf)): 係長 (supervisor) = 399.2, 課長 (section manager) = 529.2, 部長 (department head) = 635.8.
  - Mapping: L1 = 20–24, L2 = geometric midpoint, L4 = 30–34, L5 = 係長, L6 = 課長, L7 = 部長.
  - Japanese pay follows position and tenure more than function, so one row covers all departments.
- **"use" rows** are the raw rows made strictly increasing: L2 ≤ 0.97, L1 ≤ 0.95 × L2, and each level from L4 up is at least 1.05 × the level below. Missing levels are interpolated geometrically. Where "use" differs from "raw", the raw ladder dipped. Typical causes: HR Manager pays less than HR Business Partner on Payscale, and Principal pays less than Staff in GB.

**Do the two groups differ materially?**
- **US: no.** The two rows are within about 10% of each other at every level.
- **GB: yes at L5** (engineering 1.72 vs others 1.34) and at L7, where the other departments are steeper (2.42 vs 2.14).
- **DE: mostly no.** The rows are within 10% except at L7 (1.95 vs 2.20).
- **IN: yes.** Other departments start from a much lower L3, so their ladder is steeper at the top (L7 7.08 vs 4.65), while engineering jumps more at L5 (2.87 vs 1.89).
- Use separate rows for GB and IN. A single row per country would be acceptable for US and DE.

**Cross-check against levels.fyi** (software engineers at tech companies; its "Senior" ≈ L4 and "Entry-level" ≈ L1):

| Country | levels.fyi SWE base: Senior ÷ Entry-level (n entry / n senior) | This file, Eng L4 ÷ L1 (use rows) |
|---|---:|---:|
| US | 1.54 (7,502 / 23,336) [entry](https://www.levels.fyi/t/software-engineer/levels/entry-level/locations/united-states), [senior](https://www.levels.fyi/t/software-engineer/levels/senior/locations/united-states) | 1.63 |
| IN | 3.24 (2,636 / 8,665) [entry](https://www.levels.fyi/t/software-engineer/levels/entry-level/locations/india), [senior](https://www.levels.fyi/t/software-engineer/levels/senior/locations/india) | 3.46 |
| GB | 2.14 (603 / 2,358) [entry](https://www.levels.fyi/t/software-engineer/levels/entry-level/locations/united-kingdom), [senior](https://www.levels.fyi/t/software-engineer/levels/senior/locations/united-kingdom) | 2.12 |
| DE | 1.48 (207 / 1,768) [entry](https://www.levels.fyi/t/software-engineer/levels/entry-level/locations/germany), [senior](https://www.levels.fyi/t/software-engineer/levels/senior/locations/germany) | 1.58 |
| BR | 3.66 (90 / 1,304) [entry](https://www.levels.fyi/t/software-engineer/levels/entry-level/locations/brazil), [senior](https://www.levels.fyi/t/software-engineer/levels/senior/locations/brazil) | 3.18 |
| JP | 1.96 (54 / 175) [entry](https://www.levels.fyi/t/software-engineer/levels/entry-level/locations/japan), [senior](https://www.levels.fyi/t/software-engineer/levels/senior/locations/japan) | 1.29 |

US, IN, GB, DE and BR agree within about 15%. JP does not: MHLW's all-industry curve is much flatter than levels.fyi's Tokyo tech sample (54 entry-level profiles). To make the demo look like a Tokyo tech company rather than a typical Japanese employer, use a steeper JP ladder. levels.fyi puts senior at about 2× entry level there. No sourced alternative ladder is given.

## 3. Typical spread within one role and level (fraction of the median)

| Country | p10 | p25 | p75 | p90 | Basis | Label |
|---|---:|---:|---:|---:|---|---|
| US | 0.74 | 0.85 | 1.16 | 1.32 | median over 36 Payscale role × experience-band pages (1–4 y and 5–9 y bands, n ≥ 30 each) | ESTIMATED (median of CONFIRMED page percentiles) |
| IN | 0.49 | 0.71 | 1.39 | 1.98 | median over 33 Payscale role × experience-band pages (1–4 y and 5–9 y bands, n ≥ 30 each) | ESTIMATED (median of CONFIRMED page percentiles) |
| GB | 0.72 | 0.83 | 1.20 | 1.43 | median over 31 Payscale role × experience-band pages (1–4 y and 5–9 y bands, n ≥ 30 each) | ESTIMATED (median of CONFIRMED page percentiles) |
| DE | 0.73 | 0.87 | 1.15 | 1.35 | median over 20 Payscale role × experience-band pages (1–4 y and 5–9 y bands, n ≥ 30 each) | ESTIMATED (median of CONFIRMED page percentiles) |
| BR | 0.60 | 0.78 | 1.27 | 1.62 | geometric mean of US and IN (Payscale BR percentiles unusable, see §6) | ESTIMATED (weak) |
| JP | 0.73 | 0.85 | 1.16 | 1.35 | median of US, GB, DE (Payscale JP percentiles unusable, see §6) | ESTIMATED (weak) |

Notes:
- **How the four Payscale rows were built.** Each role's Payscale page has separate "1–4 years" and "5–9 years" pages with their own percentiles. I took p10/p25/p75/p90 ÷ p50 from every such page with n ≥ 30 and report the median across them. The band pages are linked from the "Job by Experience" section of each Payscale role page cited in §1. Their URLs contain a hash, e.g. [US Software Engineer, 1–4 years](https://www.payscale.com/research/US/Job=Software_Engineer/Salary/4fd947de/Early-Career).
- **These are market spreads.** Each band still mixes employers and roughly two levels, so treat them as an upper bound. One company's band for a single role and level is normally narrower. That is not confirmed here because no public source was found. For the seed, p25/p75 above give a realistic natural spread. The "paid far from peers" outliers belong beyond p10/p90.
- **Engineering vs other departments.** US 0.85/1.16 vs 0.86/1.16. GB 0.82/1.21 vs 0.86/1.19. DE 0.87/1.14 vs 0.88/1.18. IN 0.66/1.53 vs 0.72/1.38. They differ materially only in India.

## 4. Gender pay gap (official, unadjusted, latest year)

| Country | Unadjusted gap | Measure and year | Adjusted / same-job gap | Sources |
|---|---|---|---|---|
| US | **16.1%** (women's median = 83.9% of men's) | Median annual earnings, full-time year-round workers, 2025. CONFIRMED ratio; the gap is 100 − 83.9. Men $72,380, women $60,760. | **1%**: women earn $0.99 per $1 for the same job title and compensable factors; uncontrolled $0.82. Payscale *2026 Gender Pay Gap Report*, data Jan 2024–Jan 2026. CONFIRMED, but not an official statistic. | [Census P60-289, released 2026-09-15](https://www.census.gov/library/publications/2026/demo/p60-289.html) · [Payscale report](https://www.payscale.com/research-and-insights/gender-pay-gap/) |
| GB | **12.8%** all employees; **6.9%** full-time | Median hourly pay excluding overtime, April 2025. CONFIRMED. | ONS says explicitly that its measure "is not a measure of the difference in pay between men and women in the same employment". **No official adjusted figure** (CONFIRMED absence). | [ONS, Gender pay gap in the UK: 2025 (23 Oct 2025)](https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/bulletins/genderpaygapintheuk/2025) |
| DE | **16%** (2025) | Average gross hourly pay: women €22.81, men €27.05. CONFIRMED. Eurostat's harmonised figure is **15.6% (2024)** (CONFIRMED, dataset `sdg_05_20`, updated 2026-02-26). | **6%** *bereinigt* (adjusted): comparable job, qualifications and career history, 2025. CONFIRMED. | [Destatis press release 453, 16 Dec 2025](https://www.destatis.de/DE/Presse/Pressemitteilungen/2025/12/PD25_453_621.html) · [Eurostat API sdg_05_20](https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/sdg_05_20?geo=DE) |
| JP | **23.4%** (男女間賃金格差 76.6, 男 = 100) | Scheduled monthly pay, full-time general workers, 2025: men ¥373,400, women ¥285,900. CONFIRMED. Published 2026-03-24. | No official adjusted gap found. **Within the same position level** (ESTIMATED, derived from 第8表): non-managerial 15.7%, 係長 11.0%, 課長 13.1%, 部長 10.0%. | [MHLW press release](https://www.mhlw.go.jp/toukei/itiran/roudou/chingin/kouzou/z2025/dl/13.pdf) · [第8表 by position](https://www.mhlw.go.jp/toukei/itiran/roudou/chingin/kouzou/z2025/dl/08.pdf) |
| BR | **21.4%** (women = 78.6% of men) | **Mean** usual earnings, all employed people, 2024 (PNAD Contínua). CONFIRMED. | No official same-job gap found. The Ministry of Labour's 5th *Relatório de Transparência Salarial* (April 2026, firms with ≥ 100 staff) reportedly gives 21.3% for mean pay and 14.3% for median hiring pay. **NOT CONFIRMED**: the gov.br page returned "Conteúdo Restrito", so these numbers come from a search snippet only. | [IBGE, Síntese de Indicadores Sociais 2025 (PDF), section on income by occupational group](https://biblioteca.ibge.gov.br/visualizacao/livros/liv102240.pdf) |
| IN | **24.2%** (ESTIMATED: 1 − 18,353 / 24,217) | **Mean** monthly earnings of regular wage/salaried employees, calendar 2025: men ₹24,217, women ₹18,353. CONFIRMED inputs. India publishes no official gender-pay-gap statistic, so this gap is derived. | None found. | [MoSPI, PLFS Annual Report 2025 press note (Mar 2026)](https://www.mospi.gov.in/uploads/latestReleases/latest_release_1774607827733_3e8964a9-268b-4cc9-ad65-cfc8a9e32f08_Press_note_AR_PLFS_2025_23032025_V2.1_26032026_final.pdf) |

Notes:
- **Measures differ.** The six measures are not like for like: hourly vs annual, median vs mean, and all workers vs full-time. For one consistent seed parameter, use each country's figure as given and do not compare countries closely.
- **For a demo seed, the adjusted (same-job) gap is the relevant one.** Where it is known, it is 1–6%. The Japanese within-position figures suggest about 10–15%. Use ESTIMATED values for the rest.

## 5. OpenRouter rate limits for free models (`:free` model ids)

| Account state | Requests per minute | Requests per day | Label |
|---|---:|---:|---|
| Fewer than 10 credits purchased (all time) | **20** | **50** | CONFIRMED |
| At least 10 credits purchased (all time) | **20** | **1,000** | CONFIRMED |

Details, all CONFIRMED from the docs' Markdown source:
- **Where the numbers come from.** The HTML page fills the numbers in with JavaScript. The `.md` source defines them as `FREE_MODEL_RATE_LIMIT_RPM = 20`, `FREE_MODEL_NO_CREDITS_RPD = 50`, `FREE_MODEL_HAS_CREDITS_RPD = 1000` and `FREE_MODEL_CREDITS_THRESHOLD = 10`.
- **The threshold.** The tier depends on credits *purchased all time*, not on the current balance. To absorb rounding and top-up fees, the higher daily limit actually applies from 9 credits.
- **Checking the daily count.** `GET /api/v1/key` returns `free_model_daily_requests {used, limit, remaining}`, counted per UTC day. The per-minute limit is not reported there.
- **More keys do not help.** Extra accounts or API keys do not raise the limits, which are enforced globally.
- **Errors.** Going over a limit returns HTTP 429. Retry with backoff and honour `Retry-After`.
- **Shared capacity.** Free models can also return 429 when the upstream provider is busy, even under these caps.

Sources:
- [openrouter.ai/docs/api-reference/limits.md](https://openrouter.ai/docs/api-reference/limits.md) (listed as `/docs/api_reference/limits.md` in [llms.txt](https://openrouter.ai/docs/llms.txt))
- [openrouter.ai/docs/faq.md](https://openrouter.ai/docs/faq.md) ("How are rate limits calculated?" and the free-models answer use the same constants)
- [Free Variant page](https://openrouter.ai/docs/guides/routing/model-variants/free.md) (says only "may have different rate limits")

## 6. What I could not confirm, and where I looked

**Salary sources I could not use**
- **BLS OEWS** (official US wages by industry, e.g. software publishers NAICS 513200): `bls.gov/oes/...` returned 403 to curl, and the web fetch was redirected to the OEWS home page. Not used. US figures rely on Payscale and levels.fyi.
- **Glassdoor** (glassdoor.co.in, 403) was not used.
- **Gated sources** were not opened, to respect the no-sign-up rule. Hays, Michael Page, Robert Half and Robert Walters salary guides all sit behind download forms. salario.com.br's Júnior/Pleno/Sênior-by-company-size table is paywalled. AmbitionBox's exact averages need a login, so only its public 3–6-year ranges are quoted.
- **doda (JP)**: curl timed out. Two web-fetch reads of the 平均年収ランキング page returned inconsistent extracts, so no doda number is used. For context only, one read gave IT/telecom engineers ¥4.69M and finance specialists ¥4.86M. Those figures include bonus and are UNCONFIRMED.
- **MHLW jobtag and the e-Stat occupation tables (JP)**: jobtag is rendered by JavaScript. I could not locate the e-Stat 職種別 (by occupation) 2025 file in time. As a result, Japan has **no local role-by-role source**. JP roles other than Software Engineer use US/GB/DE ratios and are labelled ESTIMATED (weak). Small local samples (Payscale JP, n = 5–21, shown as cross-checks) suggest that non-engineering roles in Japan pay closer to engineers than in the West, so JP finance, HR and sales values may be **10–25% low**.
- **IBGE SIDRA API (BR)** was blocked by a Cloudflare challenge, so the IBGE PDF was used instead.

**Data quality problems in what I did use**
- **Payscale BR and JP**: role samples are tiny (n < 30 for every role except Software Engineer). Their percentiles look contaminated (for example JP p25 ≈ ¥0.45M, probably monthly pay entered as annual), so they are not used for spreads.
- **Payscale cells last updated before 2025**: GB Sales Manager (2024-01-03) and IN Sales Manager (2024-11-23). Both are flagged in the tables.
- **Title collisions and odd matches**:
  - India's "Account Executive" is an accounting role. It is replaced by a ratio, see §1.
  - The GB Support Specialist value uses Payscale "Technical Support Specialist" because "Customer Support Specialist" has n = 17, so it may run high.
  - Payscale "Sales Manager" covers all industries, including retail, so Sales Manager values are low as L3 anchors. Seed sales managers at L5+.

**Method limits**
- **Levels L6–L7.**
  - Brazil: extrapolated (ESTIMATED (weak)).
  - Other countries: Payscale's all-industry titles flatten at the top. For example, US Principal Software Engineer pays less than Staff, which the smoothing fixes.
  - No public ladder for a *mid-sized* tech company was checked.
- **Data Engineer and QA Engineer** have no separate levels.fyi family, so they use the country's F with their own Payscale medians.
- **Brazil's 13th-salary convention** in Payscale and levels.fyi is not stated (see Read me first).
- **Gender pay gap**: the Brazilian Ministry of Labour figures are not confirmed (page restricted). India has no official statistic. BLS weekly-earnings ratios were not fetched because bls.gov blocked access.

## Appendix A: tech-company factor pairs (CONFIRMED inputs)

Only pairs with Payscale n ≥ 30 and levels.fyi n ≥ 20 count. levels.fyi medians are base salary across all levels, read on 2026-10-04.

| Country | Role ↔ levels.fyi family | Payscale median (n) | levels.fyi base median, all levels (n) | √(ratio) |
|---|---|---:|---:|---:|
| US | Software Engineer ↔ [`software-engineer`](https://www.levels.fyi/t/software-engineer/locations/united-states) | 98,200 (24,077) | 160,000 (51,030) | 1.276 |
| US | Engineering Manager ↔ [`software-engineering-manager`](https://www.levels.fyi/t/software-engineering-manager/locations/united-states) | 155,526 (1,743) | 236,000 (3,430) | 1.232 |
| US | Product Manager ↔ [`product-manager`](https://www.levels.fyi/t/product-manager/locations/united-states) | 112,517 (3,805) | 186,000 (5,384) | 1.286 |
| US | Product Designer ↔ [`product-designer`](https://www.levels.fyi/t/product-designer/locations/united-states) | 96,664 (1,803) | 154,000 (1,751) | 1.262 |
| US | Accountant ↔ [`accountant`](https://www.levels.fyi/t/accountant/locations/united-states) | 61,831 (5,552) | 98,000 (580) | 1.259 |
| US | Financial Analyst ↔ [`financial-analyst`](https://www.levels.fyi/t/financial-analyst/locations/united-states) | 70,852 (7,825) | 116,000 (1,116) | 1.280 |
| US | Recruiter ↔ [`recruiter`](https://www.levels.fyi/t/recruiter/locations/united-states) | 63,002 (3,268) | 140,000 (707) | 1.491 |
| US | Support Specialist ↔ [`customer-service`](https://www.levels.fyi/t/customer-service/locations/united-states) | 56,059 (345) | 50,000 (164) | 0.944 |
| US | Operations Analyst ↔ [`business-analyst`](https://www.levels.fyi/t/business-analyst/locations/united-states) | 68,095 (1,813) | 105,000 (997) | 1.242 |
| US | IT Support Specialist ↔ [`information-technologist`](https://www.levels.fyi/t/information-technologist/locations/united-states) | 58,988 (2,175) | 85,000 (893) | 1.200 |
| US | Account Executive ↔ [`sales`](https://www.levels.fyi/t/sales/locations/united-states) | 69,682 (3,048) | 115,000 (1,323) | 1.285 |
| US | HR Generalist ↔ [`human-resources`](https://www.levels.fyi/t/human-resources/locations/united-states) | 63,650 (10,459) | 131,250 (312) | 1.436 |
| US | Marketing Manager ↔ [`marketing`](https://www.levels.fyi/t/marketing/locations/united-states) | 76,775 (9,906) | 159,000 (890) | 1.439 |
| IN | Software Engineer ↔ [`software-engineer`](https://www.levels.fyi/t/software-engineer/locations/india) | 813,748 (4,917) | 2,618,695 (23,674) | 1.794 |
| IN | Engineering Manager ↔ [`software-engineering-manager`](https://www.levels.fyi/t/software-engineering-manager/locations/india) | 4,045,177 (241) | 6,965,466 (1,080) | 1.312 |
| IN | Product Manager ↔ [`product-manager`](https://www.levels.fyi/t/product-manager/locations/india) | 2,174,410 (478) | 4,009,522 (1,659) | 1.358 |
| IN | Product Designer ↔ [`product-designer`](https://www.levels.fyi/t/product-designer/locations/india) | 930,816 (247) | 2,069,407 (446) | 1.491 |
| IN | Accountant ↔ [`accountant`](https://www.levels.fyi/t/accountant/locations/india) | 310,467 (1,154) | 984,597 (97) | 1.781 |
| IN | Financial Analyst ↔ [`financial-analyst`](https://www.levels.fyi/t/financial-analyst/locations/india) | 571,613 (1,053) | 1,246,299 (258) | 1.477 |
| IN | Recruiter ↔ [`recruiter`](https://www.levels.fyi/t/recruiter/locations/india) | 396,865 (307) | 1,960,977 (110) | 2.223 |
| IN | Support Specialist ↔ [`customer-service`](https://www.levels.fyi/t/customer-service/locations/india) | 413,325 (33) | 619,104 (50) | 1.224 |
| IN | Operations Analyst ↔ [`business-analyst`](https://www.levels.fyi/t/business-analyst/locations/india) | 489,643 (253) | 1,638,244 (415) | 1.829 |
| IN | IT Support Specialist ↔ [`information-technologist`](https://www.levels.fyi/t/information-technologist/locations/india) | 609,480 (114) | 1,016,349 (209) | 1.291 |
| IN | HR Generalist ↔ [`human-resources`](https://www.levels.fyi/t/human-resources/locations/india) | 458,059 (667) | 1,885,080 (160) | 2.029 |
| IN | Marketing Manager ↔ [`marketing`](https://www.levels.fyi/t/marketing/locations/india) | 865,044 (732) | 1,579,510 (135) | 1.351 |
| GB | Software Engineer ↔ [`software-engineer`](https://www.levels.fyi/t/software-engineer/locations/united-kingdom) | 42,172 (1,765) | 82,648 (5,051) | 1.400 |
| GB | Engineering Manager ↔ [`software-engineering-manager`](https://www.levels.fyi/t/software-engineering-manager/locations/united-kingdom) | 82,179 (147) | 131,617 (287) | 1.266 |
| GB | Product Manager ↔ [`product-manager`](https://www.levels.fyi/t/product-manager/locations/united-kingdom) | 59,188 (208) | 97,043 (434) | 1.280 |
| GB | Product Designer ↔ [`product-designer`](https://www.levels.fyi/t/product-designer/locations/united-kingdom) | 36,483 (148) | 71,537 (126) | 1.400 |
| GB | Accountant ↔ [`accountant`](https://www.levels.fyi/t/accountant/locations/united-kingdom) | 33,556 (445) | 44,542 (50) | 1.152 |
| GB | Financial Analyst ↔ [`financial-analyst`](https://www.levels.fyi/t/financial-analyst/locations/united-kingdom) | 34,887 (292) | 64,964 (81) | 1.365 |
| GB | Recruiter ↔ [`recruiter`](https://www.levels.fyi/t/recruiter/locations/united-kingdom) | 29,827 (101) | 76,418 (86) | 1.601 |
| GB | Operations Analyst ↔ [`business-analyst`](https://www.levels.fyi/t/business-analyst/locations/united-kingdom) | 30,847 (78) | 49,337 (75) | 1.265 |
| GB | IT Support Specialist ↔ [`information-technologist`](https://www.levels.fyi/t/information-technologist/locations/united-kingdom) | 30,124 (63) | 48,360 (56) | 1.267 |
| GB | Account Executive ↔ [`sales`](https://www.levels.fyi/t/sales/locations/united-kingdom) | 27,727 (150) | 73,397 (152) | 1.627 |
| GB | HR Generalist ↔ [`human-resources`](https://www.levels.fyi/t/human-resources/locations/united-kingdom) | 32,640 (198) | 75,691 (28) | 1.523 |
| GB | Marketing Manager ↔ [`marketing`](https://www.levels.fyi/t/marketing/locations/united-kingdom) | 39,585 (621) | 59,736 (82) | 1.228 |
| DE | Software Engineer ↔ [`software-engineer`](https://www.levels.fyi/t/software-engineer/locations/germany) | 60,098 (933) | 82,265 (3,177) | 1.170 |
| DE | Engineering Manager ↔ [`software-engineering-manager`](https://www.levels.fyi/t/software-engineering-manager/locations/germany) | 97,437 (87) | 117,409 (219) | 1.098 |
| DE | Product Manager ↔ [`product-manager`](https://www.levels.fyi/t/product-manager/locations/germany) | 65,812 (162) | 91,589 (252) | 1.180 |
| DE | Product Designer ↔ [`product-designer`](https://www.levels.fyi/t/product-designer/locations/germany) | 54,164 (85) | 72,818 (98) | 1.159 |
| DE | Financial Analyst ↔ [`financial-analyst`](https://www.levels.fyi/t/financial-analyst/locations/germany) | 56,957 (101) | 67,442 (26) | 1.088 |
| DE | Recruiter ↔ [`recruiter`](https://www.levels.fyi/t/recruiter/locations/germany) | 44,338 (90) | 62,553 (29) | 1.188 |
| DE | IT Support Specialist ↔ [`information-technologist`](https://www.levels.fyi/t/information-technologist/locations/germany) | 44,876 (82) | 62,120 (71) | 1.177 |
| DE | Account Executive ↔ [`sales`](https://www.levels.fyi/t/sales/locations/germany) | 58,808 (44) | 84,126 (87) | 1.196 |
| DE | Marketing Manager ↔ [`marketing`](https://www.levels.fyi/t/marketing/locations/germany) | 51,725 (187) | 69,436 (28) | 1.159 |
| BR | Software Engineer ↔ [`software-engineer`](https://www.levels.fyi/t/software-engineer/locations/brazil) | 100,521 (78) | 168,449 (2,577) | 1.295 |
| JP | Software Engineer ↔ [`software-engineer`](https://www.levels.fyi/t/software-engineer/locations/japan) | 3,845,791 (135) | 8,146,538 (433) | 1.455 |

## Appendix B: ladder titles behind the multipliers (Payscale, CONFIRMED medians)

Titles below n = 30 show "—" and were not used.

| Country | Ladder | Level | Payscale title | Median | n | Ratio to L3 anchor |
|---|---|---|---|---:|---:|---:|
| US | Eng | L4 | [Senior_Software_Engineer](https://www.payscale.com/research/US/Job=Senior_Software_Engineer/Salary) | 132,697 | 12835 | 1.29 |
| US | Eng | L5 | [Staff_Software_Engineer](https://www.payscale.com/research/US/Job=Staff_Software_Engineer/Salary) | 165,637 | 945 | 1.46 |
| US | Eng | L5 | [Lead_Software_Engineer](https://www.payscale.com/research/US/Job=Lead_Software_Engineer/Salary) | 135,647 | 2673 | 1.46 |
| US | Eng | L6 | [Principal_Software_Engineer](https://www.payscale.com/research/US/Job=Principal_Software_Engineer/Salary) | 157,609 | 2330 | 1.57 |
| US | Eng | L6 | [Senior_Engineering_Manager](https://www.payscale.com/research/US/Job=Senior_Engineering_Manager/Salary) | 165,149 | 1036 | 1.57 |
| US | Eng | L7 | [Director_of_Engineering](https://www.payscale.com/research/US/Job=Director_of_Engineering/Salary) | 161,471 | 2084 | 1.72 |
| US | Eng | L7 | [Vice_President_(VP),_Engineering](https://www.payscale.com/research/US/Job=Vice_President_%28VP%29,_Engineering/Salary) | 192,252 | 1234 | 1.72 |
| US | fin | L4 | [Senior_Accountant](https://www.payscale.com/research/US/Job=Senior_Accountant/Salary) | 79,172 | 7278 | 1.28 |
| US | fin | L5 | [Accounting_Manager](https://www.payscale.com/research/US/Job=Accounting_Manager/Salary) | 88,101 | 5092 | 1.42 |
| US | fin | L6 | [Financial_Controller](https://www.payscale.com/research/US/Job=Financial_Controller/Salary) | 100,542 | 6522 | 1.62 |
| US | fin | L7 | [Finance_Director](https://www.payscale.com/research/US/Job=Finance_Director/Salary) | 126,964 | 2983 | 2.05 |
| US | mkt | L5 | [Marketing_Manager](https://www.payscale.com/research/US/Job=Marketing_Manager/Salary) | 76,775 | 9906 | 1.24 |
| US | mkt | L6 | [Senior_Marketing_Manager](https://www.payscale.com/research/US/Job=Senior_Marketing_Manager/Salary) | 112,536 | 3200 | 1.82 |
| US | mkt | L7 | [Marketing_Director](https://www.payscale.com/research/US/Job=Marketing_Director/Salary) | 105,511 | 7751 | 1.70 |
| US | hr | L4 | [Human_Resources_(HR)_Business_Partner](https://www.payscale.com/research/US/Job=Human_Resources_%28HR%29_Business_Partner/Salary) | 84,099 | 4006 | 1.31 |
| US | hr | L5 | [Human_Resources_(HR)_Manager](https://www.payscale.com/research/US/Job=Human_Resources_%28HR%29_Manager/Salary) | 78,703 | 14033 | 1.23 |
| US | hr | L7 | [Human_Resources_(HR)_Director](https://www.payscale.com/research/US/Job=Human_Resources_%28HR%29_Director/Salary) | 102,457 | 6310 | 1.60 |
| IN | Eng | L4 | [Senior_Software_Engineer](https://www.payscale.com/research/IN/Job=Senior_Software_Engineer/Salary) | 1,671,574 | 4302 | 1.60 |
| IN | Eng | L5 | [Staff_Software_Engineer](https://www.payscale.com/research/IN/Job=Staff_Software_Engineer/Salary) | 3,923,744 | 120 | 2.87 |
| IN | Eng | L5 | [Lead_Software_Engineer](https://www.payscale.com/research/IN/Job=Lead_Software_Engineer/Salary) | 2,274,140 | 1304 | 2.87 |
| IN | Eng | L6 | [Principal_Software_Engineer](https://www.payscale.com/research/IN/Job=Principal_Software_Engineer/Salary) | 3,384,484 | 492 | 3.54 |
| IN | Eng | L6 | [Senior_Engineering_Manager](https://www.payscale.com/research/IN/Job=Senior_Engineering_Manager/Salary) | 4,025,648 | 204 | 3.54 |
| IN | Eng | L7 | [Director_of_Engineering](https://www.payscale.com/research/IN/Job=Director_of_Engineering/Salary) | 4,912,640 | 149 | 4.65 |
| IN | Eng | L7 | [Vice_President_(VP),_Engineering](https://www.payscale.com/research/IN/Job=Vice_President_%28VP%29,_Engineering/Salary) | 4,785,466 | 129 | 4.65 |
| IN | fin | L4 | [Senior_Accountant](https://www.payscale.com/research/IN/Job=Senior_Accountant/Salary) | 494,515 | 580 | 1.53 |
| IN | fin | L5 | [Accounting_Manager](https://www.payscale.com/research/IN/Job=Accounting_Manager/Salary) | 908,271 | 101 | 2.81 |
| IN | fin | L6 | [Financial_Controller](https://www.payscale.com/research/IN/Job=Financial_Controller/Salary) | 1,979,427 | 312 | 6.12 |
| IN | fin | L7 | [Finance_Director](https://www.payscale.com/research/IN/Job=Finance_Director/Salary) | 4,073,063 | 74 | 12.59 |
| IN | mkt | L5 | [Marketing_Manager](https://www.payscale.com/research/IN/Job=Marketing_Manager/Salary) | 865,044 | 732 | 1.21 |
| IN | mkt | L6 | [Senior_Marketing_Manager](https://www.payscale.com/research/IN/Job=Senior_Marketing_Manager/Salary) | 1,658,726 | 244 | 2.33 |
| IN | mkt | L7 | [Marketing_Director](https://www.payscale.com/research/IN/Job=Marketing_Director/Salary) | 3,236,973 | 140 | 4.54 |
| IN | hr | L4 | [Human_Resources_(HR)_Business_Partner](https://www.payscale.com/research/IN/Job=Human_Resources_%28HR%29_Business_Partner/Salary) | 1,005,208 | 412 | 2.11 |
| IN | hr | L5 | [Human_Resources_(HR)_Manager](https://www.payscale.com/research/IN/Job=Human_Resources_%28HR%29_Manager/Salary) | 848,380 | 1201 | 1.78 |
| IN | hr | L7 | [Human_Resources_(HR)_Director](https://www.payscale.com/research/IN/Job=Human_Resources_%28HR%29_Director/Salary) | 2,948,387 | 203 | 6.19 |
| GB | Eng | L4 | [Senior_Software_Engineer](https://www.payscale.com/research/UK/Job=Senior_Software_Engineer/Salary) | 62,007 | 1016 | 1.39 |
| GB | Eng | L5 | [Staff_Software_Engineer](https://www.payscale.com/research/UK/Job=Staff_Software_Engineer/Salary) | 85,900 | 35 | 1.72 |
| GB | Eng | L5 | [Lead_Software_Engineer](https://www.payscale.com/research/UK/Job=Lead_Software_Engineer/Salary) | 69,055 | 254 | 1.72 |
| GB | Eng | L6 | [Principal_Software_Engineer](https://www.payscale.com/research/UK/Job=Principal_Software_Engineer/Salary) | 76,762 | 159 | 1.70 |
| GB | Eng | L6 | [Senior_Engineering_Manager](https://www.payscale.com/research/UK/Job=Senior_Engineering_Manager/Salary) | 74,802 | 65 | 1.70 |
| GB | Eng | L7 | [Director_of_Engineering](https://www.payscale.com/research/UK/Job=Director_of_Engineering/Salary) | 87,953 | 59 | 2.14 |
| GB | Eng | L7 | [Vice_President_(VP),_Engineering](https://www.payscale.com/research/UK/Job=Vice_President_%28VP%29,_Engineering/Salary) | 103,662 | 34 | 2.14 |
| GB | fin | L4 | [Senior_Accountant](https://www.payscale.com/research/UK/Job=Senior_Accountant/Salary) | 37,921 | 172 | 1.14 |
| GB | fin | L5 | [Accounting_Manager](https://www.payscale.com/research/UK/Job=Accounting_Manager/Salary) | 45,563 | 53 | 1.37 |
| GB | fin | L6 | [Financial_Controller](https://www.payscale.com/research/UK/Job=Financial_Controller/Salary) | 55,351 | 355 | 1.67 |
| GB | fin | L7 | [Finance_Director](https://www.payscale.com/research/UK/Job=Finance_Director/Salary) | 79,467 | 210 | 2.40 |
| GB | mkt | L5 | [Marketing_Manager](https://www.payscale.com/research/UK/Job=Marketing_Manager/Salary) | 39,585 | 621 | 1.22 |
| GB | mkt | L6 | [Senior_Marketing_Manager](https://www.payscale.com/research/UK/Job=Senior_Marketing_Manager/Salary) | 58,591 | 184 | 1.81 |
| GB | mkt | L7 | [Marketing_Director](https://www.payscale.com/research/UK/Job=Marketing_Director/Salary) | 79,211 | 213 | 2.44 |
| GB | hr | L4 | [Human_Resources_(HR)_Business_Partner](https://www.payscale.com/research/UK/Job=Human_Resources_%28HR%29_Business_Partner/Salary) | 46,140 | 189 | 1.42 |
| GB | hr | L5 | [Human_Resources_(HR)_Manager](https://www.payscale.com/research/UK/Job=Human_Resources_%28HR%29_Manager/Salary) | 41,493 | 560 | 1.27 |
| GB | hr | L7 | [Human_Resources_(HR)_Director](https://www.payscale.com/research/UK/Job=Human_Resources_%28HR%29_Director/Salary) | 79,317 | 224 | 2.43 |
| DE | Eng | L4 | [Senior_Software_Engineer](https://www.payscale.com/research/DE/Job=Senior_Software_Engineer/Salary) | 76,530 | 634 | 1.24 |
| DE | Eng | L5 | [Staff_Software_Engineer](https://www.payscale.com/research/DE/Job=Staff_Software_Engineer/Salary) | 95,694 | 34 | 1.46 |
| DE | Eng | L5 | [Lead_Software_Engineer](https://www.payscale.com/research/DE/Job=Lead_Software_Engineer/Salary) | 85,160 | 84 | 1.46 |
| DE | Eng | L6 | [Principal_Software_Engineer](https://www.payscale.com/research/DE/Job=Principal_Software_Engineer/Salary) | 93,276 | 46 | 1.51 |
| DE | Eng | L6 | [Senior_Engineering_Manager](https://www.payscale.com/research/DE/Job=Senior_Engineering_Manager/Salary) | — | 27 | 1.51 |
| DE | Eng | L7 | [Director_of_Engineering](https://www.payscale.com/research/DE/Job=Director_of_Engineering/Salary) | 120,731 | 45 | 1.95 |
| DE | Eng | L7 | [Vice_President_(VP),_Engineering](https://www.payscale.com/research/DE/Job=Vice_President_%28VP%29,_Engineering/Salary) | — | 17 | 1.95 |
| DE | fin | L4 | [Senior_Accountant](https://www.payscale.com/research/DE/Job=Senior_Accountant/Salary) | — | 23 | — |
| DE | fin | L5 | [Accounting_Manager](https://www.payscale.com/research/DE/Job=Accounting_Manager/Salary) | — | 14 | — |
| DE | fin | L6 | [Financial_Controller](https://www.payscale.com/research/DE/Job=Financial_Controller/Salary) | 59,484 | 137 | 1.38 |
| DE | fin | L7 | [Finance_Director](https://www.payscale.com/research/DE/Job=Finance_Director/Salary) | — | 26 | — |
| DE | mkt | L5 | [Marketing_Manager](https://www.payscale.com/research/DE/Job=Marketing_Manager/Salary) | 51,725 | 187 | 1.15 |
| DE | mkt | L6 | [Senior_Marketing_Manager](https://www.payscale.com/research/DE/Job=Senior_Marketing_Manager/Salary) | 69,249 | 52 | 1.54 |
| DE | mkt | L7 | [Marketing_Director](https://www.payscale.com/research/DE/Job=Marketing_Director/Salary) | 102,319 | 66 | 2.28 |
| DE | hr | L4 | [Human_Resources_(HR)_Business_Partner](https://www.payscale.com/research/DE/Job=Human_Resources_%28HR%29_Business_Partner/Salary) | 65,043 | 49 | 1.36 |
| DE | hr | L5 | [Human_Resources_(HR)_Manager](https://www.payscale.com/research/DE/Job=Human_Resources_%28HR%29_Manager/Salary) | 57,697 | 76 | 1.20 |
| DE | hr | L7 | [Human_Resources_(HR)_Director](https://www.payscale.com/research/DE/Job=Human_Resources_%28HR%29_Director/Salary) | 102,221 | 34 | 2.13 |

## Appendix C: reproducing this

- **Payscale**: the base salary percentiles are in the page's `__NEXT_DATA__` JSON at `props.pageProps.pageData.compensation.salary`. Experience bands are under `byDimension["Job by Experience"]`, and each band has its own page with full percentiles. Of the 75 Payscale role cells used in §1, 57 were last updated in 2026, 16 in 2025 and 2 in 2024 (flagged). The range is 2024-01-03 to 2026-09-01.
- **levels.fyi**: `__NEXT_DATA__` → `props.pageProps.jobFamilyHistogram.baseSalary` (in USD) × `locationExchangeRate`. Level pages: `/t/<family>/levels/{entry-level|senior}/locations/<country>`.
- **CAGED via salario.com.br**: the `data-tabela-sal` attribute holds median and quartiles of monthly *hiring* pay (admissões), Aug 2025–Jul 2026.
- **AmbitionBox**: the public "3 - 6 years" range text on each `/profile/<role>-salary` page.
