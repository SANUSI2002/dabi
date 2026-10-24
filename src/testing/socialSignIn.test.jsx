import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const portal = '../../apps/telemedicine/packages/patient-portal/src';
const identity = vi.hoisted(() => ({
  apiConfigured: true,
  socialProviders: vi.fn(),
  socialNonce: vi.fn(async () => 'synthetic-nonce.9999999999999.signature'),
  signInWithGoogleCode: vi.fn(),
  signInWithAppleToken: vi.fn(),
  completeSocialSignup: vi.fn(),
  restoreSession: vi.fn(async () => null),
  signIn: vi.fn(),
  verifyMfaLogin: vi.fn(),
  registerPatient: vi.fn(),
  mayUsePatientPortal: (user) => !!user?.roles?.includes('PATIENT'),
}));
vi.mock('../../apps/telemedicine/packages/patient-portal/src/utils/sabiIdentity', () => identity);
vi.mock('../../apps/telemedicine/packages/shared-portal/CareStory', () => ({ default: () => null }));
const { default: Login } = await import(`${portal}/pages/Onboarding/login`);
const { default: Signup } = await import(`${portal}/pages/Onboarding/Signup`);

const user = { id: 'synthetic', email: 'ada@social.test', roles: ['PATIENT'] };
let googleClient;
function mount(page) {
  return render(
    <MemoryRouter initialEntries={['/start']}>
      <Routes>
        <Route path="/start" element={page} />
        <Route path="/dashboard" element={<p>Patient dashboard</p>} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </MemoryRouter>,
  );
}
const googleButton = () => screen.getByRole('button', { name: /^Google$|Connecting/ });

beforeEach(() => {
  identity.socialProviders.mockResolvedValue({ google: { clientId: 'synthetic.apps.googleusercontent.com' }, apple: { clientId: 'health.sabi.synthetic', redirectUri: 'https://patients.sabi.test/login' } });
  googleClient = vi.fn((config) => ({ requestCode: () => config.callback({ code: 'synthetic-one-time-code' }) }));
  window.google = { accounts: { oauth2: { initCodeClient: googleClient } } };
  window.AppleID = { auth: { init: vi.fn(), signIn: vi.fn(async () => ({ authorization: { id_token: 'synthetic.apple.token' }, user: { name: { firstName: 'Bola', lastName: 'Synthetic' } } })) } };
});
afterEach(() => { cleanup(); vi.clearAllMocks(); delete window.google; delete window.AppleID; });

