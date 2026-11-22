/**
 * frontend.test.js — verifies that Express static file serving is wired
 * correctly and that all existing API routes still function after the
 * Phase 5 app.js changes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import app from '../src/app.js';

const request = supertest(app);

test('GET / serves the login page HTML', async () => {
  const res = await request.get('/');
  assert.equal(res.status, 200);
  assert.ok(
    res.headers['content-type']?.includes('text/html'),
    `Expected text/html, got ${res.headers['content-type']}`,
  );
  assert.ok(
    res.text.includes('DigitalBank ETB'),
    'Page should contain bank name',
  );
});

test('GET /dashboard.html serves dashboard HTML', async () => {
  const res = await request.get('/dashboard.html');
  assert.equal(res.status, 200);
  assert.ok(res.headers['content-type']?.includes('text/html'));
  assert.ok(res.text.includes('dashboard') || res.text.includes('DigitalBank'), 'Should be the dashboard page');
});

test('GET /css/tokens.css serves CSS with correct content-type', async () => {
  const res = await request.get('/css/tokens.css');
  assert.equal(res.status, 200);
  assert.ok(
    res.headers['content-type']?.includes('text/css') ||
    res.headers['content-type']?.includes('css'),
    `Expected text/css, got ${res.headers['content-type']}`,
  );
});

test('GET /js/auth.js serves JavaScript with correct content-type', async () => {
  const res = await request.get('/js/auth.js');
  assert.equal(res.status, 200);
  assert.ok(
    res.headers['content-type']?.includes('javascript') ||
    res.headers['content-type']?.includes('application/'),
    `Expected JS content-type, got ${res.headers['content-type']}`,
  );
});

test('GET /nonexistent-page falls back to login.html (SPA fallback)', async () => {
  const res = await request.get('/some-unknown-route');
  // SPA fallback should return 200 with index.html content
  assert.equal(res.status, 200);
  assert.ok(
    res.headers['content-type']?.includes('text/html'),
    'SPA fallback should return HTML',
  );
});

test('GET /api/health still returns ok after static serving setup', async () => {
  const res = await request.get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
  assert.equal(res.body.service, 'digital-banking');
});
