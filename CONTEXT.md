# Doma

Doma is a personal finance context for understanding household accounts, budget movement, and spending patterns over time.

## Language

**Budget total**:
A monthly amount used for budget-level income, spending, mortgage, and net calculations. A **budget total** belongs to a **budget display month**, can come from a different spreadsheet source than category analytics, and does not have to reconcile to a **spend category breakdown**.
_Avoid_: Category total, transaction total

**Spend category breakdown**:
A calendar-month view of card spending grouped by flexible merchant category labels from the Spending summary source. It is analytical context for explaining spending patterns, not the authoritative source for budget totals; in UI copy, call it "Card spend by category". Each category has at most one amount per calendar month, even when source spreadsheet dates fall on different days inside that month.
_Avoid_: Credit card categories, credit-card total, budget spend

**Card spend subtotal**:
The budget-level credit-card amount shown with the "Card spend by category" panel. It remains the budget subtotal even though the visible category rows are independent and do not show or imply their own sum.
_Avoid_: Category sum, category total

**Visible spend category**:
A category with a positive amount in a calendar month. Blank or zero category amounts are omitted from the breakdown rather than shown as empty rows; visible categories are ordered from highest amount to lowest amount.
_Avoid_: Empty category, zero row

**Missing category data**:
A calendar month with no visible spend categories. It should be shown as an explicit absence of category analytics, not filled with placeholder categories.
_Avoid_: Placeholder category rows, fake category rows

**Budget display month**:
The month-and-year period where budget and mortgage captures are shown, represented by the final day of that month. All values in a budget or mortgage capture belong to the previous budget display month; account balance captures remain point-in-time records.
_Avoid_: Source month, capture month

**Capture date**:
The spreadsheet date attached to a budget or mortgage capture before it is assigned to a budget display month. It is provenance for the capture, not the month where the captured values are shown.
_Avoid_: Display date, month date

**Calendar month**:
The month-and-year period used for source data that is not shifted into a budget display month. Spending summary category analytics use calendar month; day-of-month differences in that source do not create separate periods.
_Avoid_: Exact source date, statement date

## Example Dialogue

Dev: "The card spend by category for April does not add up to the credit-card budget total. Is that invalid?"

Domain expert: "No. The budget total and the spend category breakdown are independent views. Show the breakdown as context without forcing it to reconcile."

Dev: "The budget row is dated May 10 and the category sheet says April 30. Are those separate periods?"

Domain expert: "No. The budget row belongs to the April budget display month, and the category sheet belongs to the April calendar month."

Dev: "Should April card spend by category appear with the May-dated budget capture?"

Domain expert: "Yes. The budget capture is shown under April, and the April spend category breakdown is matched to that displayed month."

Dev: "Should the card spend by category panel total add up the visible categories?"

Domain expert: "No. Keep the panel total as the budget card spend subtotal. The category rows are context only."
