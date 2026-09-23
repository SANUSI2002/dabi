import { apiBaseUrl } from '@/config/runtime';

export type LiveIdentity = {
  user: { id: string; email: string; roles: string[]; profile?: unknown };
  organizations: Array<{ id: string; status: string; organization: { id: string; type: string; name: string; status: string }; roles: string[]; permissions: string[] }>;
  platform: { roles: string[]; permissions: string[] } | null;
};

let accessToken: string | null = null;
let identity: LiveIdentity | null = null;
let pendingChallenge: string | null = null;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!apiBaseUrl) throw new Error('Sabi Identity API is not configured.');
  const response = await fetch(`${apiBaseUrl}/api/v1/auth${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Sabi-Client': 'browser', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error?.message || 'Identity service is unavailable.');
  return body as T;
}

async function loadIdentity(): Promise<LiveIdentity> {
  const me = await request<{ user: LiveIdentity['user']; organizations: LiveIdentity['organizations'] }>('/me');
  let platform: LiveIdentity['platform'] = null;
  try {
    const result = await request<{ data: { roles: string[]; permissions: string[] } }>('/platform-context');
    platform = result.data;
  } catch { /* no platform assignment is the normal case */ }
  identity = { user: me.user, organizations: me.organizations, platform };
  return identity;
}

export async function liveSignIn(email: string, password: string): Promise<{ kind: 'MFA' } | { kind: 'AUTHENTICATED'; identity: LiveIdentity }> {
  const result = await request<{ status: string; accessToken?: string; challengeToken?: string }>('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (result.status === 'mfa_required' && result.challengeToken) { pendingChallenge = result.challengeToken; return { kind: 'MFA' }; }
  if (!result.accessToken) throw new Error('The identity service returned an invalid login response.');
  accessToken = result.accessToken;
  return { kind: 'AUTHENTICATED', identity: await loadIdentity() };
}

export const hasPendingLiveMfa = () => !!pendingChallenge;

export async function liveVerifyMfa(value: string, recovery = false) {
  if (!pendingChallenge) throw new Error('Verification expired. Please sign in again.');
  const result = await request<{ accessToken: string }>('/mfa/login/verify', { method: 'POST', body: JSON.stringify({ challengeToken: pendingChallenge, [recovery ? 'recoveryCode' : 'code']: value }) });
  if (!result.accessToken) throw new Error('The identity service returned an invalid verification response.');
  pendingChallenge = null;
  accessToken = result.accessToken;
  return loadIdentity();
}

export async function restoreLiveIdentity() {
  if (identity && accessToken) {
    try { return await loadIdentity(); }
    catch { accessToken = null; identity = null; }
  }
  try {
    const result = await request<{ accessToken: string }>('/refresh', { method: 'POST', body: '{}' });
    accessToken = result.accessToken;
    return await loadIdentity();
  } catch {
    accessToken = null;
    identity = null;
    return null;
  }
}

export async function liveSignOut() {
  try { await request('/logout', { method: 'POST', body: '{}' }); } catch { /* local state is cleared even if expired */ }
  accessToken = null;
  identity = null;
  pendingChallenge = null;
}

export const liveMfaStatus = () => request<{ enabled: boolean; recoveryCodesRemaining: number }>('/mfa/status');
export const liveBeginMfa = (password: string) => request<{ secret: string; otpauthUri: string }>('/mfa/totp/enroll', { method: 'POST', body: JSON.stringify({ password }) });
export const liveConfirmMfa = (code: string) => request<{ recoveryCodes: string[] }>('/mfa/totp/confirm', { method: 'POST', body: JSON.stringify({ code }) });
export const liveStepUpMfa = (value: string, recovery: boolean) => request('/mfa/step-up', { method: 'POST', body: JSON.stringify({ [recovery ? 'recoveryCode' : 'code']: value }) });
export const liveRegenerateRecoveryCodes = () => request<{ recoveryCodes: string[] }>('/mfa/recovery/regenerate', { method: 'POST', body: '{}' });
export const liveDisableMfa = (password: string) => request('/mfa/disable', { method: 'POST', body: JSON.stringify({ password }) });
