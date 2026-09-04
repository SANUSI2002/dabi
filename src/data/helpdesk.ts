const day = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

export type TicketType = "IT Support" | "HR Complaint" | "Facilities" | "Benefits" | "General";
export const TICKET_PREFIX: Record<TicketType, string> = {
  "IT Support": "ITS", "HR Complaint": "HRC", "Facilities": "OPS", "Benefits": "BEN", "General": "GEN",
};

export type TicketPriority = 1 | 2 | 3;
export type TicketStatus = "New" | "In Progress" | "On Hold" | "Resolved";
export type AssigningType = "Individual" | "Department" | "Job Position";

export type Ticket = {
  id: string;
  seq: number;
  type: TicketType;
  title: string;
  description: string;
  raisedBy: string; // staff id
  assigningType: AssigningType;
  raisedOn: string; // department/job-position name, or a staff id for Individual
  assignedTo: string[]; // staff ids
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  resolvedAt?: string;
};

export type FaqCategory = { id: string; name: string };
export type Faq = { id: string; categoryId: string; question: string; answer: string };

export const tickets: Ticket[] = [
  { id: "tk1", seq: 1, type: "IT Support", title: "Cannot log in to EMR after password reset", description: "Password reset email link expired before I could use it.", raisedBy: "s7", assigningType: "Department", raisedOn: "Records & HMIS", assignedTo: ["s4"], priority: 3, status: "In Progress", createdAt: day(2) },
  { id: "tk2", seq: 2, type: "Facilities", title: "Vaccine fridge alarm keeps going off", description: "The EPI room fridge temperature alarm has sounded twice today.", raisedBy: "s6", assigningType: "Individual", raisedOn: "s1", assignedTo: ["s1"], priority: 3, status: "New", createdAt: day(1) },
  { id: "tk3", seq: 3, type: "HR Complaint", title: "Roster clash for next week", description: "I'm scheduled for both the outreach van and clinic duty on the same day.", raisedBy: "s5", assigningType: "Department", raisedOn: "Nursing", assignedTo: ["s2"], priority: 2, status: "Resolved", createdAt: day(10), resolvedAt: day(8) },
  { id: "tk4", seq: 4, type: "Benefits", title: "NHIS enrolment card not received", description: "Started 2 months ago, still no NHIS card.", raisedBy: "s8", assigningType: "Department", raisedOn: "Administration", assignedTo: [], priority: 1, status: "On Hold", createdAt: day(20) },
];

export const faqCategories: FaqCategory[] = [
  { id: "fc1", name: "IT & Systems" },
  { id: "fc2", name: "HR & Payroll" },
];

export const faqs: Faq[] = [
  { id: "fq1", categoryId: "fc1", question: "How do I reset my EMR password?", answer: "Use \"Forgot password\" on the login screen, or ask the HR/Admin Officer to reset it from Settings → Users." },
  { id: "fq2", categoryId: "fc1", question: "The printer in Registration isn't working — who do I tell?", answer: "Raise an IT Support ticket here in Helpdesk; it routes to Records & HMIS." },
  { id: "fq3", categoryId: "fc2", question: "When are payslips issued?", answer: "Payslips are generated after the monthly payroll batch is confirmed, usually by the 28th." },
];
