import { apiBaseUrl } from '@/config/runtime';

export type LiveIdentity = {
  user: { id: string; email: string; roles: string[]; profile?: unknown };
  organizations: Array<{ id: string; status: string; organization: { id: string; type: string; name: string; status: string }; roles: string[]; permissions: string[] }>;
  platformAssigned: boolean;
  platform: { roles: string[]; permissions: string[] } | null;
};

export type LivePlatformOrganization = { id: string; type: string; name: string; status: string; createdAt: string };

let accessToken: string | null = null;
let identity: LiveIdentity | null = null;
let pendingChallenge: string | null = null;

async function requestApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!apiBaseUrl) throw new Error('Sabi Identity API is not configured.');
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Sabi-Client': 'browser', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || body.error?.message || 'Identity service is unavailable.') as Error & { status: number; code?: string };
    error.status = response.status;
    error.code = body.error?.code;
    throw error;
  }
  return body as T;
}

const request = <T,>(path: string, options: RequestInit = {}) => requestApi<T>(`/api/v1/auth${path}`, options);

export const liveRequestPasswordReset = (email: string) => request<{ status: string }>('/password-reset/request', { method: 'POST', body: JSON.stringify({ email: email.trim() }) });
export const liveConfirmPasswordReset = (uid: string, token: string, password: string, confirmPassword: string) => request<{ status: string }>('/password-reset/confirm', { method: 'POST', body: JSON.stringify({ uid, token, password, confirmPassword }) });

async function loadIdentity(): Promise<LiveIdentity> {
  const me = await request<{ user: LiveIdentity['user']; organizations: LiveIdentity['organizations'] }>('/me');
  let platformAssigned = false;
  try {
    const assignment = await request<{ data: { assigned: boolean } }>('/platform-assignment');
    platformAssigned = assignment.data.assigned;
  } catch (cause) {
    if ((cause as { code?: string }).code !== 'PLATFORM_ACCESS_DENIED') throw cause;
  }
  let platform: LiveIdentity['platform'] = null;
  if (platformAssigned) {
    try {
      const result = await request<{ data: { roles: string[]; permissions: string[] } }>('/platform-context');
      platform = result.data;
    } catch (cause) {
      if (!['MFA_REQUIRED', 'MFA_ENROLLMENT_REQUIRED'].includes((cause as { code?: string }).code ?? '')) throw cause;
    }
  }
  identity = { user: me.user, organizations: me.organizations, platformAssigned, platform };
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
export const liveListPlatformOrganizations = (page = 1) => requestApi<{ data: { items: LivePlatformOrganization[]; nextPage: number | null } }>(`/api/v1/platform/organizations?page=${page}`);
export const liveBeginMfa = (password: string) => request<{ secret: string; otpauthUri: string }>('/mfa/totp/enroll', { method: 'POST', body: JSON.stringify({ password }) });
export const liveConfirmMfa = (code: string) => request<{ recoveryCodes: string[] }>('/mfa/totp/confirm', { method: 'POST', body: JSON.stringify({ code }) });
export const liveStepUpMfa = (value: string, recovery: boolean) => request('/mfa/step-up', { method: 'POST', body: JSON.stringify({ [recovery ? 'recoveryCode' : 'code']: value }) });
export const liveRegenerateRecoveryCodes = () => request<{ recoveryCodes: string[] }>('/mfa/recovery/regenerate', { method: 'POST', body: '{}' });
export const liveDisableMfa = (password: string) => request('/mfa/disable', { method: 'POST', body: JSON.stringify({ password }) });
