import { useCallback, useEffect, useState } from "react";
import { Copy, Link2, Mail, Ban } from "lucide-react";
import { Button, Badge } from "@/components/ui/primitives";
import { Field, Select } from "@/components/ui/form";
import { accountingRequest, describeEmrError } from "@/emr-live/client";
import { deliveryText } from "@/accounting-live/receivables";
import { shortDate, dateTime } from "@/lib/format";

// Live: links that let a customer or supplier see their own account (statement, invoices or bills and
// remittance advice, how to pay) without signing in. A new link is shown once — only its hash is kept —
// so copy it (or email it to a customer) then; revoke a link that should stop working.

type Link = { id: string; createdAt: string; createdBy: string; expiresAt: string; lastUsedAt?: string; useCount: number; status: "Active" | "Expired" | "Revoked" };
type Delivery = { status: "QUEUED" | "NOT_SENT"; reason?: "NO_EMAIL_ADDRESS" | "EMAIL_NOT_CONFIGURED" };

export function PortalLinks({ partyKind, partyId, email }: { partyKind: "customer" | "vendor"; partyId: string; email?: string }) {
  const [links, setLinks] = useState<Link[]>([]);
  const [days, setDays] = useState("30");
  const [fresh, setFresh] = useState<{ url: string; note?: string } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await accountingRequest<{ data: { items: Link[] } }>(`/portal-links?partyKind=${partyKind}&partyId=${partyId}`);
      setLinks(data.items);
    } catch (cause) { setNote(describeEmrError(cause)); }
  }, [partyKind, partyId]);
  useEffect(() => { void load(); }, [load]);

  const create = async (send: boolean) => {
    setBusy(true); setNote(""); setFresh(null);
    try {
      const { data } = await accountingRequest<{ data: { url: string; delivery?: Delivery } }>("/portal-links", { method: "POST", body: { partyKind, partyId, days: Number(days), ...(send ? { email: true } : {}) } });
      setFresh({ url: data.url, note: data.delivery ? `Link ${deliveryText(data.delivery, email)}.` : undefined });
      await load();
    } catch (cause) { setNote(describeEmrError(cause)); } finally { setBusy(false); }
  };
  const revoke = async (id: string) => {
    try { await accountingRequest(`/portal-links/${id}/revoke`, { method: "POST", body: {} }); await load(); } catch (cause) { setNote(describeEmrError(cause)); }
  };
  const copy = (url: string) => { void navigator.clipboard?.writeText(url).then(() => setNote("Link copied."), () => setNote("Copy the link from the box above.")); };

  return (
    <div className="space-y-2">
      <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-mist-400"><Link2 size={12} /> Self-service portal</h4>
      <p className="text-xs text-mist-500">{partyKind === "customer" ? "The customer sees their statement, downloads their invoices and finds how to pay — no sign-in." : "The supplier sees their statement, their bills and remittance advice for your payments — no sign-in."}</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-36"><Field label="Valid for"><Select value={days} onChange={(e) => setDays(e.target.value)} options={[["7", "7 days"], ["30", "30 days"], ["90", "90 days"], ["180", "180 days"]].map(([value, label]) => ({ value, label }))} /></Field></div>
        <Button variant="soft" disabled={busy} onClick={() => void create(false)}><Link2 size={14} /> Create link</Button>
        {partyKind === "customer" && email && <Button disabled={busy} onClick={() => void create(true)}><Mail size={14} /> Email link to {email}</Button>}
      </div>
      {fresh && (
        <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm ring-1 ring-brand-200">
          <p className="mb-1 text-xs font-semibold text-brand-800">Copy this link now — it is not shown again.</p>
          <div className="flex items-center gap-2"><input readOnly value={fresh.url} className="input flex-1 font-mono text-xs" onFocus={(e) => e.target.select()} /><Button variant="soft" onClick={() => copy(fresh.url)}><Copy size={14} /> Copy</Button></div>
          {fresh.note && <p className="mt-1 text-xs text-brand-800">{fresh.note}</p>}
        </div>
      )}
      {note && <p className="text-xs text-mist-600">{note}</p>}
      {links.length > 0 && (
        <ul className="divide-y divide-mist-100 rounded-lg ring-1 ring-mist-100">
          {links.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
              <span><Badge tone={l.status === "Active" ? "brand" : "mist"}>{l.status}</Badge> <span className="text-mist-600">by {l.createdBy} · {shortDate(l.createdAt)} · until {shortDate(l.expiresAt)} · {l.useCount ? `opened ${l.useCount}×, last ${dateTime(l.lastUsedAt!)}` : "not opened yet"}</span></span>
              {l.status === "Active" && <button className="btn-ghost px-2 py-1 text-xs text-action-700" onClick={() => void revoke(l.id)}><Ban size={11} /> Revoke</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
