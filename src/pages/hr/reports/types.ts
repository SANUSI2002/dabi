import type { useHr } from "@/store/useHr";
import type { useEmployees } from "@/store/useEmployees";
import type { useOrg } from "@/store/useOrg";
import type { useRecruitment } from "@/store/useRecruitment";
import type { useOnboarding } from "@/store/useOnboarding";
import type { useOffboarding } from "@/store/useOffboarding";
import type { usePerformance } from "@/store/usePerformance";
import type { usePayroll } from "@/store/usePayroll";
import type { useAudit } from "@/store/useAudit";

export type HrSnapshot = {
  staff: ReturnType<typeof useHr.getState>["staff"];
  profiles: ReturnType<typeof useEmployees.getState>["profiles"];
  documents: ReturnType<typeof useEmployees.getState>["documents"];
  disciplinaryActions: ReturnType<typeof useEmployees.getState>["disciplinaryActions"];
  departments: ReturnType<typeof useOrg.getState>["departments"];
  departmentName: ReturnType<typeof useOrg.getState>["departmentName"];
  employeeTypeName: ReturnType<typeof useOrg.getState>["employeeTypeName"];
  requisitions: ReturnType<typeof useRecruitment.getState>["requisitions"];
  candidates: ReturnType<typeof useRecruitment.getState>["candidates"];
  onboardingProgress: ReturnType<typeof useOnboarding.getState>["progress"];
  offboardingCases: ReturnType<typeof useOffboarding.getState>["cases"];
  employeeObjectives: ReturnType<typeof usePerformance.getState>["employeeObjectives"];
  payslips: ReturnType<typeof usePayroll.getState>["payslips"];
  loans: ReturnType<typeof usePayroll.getState>["loans"];
  auditEvents: ReturnType<typeof useAudit.getState>["events"];
};
