import { create } from "zustand";
import { hasPermission } from "@/command-center/access";
import type { Package, PackageVersion, PlatformPermission, PlatformUser } from "@/command-center/domain";
import { useCommandCenter } from "@/command-center/useCommandCenter";
import { persisted } from "@/platform/persist";
import { useRegistration } from "@/registration/useRegistration";
import { useAuth } from "@/store/useAuth";
import type { CommercialAuditEvent, CommercialOpportunity, CommercialQuote, PaymentPath, QuoteLineItem } from "./domain";

type ActionResult = { ok: true } | { ok: false; error: string };
type CommercialConfiguration = Pick<CommercialOpportunity, "packageId" | "billingCycle" | "branchCount" | "userCount" | "storageGb" | "implementationAmount">;

type CommercialOnboardingState = {
  opportunities: CommercialOpportunity[];
  syncApprovedApplications: () => void;
  updateConfiguration: (applicationId: string, values: CommercialConfiguration) => ActionResult;
  issueQuote: (applicationId: string, discountPercent: number, validDays: number) => ActionResult;
  acceptQuote: (applicationId: string, quoteId: string, signerName: string) => ActionResult;
  selectPaymentPath: (applicationId: string, path: PaymentPath) => ActionResult;
  confirmPayment: (applicationId: string, reference: string) => ActionResult;
  activateCommercialAgreement: (applicationId: string, reason: string) => ActionResult;
};

const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const now = () => new Date().toISOString();

function actorWith(permission: PlatformPermission): PlatformUser | undefined {
  const identity = useAuth.getState().identity;
  const actor = useCommandCenter.getState().platformUsers.find((item) => item.id === identity?.platformUserId);
  return hasPermission(actor, permission) ? actor : undefined;
}

function reason(value: string) {
  const clean = value.trim();
  return clean.length >= 8 ? clean : undefined;
}

function audit(actor: PlatformUser, action: string, why?: string, previousValue?: string, newValue?: string): CommercialAuditEvent {
  return { id: uid("cevt"), action, actorId: actor.id, actorName: actor.name, actorRole: actor.role, timestamp: now(), reason: why, previousValue, newValue };
}

function systemAudit(action: string, newValue?: string): CommercialAuditEvent {
  return { id: uid("cevt"), action, actorId: "system", actorName: "Sabi workflow", actorRole: "SYSTEM", timestamp: now(), newValue };
}

function createOpportunity(applicationId: string): CommercialOpportunity | undefined {
  const application = useRegistration.getState().applications.find((item) => item.id === applicationId);
  if (!application || application.status !== "APPROVED") return undefined;
  const command = useCommandCenter.getState();
  const selectedPackage = command.packages.find((item) => item.id === application.packageId && item.active) ?? command.packages.find((item) => item.active);
  const version = command.packageVersions.find((item) => item.id === selectedPackage?.currentVersionId && item.status === "Published");
  if (!selectedPackage || !version) return undefined;
  const createdAt = now();
  return {
    id: uid("deal"), applicationId, status: "DRAFT", selectedProducts: application.selectedProducts,
    packageId: selectedPackage.id, packageVersionId: version.id, billingCycle: application.billingCycle === "Annual" ? "Annual" : "Monthly",
    branchCount: Math.max(1, application.facility.facilities), userCount: Math.max(selectedPackage.minimumUsers, application.facility.staff), storageGb: selectedPackage.storageLimitGb,
    implementationAmount: 0, quotes: [], paymentStatus: "NOT_STARTED", events: [systemAudit("Approved application entered commercial pipeline", "DRAFT")], createdAt, updatedAt: createdAt,
  };
}

