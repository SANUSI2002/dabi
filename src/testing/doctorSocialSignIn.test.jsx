import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const portal = '../../apps/telemedicine/packages/doctor-portal/src';
const auth = vi.hoisted(() => ({
  AUTH_CONFIGURED: true, PREVIEW_ENABLED: false, REGISTRATION_CONFIGURED: true, TERMS_URL: '', PRIVACY_URL: '',
  socialProviders: vi.fn(), socialNonce: vi.fn(async () => 'synthetic-nonce.9999999999999.signature'),
  socialGoogle: vi.fn(), socialApple: vi.fn(), signInDoctor: vi.fn(), verifySignIn: vi.fn(), requestPasswordReset: vi.fn(),
  getRegistrationConfig: vi.fn(), registerDoctor: vi.fn(), registerProfessional: vi.fn(),
}));
vi.mock('../../apps/telemedicine/packages/doctor-portal/src/services/doctorAuth', () => auth);
vi.mock('../../apps/telemedicine/packages/doctor-portal/src/pages/auth/AuthLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
const { default: SignInPage } = await import(`${portal}/pages/auth/SignInPage`);
const { default: ProfessionalRegistrationPage } = await import(`${portal}/pages/auth/ProfessionalRegistrationPage`);

function Status() { const { state } = useLocation(); return <p>Status page {JSON.stringify(state)}</p>; }
function mount(path, element) {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/login" element={<SignInPage />} />
    <Route path="/register" element={element || <ProfessionalRegistrationPage />} />
    <Route path="/registration/status" element={<Status />} />
    <Route path="/dashboard" element={<p>Doctor dashboard</p>} />
  </Routes></MemoryRouter>);
}
const handOff = { signupRequired: true, signupToken: 'synthetic-signup-token', profile: { provider: 'GOOGLE', email: 'ifeoma@social.test', firstName: 'Ifeoma', lastName: 'Okeke' } };
const approved = { doctor: { id: 'synthetic-pro', accountStatus: 'active', emailVerified: true, licenceVerified: true, verificationStatus: 'VERIFIED', email: 'dr@social.test', name: 'Dr Synthetic' } };
const change = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  auth.socialProviders.mockResolvedValue({ google: { clientId: 'synthetic.apps.googleusercontent.com' }, apple: null });
  auth.getRegistrationConfig.mockResolvedValue({ enabled: true, professions: [{ type: 'DOCTOR', label: 'Doctor', disciplines: ['MEDICAL_PRACTITIONER'], regulator: 'MDCN', regulated: true }] });
  window.google = { accounts: { oauth2: { initCodeClient: (config) => ({ requestCode: () => config.callback({ code: 'synthetic-code' }) }) } } };
});
afterEach(() => { cleanup(); vi.clearAllMocks(); delete window.google; try { sessionStorage.clear(); } catch { /* jsdom */ } });

describe('Google / Apple in the professional portal', () => {
  it('shows no social buttons until the server switches a provider on', async () => {
    auth.socialProviders.mockResolvedValue({ google: null, apple: null });
    mount('/login');
    await waitFor(() => expect(auth.socialProviders).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Google' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apple' })).not.toBeInTheDocument();
  });

  it('signs an approved professional straight into the workspace', async () => {
    auth.socialGoogle.mockResolvedValue(approved);
    mount('/login');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Google' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Google' }));
    expect(await screen.findByText('Doctor dashboard')).toBeInTheDocument();
    expect(auth.socialGoogle).toHaveBeenCalledWith('synthetic-code');
  });

  it('sends someone without a professional account to registration, never creating a patient', async () => {
    auth.socialGoogle.mockResolvedValue(handOff);
    mount('/login');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Google' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Google' }));
    expect(await screen.findByText(/No professional account uses/)).toHaveTextContent('ifeoma@social.test');
    fireEvent.click(screen.getByRole('button', { name: 'Register as a professional' }));
    fireEvent.change(await screen.findByLabelText('Profession'), { target: { value: 'DOCTOR' } });
    expect(await screen.findByText('Signing up with Google')).toBeInTheDocument();
  });

  it('registers a doctor with Google: same form and documents, no password, then straight to credential upload', async () => {
    auth.socialGoogle.mockResolvedValue(handOff);
    auth.registerDoctor.mockResolvedValue({ applicationId: 'synthetic-app', email: 'ifeoma@social.test', status: 'documents_pending', signedIn: true });
    mount('/register');
    fireEvent.change(await screen.findByLabelText('Profession'), { target: { value: 'DOCTOR' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Google' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Google' }));

    expect(await screen.findByText('Signing up with Google')).toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toHaveValue('Ifeoma');
    expect(screen.getByLabelText('Email address')).toHaveValue('ifeoma@social.test');
    expect(screen.getByLabelText('Email address')).toHaveAttribute('readonly');
    expect(screen.queryByLabelText('Create password')).not.toBeInTheDocument();

    change('Phone number', '+2348030000000');
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    change('Primary specialty', 'General Practice');
    change('Primary medical qualification', 'MBBS');
    change('Medical school / university', 'University of Lagos');
    change('Graduation year', '2014');
    change('MDCN folio / registration number', 'MDCN-12345');
    change('State of practice', 'Lagos');
    change('City / town', 'Ikeja');
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    expect(await screen.findByText(/Right after creating your account you'll upload/)).toBeInTheDocument();
    change('Practising licence type', 'life');
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    expect(await screen.findByText('Sign-in')).toBeInTheDocument();
    expect(screen.getAllByText('Upload right after this step').length).toBe(2);
    fireEvent.click(screen.getByRole('checkbox', { name: /details and documents are accurate/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Agree to Doctor Terms and acknowledge Privacy Notice' }));
    fireEvent.click(screen.getByRole('button', { name: /Submit registration/ }));

    expect(await screen.findByText(/Status page/)).toHaveTextContent('"signedIn":true');
    const payload = auth.registerDoctor.mock.calls[0][0];
    expect(payload).toMatchObject({ socialSignupToken: 'synthetic-signup-token', firstName: 'Ifeoma', registrationNumber: 'MDCN-12345', licenceType: 'life', declaration: true, termsAccepted: true });
    expect(payload).not.toHaveProperty('password');
    expect(payload).not.toHaveProperty('email');
  });
});
