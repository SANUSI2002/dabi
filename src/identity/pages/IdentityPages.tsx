import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Building2, Check, ChevronRight, CircleUserRound, Fingerprint, KeyRound, Loader2, LockKeyhole, MonitorSmartphone, ShieldCheck, ShieldPlus } from "lucide-react";
import { useAuth } from "@/store/useAuth";
import { demoIdentityOptions, DEMO_PASSWORD } from "@/identity/seed";
import { identityService } from "@/identity/service";
import { useCommandCenter } from "@/command-center/useCommandCenter";
import { apiConfigured, developmentFixturesEnabled } from "@/config/runtime";
import { hasPendingLiveMfa, liveSignIn, liveSignOut, liveVerifyMfa, restoreLiveIdentity, type LiveIdentity } from "@/identity/liveIdentity";
import { hasPharmacyPortalAccess } from "@/pharmacy/access";
import { SABI_HEALTH_URL } from "@/public/ecosystemLinks";

type SignInIntent = "shared" | "emr" | "platform";

function hasPortalAccess(intent: SignInIntent | "pharmacy") {
  const { identity, memberships, activeMembership } = useAuth.getState();
  if (intent === "shared") return true;
  if (intent === "platform") return identity?.kind === "platform";
  if (intent === "pharmacy") return identity?.kind === "organization" && (hasPharmacyPortalAccess(activeMembership) || memberships.some(hasPharmacyPortalAccess));
  return identity?.kind === "organization" && (activeMembership?.products.includes("emr") || memberships.some((membership) => membership.products.includes("emr")));
}

function portalAccessError(intent: SignInIntent | "pharmacy") {
  return intent === "platform" ? "This account does not have Command Center access." : intent === "pharmacy" ? "This account is not connected to a pharmacy organization." : "This account does not have access to a Sabi EMR organization.";
}

function SabiIdLayout({ children, title, copy }: { children: ReactNode; title: string; copy: string }) {
  useEffect(() => { document.title = `${title} | Sabi ID`; }, [title]);
  return <div className="min-h-full bg-[#f4faf6]"><div className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(460px,.95fr)]"><aside className="relative hidden overflow-hidden bg-[#061d15] p-12 text-white lg:flex lg:flex-col"><div className="public-grid absolute inset-0 opacity-30"/><div className="absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-brand-500/20 blur-[100px]"/><a href={SABI_HEALTH_URL} className="relative inline-flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient"><ShieldPlus size={20}/></span><span className="font-display text-xl font-extrabold">Sabi <span className="text-brand-300">Health</span></span></a><div className="relative my-auto max-w-xl"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-brand-300">One secure identity</p><h1 className="mt-5 text-balance font-display text-5xl font-extrabold leading-[1.02] tracking-[-.05em]">One Sabi ID.<br/>Every authorized experience.</h1><p className="mt-6 max-w-lg text-lg leading-8 text-emerald-50/60">Identity resolves the person, organization membership, role, subscription and products before opening a workspace.</p><div className="mt-10 grid grid-cols-2 gap-3">{[[Fingerprint,"Verified identity"],[Building2,"Organization membership"],[KeyRound,"Role-aware access"],[ShieldCheck,"Auditable sessions"]].map(([Icon,label])=>{const C=Icon as typeof Fingerprint;return <div key={String(label)} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.05] p-4 text-sm font-semibold text-white/70"><C size={17} className="text-brand-300"/>{String(label)}</div>})}</div></div><p className="relative text-xs text-white/35">Frontend identity architecture · production enforcement requires a secure backend identity provider.</p></aside><main className="flex items-center justify-center p-5 sm:p-10"><div className="w-full max-w-[500px]"><a href={SABI_HEALTH_URL} className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-brand-700"><ArrowLeft size={15}/> Back to Sabi Health</a><div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_30px_90px_-45px_rgba(2,44,28,.45)] sm:p-9"><div className="mb-7 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-950 text-brand-300"><ShieldPlus size={20}/></span><div><p className="font-display text-lg font-extrabold">Sabi ID</p><p className="text-xs text-slate-400">Identity for the Sabi ecosystem</p></div></div><h2 className="font-display text-3xl font-extrabold tracking-[-.04em] text-slate-950">{title}</h2><p className="mt-3 text-sm leading-6 text-slate-500">{copy}</p><div className="mt-7">{children}</div></div></div></main></div></div>;
}

