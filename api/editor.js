import { ownerToken } from '../lib/auth.js';
import { BODY_LIMIT, siteOrigin } from '../lib/config.js';
import { validateContent } from '../lib/content.js';
import { readContent, verifyGithubOwner, writeContent } from '../lib/github.js';
import { HttpError, json, nodeHandler, requireSameOrigin } from '../lib/http.js';

export async function editorHandler(request, services = {}) {
  if (!['GET', 'PUT'].includes(request.method)) return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, PUT' });
  const token = await (services.ownerToken || ownerToken)(request);
  if (!token) throw new HttpError(401, 'Bạn cần đăng nhập tài khoản chủ website.');
  const user = await (services.verifyOwner || verifyGithubOwner)(token.githubAccessToken);
  if (request.method === 'GET') {
    const stored = await (services.readContent || readContent)(token.githubAccessToken);
    return json({ ...stored, user }, 200, { Vary: 'Cookie' });
  }
  requireSameOrigin(request);
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError(415, 'Yêu cầu lưu phải là JSON.');
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > BODY_LIMIT) throw new HttpError(413, 'Nội dung quá lớn (tối đa 256 KB).');
  let body;
  try { body = JSON.parse(text); } catch { throw new HttpError(400, 'Nội dung JSON không hợp lệ.'); }
  if (!body || !/^[a-f0-9]{40}$/.test(body.sha) || Object.keys(body).some(k => !['sha', 'content'].includes(k))) throw new HttpError(400, 'Thiếu phiên bản nội dung cần lưu.');
  const valid = validateContent(body.content);
  if (!valid.ok) throw new HttpError(422, valid.error);
  valid.content.updatedAt = new Date().toISOString();
  const result = await (services.writeContent || writeContent)(token.githubAccessToken, valid.content, body.sha);
  return json({ ...result, updatedAt: valid.content.updatedAt, publishedUrl: siteOrigin() });
}

export default nodeHandler(editorHandler);
