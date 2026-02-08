# Sentry Instrumentation

Wrap server functions with Sentry spans:

```tsx
import * as Sentry from '@sentry/tanstackstart-react';

Sentry.startSpan({ name: 'Operation name' }, async () => {
  // async operation
});
```