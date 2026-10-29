import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { validateContent } from '../lib/content.js';

const content = JSON.parse(await readFile(new URL('../dist/content.json', import.meta.url), 'utf8'));
const result = validateContent(content);
if (!result.ok) throw new Error(result.error);
for (const file of ['app.js', 'model.js', 'admin.js']) {
  const check = spawnSync(process.execPath, ['--check', `dist/${file}`], { stdio: 'inherit' });
  if (check.status !== 0) process.exit(check.status || 1);
}
for (const file of ['index.html', 'style.css', 'admin.html', 'admin.css']) await readFile(new URL(`../dist/${file}`, import.meta.url));
console.log(`Validated ${content.teams.length} teams, ${content.teams.reduce((n, t) => n + t.players.length, 0)} players, ${content.matches.length} fixtures.`);
