import { BODY_LIMIT, siteOrigin } from './config.js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
}

export function errorResponse(error) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  console.error('[admin] Request failed:', error?.name || 'Error');
  return json({ error: 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.' }, 502);
}

export function requireSameOrigin(request) {
  if (request.headers.get('origin') !== siteOrigin()) throw new HttpError(403, 'Yêu cầu lưu không đến từ website này.');
}

export async function toWebRequest(req) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers || {})) {
    if (Array.isArray(value)) value.forEach(v => headers.append(name, v));
    else if (value !== undefined) headers.set(name, value);
  }
  const method = req.method || 'GET';
  let body;
  if (!['GET', 'HEAD'].includes(method)) {
    if (req.body !== undefined) {
      if (Buffer.isBuffer(req.body) || typeof req.body === 'string') body = req.body;
      else if (headers.get('content-type')?.includes('application/x-www-form-urlencoded')) body = new URLSearchParams(req.body).toString();
      else body = JSON.stringify(req.body);
    } else {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += Buffer.byteLength(chunk);
        if (size > BODY_LIMIT) throw new HttpError(413, 'Nội dung quá lớn (tối đa 256 KB).');
        chunks.push(Buffer.from(chunk));
      }
      body = Buffer.concat(chunks);
    }
    if (Buffer.byteLength(body || '') > BODY_LIMIT) throw new HttpError(413, 'Nội dung quá lớn (tối đa 256 KB).');
  }
  const url = new URL(req.url, siteOrigin());
  // Always use the configured canonical origin, never an untrusted Host header.
  const target = new URL(url.pathname + url.search, siteOrigin());
  return new Request(target, { method, headers, ...(body !== undefined ? { body } : {}) });
}

export function nodeHandler(handler) {
  return async (req, res) => {
    let response;
    try { response = await handler(await toWebRequest(req)); }
    catch (error) { response = errorResponse(error); }
    res.statusCode = response.status;
    for (const [key, value] of response.headers) if (key !== 'set-cookie') res.setHeader(key, value);
    const cookies = response.headers.getSetCookie();
    if (cookies.length) res.setHeader('Set-Cookie', cookies);
    res.end(Buffer.from(await response.arrayBuffer()));
  };
}