function buildLineItems(item: CommercialOpportunity, selectedPackage: Package, version: PackageVersion): QuoteLineItem[] {
  const annualFactor = item.billingCycle === "Annual" ? 10 : 1;
  const baseAmount = item.billingCycle === "Annual" ? version.annualPrice : version.monthlyPrice;
  const excessBranches = Math.max(0, item.branchCount - selectedPackage.branchLimit);
  const excessUsers = selectedPackage.maximumUsers ? Math.max(0, item.userCount - selectedPackage.maximumUsers) : 0;
  const excessStorage = Math.max(0, item.storageGb - selectedPackage.storageLimitGb);
  return [
    { id: uid("line"), label: `${selectedPackage.name} package`, description: `Published package v${version.version} · ${item.billingCycle.toLowerCase()} billing`, quantity: 1, unitAmount: baseAmount, amount: baseAmount },
    ...(excessBranches ? [{ id: uid("line"), label: "Additional branches", description: `${excessBranches} above package allowance`, quantity: excessBranches, unitAmount: 50_000 * annualFactor, amount: excessBranches * 50_000 * annualFactor }] : []),
    ...(excessUsers ? [{ id: uid("line"), label: "Additional users", description: `${excessUsers} above package allowance`, quantity: excessUsers, unitAmount: 1_000 * annualFactor, amount: excessUsers * 1_000 * annualFactor }] : []),
    ...(excessStorage ? [{ id: uid("line"), label: "Additional storage", description: `${excessStorage} GB above package allowance`, quantity: excessStorage, unitAmount: 2_500 * annualFactor, amount: excessStorage * 2_500 * annualFactor }] : []),
    ...(item.implementationAmount ? [{ id: uid("line"), label: "Implementation services", description: "One-time configured onboarding and migration services", quantity: 1, unitAmount: item.implementationAmount, amount: item.implementationAmount }] : []),
  ];
}

