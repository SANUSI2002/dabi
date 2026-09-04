import { Users2 } from "lucide-react";
import { PageHeader, Card, Badge, StatCard } from "@/components/ui/primitives";
import { useRecruitment } from "@/store/useRecruitment";
import { timeAgo, initials } from "@/lib/format";
import { SKILL_ZONES } from "@/data/recruitment";

export default function TalentPool() {
  const talentPool = useRecruitment((s) => s.talentPool);

  return (
    <div>
      <PageHeader title="Talent Pool" subtitle="Strong candidates not hired this time, organised by skill — for future openings" />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="In pool" value={talentPool.length} tone="brand" icon={<Users2 size={18} />} />
        <StatCard label="Skill zones used" value={new Set(talentPool.map((t) => t.skillZone)).size} tone="mist" delay={0.05} />
      </div>

      <div className="space-y-4">
        {SKILL_ZONES.map((zone) => {
          const entries = talentPool.filter((t) => t.skillZone === zone);
          if (entries.length === 0) return null;
          return (
            <Card key={zone}>
              <div className="mb-2 flex items-center justify-between">
                <p className="font-display font-bold text-mist-900">{zone}</p>
                <Badge tone="mist">{entries.length}</Badge>
              </div>
              <div className="space-y-2">
                {entries.map((t) => (
                  <div key={t.id} className="flex items-start gap-3 rounded-xl bg-mist-50 px-3 py-2">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-gradient text-[11px] font-bold text-white">{initials(t.candidateName)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-mist-900">{t.candidateName}</p>
                      <p className="text-[11px] text-mist-400">{t.email} · {t.phone}</p>
                      <p className="mt-0.5 text-xs text-mist-600">{t.reason}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-mist-400">{timeAgo(t.addedAt)}</span>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
        {talentPool.length === 0 && <Card className="text-sm text-mist-400">No candidates in the talent pool yet. Add one when rejecting a candidate in Recruitment.</Card>}
      </div>
    </div>
  );
}
