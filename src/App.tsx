import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "@/store/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { WorkforceLayout } from "@/components/layout/WorkforceLayout";
import LoginDoor from "@/pages/auth/LoginDoor";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const ClinicalQueue = lazy(() => import("@/pages/clinical/ClinicalQueue"));
const Registration = lazy(() => import("@/pages/clinical/Registration"));
const Appointments = lazy(() => import("@/pages/clinical/Appointments"));
const Consultation = lazy(() => import("@/pages/clinical/Consultation"));
const Inpatient = lazy(() => import("@/pages/clinical/Inpatient"));
const MedicalHistory = lazy(() => import("@/pages/clinical/MedicalHistory"));
const PatientChart = lazy(() => import("@/pages/clinical/PatientChart"));
const Transfers = lazy(() => import("@/pages/clinical/Transfers"));
const Laboratory = lazy(() => import("@/pages/diagnostics/Laboratory"));
const Pharmacy = lazy(() => import("@/pages/diagnostics/Pharmacy"));
const Antenatal = lazy(() => import("@/pages/mch/Antenatal"));
const Labour = lazy(() => import("@/pages/mch/Labour"));
const Postnatal = lazy(() => import("@/pages/mch/Postnatal"));
const FamilyPlanning = lazy(() => import("@/pages/mch/FamilyPlanning"));
const ChildHealth = lazy(() => import("@/pages/mch/ChildHealth"));
const Nutrition = lazy(() => import("@/pages/mch/Nutrition"));
const Immunization = lazy(() => import("@/pages/mch/Immunization"));
const Ncd = lazy(() => import("@/pages/programs/Ncd"));
const Malaria = lazy(() => import("@/pages/programs/Malaria"));
const Referrals = lazy(() => import("@/pages/programs/Referrals"));
const Surveillance = lazy(() => import("@/pages/programs/Surveillance"));
const Outreach = lazy(() => import("@/pages/programs/Outreach"));
const Billing = lazy(() => import("@/pages/admin/Billing"));
const Inventory = lazy(() => import("@/pages/admin/Inventory"));
const Equipment = lazy(() => import("@/pages/admin/Equipment"));
const Hris = lazy(() => import("@/pages/admin/Hris"));
const MsfReport = lazy(() => import("@/pages/admin/MsfReport"));
const Reports = lazy(() => import("@/pages/admin/Reports"));
const NhmisSync = lazy(() => import("@/pages/admin/NhmisSync"));
const AuditLog = lazy(() => import("@/pages/admin/AuditLog"));
const Settings = lazy(() => import("@/pages/admin/Settings"));
const WorkforceDashboard = lazy(() => import("@/pages/workforce/WorkforceDashboard"));
const Schedules = lazy(() => import("@/pages/workforce/Schedules"));
const WfAttendance = lazy(() => import("@/pages/workforce/Attendance"));
const Timesheets = lazy(() => import("@/pages/workforce/Timesheets"));
const Approvals = lazy(() => import("@/pages/workforce/Approvals"));
const HolidayLeave = lazy(() => import("@/pages/workforce/HolidayLeave"));
const WorkTasks = lazy(() => import("@/pages/workforce/WorkTasks"));
const WorkforceReports = lazy(() => import("@/pages/workforce/WorkforceReports"));
const TimePolicy = lazy(() => import("@/pages/workforce/TimePolicy"));
const OrgSetup = lazy(() => import("@/pages/hr/OrgSetup"));
const EmployeeDirectory = lazy(() => import("@/pages/hr/EmployeeDirectory"));
const EmployeeDetail = lazy(() => import("@/pages/hr/EmployeeDetail"));
const Recruitment = lazy(() => import("@/pages/hr/Recruitment"));
const OnboardingHr = lazy(() => import("@/pages/hr/Onboarding"));
const Offboarding = lazy(() => import("@/pages/hr/Offboarding"));
const Performance = lazy(() => import("@/pages/hr/Performance"));
const OrgChart = lazy(() => import("@/pages/hr/OrgChart"));
const PoliciesDiscipline = lazy(() => import("@/pages/hr/PoliciesDiscipline"));
const TalentPool = lazy(() => import("@/pages/hr/TalentPool"));
const CompanyAssets = lazy(() => import("@/pages/hr/CompanyAssets"));
const Helpdesk = lazy(() => import("@/pages/hr/Helpdesk"));
const HrDashboard = lazy(() => import("@/pages/hr/HrDashboard"));

