// Notifications, WhatsApp settings and medicine schedules (see the backend's
// docs/NOTIFICATIONS_WHATSAPP.md). Every call returns the `data` of the response.
import { authorizedRequest } from "../utils/sabiIdentity";

const data = async (promise) => (await promise).data;
const post = (path, body = {}) => data(authorizedRequest(path, { method: "POST", body }));

// ---------------- In-app notifications (the bell) ----------------
export const listNotifications = (limit = 20) => data(authorizedRequest("/api/v1/notifications", { query: { limit } }));
export const markNotificationRead = (id) => authorizedRequest(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
export const markAllNotificationsRead = () => authorizedRequest("/api/v1/notifications/read-all", { method: "PATCH" });

// ---------------- Settings → Notifications ----------------
export const getNotificationSettings = () => data(authorizedRequest("/api/v1/notifications/settings"));
export const updateNotificationSettings = (changes) => data(authorizedRequest("/api/v1/notifications/settings", { method: "PUT", body: changes }));
export const sendWhatsAppCode = (phone) => post("/api/v1/notifications/settings/whatsapp", { phone, consent: true });
export const resendWhatsAppCode = () => post("/api/v1/notifications/settings/whatsapp/resend");
export const verifyWhatsAppCode = (code) => post("/api/v1/notifications/settings/whatsapp/verify", { code });
export const turnOffWhatsApp = () => data(authorizedRequest("/api/v1/notifications/settings/whatsapp", { method: "DELETE" }));

// ---------------- Medicines ----------------
export const listSchedules = () => data(authorizedRequest("/api/v1/medication-schedules"));
export const listScheduleSuggestions = () => data(authorizedRequest("/api/v1/medication-schedules/suggestions"));
export const createSchedule = (body) => post("/api/v1/medication-schedules", body);
export const updateSchedule = (id, changes) => data(authorizedRequest(`/api/v1/medication-schedules/${id}`, { method: "PATCH", body: changes }));
export const stopSchedule = (id) => post(`/api/v1/medication-schedules/${id}/stop`);
export const dosesForDay = (day) => data(authorizedRequest("/api/v1/medication-schedules/doses", { query: { day } }));
export const recordDose = (id, status) => post(`/api/v1/medication-schedules/doses/${id}/${status === "SKIPPED" ? "skipped" : "taken"}`);

/** "20:00" → "8:00 pm". */
export function clockLabel(time) {
  const [h, m] = String(time).split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** "YYYY-MM-DD" shifted by whole days. */
export function shiftDay(day, count) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
