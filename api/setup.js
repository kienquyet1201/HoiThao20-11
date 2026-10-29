import { missingConfiguration, OWNER_LOGIN } from '../lib/config.js';
import { json, nodeHandler } from '../lib/http.js';
export function setupHandler(request) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, { Allow: 'GET' });
  const missing = missingConfiguration();
  return json({ configured: missing.length === 0, missing, owner: OWNER_LOGIN });
}
export default nodeHandler(setupHandler);
