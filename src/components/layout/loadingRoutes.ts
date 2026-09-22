const routeLabels: Array<[string, string]> = [
  ["/accounting", "Accounting"],
  ["/workforce", "Workforce"],
  ["/hr", "People & HR"],
  ["/laboratory", "Laboratory"],
  ["/radiology", "Radiology"],
  ["/pharmacy/login", "Pharmacy organization sign in"],
  ["/pharmacy", "Pharmacy"],
  ["/pharmacy-portal", "Pharmacy Portal"],
  ["/billing", "Billing"],
  ["/equipment", "Equipment"],
  ["/consultation", "Consultation"],
  ["/patients", "Patient chart"],
  ["/registration", "Patient registration"],
  ["/queue", "Clinical queue"],
  ["/reports", "Reports"],
  ["/settings", "Settings"],
  ["/workspace", "Workspace"],
];

export function routeLabel(pathname: string) {
  return routeLabels.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1] ?? "Sabi OS";
}
