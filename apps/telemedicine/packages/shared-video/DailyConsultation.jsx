import React, { useEffect, useRef, useState } from 'react';
import './DailyConsultation.css';
import { ACTIVITY_EVENT } from '../shared-portal/idleTimeout.js';
let previousTeardown = Promise.resolve();
export function validVideoSession(session) {
  try {
    const url = new URL(session?.url);
    return url.protocol === 'https:' && /^[a-z0-9-]+\.daily\.co$/.test(url.hostname)
      && /^\/sabi-v-[a-f0-9]{32}$/.test(url.pathname) && !url.username && !url.password && !url.search && !url.hash
      && typeof session.token === 'string' && session.token.length >= 20 && session.token.length <= 8192 && Date.parse(session.expiresAt) > Date.now();
  } catch { return false; }
}

// Daily's fatal error types, in plain words. Anything else is treated as a network problem, which is
// by far the most common cause on mobile data, and is retried before we give up.
const DAILY_ERRORS = {
  'nbf-room': "The video room isn't open yet. It opens 10 minutes before the appointment.",
  'nbf-token': "The video room isn't open yet. It opens 10 minutes before the appointment.",
  'exp-room': 'The video window for this consultation has ended.',
  'exp-token': 'The video window for this consultation has ended.',
  ejected: 'You were removed from the call because the consultation window ended or your access changed.',
  'no-room': 'This video room is no longer available. Close this window and press Join again.',
  'meeting-full': 'This consultation is already open on another device or tab. Close it there, then try again.',
  'not-allowed': "Video calls aren't available for this account right now. Please contact Sabi support.",
  'end-of-life': 'This browser is too old for video calls. Please update it, or use Chrome or Safari.',
};
const NETWORK_ERROR = "We couldn't reach the video service. Your connection may be weak. Try again, or join with audio only.";
// Retry pauses and the access re-check interval (tests shorten them).
export const callTiming = { retryDelays: [2000, 5000], accessCheckMs: 30000 };
const RECONNECTING = 'Your connection dropped. Reconnecting…';
const CHECK_UNREACHABLE = "We couldn't reach Sabi to re-check your access. Your call continues.";
const CAMERA_BLOCKED = 'Your camera or microphone is blocked or in use. Allow access in your browser settings, or continue with audio only.';
const errorType = (e) => e?.error?.type || e?.type || '';
// Daily's own short reason is appended so a screenshot is enough for support to tell what happened.
const friendlyError = (e) => {
  const detail = String(errorType(e) || e?.errorMsg || e?.message || '').slice(0, 120);
  return `${DAILY_ERRORS[errorType(e)] || NETWORK_ERROR}${detail ? ` Details: ${detail}` : ''}`;
};
const retryable = (e) => !DAILY_ERRORS[errorType(e)];
// The server says access is gone (signed out, not allowed, not found, window ended); anything else
// (no network, timeouts, 5xx, rate limits) must not end a consultation that is going fine.
const accessGone = (error) => [401, 403, 404, 409].includes(error?.status);
/** The phone says its connection is slow or data saver is on (not every browser reports this). */
export function slowConnection(connection = typeof navigator === 'undefined' ? undefined : navigator.connection) {
  return Boolean(connection && (connection.saveData || ['slow-2g', '2g'].includes(connection.effectiveType)));
}
// Daily's settings calls return promises and some do not apply to every call type; failing quietly is
// fine because Daily's own adaptive video keeps working either way.
const quietly = (work) => Promise.resolve().then(work).catch(() => {});

