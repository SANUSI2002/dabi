const configuredBaseUrl = String(import.meta.env.VITE_SABI_IDENTITY_API_URL || '').trim().replace(/\/$/, '');
export const apiBaseUrl = configuredBaseUrl === 'same-origin'
  ? (typeof window === 'undefined' ? '' : window.location.origin)
  : configuredBaseUrl;
export const apiConfigured = apiBaseUrl.length > 0;
let accessToken = null;
let currentUser = null;
let pendingChallenge = null;
let restoring = null;
const mayUsePatientPortal = (user) => user?.roles?.some((role) => ['PATIENT', 'CAREGIVER'].includes(role));

async function request(path, options = {}) {
  if (!apiConfigured) throw new Error('Sabi Identity API is not configured.');
  const response = await fetch(`${apiBaseUrl}/api/v1/auth${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Sabi-Client': 'browser', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || body.error?.message || 'Authentication failed.');
    error.code = body.error?.code || body.code;
    error.status = response.status;
    throw error;
  }
  return body;
}

// Refresh tokens are single-use: the server treats a reused one as stolen and revokes the
// whole session. So only one refresh may be in flight — per tab (the shared promise) and
// across tabs (a Web Lock). A tab that waited on another tab's refresh reuses its cookie.
function exclusiveRefresh(work) {
  return typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('sabi-identity-refresh', work)
    : work();
}

export async function signIn(email, password) {
  const login = await request('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (login.status === 'mfa_required' && login.challengeToken) {
    pendingChallenge = login.challengeToken;
    return { mfaRequired: true };
  }
  if (!login.accessToken) throw new Error('The identity service returned an invalid login response.');
  accessToken = login.accessToken;
  const me = await request('/me');
  if (!mayUsePatientPortal(me.user)) {
    await signOut();
    throw new Error('This account does not have patient portal access.');
  }
  currentUser = me.user;
  return currentUser;
}

export async function registerPatient({ firstName, lastName, phoneNumber, email, password }) {
  return request('/register/patient', {
    method: 'POST',
    body: JSON.stringify({ firstName, lastName, phoneNumber, email, password, consentGiven: true }),
  });
}

export const requestEmailVerification = (email) => request('/email-verification/request', { method: 'POST', body: JSON.stringify({ email }) });
export const confirmEmailVerification = (uid, token) => request('/email-verification/confirm', { method: 'POST', body: JSON.stringify({ uid, token }) });

export async function verifyMfaLogin(value, recovery = false) {
  if (!pendingChallenge) throw new Error('Verification expired. Please sign in again.');
  const result = await request('/mfa/login/verify', { method: 'POST', body: JSON.stringify({ challengeToken: pendingChallenge, [recovery ? 'recoveryCode' : 'code']: value }) });
  if (!result.accessToken) throw new Error('The identity service returned an invalid verification response.');
  pendingChallenge = null;
  accessToken = result.accessToken;
  const me = await request('/me');
  if (!mayUsePatientPortal(me.user)) { await signOut(); throw new Error('This account does not have patient portal access.'); }
  currentUser = me.user;
  return currentUser;
}

async function loadCurrentUser() {
  const me = await request('/me');
  if (!mayUsePatientPortal(me.user)) { accessToken = null; currentUser = null; return null; }
  currentUser = me.user;
  return currentUser;
}

async function doRestore() {
  if (!apiConfigured) return null;
  if (currentUser && accessToken) {
    try {
      return await loadCurrentUser();
    } catch (error) {
      // Only an auth failure invalidates the session; an outage (5xx, offline) keeps it.
      if (error.status !== 401) return currentUser;
      accessToken = null;
      currentUser = null;
    }
  }
  try {
    const result = await exclusiveRefresh(() => request('/refresh', { method: 'POST', body: '{}' }));
    accessToken = result.accessToken;
    return await loadCurrentUser();
  } catch (error) {
    // A rejected refresh token ends the session. A busy or unreachable server (429, 5xx,
    // offline) does not: the cookie is still valid, so callers should retry, not sign out.
    if (error.status === 429 || error.status >= 500 || error.status === undefined) {
      throw Object.assign(new Error("Sabi Health is busy right now. Please try again in a moment."), { transient: true, status: error.status });
    }
    accessToken = null;
    currentUser = null;
    return null;
  }
}

/** Every caller (session guard, sidebar, topbar, API retries) shares one in-flight restore. */
export function restoreSession() {
  if (!restoring) restoring = doRestore().finally(() => { restoring = null; });
  return restoring;
}

export const getCurrentUser = () => currentUser;

/** Applies a saved profile change (e.g. a new name) to the cached signed-in user. */
export const updateCurrentUser = (patch) => {
  if (currentUser) currentUser = { ...currentUser, ...patch };
  return currentUser;
};

/**
 * Authenticated JSON request to the Sabi API (any path under /api). Refreshes the session
 * once on a 401 and retries. Resolves to the parsed body; rejects with an Error carrying
 * the server's message, `status` and `code`.
 */
// `raw: true` returns the response body as a Blob (for PDFs and other files) instead of parsing JSON.
export async function authorizedRequest(path, { method = 'GET', body, query, signal, raw = false } = {}) {
  if (!apiConfigured) throw Object.assign(new Error('The Sabi Health service is not configured.'), { code: 'API_NOT_CONFIGURED' });
  if (!accessToken) await restoreSession();
  const search = query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString()}` : '';
  const send = (token) => fetch(`${apiBaseUrl}${path}${search === '?' ? '' : search}`, {
    method,
    signal,
    credentials: 'include',
    headers: { 'X-Sabi-Client': 'browser', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let used = accessToken;
  let response = await send(used);
  if (response.status === 401) {
    // Only discard the token this request actually used; a concurrent request may already hold a newer one.
    if (accessToken === used) accessToken = null;
    if (await restoreSession()) { used = accessToken; response = await send(used); }
  }
  if (raw && response.ok) return response.blob();
  const parsed = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = parsed.message || parsed.error?.message || (response.status === 401 ? 'Your session has expired. Please sign in again.' : 'The Sabi Health service could not complete that request.');
    throw Object.assign(new Error(message), { status: response.status, code: parsed.error?.code || parsed.code, errors: parsed.errors });
  }
  return parsed;
}

export async function signOut() {
  try { await request('/logout', { method: 'POST', body: '{}' }); } catch { /* stale sessions still clear locally */ }
  accessToken = null;
  currentUser = null;
  pendingChallenge = null;
}

export const mfaStatus = () => request('/mfa/status');

export const changePassword = (currentPassword, newPassword) =>
  authorizedRequest('/api/v1/profile/security/change-password', {
    method: 'PUT',
    body: { current_password: currentPassword, new_password: newPassword },
  });

// Public (signed-out) password recovery. The server answers identically whether or not
// the address has an account, so the UI can't be used to discover who is registered.
async function publicAuthRequest(path, body) {
  if (!apiConfigured) throw new Error('The Sabi Health service is not configured.');
  const response = await fetch(`${apiBaseUrl}/api/v1/auth${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const parsed = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fieldMessage = parsed.errors?.map((e) => e.message).join(' ');
    throw new Error(fieldMessage || parsed.message || parsed.error?.message || 'That request could not be completed.');
  }
  return parsed;
}

export const requestPasswordReset = (email) => publicAuthRequest('/password-reset/request', { email: String(email).trim() });
export const confirmPasswordReset = (uid, token, password, confirmPassword) =>
  publicAuthRequest('/password-reset/confirm', { uid, token, password, confirmPassword });