export function SignInPage({ intent = "shared" }: { intent?: SignInIntent }) {
  const navigate = useNavigate();
  const { authed, destination, signIn } = useAuth();
  const [email, setEmail] = useState(developmentFixturesEnabled && !apiConfigured ? intent === "platform" ? "adaeze@sabios.com" : "amaka@sabi.health" : "");
  const [password, setPassword] = useState(developmentFixturesEnabled && !apiConfigured ? DEMO_PASSWORD : "");
  const [rememberMe, setRememberMe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (apiConfigured) { restoreLiveIdentity().then((current) => {
    if (!current) return;
    if (intent === 'platform') {
      if (current.platform) navigate('/command-center', { replace: true });
      else if (current.platformAssigned) navigate('/identity/mfa?next=command-center', { replace: true });
    } else navigate('/identity/account', { replace: true });
  }); } }, [intent, navigate]);
  if (!apiConfigured && authed && hasPortalAccess(intent)) return <Navigate to={intent === "platform" ? "/command-center" : destination()} replace />;

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    if (apiConfigured) {
      try {
        const result = await liveSignIn(email, password);
        if (result.kind === 'MFA') { navigate(`/mfa?context=${intent}`); return; }
        const current = result.identity;
        if (intent === 'platform') {
          if (!current.platformAssigned) {
            await liveSignOut();
            throw new Error('Command Center access must be assigned by Sabi operations. Standard account registration does not grant platform access.');
          }
          navigate(current.platform ? '/command-center' : '/identity/mfa?next=command-center', { replace: true });
          return;
        }
        if (intent === 'emr' && !current.organizations.some((membership) => membership.status === 'ACTIVE' && membership.organization.type !== 'PHARMACY')) throw new Error('This account has no active EMR organization membership.');
        navigate('/identity/account', { replace: true });
      }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign-in failed.'); }
      finally { setBusy(false); }
      return;
    }
    const result = await signIn({ email, password, rememberMe });
    setBusy(false);
    if (result.status === "ERROR") return setError(result.message);
    if (result.status === "MFA") return navigate(`/mfa?context=${intent}`);
    if (!hasPortalAccess(intent)) { useAuth.getState().signOut(); return setError(portalAccessError(intent)); }
    const destination = hasPharmacyPortalAccess(useAuth.getState().activeMembership) ? "/pharmacy-portal" : result.destination;
    navigate(destination, { replace: true });
  }

  return <SabiIdLayout title={intent === "platform" ? "Command Center sign in" : intent === "emr" ? "Sabi EMR sign in" : "Sign in to Sabi"} copy={intent === "platform" ? "For authorized Sabi platform staff. Organization and patient accounts cannot enter this workspace." : intent === "emr" ? "Use your healthcare organization's Sabi ID to access its EMR workspace." : "Use one identity for every Sabi product and organization you are authorized to access."}><form className="space-y-4" onSubmit={submit}><label className="block"><span className="label">Email</span><input className="input" required type="email" autoComplete="username" value={email} onChange={(e)=>setEmail(e.target.value)}/></label><label className="block"><span className="label">Password</span><input className="input" required type="password" autoComplete="current-password" value={password} onChange={(e)=>setPassword(e.target.value)}/></label><div className="flex items-center justify-between gap-4"><label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={rememberMe} onChange={(e)=>setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-emerald-600"/> Remember me</label><Link className="text-sm font-bold text-brand-700" to="/forgot-password">Forgot password?</Link></div>{error&&<p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}<button disabled={busy} className="public-button-primary w-full" type="submit">{busy?<Loader2 size={16} className="animate-spin"/>:<ArrowRight size={16}/>} {busy?"Checking identity…":"Sign In"}</button>{!apiConfigured && <Link to="/sso" className="public-button-secondary w-full"><Fingerprint size={16}/> Use organization SSO</Link>}</form>{!apiConfigured && authed && !hasPortalAccess(intent) && <button type="button" onClick={() => useAuth.getState().signOut()} className="mt-5 text-sm font-bold text-red-700">Sign out of the current account to switch</button>}{developmentFixturesEnabled&&!apiConfigured&&<><div className="my-7 flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-300"><span className="h-px flex-1 bg-slate-100"/>Development identities<span className="h-px flex-1 bg-slate-100"/></div><div className="grid gap-2">{demoIdentityOptions.filter((option)=>intent === "platform" ? option.id === "id-platform-ada" : intent === "emr" ? option.id !== "id-platform-ada" && option.id !== "id-owner-haven" && option.id !== "id-patient-zoe" : option.id !== "id-owner-haven").map((option)=><button type="button" key={option.id} onClick={()=>{setEmail(option.email);setPassword(DEMO_PASSWORD);setError("");}} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${email===option.email?"border-brand-300 bg-brand-50":"border-slate-200 hover:border-brand-200"}`}><span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-brand-700 ring-1 ring-slate-200"><CircleUserRound size={17}/></span><span className="min-w-0 flex-1"><b className="block truncate text-sm text-slate-800">{option.name}</b><span className="block truncate text-xs text-slate-400">{option.label}</span></span><ChevronRight size={15} className="text-slate-300"/></button>)}</div></>}{intent === "platform" ? <p className="mt-7 text-center text-sm text-slate-500">Command Center accounts are assigned by Sabi operations. Standard registration does not grant platform access.</p> : <p className="mt-7 text-center text-sm text-slate-500">New to Sabi? <Link to="/register" className="font-bold text-brand-700">Create an account</Link></p>}</SabiIdLayout>;
}

