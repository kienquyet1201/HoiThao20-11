import { Auth } from '@auth/core';
import GitHub from '@auth/core/providers/github';
import { getToken } from '@auth/core/jwt';
import { isOwner, missingConfiguration, sessionSecret, siteOrigin } from './config.js';
import { HttpError, json } from './http.js';

export function authConfig() {
  return {
    secret: sessionSecret(),
    trustHost: true,
    basePath: '/api/auth',
    useSecureCookies: siteOrigin().startsWith('https:'),
    session: { strategy: 'jwt', maxAge: 30 * 60 },
    jwt: { maxAge: 30 * 60 },
    providers: [GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      authorization: { params: { scope: 'read:user user:email public_repo' } },
    })],
    pages: { signIn: '/admin', error: '/admin' },
    callbacks: {
      signIn({ account, profile }) {
        return account?.provider === 'github' && isOwner(profile?.id, profile?.login);
      },
      jwt({ token, account, profile }) {
        if (account && profile) {
          token.ownerId = String(profile.id);
          token.login = profile.login;
          token.githubAccessToken = account.access_token;
          token.githubExpiresAt = account.expires_at || null;
        }
        if (!isOwner(token.ownerId, token.login)) return null;
        if (token.githubExpiresAt && token.githubExpiresAt * 1000 <= Date.now()) return null;
        return token;
      },
      session({ session, token }) {
        // Never forward the GitHub token to browser JavaScript.
        return { expires: session.expires, user: { id: token.ownerId, login: token.login, name: token.name || token.login } };
      },
      redirect({ url }) {
        const destination = new URL(url, siteOrigin());
        return destination.origin === siteOrigin() ? destination.href : `${siteOrigin()}/admin`;
      },
    },
    logger: { error(error) { console.error('[auth]', error?.type || 'AuthenticationError'); } },
  };
}

export async function authHandler(request) {
  if (missingConfiguration().length) return json({ error: 'Đăng nhập quản trị chưa được cấu hình.' }, 503);
  const url = new URL(request.url);
  if (url.pathname === '/api/auth') {
    const action = url.searchParams.get('authPath') || '';
    if (!/^(csrf|session|providers|signin(?:\/github)?|signout|callback\/github|error)$/.test(action)) {
      throw new HttpError(404, 'Không có đường dẫn xác thực này.');
    }
    url.pathname = `/api/auth/${action}`;
  }
  url.searchParams.delete('authPath');
  return Auth(new Request(url, request), authConfig());
}

export async function ownerToken(request) {
  if (missingConfiguration().length) return null;
  const secureCookie = siteOrigin().startsWith('https:');
  const token = await getToken({ req: request, secret: sessionSecret(), secureCookie });
  if (!token || !isOwner(token.ownerId, token.login) || !token.githubAccessToken) return null;
  if (token.githubExpiresAt && token.githubExpiresAt * 1000 <= Date.now()) return null;
  return token;
}
