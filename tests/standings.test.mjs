import test from 'node:test';
import assert from 'node:assert/strict';
import { getStandings } from '../dist/model.js';
const teams = [0,1,2].map(id => ({id, name: `Team ${id}`, group:'A'}));
const match = (home, away, a, b, status='finished') => ({stage:'group',group:'A',home:{type:'team',teamId:home},away:{type:'team',teamId:away},homeScore:a,awayScore:b,status});
const content = matches => ({teams, matches, qualifiers:{A:{first:2,second:1}}});
test('standings use points then goal difference, ignoring manual qualifiers', () => {
 const c = content([match(0,1,3,0),match(2,1,1,0)]);
 assert.deepEqual(getStandings(c,'A').map(r=>r.team.id), [0,2,1]);
 c.matches.push(match(2,0,1,0));
 assert.deepEqual(getStandings(c,'A').map(r=>r.team.id), [2,0,1]);
});
test('goals scored break equal points and difference; exact ties share rank', () => {
 const rows=getStandings(content([match(0,1,1,1),match(0,2,2,2),match(1,2,0,0)]),'A');
 assert.deepEqual(rows.map(r=>r.team.id),[0,2,1]);
 const tied=getStandings(content([match(0,1,0,0),match(0,2,0,0),match(1,2,0,0)]),'A');
 assert.deepEqual(tied.map(r=>r.rank),[1,1,1]);
});
test('unplayed tables have no rank and unfinished scores do not count', () => {
 const rows=getStandings(content([match(0,1,9,0,'scheduled')]),'A');
 assert.ok(rows.every(r=>r.rank===null && r.points===0 && r.played===0));
});
