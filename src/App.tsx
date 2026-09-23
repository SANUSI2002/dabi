import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/store/useAuth";
import { useTenant } from "@/store/useTenant";
import { useTenantSetup } from "@/tenant-setup/useTenantSetup";
import { AppLoadingScreen } from "@/components/layout/AppLoadingScreen";
import { hasPharmacyPortalAccess } from "@/pharmacy/access";
import { deploymentSurface, otherSurfaceUrl } from "@/deployment/surface";
import { apiConfigured } from "@/config/runtime";

const AppShell = lazy(() => import("@/components/layout/AppShell").then((m) => ({ default: m.AppShell })));
const WorkforceLayout = lazy(() => import("@/components/layout/WorkforceLayout").then((m) => ({ default: m.WorkforceLayout })));
const SignInPage = lazy(() => import("@/identity/pages/IdentityPages").then((m) => ({ default: m.SignInPage })));
const LiveIdentityPage = lazy(() => import("@/identity/pages/IdentityPages").then((m) => ({ default: m.LiveIdentityPage })));
const LiveMfaSettingsPage = lazy(() => import("@/identity/pages/LiveMfaSettingsPage"));
const AccessPage = lazy(() => import("@/public/pages/AccessPage"));
const MfaPage = lazy(() => import("@/identity/pages/IdentityPages").then((m) => ({ default: m.MfaPage })));
const OrganizationChooserPage = lazy(() => import("@/identity/pages/IdentityPages").then((m) => ({ default: m.OrganizationChooserPage })));
const ForgotPasswordPage = lazy(() => import("@/identity/pages/IdentityPages").then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("@/identity/pages/IdentityPages").then((m) => ({ default: m.ResetPasswordPage })));
const SsoPage = lazy(() => import("@/identity/pages/IdentityPages").then((m) => ({ default: m.SsoPage })));
const SessionsPage = lazy(() => import("@/identity/pages/IdentityPages").then((m) => ({ default: m.SessionsPage })));
const PatientPortalPage = lazy(() => import("@/identity/pages/IdentityPages").then((m) => ({ default: m.PatientPortalPage })));
const InvitePage = lazy(() => import("@/identity/pages/IdentityPages").then((m) => ({ default: m.InvitePage })));
const RegistrationStartPage = lazy(() => import("@/registration/pages/OrganizationRegistration").then((m) => ({ default: m.RegistrationStartPage })));
const OrganizationRegistrationPage = lazy(() => import("@/registration/pages/OrganizationRegistration").then((m) => ({ default: m.OrganizationRegistrationPage })));
const ApplicationStatusPage = lazy(() => import("@/registration/pages/OrganizationRegistration").then((m) => ({ default: m.ApplicationStatusPage })));
const PharmacyPortal = lazy(() => import("@/pharmacy/PharmacyPortal"));
const PharmacyLoginPage = lazy(() => import("@/pharmacy/PharmacyLoginPage"));

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const ClinicalQueue = lazy(() => import("@/pages/clinical/ClinicalQueue"));
const Registration = lazy(() => import("@/pages/clinical/Registration"));
const Appointments = lazy(() => import("@/pages/clinical/Appointments"));
const Consultation = lazy(() => import("@/pages/clinical/Consultation"));
const Inpatient = lazy(() => import("@/pages/clinical/Inpatient"));
const WardRound = lazy(() => import("@/pages/clinical/WardRound"));
const MedicalHistory = lazy(() => import("@/pages/clinical/MedicalHistory"));
const PatientChart = lazy(() => import("@/pages/clinical/PatientChart"));
const Transfers = lazy(() => import("@/pages/clinical/Transfers"));
const Procedures = lazy(() => import("@/pages/clinical/Procedures"));
const Laboratory = lazy(() => import("@/pages/diagnostics/Laboratory"));
const LabTestSettings = lazy(() => import("@/pages/diagnostics/LabTestSettings"));
const Pharmacy = lazy(() => import("@/pages/diagnostics/Pharmacy"));
const Radiology = lazy(() => import("@/pages/diagnostics/Radiology"));
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
const BillingInvoiceDetail = lazy(() => import("@/pages/admin/BillingInvoiceDetail"));
const Inventory = lazy(() => import("@/pages/admin/Inventory"));
const InventoryItemDetail = lazy(() => import("@/pages/admin/InventoryItemDetail"));
const Equipment = lazy(() => import("@/pages/admin/Equipment"));
const EquipmentCommandCentre = lazy(() => import("@/pages/equipment/CommandCentre"));
const EquipmentRegister = lazy(() => import("@/pages/equipment/Register"));
const EquipmentDetail = lazy(() => import("@/pages/equipment/Detail"));
const EquipmentAnalytics = lazy(() => import("@/pages/equipment/Analytics"));
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
const Departments = lazy(() => import("@/pages/hr/Departments"));
const Vacancies = lazy(() => import("@/pages/hr/Vacancies"));
const PoliciesDiscipline = lazy(() => import("@/pages/hr/PoliciesDiscipline"));
const TalentPool = lazy(() => import("@/pages/hr/TalentPool"));
const CompanyAssets = lazy(() => import("@/pages/hr/CompanyAssets"));
const Helpdesk = lazy(() => import("@/pages/hr/Helpdesk"));
const HrDashboard = lazy(() => import("@/pages/hr/HrDashboard"));
const Payroll = lazy(() => import("@/pages/hr/Payroll"));
const HrReports = lazy(() => import("@/pages/hr/Reports"));
const Promotions = lazy(() => import("@/pages/hr/Promotions"));
const BranchTransfers = lazy(() => import("@/pages/hr/BranchTransfers"));
const AccountingDashboard = lazy(() => import("@/pages/accounting/AccountingDashboard"));
const ChartOfAccounts = lazy(() => import("@/pages/accounting/ChartOfAccounts"));
const JournalEntries = lazy(() => import("@/pages/accounting/JournalEntries"));
const GeneralLedger = lazy(() => import("@/pages/accounting/GeneralLedger"));
const TrialBalance = lazy(() => import("@/pages/accounting/TrialBalance"));
const AcctCustomers = lazy(() => import("@/pages/accounting/Customers"));
const AcctEstimates = lazy(() => import("@/pages/accounting/Estimates"));
const AcctSalesOrders = lazy(() => import("@/pages/accounting/SalesOrders"));
const AcctInvoices = lazy(() => import("@/pages/accounting/Invoices"));
const AcctReceipts = lazy(() => import("@/pages/accounting/CustomerReceipts"));
const AcctCreditNotes = lazy(() => import("@/pages/accounting/CreditNotes"));
const AcctSalesReceipts = lazy(() => import("@/pages/accounting/SalesReceipts"));
const AcctDelayedCharges = lazy(() => import("@/pages/accounting/DelayedCharges"));
const AcctVendors = lazy(() => import("@/pages/accounting/Vendors"));
const AcctRequisitions = lazy(() => import("@/pages/accounting/PurchaseRequisitions"));
const AcctPurchaseOrders = lazy(() => import("@/pages/accounting/PurchaseOrders"));
const AcctGoodsReceipts = lazy(() => import("@/pages/accounting/GoodsReceipts"));
const AcctBills = lazy(() => import("@/pages/accounting/Bills"));
const AcctVendorPayments = lazy(() => import("@/pages/accounting/VendorPayments"));
const AcctVendorCredits = lazy(() => import("@/pages/accounting/VendorCredits"));
const AcctBankAccounts = lazy(() => import("@/pages/accounting/BankAccounts"));
const AcctBankTransactions = lazy(() => import("@/pages/accounting/BankTransactions"));
const AcctReconciliation = lazy(() => import("@/pages/accounting/BankReconciliation"));
const AcctBankFeeds = lazy(() => import("@/pages/accounting/BankFeeds"));
const AcctExpenses = lazy(() => import("@/pages/accounting/Expenses"));
const AcctFixedAssets = lazy(() => import("@/pages/accounting/FixedAssets"));
const AcctInventory = lazy(() => import("@/pages/accounting/InventoryAccounting"));
const AcctBudgets = lazy(() => import("@/pages/accounting/Budgets"));
const AcctProjects = lazy(() => import("@/pages/accounting/Projects"));
const AcctSetup = lazy(() => import("@/pages/accounting/SetupWizard"));
const AcctNotifications = lazy(() => import("@/pages/accounting/Notifications"));
const AcctAuditTrail = lazy(() => import("@/pages/accounting/AuditTrail"));
const PlatformModules = lazy(() => import("@/pages/platform/PlatformModules"));
const TerminologySettings = lazy(() => import("@/pages/platform/TerminologySettings"));
const MasterDataSettings = lazy(() => import("@/pages/platform/MasterDataSettings"));
const WorkflowBuilder = lazy(() => import("@/pages/platform/WorkflowBuilder"));
const WorkflowInbox = lazy(() => import("@/pages/platform/WorkflowInbox"));
const LetterTemplates = lazy(() => import("@/pages/platform/LetterTemplates"));
const AcctTax = lazy(() => import("@/pages/accounting/TaxCenter"));
const AcctReports = lazy(() => import("@/pages/accounting/AccountingReports"));
const AcctApprovals = lazy(() => import("@/pages/accounting/AccountingApprovals"));
const AcctPeriodEnd = lazy(() => import("@/pages/accounting/PeriodEnd"));
const AcctConsolidation = lazy(() => import("@/pages/accounting/Consolidation"));
const AcctIntegrations = lazy(() => import("@/pages/accounting/Integrations"));
const AcctSettings = lazy(() => import("@/pages/accounting/AccountingSettings"));
const CommandCenterShell = lazy(() => import("@/command-center/components/CommandCenterShell").then((m) => ({ default: m.CommandCenterShell })));
const LiveCommandCenter = lazy(() => import("@/command-center/LiveCommandCenter"));
const ApplicationEmailVerificationPage = lazy(() => import("@/registration/pages/OrganizationRegistration").then((m) => ({ default: m.ApplicationEmailVerificationPage })));
const CommandDashboard = lazy(() => import("@/command-center/pages/Dashboard"));
const SabiHealthDashboard = lazy(() => import("@/command-center/pages/SabiHealthDashboard"));
const SabiHealthVerificationCenter = lazy(() => import("@/command-center/pages/sabihealth/VerificationCenter"));
const SabiHealthConsultations = lazy(() => import("@/command-center/pages/sabihealth/Consultations"));
const SabiHealthConsultationDetail = lazy(() => import("@/command-center/pages/sabihealth/ConsultationDetail"));
const SabiHealthPrescriptions = lazy(() => import("@/command-center/pages/sabihealth/Prescriptions"));
const SabiHealthPrescriptionDetail = lazy(() => import("@/command-center/pages/sabihealth/PrescriptionDetail"));
const SabiHealthOrders = lazy(() => import("@/command-center/pages/sabihealth/Orders"));
const SabiHealthOrderDetail = lazy(() => import("@/command-center/pages/sabihealth/OrderDetail"));
const SabiHealthPayments = lazy(() => import("@/command-center/pages/sabihealth/Payments"));
const SabiHealthPatients = lazy(() => import("@/command-center/pages/sabihealth/Patients"));
const SabiHealthPatientDetail = lazy(() => import("@/command-center/pages/sabihealth/PatientDetail"));
const SabiHealthDoctors = lazy(() => import("@/command-center/pages/sabihealth/Doctors"));
const SabiHealthDoctorDetail = lazy(() => import("@/command-center/pages/sabihealth/DoctorDetail"));
const SabiHealthPharmacies = lazy(() => import("@/command-center/pages/sabihealth/Pharmacies"));
const SabiHealthPharmacyDetail = lazy(() => import("@/command-center/pages/sabihealth/PharmacyDetail"));
const SabiHealthLaboratories = lazy(() => import("@/command-center/pages/sabihealth/Laboratories"));
const SabiHealthLaboratoryDetail = lazy(() => import("@/command-center/pages/sabihealth/LaboratoryDetail"));
const CommandOrganizations = lazy(() => import("@/command-center/pages/Organizations"));
const Tenant360 = lazy(() => import("@/command-center/pages/Tenant360"));
const CommercialPage = lazy(() => import("@/command-center/pages/CommercialPages"));
const CustomerIdentityPage = lazy(() => import("@/command-center/pages/CustomerIdentityPages"));
const VerificationCenter = lazy(() => import("@/command-center/pages/VerificationCenter"));
const CommercialOnboarding = lazy(() => import("@/command-center/pages/CommercialOnboarding"));
const TenantProvisioning = lazy(() => import("@/command-center/pages/TenantProvisioning"));
const TenantFirstRunSetup = lazy(() => import("@/tenant-setup/TenantFirstRunSetup"));
const TenantSetupManagement = lazy(() => import("@/command-center/pages/TenantSetupManagement"));
const PlatformOpsPage = lazy(() => import("@/command-center/pages/PlatformOpsPages"));
const ProductRoadmap = lazy(() => import("@/command-center/pages/ProductRoadmap"));
const ProductReleases = lazy(() => import("@/command-center/pages/ProductReleases"));
const PublicShell = lazy(() => import("@/public/PublicShell"));
const RoadmapPage = lazy(() => import("@/public/pages/RoadmapPage"));
const HomePage = lazy(() => import("@/public/pages/HomePage"));
const SabiOsPage = lazy(() => import("@/public/pages/ContentPages").then((m) => ({ default: m.SabiOsPage })));
const SabiHealthPage = lazy(() => import("@/public/pages/ContentPages").then((m) => ({ default: m.SabiHealthPage })));
const AIPage = lazy(() => import("@/public/pages/ContentPages").then((m) => ({ default: m.AIPage })));
const SecurityPage = lazy(() => import("@/public/pages/ContentPages").then((m) => ({ default: m.SecurityPage })));
const AboutPage = lazy(() => import("@/public/pages/ContentPages").then((m) => ({ default: m.AboutPage })));
const PricingPage = lazy(() => import("@/public/pages/ContentPages").then((m) => ({ default: m.PricingPage })));
const SolutionsPage = lazy(() => import("@/public/pages/ContentPages").then((m) => ({ default: m.SolutionsPage })));
const ResourcesPage = lazy(() => import("@/public/pages/ContentPages").then((m) => ({ default: m.ResourcesPage })));
const RegisterEntryPage = lazy(() => import("@/public/pages/ContentPages").then((m) => ({ default: m.RegisterEntryPage })));
const BookDemoPage = lazy(() => import("@/public/pages/ContentPages").then((m) => ({ default: m.BookDemoPage })));

