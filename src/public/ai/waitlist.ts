import { apiBaseUrl, apiConfigured } from "@/config/runtime";

/** Adds someone to the Sabi AI waitlist (POST /api/v1/waitlist). Contact details only. */
export async function joinWaitlist(details: { email: string; name?: string; role: string; organisation?: string; source: string }) {
  if (!apiConfigured) throw new Error("The waitlist isn't reachable from this preview. Please try again on sabihealth.org.");
  const response = await fetch(`${apiBaseUrl}/api/v1/waitlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product: "sabi-ai", consent: true, ...details }),
  });
  if (response.status === 429) throw new Error("Too many attempts from this connection. Please try again in a few minutes.");
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.errors?.[0]?.field === "body.email" ? "Please enter a valid email address." : "We couldn't add you just now. Please try again.");
  }
}
