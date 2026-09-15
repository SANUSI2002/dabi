import { create } from "zustand";
import { browserApplicantDraftRepository, findPossibleDraftDuplicates } from "./repository";
import { APPLICATION_STEPS, createBlankApplication, type ApplicationStep, type OrganizationApplication } from "./domain";

type RegistrationState = {
  applications: OrganizationApplication[];
  createApplication: () => string;
  updateApplication: (applicationId: string, updater: (application: OrganizationApplication) => OrganizationApplication) => void;
  completeStep: (applicationId: string, step: ApplicationStep) => ApplicationStep;
  submitApplication: (applicationId: string) => { reference?: string; error?: string };
  possibleDuplicates: (applicationId: string) => OrganizationApplication[];
};

function saveAndSort(applications: OrganizationApplication[]) {
  const sorted = [...applications].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  sorted.forEach((application) => browserApplicantDraftRepository.save(application));
  return sorted;
}

export const useRegistration = create<RegistrationState>((set, get) => ({
  applications: browserApplicantDraftRepository.list(),
  createApplication: () => {
    const application = createBlankApplication();
    browserApplicantDraftRepository.save(application);
    set((state) => ({ applications: [application, ...state.applications] }));
    return application.id;
  },
  updateApplication: (applicationId, updater) => {
    set((state) => {
      const applications = state.applications.map((application) => application.id === applicationId
        ? { ...updater(application), updatedAt: new Date().toISOString() }
        : application);
      return { applications: saveAndSort(applications) };
    });
  },
  completeStep: (applicationId, step) => {
    const stepIndex = APPLICATION_STEPS.findIndex((item) => item.key === step);
    const nextStep = APPLICATION_STEPS[Math.min(stepIndex + 1, APPLICATION_STEPS.length - 1)].key;
    get().updateApplication(applicationId, (application) => ({
      ...application,
      currentStep: nextStep,
      completedSteps: application.completedSteps.includes(step) ? application.completedSteps : [...application.completedSteps, step],
    }));
    return nextStep;
  },
  submitApplication: (applicationId) => {
    const application = get().applications.find((item) => item.id === applicationId);
    if (!application) return { error: "Application not found." };
    if (application.status !== "DRAFT") return { reference: application.reference };
    if (!APPLICATION_STEPS.slice(0, -1).every((step) => application.completedSteps.includes(step.key))) return { error: "Complete every application section before submitting." };
    const now = new Date().toISOString();
    get().updateApplication(applicationId, (item) => ({ ...item, status: "SUBMITTED", submittedAt: now, updatedAt: now, completedSteps: [...new Set<ApplicationStep>([...item.completedSteps, "review"])] }));
    return { reference: application.reference };
  },
  possibleDuplicates: (applicationId) => {
    const application = get().applications.find((item) => item.id === applicationId);
    return application ? findPossibleDraftDuplicates(application, get().applications) : [];
  },
}));