function WorkspaceGate() {
  const { authed, identity, activeMembership } = useAuth();
  const activeTenant = useTenant((state) => state.tenant.id);
  const setup = useTenantSetup((state) => state.records.find((item) => item.organizationId === activeTenant));
  if (!authed || !identity) return <Navigate to="/login" replace />;
  if (identity.kind === "platform") return <Navigate to="/command-center" replace />;
  if (identity.kind === "patient") return <Navigate to="/patient" replace />;
  if (!activeMembership) return <Navigate to="/choose-organization" replace />;
  if (activeMembership.organizationId !== activeTenant) return <Navigate to="/choose-organization" replace />;
  if (setup && setup.status !== "LIVE") return <Navigate to="/workspace/setup" replace />;
  return <AppShell />;
}

function TenantSetupGate() {
  const { authed, identity, activeMembership } = useAuth();
  const activeTenant = useTenant((state) => state.tenant.id);
  const setup = useTenantSetup((state) => state.records.find((item) => item.organizationId === activeTenant));
  if (!authed || !identity) return <Navigate to="/login" replace />;
  if (identity.kind !== "organization" || !activeMembership) return <Navigate to={identity.kind === "platform" ? "/command-center" : "/patient"} replace />;
  if (activeMembership.organizationId !== activeTenant) return <Navigate to="/choose-organization" replace />;
  if (!activeMembership.role.toLowerCase().includes("administrator")) return <Navigate to="/choose-organization" replace />;
  if (!setup || setup.status === "LIVE") return <Navigate to="/workspace" replace />;
  return <TenantFirstRunSetup />;
}

