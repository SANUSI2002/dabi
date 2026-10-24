import { create } from "zustand";
import { useCompanyAssets } from "@/store/useCompanyAssets";
import { useHelpdesk } from "@/store/useHelpdesk";
import { useQueries } from "@/store/useQueries";
import { workforceRequest } from "@/emr-live/client";
import type { AssetAllocation, AssetCategory, AssetRequest, CompanyAsset } from "@/data/companyAssets";
import type { Faq, FaqCategory, Ticket } from "@/data/helpdesk";
import type { Query } from "@/data/queries";
import { adoptLiveIdentity, clean, isoDay, liveChange, uuid } from "./sync";
import { followWorkflows, loadWorkflows } from "./workflows";

// HR services in live mode (GET /services): company assets, the helpdesk and disciplinary queries. The
// server shows each person their own requests, tickets and the assets they hold (HR sees all), numbers
// tickets, and only lets a query be recorded as sent once its workflow has countersigned it.

type ApiServices = {
  selfEmployeeId: string | null; categories: AssetCategory[]; assets: CompanyAsset[]; requests: AssetRequest[]; allocations: AssetAllocation[];
  tickets: Ticket[]; faqCategories: FaqCategory[]; faqs: Faq[]; queries: Query[];
};

export const useLiveServicesMeta = create<{ loaded: boolean }>(() => ({ loaded: false }));
const noNull = <T extends object>(row: T) => Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null)) as T;

export async function loadServices() {
  const { data } = await workforceRequest<{ data: ApiServices }>("/services");
  useLiveServicesMeta.setState({ loaded: true });
  useCompanyAssets.setState({ categories: data.categories, assets: data.assets.map((a) => noNull(a)), requests: data.requests, allocations: data.allocations.map((a) => noNull(a)) });
  useHelpdesk.setState({ tickets: data.tickets.map((t) => noNull(t)), faqCategories: data.faqCategories, faqs: data.faqs });
  useQueries.setState({ queries: data.queries.map((q) => noNull(q)) });
  adoptLiveIdentity(data.selfEmployeeId);
}

const reload = () => loadServices();
const post = (path: string, body: unknown = {}) => workforceRequest(path, { method: "POST", body });

export function goLiveServices() {
  followWorkflows(() => (useLiveServicesMeta.getState().loaded ? loadServices() : Promise.resolve()));
  useCompanyAssets.setState({
    addCategory: (c) => { void liveChange(() => post("/services/asset-categories", clean({ id: uuid(), name: c.name, description: c.description || undefined })), reload); },
    addAsset: (a) => {
      void liveChange(() => post("/services/assets", clean({ id: uuid(), name: a.name, categoryId: a.categoryId, batchNo: a.batchNo || undefined, trackingId: a.trackingId, purchaseDate: isoDay(a.purchaseDate), purchaseCost: a.purchaseCost, expiryDate: isoDay(a.expiryDate) })), reload);
    },
    requestAsset: (employeeId, categoryId, description) => { void liveChange(() => post("/services/asset-requests", { id: uuid(), employeeId, categoryId, description }), reload); },
    decideRequest: (id, status) => { void liveChange(() => post(`/services/asset-requests/${id}/decide`, { status }), reload); },
    allocateAsset: (assetId, employeeId, requestId) => { void liveChange(() => post("/services/allocations", clean({ assetId, employeeId, requestId })), reload); },
    returnAsset: (allocationId, condition, note) => { void liveChange(() => post(`/services/allocations/${allocationId}/return`, clean({ condition, note: note || undefined })), reload); },
  });
  useHelpdesk.setState({
    // The server records who raised it (the signed-in person) and gives it the next number.
    createTicket: (t) => {
      void liveChange(() => post("/services/tickets", { id: uuid(), type: t.type, title: t.title, description: t.description, assigningType: t.assigningType, raisedOn: t.raisedOn, priority: t.priority }), reload);
    },
    setStatus: (id, status) => {
      void liveChange(() => post(`/services/tickets/${id}/status`, { status }), reload, () => useHelpdesk.setState((s) => ({ tickets: s.tickets.map((x) => (x.id === id ? { ...x, status } : x)) })));
    },
    assignTo: (id, staffIds) => { void liveChange(() => post(`/services/tickets/${id}/assign`, { staffIds }), reload); },
    addFaqCategory: (name) => { void liveChange(() => post("/services/faq-categories", { id: uuid(), name }), reload); },
    addFaq: (categoryId, question, answer) => { void liveChange(() => post("/services/faqs", { id: uuid(), categoryId, question, answer }), reload); },
  });
  useQueries.setState({
    raiseQuery: (input) => {
      const id = uuid();
      void liveChange(() => post("/services/queries", { id, employeeId: input.employeeId, subject: input.subject, body: input.body, responseDeadlineDays: input.responseDeadlineDays }), async () => { await Promise.all([loadServices(), loadWorkflows()]); });
      return id;
    },
    // Records that the signed letter was delivered; nothing is sent from here.
    markSent: (id) => { void liveChange(() => post(`/services/queries/${id}/sent`), reload); },
  });
}

export function clearServices() {
  useLiveServicesMeta.setState({ loaded: false });
  useCompanyAssets.setState({ categories: [], assets: [], requests: [], allocations: [] });
  useHelpdesk.setState({ tickets: [], faqCategories: [], faqs: [] });
  useQueries.setState({ queries: [] });
}
