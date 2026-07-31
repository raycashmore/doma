import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SignInLayout } from './auth';

describe('SignInLayout', () => {
  it('gives the signed-out experience an accessible heading', () => {
    render(
      <SignInLayout title="Sign in to Budget">
        <button type="button">Continue with Google</button>
      </SignInLayout>
    );

    expect(screen.getByRole('heading', { name: 'Sign in to Budget' })).toBeDefined();
  });
});
