// Access tokens stay in memory. Sabi Identity owns sessions and professional approval.
export function createDoctorAuthClient({ base, fetcher = (...args) => fetch(...args), lock = (work) => typeof navigator !== "undefined" && navigator.locks ? navigator.locks.request("sabi-identity-refresh", work) : work() }) {
  let accessToken = null;
  let restoring = null;
  let sessionDoctor = null;
  async function request(path, options = {}) {
    if (!base) throw new Error("Sabi Identity is unavailable. Please try again later.");
    const response = await fetcher(`${base}/api/v1${path}`, {
      ...options, credentials: "include", signal: options.signal || AbortSignal.timeout(30000),
      headers: { "Content-Type": "application/json", "X-Sabi-Client": "browser", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...options.headers },
    });
    const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error?.message || data.message || data.errors?.map((e) => e.message).join(" ") || "This request could not be completed."), { status: response.status, code: data.error?.code || data.code });
    return data;
  }
  async function doctorForSession() {
    const me = await request("/auth/me");
    let professional;
    try { professional = (await request("/professionals/me")).data; }
    catch (error) { if (error.status !== 404) throw error; }
    if (professional?.professionType !== "DOCTOR") throw Object.assign(new Error("This Sabi ID does not have a doctor profile. Use patient sign-in or complete doctor registration."), { code: "DOCTOR_ACCESS_REQUIRED", status: 403 });
    const user = me.user;
    return {
      id: professional.id, userId: user.id, name: user.fullName || "Doctor", email: user.email,
      initials: (user.fullName || "Doctor").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(),
      accountStatus: user.accountStatus === "ACTIVE" ? "active" : "inactive",
      emailVerified: Boolean(user.emailVerifiedAt), licenceVerified: professional.verificationStatus === "VERIFIED",
      verificationStatus: professional.verificationStatus, specialty: professional.specialty,
      hospital: professional.practiceName || "Independent practice", hospitalId: null, memberships: me.organizations || [],
    };
  }
  function approved(doctor) { return doctor?.accountStatus === "active" && doctor.emailVerified && doctor.licenceVerified; }
  async function restore() {
    if (!base) return { doctor: null };
    if (!restoring) restoring = (async () => {
      try {
        if (!accessToken) {
          const result = await lock(() => request("/auth/refresh", { method: "POST", body: "{}" }));
          if (!result.accessToken) throw new Error("Sabi Identity returned an invalid session.");
          accessToken = result.accessToken;
        }
        let doctor;
        try { doctor = await doctorForSession(); }
        catch (error) {
          if (error.status !== 401) throw error;
          const refreshed = await lock(() => request("/auth/refresh", { method: "POST", body: "{}" }));
          accessToken = refreshed.accessToken;
          doctor = await doctorForSession();
        }
        sessionDoctor = doctor;
        return { doctor: approved(doctor) ? doctor : null };
      } catch (error) {
        if (error.status === 401 || error.status === 403) { accessToken = null; sessionDoctor = null; return { doctor: null }; }
        throw error;
      }
    })().finally(() => { restoring = null; });
    return restoring;
  }
  async function authenticated(path, options = {}) {
    if ((!accessToken || !approved(sessionDoctor)) && !(await restore()).doctor) throw Object.assign(new Error("Please sign in with an approved doctor account."), { status: 401 });
    const used = accessToken;
    try { return await request(path, options); }
    catch (error) {
      if (error.status !== 401) throw error;
      if (accessToken === used) accessToken = null;
      if (!(await restore()).doctor) throw error;
      return request(path, options);
    }
  }
  return {
    restore, authenticated,
    signIn: async (email, password) => {
      accessToken = null;
      sessionDoctor = null;
      const result = await request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      if (result.status === "mfa_required" && result.challengeToken) return { mfaRequired: true, challengeId: result.challengeToken };
      if (!result.accessToken) throw new Error("Sabi Identity returned an invalid sign-in response.");
      accessToken = result.accessToken;
      sessionDoctor = await doctorForSession();
      return { doctor: sessionDoctor };
    },
    verifySignIn: async (challengeId, code, recovery = false) => {
      const result = await request("/auth/mfa/login/verify", { method: "POST", body: JSON.stringify({ challengeToken: challengeId, [recovery ? "recoveryCode" : "code"]: code }) });
      if (!result.accessToken) throw new Error("Sabi Identity returned an invalid verification response.");
      accessToken = result.accessToken;
      sessionDoctor = await doctorForSession();
      return { doctor: sessionDoctor };
    },
    signOut: async () => { await request("/auth/logout", { method: "POST", body: "{}" }); accessToken = null; sessionDoctor = null; },
    requestPasswordReset: (email) => request("/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email }) }),
  };
}
