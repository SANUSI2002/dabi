// Sabi Health's public contact details. Every page reads them from here.
export type ContactLine = { display: string; tel: string; whatsapp: string };

export const CONTACT_LINES: readonly ContactLine[] = [
  { display: "0903 221 3671", tel: "+2349032213671", whatsapp: "2349032213671" },
  { display: "+234 708 908 5813", tel: "+2347089085813", whatsapp: "2347089085813" },
];

export const CONTACT_EMAILS = [
  { label: "Support", address: "support@sabihealth.org" },
  { label: "General enquiries", address: "info@sabihealth.org" },
] as const;

const GREETING = "Hello Sabi Health, I'd like to find out more.";

export const whatsappUrl = (line: ContactLine, message = GREETING) => `https://wa.me/${line.whatsapp}?text=${encodeURIComponent(message)}`;
export const telUrl = (line: ContactLine) => `tel:${line.tel}`;
