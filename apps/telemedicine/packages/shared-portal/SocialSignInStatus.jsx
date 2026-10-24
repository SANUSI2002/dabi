import React from 'react';

/** Failed network/SDK loads are recoverable, not permanently disabled buttons. */
export default function SocialSignInStatus({ social }) {
  if (social.error) return <div className="sabi-social-status" role="alert">
    <p>{social.error}</p><button type="button" onClick={social.retry}>Retry secure sign-in</button>
  </div>;
  if (!social.checked || (social.configured.google && !social.available.google))
    return <p className="sabi-social-status" role="status" aria-live="polite">Preparing secure Google sign-in…</p>;
  return null;
}
