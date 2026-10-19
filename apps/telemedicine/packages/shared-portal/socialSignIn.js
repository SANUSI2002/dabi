// Google and Apple sign-in, shared by the patient and professional portals. Both open the provider's own
// window from the tap: Google returns a one-time code that only the Sabi server can exchange, Apple
// returns a signed token bound to a nonce the Sabi server issued. No secret ever reaches the browser.
//
// The providers' scripts and the Apple nonce are fetched when the page opens, because browsers only
// allow a sign-in popup if it opens straight from the click.
import { useCallback, useEffect, useRef, useState } from 'react';

const GOOGLE_SDK = 'https://accounts.google.com/gsi/client';
const APPLE_SDK = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
const NONCE_REFRESH_MS = 8 * 60_000; // the server's nonce lasts ten minutes

const scripts = new Map();
function loadScript(src) {
  if (!scripts.has(src)) {
    scripts.set(src, new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = src;
      tag.async = true;
      tag.onload = () => resolve();
      tag.onerror = () => { scripts.delete(src); reject(new Error('Sign-in could not load. Check your connection and try again.')); };
      document.head.appendChild(tag);
    }));
  }
  return scripts.get(src);
}

const cancelled = (provider) => Object.assign(new Error(`${provider} sign-in was closed before it finished.`), { cancelled: true });

/**
 * Builds a portal's hook from its identity client:
 *   api.configured, api.providers() → { google, apple }, api.nonce(), api.google(code, options), api.apple({ idToken, nonce, firstName, lastName }, options)
 * The hook returns `available.google` / `available.apple` (enable the button), `configured` (the server has it
 * switched on) and `start('google' | 'apple', options)`, which resolves to whatever api.google / api.apple
 * resolve to. A closed popup rejects with `error.cancelled`, which callers should ignore quietly.
 */
export function createSocialSignIn(api) {
  return function useSocialSignIn(defaults = {}) {
    const [config, setConfig] = useState({ google: null, apple: null, checked: !api.configured });
    const [loaded, setLoaded] = useState({ google: false, apple: false });
    const nonce = useRef(null);

    useEffect(() => {
      if (!api.configured) return undefined;
      let active = true;
      api.providers()
        .then((providers) => {
          if (!active) return;
          setConfig({ google: providers?.google ?? null, apple: providers?.apple ?? null, checked: true });
          // Reuse a provider script that is already on the page (another visit, or a test double).
          const ensure = (present, src) => (present ? Promise.resolve() : loadScript(src));
          if (providers?.google) ensure(window.google?.accounts?.oauth2, GOOGLE_SDK).then(() => active && setLoaded((l) => ({ ...l, google: true })), () => {});
          if (providers?.apple) ensure(window.AppleID?.auth, APPLE_SDK).then(() => active && setLoaded((l) => ({ ...l, apple: true })), () => {});
        })
        .catch(() => active && setConfig({ google: null, apple: null, checked: true }));
      return () => { active = false; };
    }, []);

    const refreshNonce = useCallback(() => api.nonce().then((value) => { nonce.current = value; }, () => { nonce.current = null; }), []);
    useEffect(() => {
      if (!config.apple) return undefined;
      refreshNonce();
      const timer = setInterval(refreshNonce, NONCE_REFRESH_MS);
      return () => clearInterval(timer);
    }, [config.apple, refreshNonce]);

    const defaultsKey = JSON.stringify(defaults);
    const start = useCallback((provider, overrides = {}) => {
      const options = { ...JSON.parse(defaultsKey), ...overrides };
      if (provider === 'google') {
        const oauth = window.google?.accounts?.oauth2;
        if (!config.google || !oauth) return Promise.reject(new Error('Google sign-in is still loading. Try again in a moment.'));
        return new Promise((resolve, reject) => {
          oauth.initCodeClient({
            client_id: config.google.clientId,
            scope: 'openid email profile',
            ux_mode: 'popup',
            callback: (response) => {
              if (response.error || !response.code) reject(response.error === 'access_denied' ? cancelled('Google') : new Error('Google could not complete the sign-in. Please try again.'));
              else api.google(response.code, options).then(resolve, reject);
            },
            error_callback: (error) => reject(error?.type === 'popup_closed' ? cancelled('Google') : new Error('The Google window could not open. Allow pop-ups for this site and try again.')),
          }).requestCode();
        });
      }
      const apple = window.AppleID?.auth;
      const value = nonce.current;
      if (!config.apple || !apple || !value) return Promise.reject(new Error('Apple sign-in is still loading. Try again in a moment.'));
      apple.init({ clientId: config.apple.clientId, scope: 'name email', redirectURI: config.apple.redirectUri, usePopup: true, nonce: value, state: crypto.randomUUID() });
      return apple.signIn().then(
        (data) => {
          nonce.current = null;
          refreshNonce();
          return api.apple({ idToken: data?.authorization?.id_token, nonce: value, firstName: data?.user?.name?.firstName, lastName: data?.user?.name?.lastName }, options);
        },
        (error) => {
          refreshNonce();
          throw ['popup_closed_by_user', 'user_cancelled_authorize'].includes(error?.error) ? cancelled('Apple') : new Error('Apple could not complete the sign-in. Please try again.');
        },
      );
    }, [config, defaultsKey, refreshNonce]);

    return {
      checked: config.checked,
      configured: { google: !!config.google, apple: !!config.apple },
      available: { google: !!config.google && loaded.google, apple: !!config.apple && loaded.apple },
      start,
    };
  };
}
