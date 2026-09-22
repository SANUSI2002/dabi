const JSON_HEADERS = { "Content-Type": "application/json" };

async function parseApiError(response) {
  let message = "Something went wrong. Please try again.";

  try {
    const body = await response.json();
    if (body) {
      if (typeof body === "string") {
        message = body;
      } else if (body.error) {
        message = body.error;
      } else if (body.message) {
        message = body.message;
      } else if (body.detail) {
        message = body.detail;
      } else if (typeof body === "object") {
        const values = Object.values(body).flat();
        if (values.length) {
          message = values.join(" ");
        }
      }
    }
  } catch (err) {
    // ignore parse failures and use fallback message
  }

  return message;
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

export async function requestPasswordReset(email) {
  const response = await fetch("/forgot-password", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ email: String(email).trim() }),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.status === 204 ? null : response.json();
}

export async function resetPassword(uid, token, password, confirmPassword) {
  const url = `/reset-password/${encodeURIComponent(uid)}/${encodeURIComponent(token)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ password, confirm_password: confirmPassword }),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.status === 204 ? null : response.json();
}
