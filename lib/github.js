import { BRANCH, CONTENT_PATH, REPOSITORY, isOwner } from './config.js';
import { HttpError } from './http.js';
import { validateContent } from './content.js';

async function github(path, token, options = {}) {
  const response = await fetch(`https://api.github.com/${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'PTIT-Rikkei-Admin', Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 401) throw new HttpError(401, 'Phiên GitHub đã hết hạn. Vui lòng đăng nhập lại.');
  if (response.status === 409 || response.status === 422) throw new HttpError(409, 'Dữ liệu đã thay đổi. Hãy tải bản mới nhất trước khi lưu lại.');
  if (response.status === 403) throw new HttpError(403, 'GitHub từ chối quyền ghi hoặc đang giới hạn yêu cầu. Vui lòng kiểm tra quyền ứng dụng.');
  if (!response.ok) throw new HttpError(502, 'Không thể truy cập nội dung giải trên GitHub.');
  return response.json();
}

export async function verifyGithubOwner(token) {
  const user = await github('user', token);
  if (!isOwner(user.id, user.login)) throw new HttpError(403, 'Chỉ chủ website được chỉnh sửa nội dung.');
  return { id: String(user.id), login: user.login };
}

export async function readContent(token) {
  const file = await github(`repos/${REPOSITORY}/contents/${CONTENT_PATH}?ref=${BRANCH}`, token);
  let parsed;
  try { parsed = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')); }
  catch { throw new HttpError(502, 'Tệp nội dung trên GitHub không đọc được.'); }
  const result = validateContent(parsed);
  if (!result.ok) throw new HttpError(502, result.error);
  return { content: result.content, sha: file.sha };
}

export async function writeContent(token, content, sha) {
  const result = await github(`repos/${REPOSITORY}/contents/${CONTENT_PATH}`, token, {
    method: 'PUT',
    body: JSON.stringify({
      message: 'Update tournament content from owner editor', branch: BRANCH, sha,
      content: Buffer.from(JSON.stringify(content, null, 2) + '\n', 'utf8').toString('base64'),
    }),
  });
  return { sha: result.content.sha, commitSha: result.commit.sha };
}
