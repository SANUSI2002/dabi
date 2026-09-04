import { create } from "zustand";
import * as seed from "@/data/helpdesk";
import { audit } from "@/store/useAudit";
import { useHr } from "@/store/useHr";
import type { Ticket, TicketStatus, TicketType, AssigningType, TicketPriority, FaqCategory, Faq } from "@/data/helpdesk";

const rid = () => Math.random().toString(36).slice(2, 9);
const who = (id: string) => useHr.getState().byId(id)?.name ?? id;

type HelpdeskState = {
  tickets: Ticket[];
  faqCategories: FaqCategory[];
  faqs: Faq[];

  createTicket: (t: { type: TicketType; title: string; description: string; raisedBy: string; assigningType: AssigningType; raisedOn: string; priority: TicketPriority }) => void;
  setStatus: (id: string, status: TicketStatus) => void;
  assignTo: (id: string, staffIds: string[]) => void;

  addFaqCategory: (name: string) => void;
  addFaq: (categoryId: string, question: string, answer: string) => void;

  ticketCode: (t: Ticket) => string;
};

export const useHelpdesk = create<HelpdeskState>((set, get) => ({
  tickets: seed.tickets,
  faqCategories: seed.faqCategories,
  faqs: seed.faqs,

  createTicket: (t) => {
    audit("raised helpdesk ticket", `hr/helpdesk/${t.title}`, { user: who(t.raisedBy) });
    const seq = get().tickets.length + 1;
    set((s) => ({
      tickets: [{ ...t, id: rid(), seq, assignedTo: [], status: "New", createdAt: new Date().toISOString() }, ...s.tickets],
    }));
  },

  setStatus: (id, status) => {
    const t = get().tickets.find((x) => x.id === id);
    audit(`ticket ${status.toLowerCase()}`, `hr/helpdesk/${t?.title ?? id}`);
    set((s) => ({
      tickets: s.tickets.map((x) => (x.id === id ? { ...x, status, resolvedAt: status === "Resolved" ? new Date().toISOString() : x.resolvedAt } : x)),
    }));
  },

  assignTo: (id, staffIds) => {
    audit("assigned ticket", `hr/helpdesk/${id}`);
    set((s) => ({ tickets: s.tickets.map((x) => (x.id === id ? { ...x, assignedTo: staffIds } : x)) }));
  },

  addFaqCategory: (name) => {
    set((s) => ({ faqCategories: [...s.faqCategories, { id: rid(), name }] }));
  },

  addFaq: (categoryId, question, answer) => {
    audit("published FAQ", `hr/helpdesk/faq/${question}`);
    set((s) => ({ faqs: [...s.faqs, { id: rid(), categoryId, question, answer }] }));
  },

  ticketCode: (t) => `${seed.TICKET_PREFIX[t.type]}-${1000 + t.seq}`,
}));
