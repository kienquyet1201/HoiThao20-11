import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateContent } from '../lib/content.js';
import { getStandings, resolveWinner } from '../dist/model.js';
import { renderMatchCards, renderScorerCards, renderStandingCards, renderBracketTree } from '../dist/tournament-ui.js';
const seed=JSON.parse(await readFile(new URL('../dist/content.json',import.meta.url),'utf8'));
test('live scores are valid but do not affect standings or knockout winners',()=>{
 const c=structuredClone(seed), m=c.matches[0];
 Object.assign(m,{status:'live',homeScore:2,awayScore:1,liveMinute:75,winnerTeamId:null});
 assert.equal(validateContent(c).ok,true);
 assert.equal(resolveWinner(m,c),null);
 assert.equal(getStandings(c,m.group).find(r=>r.team.id===m.home.teamId).played,0);
 assert.match(renderMatchCards(c,[m]),/LIVE/);
 for(const patch of [{liveMinute:151},{homeScore:null},{winnerTeamId:0}]) {
  assert.equal(validateContent({...c,matches:c.matches.map(x=>x.id===m.id?{...x,...patch}:x)}).ok,false);
 }
});
test('UI renders escaped real data, all scorers and eight knockout fixtures without mutation',()=>{
 const c=structuredClone(seed); c.teams[0].name='<script>alert(1)</script>';
 c.teams[0].players[0].goals=5;c.teams[1].players[0].goals=5;c.teams[2].players[0].goals=2;
 const before=JSON.stringify(c);
 const html=renderStandingCards(c)+renderScorerCards(c)+renderMatchCards(c,[c.matches[0]])+renderBracketTree(c);
 assert.doesNotMatch(html,/<table|<script>/);
 assert.match(html,/&lt;script&gt;/);
 assert.equal((renderScorerCards(c).match(/ui-scorer-hero/g)||[]).length,2);
 assert.equal((renderBracketTree(c).match(/<article/g)||[]).length,8);
 assert.equal((renderBracketTree(c).match(/class="ui-path-pending"/g)||[]).length,6);
 assert.equal(JSON.stringify(c),before);
});
