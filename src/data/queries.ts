// Disciplinary queries — a line manager raises a query letter against an
// employee, it escalates through the approval engine to HR for signature,
// and once signed it can be generated as a PDF and sent.

export type QueryStatus = "Drafted" | "Sent";

export type Query = {
  id: string;
  employeeId: string;
  raisedBy: string; // staffId
  subject: string;
  body: string;
  status: QueryStatus;
  raisedAt: string;
  sentAt?: string;
  responseDeadlineDays: number;
};

export const queries: Query[] = [];
