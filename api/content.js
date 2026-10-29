import { readFile } from 'node:fs/promises';
import { json, nodeHandler } from '../lib/http.js';
export async function contentHandler(request) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, { Allow: 'GET' });
  const content = JSON.parse(await readFile(new URL('../dist/content.json', import.meta.url), 'utf8'));
  return json(content, 200, { 'Cache-Control': 'public, max-age=0, s-maxage=30' });
}
export default nodeHandler(contentHandler);
