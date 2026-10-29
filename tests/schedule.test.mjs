import test from 'node:test';
import assert from 'node:assert/strict';
import { hasSchedule, getScheduledMatches } from '../dist/model.js';

const fixture = (id, date, time, extra = {}) => ({ id, stage: 'group', group: 'A', date, time, status: 'scheduled', ...extra });

test('public schedule requires a complete valid date and time', () => {
  for (const match of [fixture('empty', '', ''), fixture('date-only', '2026-10-31', ''), fixture('time-only', '', '18:30'), fixture('invalid-day', '2026-02-30', '18:30'), fixture('invalid-hour', '2026-10-31', '24:00')]) assert.equal(hasSchedule(match), false);
  assert.equal(hasSchedule(fixture('valid', '2026-10-31', '18:30')), true);
});

test('assigned slots are chronological across groups and do not alter stored fixtures', () => {
  const matches = [fixture('B1', '2026-11-01', '19:30', { group: 'B' }), fixture('blank', '', ''), fixture('A1', '2026-10-31', '18:30'), fixture('C1', '2026-11-01', '18:00', { group: 'C' }), fixture('D2', '2026-10-31', '19:30', { group: 'D' })];
  const snapshot = structuredClone(matches);
  assert.deepEqual(getScheduledMatches({ matches }).map(m => m.id), ['A1', 'D2', 'C1', 'B1']);
  assert.deepEqual(matches, snapshot);
  assert.deepEqual(getScheduledMatches({ matches }, { group: 'C' }).map(m => m.id), ['C1']);
});

test('knockout tab hides unset slots and retains finished or postponed assigned matches', () => {
  const matches = [fixture('A1', '2026-10-31', '18:30'), fixture('TK1', '', '', { stage: 'quarter', group: null }), fixture('TK2', '2026-11-02', '18:00', { stage: 'quarter', group: null, status: 'postponed' }), fixture('FINAL', '2026-11-04', '19:00', { stage: 'final', group: null, status: 'finished' })];
  assert.deepEqual(getScheduledMatches({ matches }, { stage: 'knockout' }).map(m => m.id), ['TK2', 'FINAL']);
  assert.equal(getScheduledMatches({ matches }, { stage: 'all' }).length, 3);
});

test('same-time slots keep their original order', () => {
  const matches = [fixture('C1', '2026-11-01', '18:00', { group: 'C' }), fixture('A1', '2026-11-01', '18:00')];
  assert.deepEqual(getScheduledMatches({ matches }).map(m => m.id), ['C1', 'A1']);
});
