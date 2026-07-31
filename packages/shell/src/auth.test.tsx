import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createClerkSignInAppearance, SignInLayout } from './auth';

describe('SignInLayout', () => {
  it('gives the signed-out experience an accessible heading', () => {
    render(
      <SignInLayout title="Sign in to Budget">
        <button type="button">Continue with Google</button>
      </SignInLayout>
    );

    expect(screen.getByRole('heading', { name: 'Sign in to Budget' })).toBeDefined();
  });

  it('keeps Clerk app branding large and hides duplicate headings', () => {
    expect(createClerkSignInAppearance('/meals/icons/icon.svg')).toEqual({
      layout: {
        logoImageUrl: '/meals/icons/icon.svg'
      },
      elements: {
        footerAction: 'hidden',
        footerActionLink: 'hidden',
        headerSubtitle: 'hidden',
        headerTitle: 'hidden',
        logoBox: {
          height: '9rem',
          width: '9rem'
        },
        logoImage: {
          height: '9rem',
          width: '9rem'
        }
      }
    });
  });
});