export function LiveIdentityPage() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState<LiveIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { restoreLiveIdentity().then(setCurrent).finally(() => setLoading(false)); }, []);
  if (loading) return <SabiIdLayout title="Checking Sabi ID" copy="Restoring your central identity session."><Loader2 className="animate-spin" /></SabiIdLayout>;
  if (!current) return <Navigate to="/login" replace />;
  return <SabiIdLayout title="Your Sabi ID" copy="Your identity and organization memberships come from the central backend. Product workspaces will open once their tenant-scoped APIs are connected.">
    <p className="text-sm text-slate-600">Signed in as <b>{current.user.email}</b></p>
    <div className="mt-5 space-y-3">
      {current.platformAssigned && <div className="rounded-xl border border-slate-200 p-4"><b>Command Center</b><p className="mt-1 text-xs text-slate-500">{current.platform ? current.platform.roles.join(', ') : 'Platform assignment verified; authenticator required'}</p><Link className="mt-3 inline-block text-sm font-bold text-brand-700" to={current.platform ? '/command-center' : '/identity/mfa?next=command-center'}>{current.platform ? 'Open Command Center' : 'Set up or verify authenticator'}</Link></div>}
      {current.organizations.map((membership) => <div key={membership.id} className="rounded-xl border border-slate-200 p-4"><b>{membership.organization.name}</b><p className="mt-1 text-xs text-slate-500">{membership.organization.type} · {membership.roles.join(', ')} · {membership.status}</p><p className="mt-2 text-xs text-amber-700">Workspace data connection pending</p></div>)}
    </div>
    <Link to="/identity/mfa" className="public-button-primary mt-6 w-full">Manage authenticator</Link>
    <button className="public-button-secondary mt-3 w-full" onClick={async () => { await liveSignOut(); navigate('/login', { replace: true }); }}>Sign out</button>
  </SabiIdLayout>;
}

