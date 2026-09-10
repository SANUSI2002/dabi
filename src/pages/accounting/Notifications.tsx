import { Bell, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader, Card, Badge, StatCard, EmptyState } from "@/components/ui/primitives";
import { Checkbox } from "@/components/ui/form";
import { useNotifications, NOTIFICATION_LABELS, type NotificationKey } from "@/store/accounting/useNotifications";
import { useIdentity } from "@/store/useIdentity";

const toneFor = (s: string) => (s === "urgent" ? "action" : s === "warn" ? "amber" : "mist") as "action" | "amber" | "mist";

export default function Notifications() {
  const { prefsFor, setPref, alerts } = useNotifications();
  const uid = useIdentity((s) => s.user.id);
  const prefs = prefsFor(uid);
  const list = alerts();
  const nav = useNavigate();

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Accounting alerts derived from live data — choose which ones you want to see" />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Active alerts" value={list.length} tone={list.length ? "action" : "brand"} icon={<Bell size={18} />} />
        <StatCard label="Urgent" value={list.filter((a) => a.severity === "urgent").length} tone="action" delay={0.05} />
        <StatCard label="Categories on" value={Object.values(prefs).filter(Boolean).length} tone="mist" delay={0.1} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="p-0">
          <p className="border-b border-mist-100 px-4 py-2.5 text-sm font-bold text-mist-600">Alerts</p>
          {list.length === 0 ? <EmptyState title="All clear" hint="Nothing needs attention right now." /> : (
            <div className="divide-y divide-mist-100">
              {list.map((a) => (
                <button key={a.id} onClick={() => nav(a.href)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-mist-50/60">
                  <div>
                    <p className="text-sm font-semibold text-mist-800">{a.title} <Badge tone={toneFor(a.severity)}>{a.severity}</Badge></p>
                    <p className="text-xs text-mist-500">{a.detail}</p>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-mist-300" />
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <p className="mb-3 text-sm font-bold text-mist-600">What to notify me about</p>
          <div className="space-y-2">
            {(Object.keys(NOTIFICATION_LABELS) as NotificationKey[]).map((k) => (
              <Checkbox key={k} label={NOTIFICATION_LABELS[k]} checked={prefs[k]} onChange={(e) => setPref(k, e.target.checked)} />
            ))}
          </div>
          <p className="mt-3 text-xs text-mist-400">Preferences are per user. There's no email/SMS delivery in this build — these filter the in-app feed.</p>
        </Card>
      </div>
    </div>
  );
}
