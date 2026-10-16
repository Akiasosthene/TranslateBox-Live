import React from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LocaleProvider } from './LocaleContext';
import { InterfaceLanguage } from '../components/InterfaceLanguage';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login';
import { TranscriptPanel } from '../components/TranscriptPanel';

beforeEach(() => {
  const values = new Map();
  vi.stubGlobal("localStorage", {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), clear: () => values.clear()});
});
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test('English default, French selection and saved preference preserve access-code input', () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
  const ui = () => render(<LocaleProvider><MemoryRouter initialEntries={['/login']}><Login /></MemoryRouter></LocaleProvider>);
  const view = ui();
  fireEvent.click(screen.getByTestId('login-mode-code'));
  expect(screen.getByTestId('login-submit').textContent).toContain('Sign in');
  fireEvent.change(screen.getByLabelText('Operator access code'), {target: {value: 'private-test-code'}});
  fireEvent.change(screen.getByLabelText('Interface language'), {target: {value: 'fr'}});
  expect(screen.getByTestId('login-submit').textContent).toContain('Se connecter');
  expect(screen.getByLabelText('Code d’accès opérateur').value).toBe('private-test-code');
  expect(document.documentElement.lang).toBe('fr');
  expect(localStorage.getItem('tbl-ui-language')).toBe('fr');
  view.unmount();
  ui();
  expect(screen.getByTestId('login-submit').textContent).toContain('Se connecter');
});

test('switching interface language preserves transcript content and mounted session', () => {
  const mount = vi.fn(), unmount = vi.fn();
  function Session() {
    React.useEffect(() => { mount(); return unmount; }, []);
    return <><InterfaceLanguage /><TranscriptPanel label="Session" text="Bonjour à tous — Hello everyone" active panelTestId="panel" textTestId="words" /></>;
  }
  render(<LocaleProvider><Session /></LocaleProvider>);
  fireEvent.change(screen.getByLabelText('Interface language'), {target: {value: 'fr'}});
  expect(screen.getByTestId('words').textContent).toBe('Bonjour à tous — Hello everyone');
  expect(mount).toHaveBeenCalledTimes(1);
  expect(unmount).not.toHaveBeenCalled();
});