function CommandCenterGate() {
  const { authed, identity } = useAuth();
  if (apiConfigured) return <LiveCommandCenter />;
  return authed && identity?.kind === "platform" ? <CommandCenterShell /> : <Navigate to="/command-center/login" replace />;
}

function PharmacyPortalGate() {
  const { authed, identity, activeMembership } = useAuth();
  if (!authed || !identity) return <Navigate to="/pharmacy/login" replace />;
  if (identity.kind !== "organization" || !activeMembership) return <Navigate to={identity.kind === "platform" ? "/command-center" : "/patient"} replace />;
  if (!hasPharmacyPortalAccess(activeMembership)) return <Navigate to="/pharmacy/login" replace />;
  return <PharmacyPortal />;
}

export default function App() {
  const loc = useLocation();
  const surface = deploymentSurface(import.meta.env.VITE_DEPLOYMENT_SURFACE);
  const crossSurfaceUrl = otherSurfaceUrl(loc.pathname, loc.search, surface, {
    health: import.meta.env.VITE_SABI_HEALTH_URL,
    emr: import.meta.env.VITE_SABI_EMR_URL,
    pharmacy: import.meta.env.VITE_SABI_PHARMACY_URL,
    "command-center": import.meta.env.VITE_SABI_COMMAND_CENTER_URL,
    telemedicine: import.meta.env.VITE_SABI_TELEMEDICINE_URL,
  });
  useEffect(() => {
    if (crossSurfaceUrl) window.location.replace(crossSurfaceUrl);
  }, [crossSurfaceUrl]);
  if (crossSurfaceUrl) return <div className="grid min-h-screen place-items-center bg-slate-50 p-6 text-center text-sm text-slate-600">Opening the correct Sabi workspace… <a className="ml-1 font-bold text-emerald-700 underline" href={crossSurfaceUrl}>Continue</a></div>;
  if (loc.pathname === "/" && surface === "emr") return <Navigate to="/login" replace />;
  if (loc.pathname === "/" && surface === "pharmacy") return <Navigate to="/pharmacy/login" replace />;
  if (loc.pathname === "/" && surface === "command-center") return <Navigate to="/command-center" replace />;
  return (
    <Suspense fallback={<AppLoadingScreen pathname={loc.pathname} />}>
      <Routes location={loc}>
        <Route element={<PublicShell />}>
          <Route index element={<HomePage />} />
          <Route path="products/sabi-os" element={<SabiOsPage />} />
          <Route path="products/sabi-health" element={<SabiHealthPage />} />
          <Route path="ai" element={<AIPage />} />
          <Route path="roadmap" element={<RoadmapPage />} />
          <Route path="security" element={<SecurityPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="pricing" element={<PricingPage />} />
          <Route path="solutions/:type" element={<SolutionsPage />} />
          <Route path="resources" element={<ResourcesPage />} />
          <Route path="register" element={<RegisterEntryPage />} />
          <Route path="book-demo" element={<BookDemoPage />} />
        </Route>
        <Route path="/login" element={surface === "health" ? <AccessPage /> : <SignInPage intent={surface === "emr" ? "emr" : surface === "command-center" ? "platform" : "shared"} />} />
        <Route path="/identity/account" element={<LiveIdentityPage />} />
        <Route path="/identity/mfa" element={<LiveMfaSettingsPage />} />
        <Route path="/access" element={<AccessPage />} />
        <Route path="/emr/login" element={<SignInPage intent="emr" />} />
        <Route path="/command-center/login" element={<SignInPage intent="platform" />} />
        <Route path="/mfa" element={<MfaPage />} />
        <Route path="/choose-organization" element={<OrganizationChooserPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:uid" element={<ResetPasswordPage />} />
        <Route path="/sso" element={<SsoPage />} />
        <Route path="/account/sessions" element={<SessionsPage />} />
        <Route path="/accept-invite" element={<InvitePage />} />
        <Route path="/accept-invite/:id" element={<InvitePage />} />
        <Route path="/patient" element={<PatientPortalPage />} />
        <Route path="/pharmacy/login" element={<PharmacyLoginPage />} />
        <Route path="/pharmacy-portal/login" element={<PharmacyLoginPage />} />
        <Route path="/pharmacy-portal" element={<PharmacyPortalGate />} />
        <Route path="/workspace/setup" element={<TenantSetupGate />} />
        <Route path="/register/organization" element={<RegistrationStartPage />} />
        <Route path="/register/organization/:applicationId" element={<OrganizationRegistrationPage />} />
        <Route path="/register/organization/:applicationId/status" element={<ApplicationStatusPage />} />
        <Route path="/register/organization/verify/:id" element={<ApplicationEmailVerificationPage />} />
        <Route path="/signup/organisation/:type" element={<Navigate to="/register/organization" replace />} />
        <Route path="/signup/organization/:type" element={<Navigate to="/register/organization" replace />} />
        <Route path="/command-center" element={<CommandCenterGate />}>
          <Route index element={<CommandDashboard />} />
          <Route path="sabi-health" element={<SabiHealthDashboard />} />
          <Route path="sabi-health/verification" element={<SabiHealthVerificationCenter />} />
          <Route path="sabi-health/verification/:subjectId" element={<SabiHealthVerificationCenter />} />
          <Route path="sabi-health/consultations" element={<SabiHealthConsultations />} />
          <Route path="sabi-health/consultations/:consultationId" element={<SabiHealthConsultationDetail />} />
          <Route path="sabi-health/prescriptions" element={<SabiHealthPrescriptions />} />
          <Route path="sabi-health/prescriptions/:prescriptionId" element={<SabiHealthPrescriptionDetail />} />
          <Route path="sabi-health/orders" element={<SabiHealthOrders />} />
          <Route path="sabi-health/orders/:orderId" element={<SabiHealthOrderDetail />} />
          <Route path="sabi-health/payments" element={<SabiHealthPayments />} />
          <Route path="sabi-health/patients" element={<SabiHealthPatients />} />
          <Route path="sabi-health/patients/:patientId" element={<SabiHealthPatientDetail />} />
          <Route path="sabi-health/doctors" element={<SabiHealthDoctors />} />
          <Route path="sabi-health/doctors/:doctorId" element={<SabiHealthDoctorDetail />} />
          <Route path="sabi-health/pharmacies" element={<SabiHealthPharmacies />} />
          <Route path="sabi-health/pharmacies/:pharmacyId" element={<SabiHealthPharmacyDetail />} />
          <Route path="sabi-health/laboratories" element={<SabiHealthLaboratories />} />
          <Route path="sabi-health/laboratories/:laboratoryId" element={<SabiHealthLaboratoryDetail />} />
          <Route path="organizations" element={<CommandOrganizations />} />
          <Route path="organizations/:organizationId" element={<Tenant360 />} />
          <Route path="onboarding" element={<VerificationCenter />} />
          <Route path="onboarding/:applicationId" element={<VerificationCenter />} />
          <Route path="provisioning" element={<TenantProvisioning />} />
          <Route path="provisioning/:applicationId" element={<TenantProvisioning />} />
          <Route path="setup" element={<TenantSetupManagement />} />
          <Route path="setup/:organizationId" element={<TenantSetupManagement />} />
          <Route path="documents" element={<CustomerIdentityPage kind="documents" />} />
          <Route path="support" element={<CustomerIdentityPage kind="support" />} />
          <Route path="opportunities" element={<CommercialOnboarding />} />
          <Route path="opportunities/:applicationId" element={<CommercialOnboarding />} />
          <Route path="subscriptions" element={<CommercialPage kind="subscriptions" />} />
          <Route path="licenses" element={<CommercialPage kind="licenses" />} />
          <Route path="packages" element={<CommercialPage kind="packages" />} />
          <Route path="catalog" element={<CommercialPage kind="catalog" />} />
          <Route path="pricing" element={<CommercialPage kind="pricing" />} />
          <Route path="invoices" element={<CommercialPage kind="invoices" />} />
          <Route path="transactions" element={<CommercialPage kind="transactions" />} />
          <Route path="roadmap" element={<ProductRoadmap />} />
          <Route path="releases" element={<ProductReleases />} />
          <Route path="users" element={<CustomerIdentityPage kind="users" />} />
          <Route path="roles" element={<CustomerIdentityPage kind="roles" />} />
          <Route path="sso" element={<CustomerIdentityPage kind="sso" />} />
          <Route path="sessions" element={<CustomerIdentityPage kind="sessions" />} />
          <Route path="entitlements" element={<PlatformOpsPage kind="entitlements" />} />
          <Route path="feature-flags" element={<PlatformOpsPage kind="feature-flags" />} />
          <Route path="integrations" element={<PlatformOpsPage kind="integrations" />} />
          <Route path="notifications" element={<PlatformOpsPage kind="notifications" />} />
          <Route path="analytics" element={<PlatformOpsPage kind="analytics" />} />
          <Route path="health" element={<PlatformOpsPage kind="health" />} />
          <Route path="incidents" element={<PlatformOpsPage kind="incidents" />} />
          <Route path="jobs" element={<PlatformOpsPage kind="jobs" />} />
          <Route path="audit" element={<PlatformOpsPage kind="audit" />} />
          <Route path="branding" element={<PlatformOpsPage kind="branding" />} />
          <Route path="themes" element={<PlatformOpsPage kind="themes" />} />
          <Route path="terminology" element={<PlatformOpsPage kind="terminology" />} />
          <Route path="internal-users" element={<CustomerIdentityPage kind="internal-users" />} />
          <Route path="security" element={<PlatformOpsPage kind="security" />} />
          <Route path="settings" element={<PlatformOpsPage kind="settings" />} />
          <Route path="*" element={<Navigate to="/command-center" replace />} />
        </Route>
        <Route element={<WorkspaceGate />}>
          <Route path="/workspace" element={<Dashboard />} />
          <Route path="/dashboard" element={<Navigate to="/workspace" replace />} />
          <Route path="/queue" element={<ClinicalQueue />} />
          <Route path="/registration" element={<Registration />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/consultation" element={<Consultation />} />
          <Route path="/inpatient" element={<Inpatient />} />
          <Route path="/ward-round/:admissionId/:roundId?" element={<WardRound />} />
          <Route path="/history" element={<MedicalHistory />} />
          <Route path="/patients/:id" element={<PatientChart />} />
          <Route path="/transfers" element={<Transfers />} />
          <Route path="/procedures" element={<Procedures />} />
          <Route path="/laboratory" element={<Laboratory />} />
          <Route path="/laboratory/test-settings" element={<LabTestSettings />} />
          <Route path="/pharmacy" element={<Pharmacy />} />
          <Route path="/radiology" element={<Radiology />} />
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
          <Route path="/billing/invoices/:invoiceId" element={<BillingInvoiceDetail />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/inventory/item/:itemId" element={<InventoryItemDetail />} />
          <Route path="/equipment" element={<Equipment />} />
          <Route path="/equipment-scada" element={<EquipmentCommandCentre />} />
          <Route path="/equipment-scada/register" element={<EquipmentRegister />} />
          <Route path="/equipment-scada/register/:id" element={<EquipmentDetail />} />
          <Route path="/equipment-scada/analytics" element={<EquipmentAnalytics />} />
          <Route path="/hris" element={<Hris />} />
          <Route path="/msf-report" element={<MsfReport />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/nhmis-sync" element={<NhmisSync />} />
          <Route path="/audit-log" element={<AuditLog />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/platform" element={<PlatformModules />} />
          <Route path="/settings/terminology" element={<TerminologySettings />} />
          <Route path="/settings/master-data" element={<MasterDataSettings />} />
          <Route path="/settings/workflows" element={<WorkflowBuilder />} />
          <Route path="/settings/letters" element={<LetterTemplates />} />
          <Route path="/workflows/inbox" element={<WorkflowInbox />} />
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
          <Route path="/hr/departments" element={<Departments />} />
          <Route path="/hr/departments/:id" element={<Departments />} />
          <Route path="/hr/vacancies" element={<Vacancies />} />
          <Route path="/hr/policies-discipline" element={<PoliciesDiscipline />} />
          <Route path="/hr/talent-pool" element={<TalentPool />} />
          <Route path="/hr/assets" element={<CompanyAssets />} />
          <Route path="/hr/helpdesk" element={<Helpdesk />} />
          <Route path="/hr/dashboard" element={<HrDashboard />} />
          <Route path="/hr/payroll" element={<Payroll />} />
          <Route path="/hr/promotions" element={<Promotions />} />
          <Route path="/hr/branch-transfers" element={<BranchTransfers />} />
          <Route path="/hr/reports" element={<HrReports />} />
          <Route path="/accounting" element={<AccountingDashboard />} />
          <Route path="/accounting/chart-of-accounts" element={<ChartOfAccounts />} />
          <Route path="/accounting/journals" element={<JournalEntries />} />
          <Route path="/accounting/general-ledger" element={<GeneralLedger />} />
          <Route path="/accounting/trial-balance" element={<TrialBalance />} />
          <Route path="/accounting/customers" element={<AcctCustomers />} />
          <Route path="/accounting/quotations" element={<AcctEstimates />} />
          <Route path="/accounting/sales-orders" element={<AcctSalesOrders />} />
          <Route path="/accounting/invoices" element={<AcctInvoices />} />
          <Route path="/accounting/receipts" element={<AcctReceipts />} />
          <Route path="/accounting/credit-notes" element={<AcctCreditNotes />} />
          <Route path="/accounting/sales-receipts" element={<AcctSalesReceipts />} />
          <Route path="/accounting/delayed-charges" element={<AcctDelayedCharges />} />
          <Route path="/accounting/vendors" element={<AcctVendors />} />
          <Route path="/accounting/requisitions" element={<AcctRequisitions />} />
          <Route path="/accounting/purchase-orders" element={<AcctPurchaseOrders />} />
          <Route path="/accounting/goods-receipts" element={<AcctGoodsReceipts />} />
          <Route path="/accounting/bills" element={<AcctBills />} />
          <Route path="/accounting/vendor-payments" element={<AcctVendorPayments />} />
          <Route path="/accounting/vendor-credits" element={<AcctVendorCredits />} />
          <Route path="/accounting/bank-accounts" element={<AcctBankAccounts />} />
          <Route path="/accounting/bank-transactions" element={<AcctBankTransactions />} />
          <Route path="/accounting/reconciliation" element={<AcctReconciliation />} />
          <Route path="/accounting/bank-feeds" element={<AcctBankFeeds />} />
          <Route path="/accounting/expenses" element={<AcctExpenses />} />
          <Route path="/accounting/fixed-assets" element={<AcctFixedAssets />} />
          <Route path="/accounting/inventory" element={<AcctInventory />} />
          <Route path="/accounting/budgets" element={<AcctBudgets />} />
          <Route path="/accounting/projects" element={<AcctProjects />} />
          <Route path="/accounting/setup" element={<AcctSetup />} />
          <Route path="/accounting/notifications" element={<AcctNotifications />} />
          <Route path="/accounting/audit-trail" element={<AcctAuditTrail />} />
          <Route path="/accounting/tax" element={<AcctTax />} />
          <Route path="/accounting/reports" element={<AcctReports />} />
          <Route path="/accounting/approvals" element={<AcctApprovals />} />
          <Route path="/accounting/period-end" element={<AcctPeriodEnd />} />
          <Route path="/accounting/consolidation" element={<AcctConsolidation />} />
          <Route path="/accounting/integrations" element={<AcctIntegrations />} />
          <Route path="/accounting/settings" element={<AcctSettings />} />
          <Route path="*" element={<Navigate to="/workspace" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
