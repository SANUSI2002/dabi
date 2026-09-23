const configuredBaseUrl = String(import.meta.env.VITE_SABI_IDENTITY_API_URL || '').trim().replace(/\/$/, '');
const baseUrl = configuredBaseUrl === 'same-origin'
  ? (typeof window === 'undefined' ? '' : window.location.origin)
  : configuredBaseUrl;
let accessToken = null;
let currentUser = null;
let pendingChallenge = null;
const mayUsePatientPortal = (user) => user?.roles?.some((role) => ['PATIENT', 'CAREGIVER'].includes(role));

async function request(path, options = {}) {
  if (!baseUrl) throw new Error('Sabi Identity API is not configured.');
  const response = await fetch(`${baseUrl}/api/v1/auth${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Sabi-Client': 'browser', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error?.message || 'Authentication failed.');
  return body;
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

export async function restoreSession() {
  if (currentUser && accessToken) {
    try {
      const me = await request('/me');
      if (!mayUsePatientPortal(me.user)) { accessToken = null; currentUser = null; return null; }
      currentUser = me.user;
      return currentUser;
    } catch { accessToken = null; currentUser = null; }
  }
  try {
    const result = await request('/refresh', { method: 'POST', body: '{}' });
    accessToken = result.accessToken;
    const me = await request('/me');
    if (!mayUsePatientPortal(me.user)) { accessToken = null; return null; }
    currentUser = me.user;
    return currentUser;
  } catch {
    accessToken = null;
    currentUser = null;
    return null;
  }
}

export async function signOut() {
  try { await request('/logout', { method: 'POST', body: '{}' }); } catch { /* stale sessions still clear locally */ }
  accessToken = null;
  currentUser = null;
  pendingChallenge = null;
}

export const mfaStatus = () => request('/mfa/status');

export async function changePassword(currentPassword, newPassword) {
  if (!baseUrl || !accessToken) throw new Error('Sign in before changing your password.');
  const response = await fetch(`${baseUrl}/api/v1/profile/security/change-password`, {
    method: 'PUT', credentials: 'include',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error?.message || 'Password change failed.');
  return body;
}
