import { randomBytes, randomUUID } from "node:crypto";

const base = process.argv[2]?.replace(/\/$/, "");
if (!base || !/^http:\/\/127\.0\.0\.1:517[34]$|^https:\/\/(?:sabi-health-delta|sabi-emr|sabi-pharmacy|sabi-command-center|sabi-telemedicine)\.vercel\.app$|^https:\/\/sabi-health-api-test\.onrender\.com$/.test(base)) {
  throw new Error("Pass a local Sabi dev origin, a Sabi Vercel test site, or the dedicated Render test API URL.");
}

const email = `sabi.smoke+${randomUUID()}@example.test`;
const password = `${randomBytes(32).toString("base64url")}A1!`;
const origin = base === "https://sabi-health-api-test.onrender.com" ? "http://127.0.0.1:5173" : base;

async function request(path, { method = "GET", body, token, cookie, browser = false } = {}) {
  const response = await fetch(`${base}/api/v1/auth${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(browser ? { Origin: origin, "X-Sabi-Client": "browser" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${data.message || data.error?.message || "unexpected response"}`);
  return { status: response.status, data, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}

const registered = await request("/register/patient", {
  method: "POST",
  body: { email, password, firstName: "Sabi", lastName: "Smoke", consentGiven: true },
});
const login = await request("/login", { method: "POST", body: { email, password }, browser: true });
if (!login.data.accessToken || !login.cookie) throw new Error("Login did not create a browser session.");

const me = await request("/me", { token: login.data.accessToken });
if (me.data.user?.email !== email) throw new Error("Authenticated identity did not match the test account.");

const refreshed = await request("/refresh", { method: "POST", body: {}, browser: true, cookie: login.cookie });
if (!refreshed.data.accessToken || !refreshed.cookie) throw new Error("Session refresh failed.");

const loggedOut = await request("/logout", { method: "POST", body: {}, browser: true, cookie: refreshed.cookie });
console.log(`Disposable identity smoke test passed: register ${registered.status}, login ${login.status}, me ${me.status}, refresh ${refreshed.status}, logout ${loggedOut.status}.`);
