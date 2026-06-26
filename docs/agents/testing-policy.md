## Testing policy

Before writing tests, classify the change as:

1. Behavioural
2. Refactor
3. Cosmetic

Only behavioural changes require new UI tests. Cosmetic changes must not generate Playwright/Cypress/RTL tests unless explicitly requested.

For UI tests, assert user-visible behaviour and semantic contracts rather than
styling implementation details. Avoid expectations against Tailwind/CSS utility
classes, pixel values, percentages, spacing tokens, or other tweakable visual
choices unless that styling value is itself the contract under test. For layout
issues such as truncation, overflow, responsive sizing, or visual alignment,
prefer browser verification or a higher-level observable outcome over unit tests
that lock in specific classes.

Backend behavior changes need targeted unit or integration tests around the
changed contract. For bot gateway work, cover auth, provider parsing, storage
state, and privacy-sensitive edges such as rejecting non-private Telegram chats.