export default function DailyConsultation({ appointmentId, title, getConfig, joinSession, checkSession, onClose }) {
  const host = useRef(null), closeButton = useRef(null), alive = useRef(false), frameRef = useRef(null);
  const [config, setConfig] = useState(null), [configError, setConfigError] = useState('');
  const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false);
  const [session, setSession] = useState(null), [error, setError] = useState(''), [phase, setPhase] = useState('Ready');
  const [attempt, setAttempt] = useState(0);
  const [slow] = useState(() => slowConnection());
  const [audioOnly, setAudioOnly] = useState(false), [quality, setQuality] = useState('good'), [note, setNote] = useState('');
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    const focus = document.activeElement;
    closeButton.current?.focus();
    getConfig(controller.signal).then((result) => { if (!controller.signal.aborted) { setConfig(result); setConfigError(''); } })
      .catch((e) => { if (!controller.signal.aborted) setConfigError(e.message); });
    return () => { alive.current = false; controller.abort(); focus?.focus?.(); };
  }, [getConfig, attempt]);
  useEffect(() => {
    if (!session) return;
    let frame, disposed = false, joined = false;
    const controller = new AbortController();
    const fail = (message) => { if (!disposed) { setError(message); setSession(null); } };
    // Weak network: send a lighter video stream and receive the lowest quality layer; restore when it recovers.
    const adapt = (threshold) => {
      if (disposed || !frame) return;
      const weak = threshold === 'low' || threshold === 'very-low';
      setQuality(threshold);
      quietly(() => frame.updateSendSettings?.({ video: weak ? 'bandwidth-optimized' : 'default-video' }));
      quietly(() => frame.updateReceiveSettings?.({ '*': { video: { layer: weak ? 0 : 'inherit' } } }));
    };
    const open = async (Daily) => {
      frame = Daily.createFrame(host.current, { iframeStyle: { width: '100%', height: '100%', border: '0', borderRadius: '14px' }, showLeaveButton: true, startVideoOff: audioOnly });
      frameRef.current = frame;
      frame.on('joining-meeting', () => !disposed && setPhase('Connecting…'));
      frame.on('joined-meeting', () => {
        if (disposed) return;
        joined = true;
        setPhase(audioOnly ? 'Connected with audio only · open Chat inside the call' : 'Connected · open Chat inside the call');
        // Start light when the person chose audio only or the phone reports a slow connection.
        if (audioOnly || slow) adapt('low');
      });
      frame.on('left-meeting', () => { if (!disposed) { setSession(null); setPhase('Call ended'); } });
      // Before joining, a failed join is retried below; after joining, a fatal error ends the call.
      frame.on('error', (e) => { if (joined) fail(friendlyError(e)); });
      frame.on('network-quality-change', (e) => adapt(e?.threshold));
      frame.on('network-connection', (e) => {
        if (disposed) return;
        if (e?.event === 'interrupted') setNote(RECONNECTING);
        else if (e?.event === 'connected') setNote((current) => (current === RECONNECTING ? '' : current));
      });
      frame.on('camera-error', () => !disposed && setNote(CAMERA_BLOCKED));
      await frame.join({ url: session.url, token: session.token });
    };
    const create = async () => {
      await previousTeardown;
      if (disposed) return;
      let Daily;
      try { ({ default: Daily } = await import('@daily-co/daily-js')); }
      catch { fail(NETWORK_ERROR); return; }
      for (let tries = 0; ; tries += 1) {
        if (disposed) return;
        try { await open(Daily); return; }
        catch (e) {
          // A failed frame cannot be joined again; replace it before retrying.
          const failed = frame; frame = undefined; frameRef.current = null;
          await failed?.destroy?.().catch(() => {});
          if (disposed) return;
          if (!retryable(e) || tries >= callTiming.retryDelays.length) { fail(friendlyError(e)); return; }
          setPhase(`Weak connection. Trying again (${tries + 1} of ${callTiming.retryDelays.length})…`);
          await new Promise((resolve) => setTimeout(resolve, callTiming.retryDelays[tries]));
        }
      }
    };
    void create();
    // Clicks and speech inside Daily's iframe are invisible to the page, so a live call counts as activity
    // for the idle sign-out; otherwise a five-minute stretch of talking would end the consultation.
    const stillHere = () => window.dispatchEvent(new Event(ACTIVITY_EVENT));
    stillHere();
    const poll = setInterval(() => {
      stillHere();
      checkSession(appointmentId, controller.signal)
        .then(() => { if (!disposed) setNote((current) => (current === CHECK_UNREACHABLE ? '' : current)); })
        .catch((e) => {
          if (disposed) return;
          if (accessGone(e)) fail('Your consultation access changed or could not be verified. Reconnect to check your access again.');
          else setNote(CHECK_UNREACHABLE);
        });
    }, callTiming.accessCheckMs);
    const expiry = setTimeout(() => fail('The consultation window has ended.'), Math.max(0, Math.min(2147483647, Date.parse(session.expiresAt) - Date.now())));
    return () => {
      disposed = true; controller.abort(); clearInterval(poll); clearTimeout(expiry); frameRef.current = null;
      setQuality('good'); setNote('');
      if (frame) previousTeardown = previousTeardown.then(() => frame.destroy()).catch(() => {});
    };
  }, [session, appointmentId, checkSession, audioOnly, slow]);
  async function connect(withAudioOnly) {
    setBusy(true); setError(''); setAudioOnly(withAudioOnly);
    try {
      const result = await joinSession(appointmentId, { providerConsent: true });
      if (!validVideoSession(result)) throw new Error('The video provider returned an invalid session. Please retry.');
      if (alive.current) { setPhase('Preparing camera and microphone…'); setSession(result); }
    } catch (e) { if (alive.current) setError(e.message); }
    finally { if (alive.current) setBusy(false); }
  }
  function keys(event) {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
    if (event.key === 'Tab') {
      const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), iframe')];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }
  const canJoin = config?.enabled && consent && !busy;
  return <div className="sabi-video-overlay"><section className="sabi-video-panel" role="dialog" aria-modal="true" aria-label="Video consultation" onKeyDown={keys}>
    <header className="sabi-video-header"><div><small>SABI CONSULTATION</small><h2>{title || 'Video consultation'}</h2><p role="status">{session ? phase : 'Private video and live in-call chat'}</p></div><button ref={closeButton} type="button" onClick={onClose} aria-label="Leave and close consultation">Close call</button></header>
    {error && <div className="sabi-video-error" role="alert">{error}</div>}
    {session && quality === 'very-low' && <div className="sabi-video-banner" role="status">Your connection is very weak. Turning off your video keeps the conversation going.<button type="button" onClick={() => quietly(() => frameRef.current?.setLocalVideo(false))}>Turn off my video</button></div>}
    {session && quality === 'low' && <div className="sabi-video-banner" role="status">Weak connection: video quality is lowered so the call can continue.</div>}
    {session && note && <div className="sabi-video-banner" role="status">{note}</div>}
    {session ? <div ref={host} className="sabi-video-frame" /> : <div className="sabi-video-lobby"><div className="sabi-video-mark" aria-hidden="true">↗</div><h3>Your consultation, connected</h3><p>Check your camera and microphone before joining. Use the Chat button inside the call to message the other participant.</p><p className="sabi-video-muted">Daily processes your call audio, video and in-call messages. Recording and transcription are disabled. Chat is for this call, not a persistent medical record. Calls open 10 minutes before your appointment and close 15 minutes after its scheduled end.</p>
      <p className="sabi-video-muted">On a weak connection the call lowers video quality by itself and keeps your voice first. Audio only uses much less data.</p>
      {slow && <p className="sabi-video-hint" role="status">Your connection looks slow. Joining with audio only is more reliable; you can turn your camera on inside the call.</p>}
      {!config && !configError && <p role="status">Checking video availability…</p>}
      {configError && <><p role="alert">{configError}</p><button type="button" onClick={() => setAttempt((v) => v + 1)}>Retry availability check</button></>}
      {config && !config.enabled && <p role="alert">Video service is not enabled yet. Please contact Sabi support.</p>}
      <label className="sabi-video-consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />I understand and agree to connect this consultation through Daily.</label>
      <div className="sabi-video-actions">
        <button className={slow ? undefined : 'sabi-video-primary'} type="button" disabled={!canJoin} onClick={() => connect(false)}>{busy ? 'Preparing secure call…' : error ? 'Reconnect' : 'Join video and chat'}</button>
        <button className={slow ? 'sabi-video-primary' : undefined} type="button" disabled={!canJoin} onClick={() => connect(true)}>Join with audio only</button>
      </div>
    </div>}
  </section></div>;
}
