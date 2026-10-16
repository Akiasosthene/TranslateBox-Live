import React from 'react';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,x') } }));
import Screen from './Screen';

let sockets;
beforeEach(() => {
  sockets = [];
  global.fetch = vi.fn().mockResolvedValue({ok: true, json: async () => ({name: 'Conference', target: 'fr', targets: ['fr', 'es'], pin_protected: false, live: true})});
  global.WebSocket = class { constructor(url) { this.url = url; sockets.push(this); } close = vi.fn(); send = vi.fn(); };
});
afterEach(cleanup);

test('room screen joins caption-only and switches caption language', async () => {
  render(<MemoryRouter initialEntries={['/e/abc/screen']}><Routes><Route path="/e/:id/screen" element={<Screen/>}/></Routes></MemoryRouter>);
  await screen.findByText('Conference');
  expect(sockets[0].url).toContain('audio=0');
  expect(sockets[0].url).toContain('lang=fr');
  act(() => sockets[0].onopen());
  act(() => sockets[0].onmessage({data: JSON.stringify({type: 'status', live: true})}));
  act(() => sockets[0].onmessage({data: JSON.stringify({type: 'caption', text: 'Premier.\n\nDeuxième phrase.'})}));
  expect(screen.getByText('Deuxième phrase.')).toBeTruthy();
  fireEvent.click(screen.getByRole('radio', {name: /Español/}));
  expect(sockets.at(-1).url).toContain('lang=es');
});
