import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { PageHeader, StatCard } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { useHr } from "@/store/useHr";
import { useEmployees } from "@/store/useEmployees";
import { useOrg } from "@/store/useOrg";
import { useRecruitment } from "@/store/useRecruitment";
import { useOnboarding } from "@/store/useOnboarding";
import { useOffboarding } from "@/store/useOffboarding";
import { usePerformance } from "@/store/usePerformance";
import { usePayroll } from "@/store/usePayroll";
import { useAudit } from "@/store/useAudit";
import { HR_REPORTS, HR_REPORT_CATEGORIES } from "./reports/config";
import { HrReportView } from "./reports/HrReportView";
import type { HrSnapshot } from "./reports/types";

export default function HrReports() {
  const staff = useHr((s) => s.staff);
  const { profiles, documents, disciplinaryActions } = useEmployees();
  const { departments, departmentName, employeeTypeName } = useOrg();
  const { requisitions, candidates } = useRecruitment();
  const onboardingProgress = useOnboarding((s) => s.progress);
  const offboardingCases = useOffboarding((s) => s.cases);
  const { employeeObjectives } = usePerformance();
  const { payslips, loans } = usePayroll();
  const auditEvents = useAudit((s) => s.events);
  const log = useAudit((s) => s.log);

  const snap: HrSnapshot = {
    staff, profiles, documents, disciplinaryActions, departments, departmentName, employeeTypeName,
    requisitions, candidates, onboardingProgress, offboardingCases, employeeObjectives, payslips, loans, auditEvents,
  };

  const [familyName, setFamilyName] = useState(HR_REPORTS[0].name);
  const family = useMemo(() => HR_REPORTS.find((f) => f.name === familyName)!, [familyName]);
  const [tabName, setTabName] = useState(family.tabs[0].name);
  const tab = family.tabs.find((t) => t.name === tabName) ?? family.tabs[0];

  useEffect(() => {
    log("viewed HR report", `hr/report/${familyName.toLowerCase().replace(/[^a-z]+/g, "-")}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyName]);

  function pick(name: string) {
    setFamilyName(name);
    setTabName(HR_REPORTS.find((f) => f.name === name)!.tabs[0].name);
  }

  return (
    <div>
      <PageHeader title="HR Reports" subtitle="Analytics across Workforce, Payroll, Talent & Compliance — computed live from the HR suite" />

      <div className="grid gap-5 lg:grid-cols-[236px_1fr]">
        <div className="card h-fit p-2 lg:sticky lg:top-20">
          {HR_REPORT_CATEGORIES.map((cat) => (
            <div key={cat} className="mb-2">
              <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-mist-400">{cat}</p>
              {HR_REPORTS.filter((f) => f.category === cat).map((f) => (
                <button
                  key={f.name}
                  onClick={() => pick(f.name)}
                  className={cn(
                    "mb-0.5 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-medium transition",
                    familyName === f.name ? "bg-brand-gradient text-white shadow-glow" : "text-mist-600 hover:bg-mist-50",
                  )}
                >
                  <BarChart3 size={14} className="shrink-0" /> <span className="truncate">{f.name}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div>
          <h2 className="mb-4 font-display text-lg font-bold text-mist-900">{family.category} · {family.name}</h2>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {family.stats(snap).map((st, i) => (
              <StatCard key={st.label} label={st.label} value={st.value} tone={st.tone ?? "mist"} delay={i * 0.04} />
            ))}
          </div>

          <div className="mb-4 flex flex-wrap gap-1 border-b border-mist-200">
            {family.tabs.map((t) => (
              <button
                key={t.name}
                onClick={() => setTabName(t.name)}
                className={cn("px-3 py-2.5 text-[13px] font-semibold transition-colors", tabName === t.name ? "border-b-2 border-brand-600 text-brand-700" : "text-mist-400 hover:text-mist-600")}
              >
                {t.name}
              </button>
            ))}
          </div>

          <HrReportView tab={tab} snap={snap} />

          <p className="mt-4 text-center text-[11px] text-mist-300">{family.name} · {tab.name} · generated {new Date().toLocaleString("en-NG")}</p>
        </div>
      </div>
    </div>
  );
}
