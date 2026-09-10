// Reusable document / letter engine (Phases 23, 38).
//
// Every HR letter (offer, missing-document, query, promotion, transfer, loan
// escalation, warning) is a template with {{placeholders}} that a consumer
// fills with a data bag. Templates are editable in Settings; generated letters
// are logged and rendered through <LetterDoc> for print / PDF.

export type LetterCategory = "Onboarding" | "Discipline" | "Movement" | "Finance" | "General";

export type LetterTemplate = {
  key: string;
  name: string;
  category: LetterCategory;
  /** plain text with {{placeholder}} tokens; blank lines separate paragraphs */
  body: string;
  signatories: string[]; // e.g. ["Authorised Signatory", "Employee (acknowledged)"]
  active?: boolean; // undefined = active
  system?: boolean;
};

export type GeneratedLetter = {
  id: string;
  templateKey: string;
  title: string;
  subjectStaffId?: string;
  reference?: string; // domain doc id (query id, onboarding id, loan id…)
  data: Record<string, string>;
  rendered: string;
  generatedBy: string;
  generatedAt: string;
  sentAt?: string;
  sentTo?: string;
};

export const LETTER_TEMPLATES: LetterTemplate[] = [
  {
    key: "offer",
    name: "Offer of Employment",
    category: "Onboarding",
    system: true,
    signatories: ["For and on behalf of {{organisation}}", "Accepted by {{candidate_name}}"],
    body: `Dear {{candidate_name}},

Following your application and interview, we are pleased to offer you the position of {{position}} in the {{department}} department at {{organisation}}, reporting to {{reporting_to}}.

Your basic salary will be {{basic_salary}} per month, subject to statutory deductions. Your employment type is {{employment_type}} and your expected date of resumption is {{resumption_date}}.

This offer is conditional on satisfactory reference checks and the submission of all required documents. Please indicate your acceptance by signing and returning a copy of this letter on or before {{offer_deadline}}.

We look forward to welcoming you to the team.`,
  },
  {
    key: "missing-document",
    name: "Outstanding Document Notice",
    category: "Onboarding",
    system: true,
    signatories: ["{{issued_by}} — {{issuer_role}}", "Employee acknowledgement"],
    body: `Dear {{employee_name}},

Our records show that the following document(s) required for your employment file remain outstanding:

{{document_list}}

You are required to submit the item(s) above to the {{department}} / HR office on or before {{deadline}}. Failure to comply by this date may affect your confirmation and, where applicable, access to certain duties.

If any document is genuinely unavailable, please provide a written explanation and an expected date of submission.`,
  },
  {
    key: "query",
    name: "Query Letter",
    category: "Discipline",
    system: true,
    signatories: ["{{issued_by}} — Line Manager", "HR", "Employee acknowledgement"],
    body: `Dear {{employee_name}},

RE: {{subject}}

It has been brought to management's attention that {{incident}}.

You are required to provide a written explanation of the above within {{response_days}} working days of receipt of this letter. Your response should be addressed to the Human Resources office.

Please note that this is a formal query and your explanation will be considered before any further action is taken.`,
  },
  {
    key: "promotion",
    name: "Letter of Promotion",
    category: "Movement",
    system: true,
    signatories: ["{{issued_by}} — Human Resources", "Employee acknowledgement"],
    body: `Dear {{employee_name}},

We are pleased to inform you that, following review and the necessary approvals, you have been promoted from {{from_position}} to {{to_position}} with effect from {{effective_date}}.

Your revised basic salary will be {{new_salary}} per month. You will now report to {{new_reporting_to}}.

Congratulations on this well-deserved advancement. We trust you will continue to discharge your duties with the same commitment.`,
  },
  {
    key: "transfer",
    name: "Letter of Transfer",
    category: "Movement",
    system: true,
    signatories: ["{{issued_by}} — Human Resources", "Employee acknowledgement"],
    body: `Dear {{employee_name}},

This is to inform you that you have been transferred from {{from_branch}} to {{to_branch}} with effect from {{effective_date}}.

Your position ({{position}}) and terms of employment remain unchanged. You are expected to complete the handover of your current responsibilities before the effective date and to report to the receiving location on {{effective_date}}.`,
  },
  {
    key: "loan-escalation",
    name: "Loan Repayment Escalation",
    category: "Finance",
    system: true,
    signatories: ["{{issued_by}} — Payroll / Finance"],
    body: `Dear {{employee_name}},

RE: Overdue loan repayment — {{loan_reference}}

Our records indicate that your scheduled repayment of {{period_amount}} for the period ending {{period_end}} has not been received in full. The outstanding shortfall of {{shortfall}} will be added to your next scheduled repayment, making the next amount due {{next_due}}.

Please regularise this at the earliest opportunity. Continued default may result in the full outstanding balance being recovered from your salary or terminal benefits.`,
  },
  {
    key: "warning",
    name: "Warning Letter",
    category: "Discipline",
    signatories: ["{{issued_by}} — Human Resources", "Employee acknowledgement"],
    body: `Dear {{employee_name}},

RE: {{subject}}

Further to the query issued to you and your response thereto, management has decided to issue you this {{warning_level}} warning in respect of {{incident}}.

You are advised that any repetition of this or similar conduct will attract more severe disciplinary action, up to and including termination of your employment.

This letter will be placed in your personnel file.`,
  },
];
