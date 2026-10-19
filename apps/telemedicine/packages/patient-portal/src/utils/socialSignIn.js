// Google and Apple sign-in for the patient portal (see shared-portal/socialSignIn.js).
// `useSocialSignIn({ responder })`; `start(provider, { consentGiven })` resolves to
// { user } | { mfaRequired } | { signupRequired, signupToken, profile }.
import { createSocialSignIn } from '../../../shared-portal/socialSignIn.js';
import { apiConfigured, signInWithAppleToken, signInWithGoogleCode, socialNonce, socialProviders } from './sabiIdentity';

const useSharedSocialSignIn = createSocialSignIn({
  configured: apiConfigured,
  providers: () => socialProviders(),
  nonce: () => socialNonce(),
  google: (code, options) => signInWithGoogleCode(code, options),
  apple: (token, options) => signInWithAppleToken(token, options),
});

export function useSocialSignIn({ responder = false } = {}) {
  return useSharedSocialSignIn({ consentGiven: false, responder });
}