export const useCommercialOnboarding = create<CommercialOnboardingState>(
  persisted<CommercialOnboardingState>("commercial-onboarding-v1", (set, get) => ({
    opportunities: [],
    syncApprovedApplications: () => {
      const approved = useRegistration.getState().applications.filter((item) => item.status === "APPROVED");
      const existing = new Set(get().opportunities.map((item) => item.applicationId));
      const added = approved.map((item) => item.id).filter((id) => !existing.has(id)).map(createOpportunity).filter(Boolean) as CommercialOpportunity[];
      const checkedAt = Date.now();
      let expiredAny = false;
      const existingOpportunities = get().opportunities.map((item) => {
        if (item.status !== "QUOTED" || !item.quotes.some((quote) => quote.status === "ISSUED" && new Date(quote.expiresAt).getTime() < checkedAt)) return item;
        expiredAny = true;
        return { ...item, status: "DRAFT" as const, updatedAt: now(), quotes: item.quotes.map((quote) => quote.status === "ISSUED" && new Date(quote.expiresAt).getTime() < checkedAt ? { ...quote, status: "EXPIRED" as const } : quote), events: [...item.events, systemAudit("Expired an unaccepted commercial quote", "DRAFT")] };
      });
      if (added.length || expiredAny) set({ opportunities: [...added, ...existingOpportunities] });
    },
    updateConfiguration: (applicationId, values) => {
      const actor = actorWith("subscriptions.manage");
      const item = get().opportunities.find((entry) => entry.applicationId === applicationId);
      const command = useCommandCenter.getState();
      const selectedPackage = command.packages.find((entry) => entry.id === values.packageId && entry.active);
      const version = command.packageVersions.find((entry) => entry.id === selectedPackage?.currentVersionId && entry.status === "Published");
      if (!actor) return { ok: false, error: "You do not have permission to configure commercial agreements." };
      if (!item || !["DRAFT", "QUOTED"].includes(item.status)) return { ok: false, error: "This agreement can no longer be reconfigured." };
      if (!selectedPackage || !version) return { ok: false, error: "Choose an active package with a published price version." };
      if (values.branchCount < 1 || values.userCount < 1 || values.storageGb < 1 || values.implementationAmount < 0) return { ok: false, error: "Capacity values must be positive and fees cannot be negative." };
      const updatedAt = now();
      set((state) => ({ opportunities: state.opportunities.map((entry) => entry.id === item.id ? {
        ...entry, ...values, packageVersionId: version.id, status: "DRAFT", updatedAt,
        quotes: entry.quotes.map((quote) => quote.status === "ISSUED" ? { ...quote, status: "SUPERSEDED" } : quote),
        events: [...entry.events, audit(actor, "Updated commercial configuration", undefined, entry.status, "DRAFT")],
      } : entry) }));
      return { ok: true };
    },
    issueQuote: (applicationId, discountPercent, validDays) => {
      const actor = actorWith("subscriptions.manage");
      const item = get().opportunities.find((entry) => entry.applicationId === applicationId);
      const command = useCommandCenter.getState();
      const selectedPackage = command.packages.find((entry) => entry.id === item?.packageId && entry.active);
      const version = command.packageVersions.find((entry) => entry.id === item?.packageVersionId && entry.status === "Published");
      if (!actor) return { ok: false, error: "You do not have permission to issue commercial quotes." };
      if (!item || !["DRAFT", "QUOTED"].includes(item.status)) return { ok: false, error: "This agreement cannot be quoted from its current state." };
      if (!selectedPackage || !version) return { ok: false, error: "The selected package price is unavailable." };
      if (discountPercent < 0 || discountPercent > 30) return { ok: false, error: "Discount must be between 0% and 30%." };
      if (discountPercent > 0 && !hasPermission(actor, "pricing.manage")) return { ok: false, error: "A pricing manager must authorize discounts." };
      if (validDays < 1 || validDays > 90) return { ok: false, error: "Quote validity must be between 1 and 90 days." };
      const lineItems = buildLineItems(item, selectedPackage, version);
      const subtotal = lineItems.reduce((sum, line) => sum + line.amount, 0);
      if (subtotal <= 0) return { ok: false, error: "A zero-value enterprise package requires an implementation or custom fee before quoting." };
      const discountAmount = Math.round(subtotal * discountPercent / 100);
      const taxPercent = 7.5;
      const taxAmount = Math.round((subtotal - discountAmount) * taxPercent / 100);
      const issuedAt = now();
      const expiresAt = new Date(new Date(issuedAt).getTime() + validDays * 86_400_000).toISOString();
      const quoteVersion = Math.max(0, ...item.quotes.map((quote) => quote.version)) + 1;
      const quote: CommercialQuote = {
        id: uid("quote"), number: `SABI-Q-${new Date().getFullYear()}-${applicationId.slice(-5).toUpperCase()}-V${quoteVersion}`, version: quoteVersion, status: "ISSUED", currency: version.currency,
        lineItems, subtotal, discountPercent, discountAmount, taxPercent, taxAmount, total: subtotal - discountAmount + taxAmount,
        issuedAt, expiresAt, issuedBy: actor.id,
      };
      set((state) => ({ opportunities: state.opportunities.map((entry) => entry.id === item.id ? { ...entry, status: "QUOTED", updatedAt: issuedAt, quotes: [...entry.quotes.map((existing) => existing.status === "ISSUED" ? { ...existing, status: "SUPERSEDED" as const } : existing), quote], events: [...entry.events, audit(actor, `Issued quote ${quote.number}`, discountPercent ? `${discountPercent}% authorized discount` : undefined, entry.status, "QUOTED")] } : entry) }));
      return { ok: true };
    },
    acceptQuote: (applicationId, quoteId, signerName) => {
      const cleanName = signerName.trim();
      const item = get().opportunities.find((entry) => entry.applicationId === applicationId);
      const quote = item?.quotes.find((entry) => entry.id === quoteId);
      if (cleanName.length < 3) return { ok: false, error: "Provide the authorized signer's full name." };
      if (!item || item.status !== "QUOTED" || !quote || quote.status !== "ISSUED") return { ok: false, error: "This quote is not available for acceptance." };
      if (new Date(quote.expiresAt).getTime() < Date.now()) return { ok: false, error: "This quote has expired. Request a new version." };
      const acceptedAt = now();
      const event: CommercialAuditEvent = { id: uid("cevt"), action: `Accepted quote ${quote.number}`, actorId: `applicant:${applicationId}`, actorName: cleanName, actorRole: "APPLICANT_SIGNER", timestamp: acceptedAt, previousValue: "QUOTED", newValue: "ACCEPTED" };
      set((state) => ({ opportunities: state.opportunities.map((entry) => entry.id === item.id ? { ...entry, status: "ACCEPTED", updatedAt: acceptedAt, quotes: entry.quotes.map((candidate) => candidate.id === quoteId ? { ...candidate, status: "ACCEPTED", acceptedAt, acceptedByName: cleanName } : candidate), events: [...entry.events, event] } : entry) }));
      return { ok: true };
    },
    selectPaymentPath: (applicationId, path) => {
      const actor = actorWith("billing.manage");
      const item = get().opportunities.find((entry) => entry.applicationId === applicationId);
      if (!actor) return { ok: false, error: "You do not have permission to configure payment activation." };
      if (!item || item.status !== "ACCEPTED") return { ok: false, error: "The current quote must be accepted before choosing activation terms." };
      const paymentStatus = path === "TRIAL" ? "WAIVED" : "PENDING";
      set((state) => ({ opportunities: state.opportunities.map((entry) => entry.id === item.id ? { ...entry, status: "PAYMENT_PENDING", paymentPath: path, paymentStatus, updatedAt: now(), events: [...entry.events, audit(actor, `Selected ${path.replace("_", " ").toLowerCase()} activation path`, undefined, "ACCEPTED", "PAYMENT_PENDING")] } : entry) }));
      return { ok: true };
    },
    confirmPayment: (applicationId, rawReference) => {
      const actor = actorWith("billing.manage");
      const reference = rawReference.trim();
      const item = get().opportunities.find((entry) => entry.applicationId === applicationId);
      if (!actor) return { ok: false, error: "You do not have permission to confirm payments." };
      if (!item || item.status !== "PAYMENT_PENDING" || !["INVOICE", "MANUAL_TRANSFER"].includes(item.paymentPath ?? "")) return { ok: false, error: "This agreement is not awaiting a confirmable payment." };
      if (reference.length < 6) return { ok: false, error: "Provide a payment or invoice reference of at least six characters." };
      const confirmedAt = now();
      set((state) => ({ opportunities: state.opportunities.map((entry) => entry.id === item.id ? { ...entry, paymentStatus: "CONFIRMED", paymentReference: reference, paymentConfirmedAt: confirmedAt, updatedAt: confirmedAt, events: [...entry.events, audit(actor, "Confirmed commercial payment authorization", reference, "PENDING", "CONFIRMED")] } : entry) }));
      return { ok: true };
    },
    activateCommercialAgreement: (applicationId, rawReason) => {
      const actor = actorWith("subscriptions.manage");
      const why = reason(rawReason);
      const item = get().opportunities.find((entry) => entry.applicationId === applicationId);
      if (!actor || !hasPermission(actor, "billing.manage")) return { ok: false, error: "Activation requires subscription and billing permissions." };
      if (!why) return { ok: false, error: "Provide an activation rationale of at least eight characters." };
      if (!item || item.status !== "PAYMENT_PENDING" || !["CONFIRMED", "WAIVED"].includes(item.paymentStatus)) return { ok: false, error: "Payment confirmation or an authorized trial is required before activation." };
      const activatedAt = now();
      set((state) => ({ opportunities: state.opportunities.map((entry) => entry.id === item.id ? { ...entry, status: "ACTIVE", activatedAt, updatedAt: activatedAt, events: [...entry.events, audit(actor, "Activated pre-provisioning commercial agreement", why, "PAYMENT_PENDING", "ACTIVE")] } : entry) }));
      return { ok: true };
    },
  }), { scope: "global", pick: (state) => ({ opportunities: state.opportunities }) }),
);
