import { useEffect, useRef, useState } from "react";
import { liveApiRequest } from "@/identity/liveIdentity";
import {
  CommandPageHeader,
  Panel,
  PanelHeader,
  StatusPill,
} from "./components/ui";
type AccountStatus =
  | "PENDING"
  | "ACTIVE"
  | "SUSPENDED"
  | "LOCKED"
  | "DISABLED"
  | "DEACTIVATED"
  | "BANNED";
type DirectoryUser = {
  id: string;
  email: string;
  full_name: string | null;
  accountStatus: AccountStatus;
  roles: { role: string }[];
  platformRoleAssignments: { roleCode: string }[];
  identityMemberships: {
    id: string;
    status: string;
    roles: { roleCode: string }[];
    organization: {
      id: string;
      type: string;
      organisation: { name: string } | null;
      pharmacy: { name: string } | null;
    };
  }[];
};
export default function LiveUsersPage({
  canManage,
  currentUserId,
}: {
  canManage: boolean;
  currentUserId: string;
}) {
  const [items, setItems] = useState<DirectoryUser[]>([]),
    [page, setPage] = useState(1),
    [nextPage, setNextPage] = useState<number | null>(null);
  const [search, setSearch] = useState(""),
    [platform, setPlatform] = useState(""),
    [status, setStatus] = useState("");
  const [applied, setApplied] = useState({
      search: "",
      platform: "",
      status: "",
    }),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [selected, setSelected] = useState<DirectoryUser | null>(null),
    [decision, setDecision] = useState<
      "ACTIVE" | "SUSPENDED" | "DISABLED" | "BANNED"
    >("SUSPENDED"),
    [reason, setReason] = useState("");
  const confirmation = useRef<HTMLHeadingElement>(null);
  const [courierUser, setCourierUser] = useState<DirectoryUser | null>(null),
    [courierName, setCourierName] = useState(""),
    [courierActive, setCourierActive] = useState(true);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    const query = new URLSearchParams({
      page: String(page),
      ...Object.fromEntries(
        Object.entries(applied).filter(([, value]) => value),
      ),
    });
    liveApiRequest<{
      data: { items: DirectoryUser[]; nextPage: number | null };
    }>(`/api/v1/platform/users?${query}`)
      .then((r) => {
        if (current) {
          setItems(r.data.items);
          setNextPage(r.data.nextPage);
        }
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [page, applied]);
  useEffect(() => {
    if (selected) confirmation.current?.focus();
  }, [selected]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      await liveApiRequest(`/api/v1/platform/users/${selected.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: decision,
          expectedStatus: selected.accountStatus,
          reason,
        }),
      });
      setItems((rows) =>
        rows.map((row) =>
          row.id === selected.id ? { ...row, accountStatus: decision } : row,
        ),
      );
      setMessage(
        `Account set to ${decision.toLowerCase()}. Existing sessions were revoked.`,
      );
      setSelected(null);
      setReason("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not update this account.",
      );
    } finally {
      setBusy(false);
    }
  }
  const input =
    "mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600";
  return (
    <>
      <CommandPageHeader
        eyebrow="Administration · All Sabi"
        title="User directory"
        description="One account directory across patients, practitioners and organization teams. Access decisions are audited; clinical records are not exposed here."
      />
      {message && (
        <p
          role="status"
          className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900"
        >
          {message}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      <Panel>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setApplied({ search, platform, status });
          }}
          className="grid gap-3 p-5 sm:grid-cols-4"
        >
          <label className="text-sm font-semibold">
            Name or email
            <input
              className={input}
              type="search"
              maxLength={100}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="text-sm font-semibold">
            Platform
            <select
              className={input}
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
            >
              <option value="">All platforms</option>
              {["PATIENT", "DOCTOR", "PHARMACY", "HOSPITAL", "PLATFORM"].map(
                (p) => (
                  <option key={p}>{p}</option>
                ),
              )}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Account status
            <select
              className={input}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              {[
                "PENDING",
                "ACTIVE",
                "SUSPENDED",
                "LOCKED",
                "DISABLED",
                "DEACTIVATED",
                "BANNED",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <button
            disabled={loading || busy}
            className="min-h-11 self-end rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            Apply filters
          </button>
        </form>
      </Panel>
      {courierUser && (
        <Panel className="mt-4">
          <PanelHeader title="Configure delivery partner" />
          <form
            className="space-y-4 p-5"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              setMessage("");
              try {
                await liveApiRequest(
                  `/api/v1/delivery/platform/partners/${courierUser.id}`,
                  {
                    method: "PUT",
                    body: JSON.stringify({
                      displayName: courierName.trim(),
                      isActive: courierActive,
                    }),
                  },
                );
                setMessage(
                  courierActive
                    ? "Courier activated. They can sign in at the pharmacy delivery partner page."
                    : "Courier deactivated. Assignment access is blocked.",
                );
                setCourierUser(null);
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Could not configure courier.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="break-words font-semibold">{courierUser.email}</p>
            <p className="text-sm text-slate-600">
              This changes delivery partner access only. Recent MFA is required;
              activation is audited.
            </p>
            <label className="block text-sm font-semibold">
              Courier display name
              <input
                className={input}
                required
                minLength={2}
                maxLength={120}
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="block text-sm font-semibold">
              Delivery access
              <select
                className={input}
                value={courierActive ? "active" : "inactive"}
                onChange={(e) => setCourierActive(e.target.value === "active")}
                disabled={busy}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                disabled={busy}
                className="min-h-11 rounded-lg bg-emerald-700 px-4 font-bold text-white"
              >
                {busy ? "Saving…" : "Save courier access"}
              </button>
              <button
                type="button"
                className="min-h-11 rounded-lg border px-4"
                disabled={busy}
                onClick={() => setCourierUser(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </Panel>
      )}
      {selected && (
        <Panel className="mt-4">
          <PanelHeader title="Confirm account access decision" />
          <form className="space-y-4 p-5" onSubmit={save}>
            <h2
              ref={confirmation}
              tabIndex={-1}
              className="break-words font-semibold outline-none"
            >
              {selected.email}
            </h2>
            <p className="text-sm text-slate-600">
              This applies to every Sabi surface using this identity. No account
              or medical record is deleted.
            </p>
            <label className="block text-sm font-semibold">
              New status
              <select
                className={input}
                value={decision}
                onChange={(e) => setDecision(e.target.value as typeof decision)}
              >
                {["SUSPENDED", "DISABLED", "BANNED", "ACTIVE"]
                  .filter((s) => s !== selected.accountStatus)
                  .map((s) => (
                    <option key={s}>{s}</option>
                  ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Reason for audit
              <textarea
                required
                minLength={10}
                maxLength={1000}
                className={input}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div className="flex gap-3">
              <button
                disabled={busy}
                className="min-h-11 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : "Confirm decision"}
              </button>
              <button
                disabled={busy}
                type="button"
                className="min-h-11 rounded-lg border px-4"
                onClick={() => setSelected(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </Panel>
      )}
      <Panel className="mt-4">
        <PanelHeader title="Registered identities" />
        {loading ? (
          <p role="status" className="p-5">
            Loading accounts…
          </p>
        ) : !items.length ? (
          <p className="p-5 text-slate-600">No accounts match these filters.</p>
        ) : (
          <div className="divide-y divide-slate-200">
            {items.map((user) => (
              <article
                key={user.id}
                className="flex flex-wrap items-start justify-between gap-4 p-5"
              >
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold [overflow-wrap:anywhere]">
                    {user.full_name || user.email}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 [overflow-wrap:anywhere]">
                    {user.email}
                  </p>
                  <p className="mt-2 text-xs text-slate-600">
                    {[
                      ...user.roles.map((r) => r.role),
                      ...user.platformRoleAssignments.map((r) => r.roleCode),
                    ].join(" · ") || "Organization member"}
                  </p>
                  {user.identityMemberships.map((m) => (
                    <p key={m.id} className="mt-1 text-xs text-slate-600">
                      {m.organization.organisation?.name ||
                        m.organization.pharmacy?.name}{" "}
                      · {m.organization.type} · {m.status} ·{" "}
                      {m.roles.map((r) => r.roleCode).join(", ")}
                    </p>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={user.accountStatus} />
                  {canManage &&
                    user.id !== currentUserId &&
                    user.accountStatus === "ACTIVE" && (
                      <button
                        className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold"
                        disabled={busy}
                        onClick={() => {
                          setCourierUser(user);
                          setCourierName(user.full_name || "");
                          setCourierActive(true);
                          setMessage("");
                        }}
                      >
                        Courier access
                      </button>
                    )}
                  {canManage && user.id !== currentUserId && (
                    <button
                      disabled={busy}
                      onClick={() => {
                        setSelected(user);
                        setDecision(
                          user.accountStatus === "SUSPENDED"
                            ? "ACTIVE"
                            : "SUSPENDED",
                        );
                        setReason("");
                        setMessage("");
                      }}
                      className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold"
                    >
                      Manage access
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between border-t p-4">
          <button
            disabled={loading || page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="min-h-11 rounded-lg border px-4 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm">Page {page}</span>
          <button
            disabled={loading || !nextPage}
            onClick={() => nextPage && setPage(nextPage)}
            className="min-h-11 rounded-lg border px-4 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </Panel>
    </>
  );
}
