import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Truck, ShieldCheck, PackageCheck, LogOut } from "lucide-react";
import { apiConfigured } from "@/config/runtime";
import {
  liveSignIn,
  liveSignOut,
  restoreLiveIdentity,
} from "@/identity/liveIdentity";
import { getLive, writeLive } from "./liveApi";
import { deliveryButton, deliveryInput } from "./deliveryUi";
import { IdleSignOutNotice } from "@/identity/IdleSessionGuard";

type Assignment = {
  id: string;
  reference: string;
  assignmentStatus: string;
  fulfilmentStatus: string;
  pickup: { name: string; address: string; contactPhone: string };
  recipient?: {
    recipientName: string;
    recipientPhone: string;
    address: string;
  };
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
};
export default function CourierPortal() {
  const navigate = useNavigate();
  const pendingAction = useRef(false);
  const [authenticated, setAuthenticated] = useState(false),
    [restoring, setRestoring] = useState(true);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState("");
  const [items, setItems] = useState<Assignment[]>([]),
    [selected, setSelected] = useState<Assignment | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const load = useCallback(async () => {
    setItems(await getLive<Assignment[]>("/api/v1/delivery/assignments"));
  }, []);
  useEffect(() => {
    let active = true;
    if (!apiConfigured) {
      return;
    }
    restoreLiveIdentity()
      .then(async (identity) => {
        if (!active) return;
        if (identity) {
          setAuthenticated(true);
          await load();
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setRestoring(false);
      });
    return () => {
      active = false;
    };
  }, [load]);
  async function run(work: () => Promise<void>) {
    if (pendingAction.current) return;
    pendingAction.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Delivery service unavailable.",
      );
    } finally {
      pendingAction.current = false;
      setBusy(false);
    }
  }
  async function action(kind: string, body: Record<string, unknown> = {}) {
    if (!selected) return;
    const id = selected.id;
    const confirmed = await writeLive<{assignmentStatus:string; fulfilmentStatus:string}>(`/api/v1/delivery/assignments/${id}/${kind}`, body);
    setCode("");
    setSelected({...selected, assignmentStatus:confirmed.assignmentStatus, fulfilmentStatus:confirmed.fulfilmentStatus, ...(confirmed.assignmentStatus === 'COMPLETED' ? {recipient:undefined}: {})});
    setMessage(
      kind === "accept"
        ? "Collection accepted."
        : kind === "reject"
          ? "Assignment declined."
          : body.status === 'PICKED_UP' ? 'Package collected successfully.' : body.status === 'DELIVERED' ? 'Package delivered successfully.' : 'Delivery started successfully.',
    );
    try {
      setSelected(await getLive<Assignment>(`/api/v1/delivery/assignments/${id}`));
      await load();
    } catch { throw new Error('Handover saved. Could not refresh delivery details; use Refresh.'); }
  }
  const stage =
    selected?.fulfilmentStatus === "READY_FOR_PICKUP"
      ? "collection"
      : "delivery";
  return (
    <main className="min-h-screen bg-[#f5f8f4] p-4 text-[#17342a] sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#0d2c22] p-6 text-white">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Truck size={20} aria-hidden="true" /> Sabi Pharmacy
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold">
              Delivery partner
            </h1>
            <p className="mt-2 text-sm text-[#dbe9e2]">
              Secure collection. Confirmed delivery.
            </p>
          </div>
          {authenticated && (
            <button
              className="flex min-h-11 items-center gap-2 rounded-xl border border-white/40 px-4"
              onClick={() =>
                run(async () => {
                  await liveSignOut();
                  setAuthenticated(false);
                  setSelected(null);
                  setItems([]);
                })
              }
            >
              <LogOut size={18} aria-hidden="true" />
              Sign out
            </button>
          )}
        </header>
      {error && !selected && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
          >
            {error}
          </p>
        )}
        <IdleSignOutNotice />
        {message && (
          <p
            role="status"
            className="rounded-xl border border-green-200 bg-green-50 p-4"
          >
            {message}
          </p>
        )}
        {!apiConfigured ? (
          <section className="rounded-2xl border bg-white p-6">
            <h2 className="text-xl font-bold">API connection required</h2>
            <p className="mt-2">
              Courier handover uses the pharmacy backend. This local-storage
              preview cannot verify real collection or delivery codes.
            </p>
            <Link
              className="mt-4 inline-flex min-h-11 items-center underline"
              to="/pharmacy/login"
            >
              Back to pharmacy
            </Link>
          </section>
        ) : restoring ? (
          <p role="status">Restoring your session…</p>
        ) : !authenticated ? (
          <form
            className="mx-auto max-w-md space-y-5 rounded-2xl border bg-white p-6"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const result = await liveSignIn(email, password);
                setPassword("");
                if (result.kind === "MFA") {
                  navigate("/mfa?context=courier");
                  return;
                }
                if (!result.identity.user.roles.includes("DELIVERY_PARTNER"))
                  throw new Error(
                    "Sabi operations must activate your delivery partner account.",
                  );
                await load();
                setAuthenticated(true);
                navigate("/pharmacy/courier", { replace: true });
              });
            }}
          >
            <h2 className="text-xl font-bold">Courier sign in</h2>
            <label className="block">
              Email address
              <input
                className={deliveryInput}
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="block">
              Password
              <input
                className={deliveryInput}
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            </label>
            <button className={`${deliveryButton} w-full`} disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <Link
              className="inline-flex min-h-11 items-center underline"
              to="/forgot-password"
            >
              Forgot password?
            </Link>
          </form>
        ) : (
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <section className="rounded-2xl border bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold">Your assignments</h2>
                <button
                  className="min-h-11 rounded-xl border px-3"
                  disabled={busy}
                onClick={() => run(async () => { await load(); if(selected) setSelected(await getLive(`/api/v1/delivery/assignments/${selected.id}`)); })}
                >
                  Refresh
                </button>
              </div>
              {!items.length && (
                <p className="mt-5">
                  No active assignments. New collections appear here when a
                  pharmacy assigns them to you.
                </p>
              )}
              <div className="mt-4 space-y-3">
                {items.map((item) => (
                  <button
                    key={item.id}
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        setCode("");
                        setSelected(
                          await getLive(
                            `/api/v1/delivery/assignments/${item.id}`,
                          ),
                        );
                      })
                    }
                    className="min-h-20 w-full rounded-xl border border-[#cfe0d8] p-4 text-left hover:bg-[#f5f8f4]"
                    aria-pressed={selected?.id === item.id}
                  >
                    <span className="block font-bold">{item.reference}</span>
                    <span className="mt-1 block text-sm">
                      {item.pickup.name}
                    </span>
                    <span className="mt-1 block text-sm">
                      {item.fulfilmentStatus.replaceAll("_", " ")}
                    </span>
                  </button>
                ))}
              </div>
            </section>
            <section
              className="min-w-0 rounded-2xl border bg-white p-5"
              aria-label="Assignment details"
            >
              {!selected ? (
                <p>Select an assignment to see its collection details.</p>
              ) : (
                <div className="space-y-5">
                  <div>
                    <h2 className="break-words text-xl font-bold">
                      {selected.reference}
                    </h2>
                    <p className="mt-1">
                      {selected.fulfilmentStatus.replaceAll("_", " ")}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-bold">Collect from</h3>
                    <p>{selected.pickup.name}</p>
                    <p className="break-words">{selected.pickup.address}</p>
                    <p>{selected.pickup.contactPhone}</p>
                  </div>
                  {selected.recipient && (
                    <div>
                      <h3 className="font-bold">Deliver to</h3>
                      <p>{selected.recipient.recipientName}</p>
                      <p className="break-words">
                        {selected.recipient.address}
                      </p>
                      <p>{selected.recipient.recipientPhone}</p>
                    </div>
                  )}
              {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}
              {selected.assignmentStatus === "PENDING" && (
                    <div className="flex flex-wrap gap-3">
                      <button
                        className={deliveryButton}
                        disabled={busy}
                        onClick={() => run(() => action("accept"))}
                      >
                        Accept collection
                      </button>
                      <button
                        className="min-h-11 rounded-xl border px-4"
                        disabled={busy}
                        onClick={() => {
                          const reason = window.prompt(
                            "Reason for declining this assignment",
                          );
                          if (reason?.trim())
                            run(async () => {
                              await writeLive(
                                `/api/v1/delivery/assignments/${selected.id}/reject`,
                                { reason: reason.trim() },
                              );
                              setSelected(null);
                              await load();
                              setMessage("Assignment declined.");
                            });
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  )}
                  {selected.assignmentStatus === "ACCEPTED" &&
                    ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY"].includes(
                      selected.fulfilmentStatus,
                    ) && (
                      <form
                        className="space-y-4 rounded-xl bg-[#f5f8f4] p-4"
                        onSubmit={(e) => {
                          e.preventDefault();
                          run(() =>
                            action("status", {
                              status:
                                stage === "collection"
                                  ? "PICKED_UP"
                                  : "DELIVERED",
                              code,
                            }),
                          );
                        }}
                      >
                        <h3 className="flex items-center gap-2 font-bold">
                          <ShieldCheck size={20} aria-hidden="true" />
                          Confirm {stage}
                        </h3>
                        <p className="text-sm">
                          {stage === "collection"
                            ? "Ask the pharmacy for its collection code when receiving the package."
                            : "Ask the recipient for their delivery code only when handing over the package."}
                        </p>
                        <label className="block" htmlFor="handover-code">
                          Six-digit {stage} code
                        </label>
                        <input
                          id="handover-code"
                          className={`${deliveryInput} font-mono text-xl tracking-widest`}
                          inputMode="numeric"
                          autoComplete="off"
                          pattern="[0-9]{6}"
                          minLength={6}
                          maxLength={6}
                          required
                          value={code}
                          onChange={(e) =>
                            setCode(
                              e.target.value.replace(/\D/g, "").slice(0, 6),
                            )
                          }
                          disabled={busy}
                        />
                        <button
                          className={`${deliveryButton} w-full`}
                          disabled={busy || code.length !== 6}
                        >
                          {busy
                            ? "Verifying…"
                            : stage === "collection"
                              ? "Verify package collected"
                              : "Verify successful delivery"}
                        </button>
                      </form>
                    )}
                  {selected.assignmentStatus === "ACCEPTED" &&
                    selected.fulfilmentStatus === "PICKED_UP" && (
                      <button
                        className={deliveryButton}
                        disabled={busy}
                        onClick={() =>
                          run(() =>
                            action("status", { status: "OUT_FOR_DELIVERY" }),
                          )
                        }
                      >
                        Start delivery
                      </button>
                    )}
                  {selected.pickedUpAt && (
                    <p className="text-sm">
                      Collected:{" "}
                      {new Date(selected.pickedUpAt).toLocaleString()}
                    </p>
                  )}
                  {selected.deliveredAt && (
                    <p className="flex items-center gap-2 font-semibold">
                      <PackageCheck size={20} aria-hidden="true" /> Delivered:{" "}
                      {new Date(selected.deliveredAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
