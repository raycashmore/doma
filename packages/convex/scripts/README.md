# CREAM — Excel to Convex Migration

Personal finance tracker migrating from an Excel workbook (CREAM.xlsx) to a Convex backend.

## Project Structure
├── CREAM.xlsx # Source spreadsheet (12 sheets, ~1,200 data rows total) 
├── seedScript.ts # Node script to read xlsx and seed Convex 
├── convex/ 
│ ├── schema.ts # Table definitions (9 tables) 
│ ├── helpers.ts # Derived field functions + Excel date ↔ Unix timestamp 
│ ├── seed.ts # Bulk insert mutations (used by seedScript.ts) 
│ ├── queries.ts # Read queries — attach computed fields at read time 
│ └── mutations.ts # CRUD mutations + addSnapshot + updateExchangeRates 
└── README.md

## Architecture 

### Core Principle: Store raw inputs, derive everything else The Excel workbook has many columns that are formulas (TOTAL, NET, Equity, etc.). 
These are NOT stored in Convex. Instead, `helpers.ts` exports pure functions that compute them, and `queries.ts` attaches them to query results at read time. 
This keeps the database normalized and the logic testable. 

### Tables ↔ Excel Sheets | Convex Table | Excel Sheet | ~Rows | Key Fields | 
|------------------------|----------------|-------|------------| 
| `currentAccounts` | Current | 157 | NAB current, NAB shared, ING, Other | 
| `cashAccounts` | Cash | 157 | NAB saver, EasyStreet | 
| `ukAccounts` | UK | 159 | 4× HSBC accounts (GBP), GBPAUD rate | 
| `superAccounts` | Super | 157 | HL (GBP), FirstChoice, REST, AustralianSuper, GBPAUD | 
| `investmentAccounts` | Investments | 202 | MonitorMoney, MarginLoan, NABTrade, Schwab, USDAUD, + 5 more | 
| `mortgage` | Mortgage | 113 | Deposit, Mum, 2× Debt, Interest, Principal, Price, Land, Growth | 
| `budget` | Sink or Swim | 139 | Income (Ray/Romi/Lola), Expenses (Qantas/NAB/ANZ/OneOffs/Shared) | 
| `cryptoTransactions` | Crypto | ~21 | Platform, date, deposit/withdrawal, amount | 
| `cryptoSummaries` | Crypto | 2 | Platform totals (deposited, withdrawn, current value) | 

### Sheets NOT migrated (fully derived) 
- **TOTALS** — Reproduced by `getLatestTotals` and `getTotalsHistory` queries 
- **Perf** — Period-over-period growth, compute from totals history 
- **Ratios** — Single-point ratios, compute from latest totals 
- **Growth** — 1M/3M/12M growth windows, compute from totals history 

### Derived Fields (computed, not stored) All in `helpers.ts`. Key examples: 
- `currentAccountTotal()` → sum of 4 bank accounts 
- `ukTotalGbp()` / `ukTotalAud()` → sum GBP accounts, multiply by exchange rate 
- `superTotal()` → convert HL to AUD + sum AU super accounts 
- `investmentTotal()` → net monitor money + all brokerages (Schwab converted via USDAUD) 
- `mortgageEquity()` → price - (debtSimplifier + debtFixed) 
- `budgetNetGainLoss()` → totalIn - totalOut 
- `computeTotals()` → joins latest row from each table into the TOTALS view 

### Date Handling All dates stored two ways: 
- `excelDate: number` — Excel serial date (e.g., 45937 = a date in 2025). Preserves original reference. 
- `date: number` — Unix timestamp in ms. Used for indexing and display.

- Conversion functions in `helpers.ts`: `excelDateToTimestamp()` and `timestampToExcelDate()`. 

### Excel Column Mappings Derived columns are SKIPPED during import. The `seedScript.ts` maps by column index: 
- **Investments**: col 3 (Monitor Money NET) = derived, skip. Read cols 1-2, 4-12. 
- **Mortgage**: cols 10-15 (Available ×3, My Available, Liquid, Equity) = derived, skip. Read cols 1-9, 16-18. 
- **Sink or Swim**: cols 3, 12, 17-19 = derived or blank, skip. Column order is non-sequential — income is cols 5-6+16, expenses are cols 1-2+13-15. 
- **UK**: cols 5-6 (TOTAL £, TOTAL $) and col 8 (AUDGBP) = derived. 
- **Super**: col 2 (HL $) and col 7 (TOTAL) = derived. 

### Key Mutations - `addSnapshot` — The primary "add a new row" operation. Pass an excelDate and any combination of table data. Equivalent to adding a row across multiple Excel sheets at once. - `updateExchangeRates` — Bulk-update GBPAUD and/or USDAUD across UK, Super, and Investments for a given date. - Individual `add/update/delete` mutations exist for every table. 

## Setup & Seed ```bash npm install convex xlsx tsx npx convex dev 

# Start Convex dev server npx tsx seedScript.ts 

# Seed all data from CREAM.xlsx

The seed script batches inserts in chunks of 100 rows per mutation call.

```
npx tsx seedScript.ts
```

## Dependencies

convex — backend framework
xlsx — reads the Excel file in seedScript.ts
tsx — runs TypeScript directly for the seed script
