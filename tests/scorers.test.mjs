import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getTopScorers } from '../dist/model.js';
import { validateContent } from '../lib/content.js';
const seed = JSON.parse(await readFile(new URL('../dist/content.json', import.meta.url), 'utf8'));
test('scorers exclude zero/unset totals and use shared competition ranks', () => {
 const c = structuredClone(seed);
 for (const t of c.teams) for (const p of t.players) delete p.goals;
 assert.deepEqual(getTopScorers(c), []);
 c.teams[0].players[0].goals = 3;
 c.teams[1].players[0].goals = 3;
 c.teams[2].players[0].goals = 1;
 assert.deepEqual(getTopScorers(c).map(r => [r.rank, r.goals]), [[1,3],[1,3],[3,1]]);
 assert.equal(getTopScorers(c)[2].team.id, c.teams[2].id);
});
test('old registrations remain valid and invalid goal totals are rejected', () => {
 assert.equal(validateContent(seed).ok, true);
 for (const goals of [-1, 1.5, 1000, '2', null]) {
  const c = structuredClone(seed); c.teams[0].players[0].goals = goals;
  assert.equal(validateContent(c).ok, false);
 }
 const c = structuredClone(seed); c.teams[0].players[0].goals = 4;
 assert.equal(validateContent(c).content.teams[0].players[0].goals, 4);
});
