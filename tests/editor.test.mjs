import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { encode } from '@auth/core/jwt';
import { authConfig, authHandler, ownerToken } from '../lib/auth.js';
import { validateContent } from '../lib/content.js';
import { editorHandler } from '../api/editor.js';
import { contentHandler } from '../api/content.js';
import { setupHandler } from '../api/setup.js';
import { OWNER_ID, OWNER_LOGIN, siteOrigin, sessionSecret } from '../lib/config.js';
import { HttpError } from '../lib/http.js';
import { resolveSide, resolveWinner, getStandings } from '../dist/model.js';

const seed = JSON.parse(await readFile(new URL('../dist/content.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(seed);
const sha = 'a'.repeat(40);
const request = body => new Request(`${siteOrigin()}/api/editor`, { method: 'PUT', headers: { Origin: siteOrigin(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const services = {
  ownerToken: async () => ({ githubAccessToken: 'test-only-token' }),
  verifyOwner: async () => ({ id: OWNER_ID, login: OWNER_LOGIN }),
  writeContent: async (_token, content, previous) => { assert.equal(previous, sha); assert.ok(content.updatedAt); return { sha: 'b'.repeat(40), commitSha: 'c'.repeat(40) }; },
};

test('migration preserves original registrations and fixtures', () => {
  assert.equal(validateContent(seed).ok, true);
  assert.equal(seed.teams.length, 12);
  assert.equal(seed.teams.reduce((n, t) => n + t.players.length, 0), 153);
  assert.equal(seed.matches.filter(m => m.stage === 'group').length, 12);
  assert.equal(seed.matches.filter(m => m.stage !== 'group').length, 8);
});

test('invalid scores, dates, ranks, duplicate players and changed knockout topology are rejected', () => {
  for (const mutate of [
    c => { c.matches[0].homeScore = -1; },
    c => { c.matches[0].date = '2026-02-30'; },
    c => { c.matches[0].date = '2026-99-99'; },
    c => { c.qualifiers.A.first = 8; },
    c => { c.teams[1].players[0].id = c.teams[0].players[0].id; },
    c => { c.matches.find(m => m.id === 'TK1').home = { type: 'team', teamId: 1 }; },
    c => { c.matches[0].status = 'finished'; c.matches[0].homeScore = 0; },
  ]) { const content = clone(); mutate(content); assert.equal(validateContent(content).ok, false); }
});

test('qualifier ID zero and knockout winner/loser propagate; tied knockout requires owner decision', () => {
  const c = clone(); c.qualifiers.A.first = 0; c.qualifiers.C.second = 6;
  const quarter = c.matches.find(m => m.id === 'TK1');
  Object.assign(quarter, { status: 'finished', homeScore: 1, awayScore: 1 });
  assert.equal(validateContent(c).ok, false);
  quarter.winnerTeamId = 0;
  assert.equal(validateContent(c).ok, true);
  assert.equal(resolveWinner(quarter, c), 0);
  assert.equal(resolveSide({ type: 'winner', matchId: 'TK1' }, c).id, 0);
  assert.equal(resolveSide({ type: 'loser', matchId: 'TK1' }, c).id, 6);
});

test('only finished group scores count, without inferring qualifiers', () => {
  const c = clone(); Object.assign(c.matches[0], { status: 'finished', homeScore: 3, awayScore: 1 });
  const rows = getStandings(c, 'A');
  assert.equal(rows.find(r => r.team.id === 0).points, 3);
  assert.equal(rows.find(r => r.team.id === 0).gd, 2);
  assert.ok(rows.every(r => r.rank === null));
});

test('unauthenticated saves fail before GitHub writes', async () => {
  await assert.rejects(editorHandler(request({ content: clone(), sha }), { ownerToken: async () => null }), error => error.status === 401);
});

test('cross-site saves fail even with an owner session', async () => {
  const req = new Request(`${siteOrigin()}/api/editor`, { method: 'PUT', headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' }, body: '{}' });
  await assert.rejects(editorHandler(req, services), error => error.status === 403);
});

test('owner can save validated content and receives its new revision', async () => {
  const c = clone(); c.teams[0].name = 'Tên đội đã sửa';
  const response = await editorHandler(request({ content: c, sha }), services);
  assert.equal(response.status, 200);
  const body = await response.json(); assert.equal(body.sha, 'b'.repeat(40));
  assert.ok(body.updatedAt); assert.equal(body.githubAccessToken, undefined);
});

test('server rejects malformed content and exposes version conflicts without overwriting', async () => {
  const c = clone(); c.teams[0].id = 8;
  await assert.rejects(editorHandler(request({ content: c, sha }), services), error => error.status === 422);
  await assert.rejects(editorHandler(request({ content: clone(), sha }), { ...services, writeContent: async () => { throw new HttpError(409, 'changed'); } }), error => error.status === 409);
});

test('public reads contain real data and no authentication tokens', async () => {
  const response = await contentHandler(new Request(`${siteOrigin()}/api/content`));
  const body = await response.json(); assert.equal(body.teams.length, 12);
  assert.equal(JSON.stringify(body).includes('githubAccessToken'), false);
});

test('authentication denies other GitHub accounts and never exposes access token in session', async () => {
  const config = authConfig();
  assert.equal(config.callbacks.signIn({ account: { provider: 'github' }, profile: { id: '999', login: OWNER_LOGIN } }), false);
  assert.equal(config.callbacks.signIn({ account: { provider: 'github' }, profile: { id: OWNER_ID, login: OWNER_LOGIN } }), true);
  const session = config.callbacks.session({ session: { expires: 'later' }, token: { ownerId: OWNER_ID, login: OWNER_LOGIN, githubAccessToken: 'hidden' } });
  assert.equal(JSON.stringify(session).includes('hidden'), false);
});

test('Auth.js decrypts only valid owner cookies; forged/other-account cookies are denied', async () => {
  const previous = { id: process.env.AUTH_GITHUB_ID, secret: process.env.AUTH_GITHUB_SECRET };
  process.env.AUTH_GITHUB_ID = 'test-client-id'; process.env.AUTH_GITHUB_SECRET = 'test-secret-value-for-unit-tests-only';
  try {
    const secure = siteOrigin().startsWith('https:');
    const name = `${secure ? '__Secure-' : ''}authjs.session-token`;
    for (const [ownerId, login, allowed] of [[OWNER_ID, OWNER_LOGIN, true], ['999', OWNER_LOGIN, false]]) {
      const cookie = await encode({ token: { ownerId, login, githubAccessToken: 'unit-test-only' }, secret: sessionSecret(), salt: name, maxAge: 60 });
      const result = await ownerToken(new Request(`${siteOrigin()}/api/editor`, { headers: { Cookie: `${name}=${cookie}` } }));
      assert.equal(Boolean(result), allowed);
    }
    assert.equal(await ownerToken(new Request(`${siteOrigin()}/api/editor`, { headers: { Cookie: `${name}=forged` } })), null);
  } finally {
    if (previous.id === undefined) delete process.env.AUTH_GITHUB_ID; else process.env.AUTH_GITHUB_ID = previous.id;
    if (previous.secret === undefined) delete process.env.AUTH_GITHUB_SECRET; else process.env.AUTH_GITHUB_SECRET = previous.secret;
  }
});

test('missing configuration is explicit and fails closed', async () => {
  const previous = { id: process.env.AUTH_GITHUB_ID, secret: process.env.AUTH_GITHUB_SECRET };
  delete process.env.AUTH_GITHUB_ID; delete process.env.AUTH_GITHUB_SECRET;
  try {
    const setup = await setupHandler(new Request(`${siteOrigin()}/api/setup`)).json();
    assert.equal(setup.configured, false);
    assert.equal((await authHandler(new Request(`${siteOrigin()}/api/auth/csrf`))).status, 503);
    assert.equal(await ownerToken(new Request(`${siteOrigin()}/api/editor`)), null);
  } finally {
    if (previous.id !== undefined) process.env.AUTH_GITHUB_ID = previous.id;
    if (previous.secret !== undefined) process.env.AUTH_GITHUB_SECRET = previous.secret;
  }
});
