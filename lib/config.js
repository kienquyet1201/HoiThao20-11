import { createHash } from 'node:crypto';

export const OWNER_ID = '232730198';
export const OWNER_LOGIN = 'kienquyet1201';
export const REPOSITORY = 'kienquyet1201/HoiThao20-11';
export const CONTENT_PATH = 'dist/content.json';
export const BRANCH = 'main';
export const BODY_LIMIT = 256 * 1024;

export function siteOrigin() {
  return new URL(process.env.SITE_ORIGIN || 'https://hoithao20-11.vercel.app').origin;
}

export function missingConfiguration() {
  return ['AUTH_GITHUB_ID', 'AUTH_GITHUB_SECRET'].filter(name => !process.env[name]?.trim());
}

export function sessionSecret() {
  if (process.env.AUTH_SECRET?.length >= 32) return process.env.AUTH_SECRET;
  if (!process.env.AUTH_GITHUB_SECRET) return null;
  // Domain separation: the OAuth secret never appears in a cookie or response.
  return createHash('sha256').update('ptit-admin-session-v1\0').update(process.env.AUTH_GITHUB_SECRET).digest('hex');
}

export function isOwner(id, login) {
  return String(id) === OWNER_ID && String(login).toLowerCase() === OWNER_LOGIN;
}
