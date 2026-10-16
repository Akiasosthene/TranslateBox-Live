import React from 'react';
import { afterEach, test, expect, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import OperatorAccess from './OperatorAccess';
afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); });

test('offers SSO when configured and accepts the session from the fragment', async () => {
  window.history.replaceState(null, '', '/#sso=sess-123');
  global.fetch = vi.fn(async (url, opts) => url.endsWith('/auth/sso')
    ? { ok: true, json: async () => ({ enabled: true, label: 'Google' }) }
    : { ok: opts?.headers?.Authorization === 'Bearer sess-123', json: async () => ({ status: 'ok' }) });
  render(<OperatorAccess><p>Console ready</p></OperatorAccess>);
  await screen.findByText('Console ready');
  expect(window.location.hash).toBe('');
});

test('shows the SSO button and a sign-in error', async () => {
  window.history.replaceState(null, '', '/#sso_error=This+account+is+not+allowed');
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ enabled: true, label: 'Microsoft' }) }));
  render(<OperatorAccess><p>Console ready</p></OperatorAccess>);
  await waitFor(() => expect(screen.getByTestId('sso-button').getAttribute('href')).toBe('/api/auth/sso/start'));
  expect(screen.getByText(/not allowed/)).toBeTruthy();
});
