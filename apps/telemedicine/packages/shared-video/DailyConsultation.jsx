import React, { useEffect, useRef, useState } from 'react';
import './DailyConsultation.css';
let previousTeardown = Promise.resolve();
export function validVideoSession(session) {
  try {
    const url = new URL(session?.url);
    return url.protocol === 'https:' && /^[a-z0-9-]+\.daily\.co$/.test(url.hostname)
      && /^\/sabi-v-[a-f0-9]{32}$/.test(url.pathname) && !url.username && !url.password && !url.search && !url.hash
      && typeof session.token === 'string' && session.token.length >= 20 && session.token.length <= 8192 && Date.parse(session.expiresAt) > Date.now();
  } catch { return false; }
}
export default function DailyConsultation({ appointmentId, title, getConfig, joinSession, checkSession, onClose }) {
  const host = useRef(null), closeButton = useRef(null), alive = useRef(false);
  const [config, setConfig] = useState(null), [configError, setConfigError] = useState('');
  const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false);
  const [session, setSession] = useState(null), [error, setError] = useState(''), [phase, setPhase] = useState('Ready');
  const [attempt, setAttempt] = useState(0);
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
    let frame, disposed = false;
    const controller = new AbortController();
    const fail = (message) => { if (!disposed) { setError(message); setSession(null); } };
    const create = async () => {
      await previousTeardown;
      if (disposed) return;
      try {
        const { default: Daily } = await import('@daily-co/daily-js');
        if (disposed) return;
        frame = Daily.createFrame(host.current, { iframeStyle: { width: '100%', height: '100%', border: '0', borderRadius: '14px' }, showLeaveButton: true });
        frame.on('joining-meeting', () => !disposed && setPhase('Connecting…'));
        frame.on('joined-meeting', () => !disposed && setPhase('Connected · open Chat inside the call'));
        frame.on('left-meeting', () => { if (!disposed) { setSession(null); setPhase('Call ended'); } });
        frame.on('error', () => fail('The call could not connect. Check your internet and camera/microphone permissions, then try again.'));
        await frame.join({ url: session.url, token: session.token });
      } catch { fail('The call could not connect. Check your connection and try again.'); }
    };
    void create();
    const poll = setInterval(() => { checkSession(appointmentId, controller.signal).catch(() => fail('Your consultation access changed or could not be verified. Reconnect to check your access again.')); }, 30000);
    const expiry = setTimeout(() => fail('The consultation window has ended.'), Math.max(0, Math.min(2147483647, Date.parse(session.expiresAt) - Date.now())));
    return () => { disposed = true; controller.abort(); clearInterval(poll); clearTimeout(expiry); if (frame) previousTeardown = previousTeardown.then(() => frame.destroy()).catch(() => {}); };
  }, [session, appointmentId, checkSession]);
  async function connect() {
    setBusy(true); setError('');
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
  return <div className="sabi-video-overlay"><section className="sabi-video-panel" role="dialog" aria-modal="true" aria-label="Video consultation" onKeyDown={keys}>
    <header className="sabi-video-header"><div><small>SABI CONSULTATION</small><h2>{title || 'Video consultation'}</h2><p role="status">{session ? phase : 'Private video and live in-call chat'}</p></div><button ref={closeButton} type="button" onClick={onClose} aria-label="Leave and close consultation">Close call</button></header>
    {error && <div className="sabi-video-error" role="alert">{error}</div>}
    {session ? <div ref={host} className="sabi-video-frame" /> : <div className="sabi-video-lobby"><div className="sabi-video-mark" aria-hidden="true">↗</div><h3>Your consultation, connected</h3><p>Check your camera and microphone before joining. Use the Chat button inside the call to message the other participant.</p><p className="sabi-video-muted">Daily processes your call audio, video and in-call messages. Recording and transcription are disabled. Chat is for this call, not a persistent medical record. Calls open 10 minutes before your appointment and close 15 minutes after its scheduled end.</p>
      {!config && !configError && <p role="status">Checking video availability…</p>}
      {configError && <><p role="alert">{configError}</p><button type="button" onClick={() => setAttempt((v) => v + 1)}>Retry availability check</button></>}
      {config && !config.enabled && <p role="alert">Video service is not enabled yet. Please contact Sabi support.</p>}
      <label className="sabi-video-consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />I understand and agree to connect this consultation through Daily.</label>
      <button className="sabi-video-primary" type="button" disabled={!config?.enabled || !consent || busy} onClick={connect}>{busy ? 'Preparing secure call…' : error ? 'Reconnect' : 'Join video and chat'}</button>
    </div>}
  </section></div>;
}