describe('Google and Apple on the patient sign-in page', () => {
  it('lets a mobile user recover when the provider request fails instead of leaving Google disabled forever', async () => {
    identity.socialProviders.mockRejectedValueOnce(new Error('offline'));
    mount(<Login />);
    const retry = await screen.findByRole('button', { name: 'Retry secure sign-in' });
    expect(googleButton()).toBeDisabled();
    fireEvent.click(retry);
    await waitFor(() => expect(googleButton()).toBeEnabled());
    expect(identity.socialProviders).toHaveBeenCalledTimes(2);
  });

  it('recovers from a blocked Google SDK download and opens the popup directly from the next tap', async () => {
    const google = window.google;
    delete window.google;
    mount(<Login />);
    await waitFor(() => expect(document.querySelector('script[src="https://accounts.google.com/gsi/client"]')).not.toBeNull());
    fireEvent.error(document.querySelector('script[src="https://accounts.google.com/gsi/client"]'));
    const retry = await screen.findByRole('button', { name: 'Retry secure sign-in' });
    window.google = google;
    fireEvent.click(retry);
    await waitFor(() => expect(googleButton()).toBeEnabled());
    identity.signInWithGoogleCode.mockResolvedValue({ user });
    fireEvent.click(googleButton());
    // No awaited SDK or API operation may precede requestCode: Safari/iPadOS
    // would lose the browser's user-activation permission for the popup.
    expect(googleClient).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Patient dashboard')).toBeInTheDocument();
  });
  it('keeps the buttons switched off, with the note, when the server has no providers', async () => {
    identity.socialProviders.mockResolvedValue({ google: null, apple: null });
    mount(<Login />);
    expect(await screen.findByText(/Google and Apple sign-in are coming soon/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Google' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Apple' })).toBeDisabled();
  });

  it('asks a new person to accept the terms before creating the account', async () => {
    identity.signInWithGoogleCode.mockResolvedValue({ signupRequired: true, signupToken: 'synthetic-signup', profile: { provider: 'GOOGLE', email: 'ada@social.test' } });
    identity.completeSocialSignup.mockResolvedValue({ user, accountCreated: true });
    mount(<Login />);
    await waitFor(() => expect(googleButton()).toBeEnabled());
    expect(screen.queryByText(/coming soon/)).not.toBeInTheDocument();
    fireEvent.click(googleButton());

    expect(googleClient).toHaveBeenCalledWith(expect.objectContaining({ client_id: 'synthetic.apps.googleusercontent.com', ux_mode: 'popup', scope: 'openid email profile' }));
    expect(await screen.findByText(/There's no Sabi Health account for/)).toHaveTextContent('ada@social.test');
    expect(identity.signInWithGoogleCode).toHaveBeenCalledWith('synthetic-one-time-code', { consentGiven: false, responder: false });
    const create = screen.getByRole('button', { name: 'Create account' });
    expect(create).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /Terms of Service/ }));
    fireEvent.click(create);
    expect(await screen.findByText('Patient dashboard')).toBeInTheDocument();
    expect(identity.completeSocialSignup).toHaveBeenCalledWith('synthetic-signup', { responder: false });
  });

  it('signs an existing account straight in with Apple, sending the server nonce and first-time name', async () => {
    identity.signInWithAppleToken.mockResolvedValue({ user });
    mount(<Login />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Apple' })).toBeEnabled());
    await waitFor(() => expect(identity.socialNonce).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Apple' }));
    expect(await screen.findByText('Patient dashboard')).toBeInTheDocument();
    expect(window.AppleID.auth.init).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'health.sabi.synthetic', usePopup: true, nonce: 'synthetic-nonce.9999999999999.signature', redirectURI: 'https://patients.sabi.test/login' }));
    expect(identity.signInWithAppleToken).toHaveBeenCalledWith({ idToken: 'synthetic.apple.token', nonce: 'synthetic-nonce.9999999999999.signature', firstName: 'Bola', lastName: 'Synthetic' }, { consentGiven: false, responder: false });
  });

  it('moves to the authenticator step when two-step verification is on, and says nothing when the window is closed', async () => {
    identity.signInWithGoogleCode.mockResolvedValue({ mfaRequired: true });
    mount(<Login />);
    await waitFor(() => expect(googleButton()).toBeEnabled());
    fireEvent.click(googleButton());
    expect(await screen.findByLabelText('Six-digit authenticator code')).toBeInTheDocument();

    window.google.accounts.oauth2.initCodeClient = vi.fn((config) => ({ requestCode: () => config.error_callback({ type: 'popup_closed' }) }));
    fireEvent.click(googleButton());
    await waitFor(() => expect(googleButton()).toBeEnabled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Google and Apple on the patient sign-up page', () => {
  it('needs the terms box ticked, then creates the account in one step', async () => {
    identity.signInWithGoogleCode.mockResolvedValue({ user, accountCreated: true });
    mount(<Signup />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Google' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Google' }));
    expect(await screen.findByText('Accept the Terms of Service and Privacy Policy to continue.')).toBeInTheDocument();
    expect(googleClient).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Google' }));
    expect(await screen.findByText('Patient dashboard')).toBeInTheDocument();
    expect(identity.signInWithGoogleCode).toHaveBeenCalledWith('synthetic-one-time-code', { consentGiven: true, responder: false });
  });
});