function Loader() {
  return (
    <div className="grid place-items-center py-32">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-600" />
    </div>
  );
}

export default function App() {
  const authed = useAuth((s) => s.authed);
  const loc = useLocation();

  if (!authed) {
    return (
      <AnimatePresence mode="wait">
        <LoginDoor key="login" />
      </AnimatePresence>
    );
  }

  return (
    <Suspense fallback={<Loader />}>
      <Routes location={loc}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/queue" element={<ClinicalQueue />} />
          <Route path="/registration" element={<Registration />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/consultation" element={<Consultation />} />
          <Route path="/inpatient" element={<Inpatient />} />
          <Route path="/history" element={<MedicalHistory />} />
          <Route path="/patients/:id" element={<PatientChart />} />
          <Route path="/transfers" element={<Transfers />} />
          <Route path="/laboratory" element={<Laboratory />} />
          <Route path="/pharmacy" element={<Pharmacy />} />
          <Route path="/anc" element={<Antenatal />} />
          <Route path="/labour" element={<Labour />} />
          <Route path="/pnc" element={<Postnatal />} />
          <Route path="/family-planning" element={<FamilyPlanning />} />
          <Route path="/child-health" element={<ChildHealth />} />
          <Route path="/nutrition" element={<Nutrition />} />
          <Route path="/immunization" element={<Immunization />} />
          <Route path="/ncd" element={<Ncd />} />
          <Route path="/malaria" element={<Malaria />} />
          <Route path="/referrals" element={<Referrals />} />
          <Route path="/surveillance" element={<Surveillance />} />
          <Route path="/outreach" element={<Outreach />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/equipment" element={<Equipment />} />
          <Route path="/hris" element={<Hris />} />
          <Route path="/msf-report" element={<MsfReport />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/nhmis-sync" element={<NhmisSync />} />
          <Route path="/audit-log" element={<AuditLog />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/workforce" element={<WorkforceLayout />}>
            <Route index element={<WorkforceDashboard />} />
            <Route path="schedules" element={<Schedules />} />
            <Route path="attendance" element={<WfAttendance />} />
            <Route path="timesheets" element={<Timesheets />} />
            <Route path="approvals" element={<Approvals />} />
            <Route path="leave" element={<HolidayLeave />} />
            <Route path="work" element={<WorkTasks />} />
            <Route path="reports" element={<WorkforceReports />} />
            <Route path="policy" element={<TimePolicy />} />
          </Route>
          <Route path="/hr/org-setup" element={<OrgSetup />} />
          <Route path="/hr/employees" element={<EmployeeDirectory />} />
          <Route path="/hr/employees/:id" element={<EmployeeDetail />} />
          <Route path="/hr/recruitment" element={<Recruitment />} />
          <Route path="/hr/onboarding" element={<OnboardingHr />} />
          <Route path="/hr/offboarding" element={<Offboarding />} />
          <Route path="/hr/performance" element={<Performance />} />
          <Route path="/hr/org-chart" element={<OrgChart />} />
          <Route path="/hr/policies-discipline" element={<PoliciesDiscipline />} />
          <Route path="/hr/talent-pool" element={<TalentPool />} />
          <Route path="/hr/assets" element={<CompanyAssets />} />
          <Route path="/hr/helpdesk" element={<Helpdesk />} />
          <Route path="/hr/dashboard" element={<HrDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