export function MfaPage() { return apiConfigured ? <LiveMfaPage /> : <FixtureMfaPage />; }

function LiveMfaPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [value, setValue] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!hasPendingLiveMfa()) return <Navigate to="/login" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const current = await liveVerifyMfa(value, recovery);
      const context = searchParams.get('context');
      if (context === 'platform') {
        if (!current.platformAssigned) { await liveSignOut(); throw new Error('This account does not have Command Center access.'); }
        navigate(current.platform ? '/command-center' : '/identity/mfa?next=command-center', { replace: true });
        return;
      }
      if (context === 'pharmacy' && !current.organizations.some((membership) => membership.status === 'ACTIVE' && membership.organization.type === 'PHARMACY')) throw new Error('This account has no active pharmacy membership.');
      if (context === 'emr' && !current.organizations.some((membership) => membership.status === 'ACTIVE' && membership.organization.type !== 'PHARMACY')) throw new Error('This account has no active EMR membership.');
      navigate('/identity/account', { replace: true });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Verification failed.'); }
    finally { setBusy(false); }
  }
  return <SabiIdLayout title="Verify it’s you" copy="Use your authenticator app or one unused recovery code to complete Sabi ID sign-in."><form onSubmit={submit} className="space-y-4"><label className="block"><span className="label">{recovery ? 'Recovery code' : 'Six-digit authenticator code'}</span><input className="input" required autoComplete="one-time-code" inputMode={recovery ? 'text' : 'numeric'} value={value} onChange={(event) => setValue(recovery ? event.target.value : event.target.value.replace(/\D/g, '').slice(0, 6))} /></label>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}<button className="public-button-primary w-full" disabled={busy || (!recovery && value.length !== 6)}>{busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} Verify and continue</button><button type="button" className="public-button-secondary w-full" onClick={() => { setRecovery(!recovery); setValue(''); setError(''); }}>{recovery ? 'Use authenticator app' : 'Use a recovery code'}</button></form></SabiIdLayout>;
}

function FixtureMfaPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const context = searchParams.get("context");
  const pending = useAuth((state)=>state.pendingMfa);
  const verifyMfa = useAuth((state)=>state.verifyMfa);
  const [code,setCode]=useState(developmentFixturesEnabled?"246810":""); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  if(!pending) return <Navigate to={context === "platform" ? "/command-center/login" : context === "pharmacy" ? "/pharmacy/login" : "/login"} replace/>;
  async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError("");const result=await verifyMfa(code);setBusy(false);if(result.status==="ERROR")return setError(result.message);if(result.status==="MFA")return setError("A new challenge is required.");const intent = context === "platform" || context === "emr" || context === "pharmacy" ? context : "shared";if(!hasPortalAccess(intent)){useAuth.getState().signOut();return setError(portalAccessError(intent));}const destination=intent === "platform" ? "/command-center" : intent === "pharmacy" || hasPharmacyPortalAccess(useAuth.getState().activeMembership) ? "/pharmacy-portal" : result.destination;navigate(destination,{replace:true});}
  return <SabiIdLayout title="Verify it’s you" copy={`Enter the verification code for ${pending.identity.email}.`}><form onSubmit={submit} className="space-y-4">{developmentFixturesEnabled&&<div className="rounded-2xl bg-brand-50 p-4 text-sm leading-6 text-brand-900"><b>Development authenticator code:</b> 246810.</div>}<label className="block"><span className="label">Six-digit code</span><input value={code} onChange={(e)=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} required inputMode="numeric" autoComplete="one-time-code" className="input text-center font-mono text-2xl tracking-[.35em]"/></label>{error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}<button disabled={busy||code.length!==6} className="public-button-primary w-full">{busy?<Loader2 className="animate-spin" size={16}/>:<ShieldCheck size={16}/>} Verify and continue</button><Link to="/login" className="public-button-secondary w-full">Cancel</Link></form></SabiIdLayout>;
}

