// Google and Apple for the professional portal (see shared-portal/socialSignIn.js). Never creates a
// patient: a new person gets { signupRequired, signupToken, profile } for the registration form.
import { createSocialSignIn } from "../../../shared-portal/socialSignIn.js";
import { AUTH_CONFIGURED, socialApple, socialGoogle, socialNonce, socialProviders } from "./doctorAuth";

export const useSocialSignIn = createSocialSignIn({
  configured: AUTH_CONFIGURED,
  providers: () => socialProviders(),
  nonce: () => socialNonce(),
  google: (code) => socialGoogle(code),
  apple: (token) => socialApple(token),
});
