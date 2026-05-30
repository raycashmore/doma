## Testing policy

Before writing tests, classify the change as:

1. Behavioural
2. Refactor
3. Cosmetic

Only behavioural changes require new UI tests. Cosmetic changes must not generate Playwright/Cypress/RTL tests unless explicitly requested.

Backend behavior changes need targeted unit or integration tests around the
changed contract. For bot gateway work, cover auth, provider parsing, storage
state, and privacy-sensitive edges such as rejecting non-private Telegram chats.