export function OrganizationChooserPage() {
  const { authed, identity, memberships, activateMembership } = useAuth();
  const organizations = useCommandCenter((state)=>state.organizations);
  const packages = useCommandCenter((state)=>state.packages);
  const subscriptions = useCommandCenter((state)=>state.subscriptions);
  const [busy,setBusy]=useState(""); const [error,setError]=useState("");
  if(!authed||identity?.kind!=="organization") return <Navigate to="/login" replace/>;
  async function choose(membershipId:string){setBusy(membershipId);setError("");const result=await activateMembership(membershipId);if(result.error){setBusy("");setError(result.error);return;}window.setTimeout(()=>window.location.assign(result.destination??"/workspace"),180);}
  return <SabiIdLayout title="Choose organization" copy="Your Sabi ID belongs to more than one healthcare organization. Select the workspace you want to enter."><div className="space-y-3">{memberships.map((membership)=>{const org=organizations.find((item)=>item.id===membership.organizationId);const subscription=subscriptions.find((item)=>item.organizationId===membership.organizationId);const pkg=packages.find((item)=>item.id===subscription?.packageId);if(!org)return null;return <button disabled={!!busy} onClick={()=>choose(membership.id)} key={membership.id} className="group flex w-full items-center gap-4 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-brand-300 hover:bg-brand-50"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-950 text-brand-300"><Building2 size={21}/></span><span className="min-w-0 flex-1"><b className="block truncate font-display text-base text-slate-900">{org.name}</b><span className="mt-1 block text-xs text-slate-500">{membership.role} · {pkg?.name??"Subscription"}</span><span className="mt-1 block font-mono text-[10px] text-slate-400">{org.tenantId} · {org.state}, {org.country}</span></span>{busy===membership.id?<Loader2 size={17} className="animate-spin text-brand-700"/>:<ChevronRight size={17} className="text-slate-300 transition group-hover:translate-x-1"/>}</button>})}</div>{error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}<div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5"><span className="text-xs text-slate-400">Signed in as {identity.email}</span><SignOutButton/></div></SabiIdLayout>;
}

export function ForgotPasswordPage(){const[email,setEmail]=useState("");const[busy,setBusy]=useState(false);const[sent,setSent]=useState(false);const[error,setError]=useState("");async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError("");try{await identityService.requestPasswordReset(email);setSent(true);}catch(err){setError(err instanceof Error?err.message:"Password recovery is unavailable.");}finally{setBusy(false);}}return <SabiIdLayout title="Reset your password" copy="Enter your Sabi ID email. If an eligible account exists, the identity service will send recovery instructions.">{sent?<SuccessBlock title="Check your email" copy="If an eligible Sabi ID matches that address, recovery instructions have been requested."/>:<form onSubmit={submit} className="space-y-4"><label><span className="label">Email</span><input required type="email" autoComplete="email" className="input" value={email} onChange={(e)=>setEmail(e.target.value)}/></label>{error&&<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{error}</p>}<button disabled={busy} className="public-button-primary w-full">{busy?<Loader2 className="animate-spin" size={16}/>:<KeyRound size={16}/>} Request reset link</button></form>}<Link className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand-700" to="/login"><ArrowLeft size={14}/>Return to sign in</Link></SabiIdLayout>}

export function SsoPage(){const[email,setEmail]=useState("");const[busy,setBusy]=useState(false);const[result,setResult]=useState<{configured:boolean;message:string}>();async function submit(e:FormEvent){e.preventDefault();setBusy(true);setResult(await identityService.requestSso(email));setBusy(false);}return <SabiIdLayout title="Use organization SSO" copy="Enter your work email to discover whether your organization has a configured enterprise identity connection."><form onSubmit={submit} className="space-y-4"><label><span className="label">Work email</span><input required type="email" className="input" value={email} onChange={(e)=>setEmail(e.target.value)}/></label>{result&&<p className={`rounded-xl p-4 text-sm font-semibold ${result.configured?"bg-brand-50 text-brand-800":"bg-amber-50 text-amber-800"}`}>{result.message}</p>}<button disabled={busy} className="public-button-primary w-full">{busy?<Loader2 className="animate-spin" size={16}/>:<Fingerprint size={16}/>} Continue with SSO</button></form><p className="mt-4 text-xs leading-5 text-slate-400">Discovery only. A production identity service must perform signed OIDC/SAML redirects, validate responses and enforce organization policy.</p><Link className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand-700" to="/login"><ArrowLeft size={14}/>Use email and password</Link></SabiIdLayout>}

export function SessionsPage(){const{authed,identity,session,signOut}=useAuth();if(!authed||!identity)return <Navigate to="/login" replace/>;return <SabiIdLayout title="Sessions & devices" copy="Review the session currently associated with your Sabi ID."><div className="rounded-2xl border border-brand-200 bg-brand-50 p-5"><div className="flex items-start gap-4"><span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-brand-700"><MonitorSmartphone/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b>This browser</b><span className="rounded-full bg-brand-600 px-2 py-0.5 text-[9px] font-bold uppercase text-white">Current</span></div><p className="mt-2 text-xs text-slate-500">Signed in {session?new Date(session.createdAt).toLocaleString():"recently"}</p><p className="mt-1 text-xs text-slate-500">Expires {session?new Date(session.expiresAt).toLocaleString():"when the session ends"}</p></div></div></div><div className="mt-5 rounded-xl border border-slate-200 p-4 text-sm text-slate-500">Account-wide session history is unavailable until the identity service is connected.</div><button onClick={()=>{signOut();window.location.assign("/login");}} className="mt-6 public-button-secondary w-full text-red-700"><LockKeyhole size={16}/>Revoke this session and sign out</button></SabiIdLayout>}

export function PatientPortalPage(){const{authed,identity}=useAuth();if(!authed||identity?.kind!=="patient")return <Navigate to="/login" replace/>;return <SabiIdLayout title="Sabi Health for patients" copy="Patient services remain separate from healthcare-organization workspaces."><div className="rounded-2xl bg-slate-950 p-6 text-white"><p className="text-xs font-bold uppercase tracking-widest text-brand-300">Patient account</p><h3 className="mt-3 font-display text-2xl font-bold">Welcome, {identity.name.split(" ")[0]}.</h3><p className="mt-3 text-sm leading-6 text-white/55">Clinical records and virtual-care data are unavailable until their backend services are connected.</p></div><div className="mt-5 grid grid-cols-2 gap-3">{["Health records","Prescriptions","Care reminders","Virtual care"].map((item)=><div key={item} className="rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-500">{item}<span className="mt-2 block text-[9px] font-bold uppercase text-amber-700">Service unavailable</span></div>)}</div><div className="mt-6 flex gap-3"><Link to="/products/sabi-health" className="public-button-primary flex-1">View service status</Link><SignOutButton/></div></SabiIdLayout>}

export function InvitePage(){return <SabiIdLayout title="Accept invitation" copy="Organization invitations connect an existing or new Sabi ID to a specific membership and role."><div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900"><b>No valid invitation was supplied.</b><br/>Production invitations must be single-use, time-bound and verified by the identity backend before membership activation.</div><Link to="/login" className="mt-5 public-button-primary w-full">Sign in to continue <ArrowRight size={16}/></Link></SabiIdLayout>}

function SuccessBlock({title,copy}:{title:string;copy:string}){return <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-600 text-white"><Check/></span><h3 className="mt-4 font-display text-xl font-bold text-brand-950">{title}</h3><p className="mt-2 text-sm leading-6 text-brand-900/65">{copy}</p></div>}
function SignOutButton(){const signOut=useAuth((state)=>state.signOut);return <button onClick={()=>{signOut();window.location.assign("/login");}} className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:border-red-200 hover:text-red-700">Sign out</button>}
