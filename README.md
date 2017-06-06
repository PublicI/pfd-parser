Parses public financial disclosure data from OGE form 278e.

### Output
---

Outputs up to 10 CSVs with data from the disclosure files. The format is (briefly) documented here.

Entries should be read with the employee's separate ethics agreement and the endnotes included in the final table, which often indicate whether the employee intends to divest the asset upon entering government.

## 1. Filer's Positions Held Outside United States Government
filer-s-positions-held-outside-united-states-government.csv

| Column |
| ---- |
| # |
| organization-name |
| city-state |
| organization-type |
| position-held |
| from |
| to |

## 2. Filer's Employment Assets & Income and Retirement Accounts
filer-s-employment-assets-&-income-and-retirement-accounts.csv

| Column |
| ---- |
| # |
| description |
| eif |
| value |
| income-type |
| income-amount |

## 3. Filer's Employment Agreements and Arrangements
filer-s-employment-agreements-and-arrangements.csv

| Column |
| ---- |
| # |
| employer-or-party |
| city-state |
| status-and-terms |
| date |

## 4. Filers Sources of Compensation Exceeding $5,000 in a Year
filer-s-sources-of-compensation-exceeding-$5-000-in-a-year.csv

| Column |
| ---- |
| # |
| source-name |
| city-state |
| brief-description-of-duties |

## 5. Spouse's Employment Assets & Income and Retirement accounts
spouse-s-employment-assets-&-income-and-retirement-accounts.csv

| Column |
| ---- |
| # |
| description |
| eif |
| value |
| income-type |
| income-amount |

## 6. Other Assets and Income
other-assets-and-income.csv

| Column |
| ---- |
| # |
| description |
| eif |
| value |
| income-type |
| income-amount |

## 7. Transactions
transactions.csv

| Column |
| ---- |
| # |
| description |
| type |
| date |
| amount |

## 8. Liabilities
liabilities.csv

| Column |
| ---- |
| # |
| creditor-name |
| type |
| amount |
| year-incurred |
| rate |
| term |

## 9. Gifts and Travel Reimbursements
gifts-and-travel-reimbursements.csv

| Column |
| ---- |
| # |
| source-name |
| city-state |
| brief-description |
| value |

## Endnotes
endotes.csv

| Column |
| ---- |
| part |
| # |
| endnote |