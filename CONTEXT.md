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

**Morning briefing**:
A once-per-morning household readiness summary focused on what needs attention before the day gets moving. It is distinct from event reminders because it highlights daily actions, risks, and context rather than notifying about each upcoming event.
_Avoid_: Morning schedule briefing, schedule reminder, calendar notification, event alert

**Daily requirements calendar**:
A curated calendar source for day-specific household requirements such as special events, clothing expectations, items to bring, preparation notes, and timing constraints. Its event descriptions are treated as the source of detailed readiness information, distinct from ordinary family schedule events.
_Avoid_: Family calendar, school calendar, event reminder feed

**Routine requirement**:
A recurring or expected daily requirement that still changes what someone should wear, bring, prepare, remember, coordinate, or leave earlier for. A **routine requirement** should be mentioned calmly without being framed as unusual.
_Avoid_: Special event, alert, calendar noise

**Special requirement**:
An unusual or non-routine daily requirement that deserves extra attention in a **morning briefing**. A **special requirement** may come from the **daily requirements calendar** or from ordinary schedule context when it affects readiness.
_Avoid_: Normal event, recurring requirement

**List**:
A reusable checklist container for marking off arbitrary things, including todo lists, shopping lists, and other one-off or repeated lists. A **list** is the canonical capability; todo and shopping are examples rather than separate app concepts or special templates.
_Avoid_: Todo app, Shopping app, list template

**List property**:
A field definition owned by a **list** and available to every item in that list, such as due date, priority, quantity, store section, or instructions. List properties can be added, renamed, reordered, and removed after items exist; items may leave a list property blank, but they do not invent unrelated property definitions on their own.
_Avoid_: Item schema, ad hoc item property

**List property type**:
The kind of value a **list property** accepts. The initial property types are text, number, date, select, and checkbox.
_Avoid_: Formula field, file field, reminder field

**List item**:
A checkable entry inside a **list**. A **list item** has its own completion state, a manual order while active, and may store values for the list's properties.
_Avoid_: Task, shopping row

**Completed list item**:
A **list item** that has been marked done but remains part of the list until it is explicitly cleared or removed. Completion is a visible state, not automatic deletion; completed list items are shown separately in completion-time order.
_Avoid_: Deleted item, archived item

**Personal list**:
A **list** visible and editable only by the household user who created it.
_Avoid_: Private workspace, owner-only project

**Shared list**:
A **list** visible and editable by every household user. Shared lists do not use invites, roles, or per-user permissions.
_Avoid_: Team list, collaborative workspace

**Household user**:
A signed-in Doma user who is allowed to use the app. Household users can all read and edit shared lists; personal lists remain limited to their creator.
_Avoid_: Team member, collaborator, invited user

## Example Dialogue

Dev: "The card spend by category for April does not add up to the credit-card budget total. Is that invalid?"

Domain expert: "No. The budget total and the spend category breakdown are independent views. Show the breakdown as context without forcing it to reconcile."

Dev: "The budget row is dated May 10 and the category sheet says April 30. Are those separate periods?"

Domain expert: "No. The budget row belongs to the April budget display month, and the category sheet belongs to the April calendar month."

Dev: "Should April card spend by category appear with the May-dated budget capture?"

Domain expert: "Yes. The budget capture is shown under April, and the April spend category breakdown is matched to that displayed month."

Dev: "Should the card spend by category panel total add up the visible categories?"

Domain expert: "No. Keep the panel total as the budget card spend subtotal. The category rows are context only."

Dev: "Is the morning briefing just a schedule reminder?"

Domain expert: "No. A morning briefing is a household readiness summary. It should surface routine and special requirements that affect the day, not repeat every calendar notification."

Dev: "If the daily requirements calendar is empty today, should we warn the recipient?"

Domain expert: "No, that is a quiet day. Warn only when the daily requirements calendar is not configured or the schedule data is stale enough to undermine trust."

Dev: "Should Doma have separate Todo and Shopping apps?"

Domain expert: "No. Use Lists as the app and model todo and shopping as list use cases."

Dev: "Should todo and shopping lists be special templates?"

Domain expert: "No. They are ordinary lists that can use different names and properties."

Dev: "Can one item add a due date while another item adds a quantity field?"

Domain expert: "No. Add due date or quantity as list properties, then each item can choose whether it has a value for them."

Dev: "If a list already has items, can I still change its properties?"

Domain expert: "Yes. List properties stay editable; removing one removes that field from the list and its items."

Dev: "Should list properties support reminders, attachments, and formulas in the first version?"

Domain expert: "No. Start with text, number, date, select, and checkbox properties."

Dev: "Does a shared list need invites or editor/viewer roles?"

Domain expert: "No. A personal list belongs to its creator; a shared list is editable by every household user."

Dev: "Does Lists need a separate team or household membership model?"

Domain expert: "No. Use the allowed household users: shared lists are for everyone, personal lists are for the creator."

Dev: "If two household users edit the same item field at the same time, should Lists show a merge conflict?"

Domain expert: "No. Lists use simple live updates; the latest focused edit wins."

Dev: "When an item is checked off, should it disappear?"

Domain expert: "No. It becomes a completed list item and remains visible until someone explicitly clears or removes it."

Dev: "How should items be sorted?"

Domain expert: "Active list items use manual order; completed list items sit separately by completion time."
