import { useMemo, useState, type ReactNode } from "react";
import { Building2, Check, ReceiptText, ShieldCheck } from "lucide-react";
import { usePharmacyCatalogue, type PharmacyProfile } from "./catalogue";

const emptyProfile = (organizationId: string, organizationName: string): PharmacyProfile => ({
  organizationId,
  legalName: organizationName,
  licenceNumber: "",
  superintendentPharmacist: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  defaultReorderLevel: 10,
  receiptFooter: "Thank you for choosing our pharmacy.",
});

export function SettingsView({ organizationId, organizationName }: { organizationId: string; organizationName: string }) {
  const profiles = usePharmacyCatalogue((state) => state.profiles);
  const stored = useMemo(() => (profiles ?? []).find((profile) => profile.organizationId === organizationId), [profiles, organizationId]);
  const setProfile = usePharmacyCatalogue((state) => state.setProfile);
  const [profile, setDraft] = useState<PharmacyProfile>(stored ?? emptyProfile(organizationId, organizationName));
  const [saved, setSaved] = useState(false);
  const set = (patch: Partial<PharmacyProfile>) => { setDraft((current) => ({ ...current, ...patch })); setSaved(false); };
  const save = () => { setProfile(profile); setSaved(true); };

  return <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
    <div className="rounded-[24px] border border-[#dbe9e2] bg-white p-6">
      <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e8f5ef] text-[#0b8a63]"><Building2 size={18}/></span><div><p className="text-xs font-extrabold uppercase tracking-wider text-[#b06d10]">Organization profile</p><h2 className="mt-1 font-display text-xl font-bold text-[#17342a]">Pharmacy identity and contact</h2><p className="mt-1 text-xs leading-5 text-[#70877d]">These details belong only to this pharmacy tenant and support receipts, marketplace verification and branch operations.</p></div></div>
      {saved && <div className="mt-5 flex items-center gap-2 rounded-xl bg-[#eaf8f2] px-4 py-3 text-xs font-bold text-[#087f5b]"><Check size={15}/> Settings saved for this pharmacy.</div>}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Registered pharmacy name" wide><input value={profile.legalName} onChange={(event) => set({ legalName: event.target.value })} className={control}/></Field>
        <Field label="PCN licence number"><input value={profile.licenceNumber} onChange={(event) => set({ licenceNumber: event.target.value })} className={control} placeholder="e.g. PCN-PHA-2026-001"/></Field>
        <Field label="Superintendent pharmacist"><input value={profile.superintendentPharmacist} onChange={(event) => set({ superintendentPharmacist: event.target.value })} className={control}/></Field>
        <Field label="Business email"><input type="email" value={profile.email} onChange={(event) => set({ email: event.target.value })} className={control}/></Field>
        <Field label="Business phone"><input value={profile.phone} onChange={(event) => set({ phone: event.target.value })} className={control}/></Field>
        <Field label="Street address" wide><input value={profile.address} onChange={(event) => set({ address: event.target.value })} className={control}/></Field>
        <Field label="City"><input value={profile.city} onChange={(event) => set({ city: event.target.value })} className={control}/></Field>
        <Field label="State"><input value={profile.state} onChange={(event) => set({ state: event.target.value })} className={control}/></Field>
      </div>
      <button type="button" onClick={save} disabled={!profile.legalName.trim()} className="mt-6 flex items-center gap-2 rounded-xl bg-[#0d2c22] px-5 py-3 text-xs font-bold text-white disabled:opacity-40"><Check size={15}/> Save organization settings</button>
    </div>

    <div className="space-y-5">
      <div className="rounded-[24px] border border-[#dbe9e2] bg-white p-6"><div className="flex items-center gap-2"><ShieldCheck size={18} className="text-[#0b8a63]"/><h2 className="font-display text-lg font-bold text-[#17342a]">Inventory policy</h2></div><label className="mt-5 block"><span className="mb-1.5 block text-xs font-bold text-[#5b766a]">Default low-stock level</span><input type="number" min="0" value={profile.defaultReorderLevel} onChange={(event) => set({ defaultReorderLevel: Number(event.target.value) })} className={control}/><span className="mt-1.5 block text-[11px] leading-4 text-[#82958c]">New products use this threshold unless you choose another value.</span></label></div>
      <div className="rounded-[24px] border border-[#dbe9e2] bg-white p-6"><div className="flex items-center gap-2"><ReceiptText size={18} className="text-[#b06d10]"/><h2 className="font-display text-lg font-bold text-[#17342a]">Receipt setup</h2></div><label className="mt-5 block"><span className="mb-1.5 block text-xs font-bold text-[#5b766a]">Receipt footer</span><textarea rows={4} value={profile.receiptFooter} onChange={(event) => set({ receiptFooter: event.target.value })} className={control}/></label><p className="mt-3 rounded-xl bg-[#f7faf8] p-3 text-[11px] leading-5 text-[#70877d]">Payment provider, settlement account and tax settings will become server-controlled when the finance backend is connected.</p></div>
    </div>
  </div>;
}

const control = "w-full rounded-xl border border-[#cfe0d8] bg-[#fbfefc] px-3 py-3 text-sm text-[#17342a] outline-none transition focus:border-[#0b8a63] focus:ring-2 focus:ring-[#0b8a63]/10";

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <label className={wide ? "block sm:col-span-2" : "block"}><span className="mb-1.5 block text-xs font-bold text-[#5b766a]">{label}</span>{children}</label>;
}
