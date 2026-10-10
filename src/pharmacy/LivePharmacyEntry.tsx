import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { restoreLiveIdentity, liveSignOut } from "@/identity/liveIdentity";
import { getLive, writeLive } from "./liveApi";
import LivePharmacyPortal from "./LivePharmacyPortal";
import PharmacistWorkspace from "./PharmacistWorkspace";
import PharmacyStaffWorkspace from "./PharmacyStaffWorkspace";
type Workspace = {
  id: string;
  name: string;
  kind: "OWNER" | "PHARMACIST" | "STAFF";
};
type Workspaces = {
  items: Workspace[];
  invitations: { id: string; pharmacy: { name: string } }[];
};
export default function LivePharmacyEntry() {
  const navigate = useNavigate();
  const [data, setData] = useState<Workspaces | null>(null),
    [selected, setSelected] = useState<Workspace | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    const result = await getLive<Workspaces>(
      "/api/v1/pharmacy-portal/workspaces",
    );
    setData(result);
    if (result.items.length === 1 && !result.invitations.length)
      setSelected(result.items[0]);
  }
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!(await restoreLiveIdentity())) {
        navigate("/pharmacy/login", { replace: true });
        return;
      }
      if (mounted) await refresh();
    })().catch((e) => {
      if (mounted) setError(e.message);
    });
    return () => {
      mounted = false;
    };
  }, [navigate]);
  if (selected)
    return (
      <>
        {selected.kind === "STAFF" && (
          <button
            className="min-h-11 w-full border-b bg-white px-4 text-right font-semibold"
            onClick={async () => {
              await liveSignOut();
              navigate("/pharmacy/login", { replace: true });
            }}
          >
            Sign out
          </button>
        )}
        {data && data.items.length > 1 && (
          <button
            className="min-h-11 w-full border-b bg-[#edf5ef] px-4 py-2 text-sm font-semibold text-[#17342a]"
            onClick={() => setSelected(null)}
          >
            Switch pharmacy workspace
          </button>
        )}
        {selected.kind === "OWNER" ? (
          <LivePharmacyPortal />
        ) : selected.kind === "STAFF" ? (
          <PharmacyStaffWorkspace pharmacy={selected} />
        ) : (
          <PharmacistWorkspace pharmacy={selected} />
        )}
      </>
    );
  return (
    <main className="min-h-screen bg-[#f5f8f4] p-5 text-[#17342a] sm:p-10">
      <div className="mx-auto max-w-3xl space-y-5">
        <h1 className="font-display text-3xl font-bold">Sabi Pharmacy</h1>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
            {error}
          </p>
        )}
        {!data && !error && <p role="status">Loading your pharmacy access…</p>}
        {data?.items.map((item) => (
          <button
            key={`${item.id}:${item.kind}`}
            className="flex min-h-20 w-full items-center justify-between rounded-2xl border bg-white p-5 text-left"
            onClick={() => setSelected(item)}
          >
            <span className="font-bold">{item.name}</span>
            <span>
              {item.kind === "OWNER"
                ? "Organization management"
                : item.kind === "STAFF"
                  ? "Inventory access"
                  : "Pharmacist workspace"}
            </span>
          </button>
        ))}
        {data?.invitations.map((invite) => (
          <section key={invite.id} className="rounded-2xl border bg-white p-5">
            <h2 className="font-bold">
              Pharmacist invitation · {invite.pharmacy.name}
            </h2>
            <button
              className="mt-4 min-h-11 rounded-xl bg-[#0d2c22] px-5 text-white disabled:opacity-50"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await writeLive(
                    `/api/v1/pharmacy-portal/pharmacists/${invite.id}/accept`,
                    {},
                  );
                  await refresh();
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Could not accept the invitation.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Accept pharmacy membership
            </button>
          </section>
        ))}
        {data && !data.items.length && !data.invitations.length && (
          <p>
            No eligible pharmacy workspace is connected to this account.
            Clinical tools require an active membership and a verified
            pharmacist profile.
          </p>
        )}
        <button
          className="min-h-11 rounded-xl border px-5"
          onClick={async () => {
            await liveSignOut();
            navigate("/pharmacy/login", { replace: true });
          }}
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
