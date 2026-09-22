import React, { useCallback, useMemo, useState } from "react";
import { Button } from "design-system";
import { SectionCard, ToggleSwitch } from "../shared";
import { SECURITY } from "../data";
import Modal from "../shared/Modal";
import { MailCheck } from "lucide-react";

function getPasswordStrength(password) {
  if (!password) {
    return { label: "Enter a password", score: 0, width: 0 };
  }

  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) {
    return { label: "Weak", score, width: 25 };
  }
  if (score === 2) {
    return { label: "Fair", score, width: 50 };
  }
  if (score === 3) {
    return { label: "Good", score, width: 75 };
  }
  return { label: "Strong", score, width: 100 };
}

export function SecurityCard() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(SECURITY.twoFactorEnabled);
  const [show2faModal, setShow2faModal] = useState(false);
  const [pending2faValue, setPending2faValue] = useState(null);
  const [showPasswordConfirmModal, setShowPasswordConfirmModal] = useState(false);
  const [showPasswordEmailModal, setShowPasswordEmailModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPasswordShown, setConfirmPasswordShown] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const passwordStrength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);

  const closeToast = () => setToast("");

  const showToast = (message) => {
    setToast(message);
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => setToast(""), 2400);
  };

  // Stable handlers (useCallback) so Modal's props don't change identity
  // on every keystroke — this is what previously caused Modal's effect
  // to re-run and steal focus while typing.
  const closePasswordModal = useCallback(() => {
    setShowPasswordModal(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setErrors({});
  }, []);

  const close2faModal = useCallback(() => {
    setShow2faModal(false);
    setPending2faValue(null);
  }, []);

  const closePasswordConfirmModal = useCallback(() => {
    setShowPasswordConfirmModal(false);
  }, []);

  const proceedToPasswordChange = useCallback(() => {
    setShowPasswordConfirmModal(false);
    setShowPasswordEmailModal(true);
  }, []);

  const submitPasswordChange = () => {
    const nextErrors = {};
    if (!currentPassword.trim()) nextErrors.currentPassword = "Enter your current password.";
    if (!newPassword.trim()) nextErrors.newPassword = "Choose a new password.";
    else if (passwordStrength.score < 3) nextErrors.newPassword = "Use at least 8 characters with a mix of letters, numbers, and symbols.";
    if (!confirmPassword.trim()) nextErrors.confirmPassword = "Please confirm your new password.";
    else if (confirmPassword !== newPassword) nextErrors.confirmPassword = "Passwords do not match.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      closePasswordModal();
      showToast("✅ Password updated successfully.");
    }, 650);
  };

  const request2faToggle = (nextValue) => {
    setPending2faValue(nextValue);
    setShow2faModal(true);
  };

  const confirm2faChange = () => {
    setTwoFactorEnabled(Boolean(pending2faValue));
    setShow2faModal(false);
    setPending2faValue(null);
    showToast(`✅ Two-Factor Authentication ${Boolean(pending2faValue) ? "enabled" : "disabled"} successfully.`);
  };

  return (
    <>
      <SectionCard
        icon="🛡️"
        title="Security"
        headerRight={<span className="sabi-pill">Last changed {SECURITY.lastChanged}</span>}
      >
        <div className="sabi-security-grid">
          <div className="sabi-security-row">
            <div>
              <div className="sabi-security-title">Change Password</div>
              <div className="sabi-security-sub">Update your security credentials.</div>
            </div>
            <Button variant="outline" onClick={() => setShowPasswordConfirmModal(true)}>
              Change Password
            </Button>
          </div>
          <div className="sabi-security-row">
            <div>
              <div className="sabi-security-title">Two-Factor Auth</div>
              <div className="sabi-security-sub">Enhanced account protection.</div>
            </div>
            <ToggleSwitch
              checked={twoFactorEnabled}
              label="Two-factor authentication"
              onChange={(event) => request2faToggle(event.target.checked)}
            />
          </div>
        </div>
      </SectionCard>

      <Modal
        // open={show2faModal}
        title={pending2faValue ? "Enable Two-Factor Authentication?" : "Disable Two-Factor Authentication?"}
        description={
          pending2faValue
            ? "Adding Two-Factor Authentication provides an extra layer of security by requiring a verification code when signing in from a new device."
            : "Disabling Two-Factor Authentication reduces the security of your account. You will only need your password to sign in."
        }
        onClose={close2faModal}
        busy={busy}
        actions={
          <>
            <Button type="button" variant="secondary" onClick={close2faModal} disabled={busy}>
              {pending2faValue ? "Cancel" : "Keep Enabled"}
            </Button>
            <Button type="button" variant="primary" onClick={confirm2faChange} disabled={busy}>
              {pending2faValue ? "Enable 2FA" : "Disable 2FA"}
            </Button>
          </>
        }
      />

      <Modal
        open={showPasswordConfirmModal}
        title="Change your password?"
        description="You're about to update the password for your account. You'll need your current password to continue."
        onClose={closePasswordConfirmModal}
        busy={busy}
        actions={
          <>
            <Button type="button" variant="secondary" onClick={closePasswordConfirmModal} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={proceedToPasswordChange} disabled={busy}>
              Yes, Continue
            </Button>
          </>
        }
      />

        <Modal
          open={showPasswordEmailModal}
          title="Check your email"
          description="We've sent a secure password reset link to your registered email address. Open the email and follow the instructions to create a new password.

        If you don't see the email within a few minutes, please check your Spam or Junk folder."
          onClose={() => setShowPasswordEmailModal(false)}
          actions={
            <Button
              type="button"
              variant="primary"
              onClick={() => setShowPasswordEmailModal(false)}
            >
              Done
            </Button>
          }
        >
          <div className="sabi-email-success">
            <MailCheck size={40} />
          </div>
        </Modal>
        

      <Modal
        open={showPasswordModal}
        title="Change Password"
        description="Use a strong password and keep it unique to your account."
        onClose={closePasswordModal}
        busy={busy}
        size="lg"
        actions={
          <>
            <Button type="button" variant="secondary" onClick={closePasswordModal} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={submitPasswordChange} disabled={busy}>
              {busy ? "Updating..." : "Update Password"}
            </Button>
          </>
        }
      >
        <div className="sabi-field">
          <label className="sabi-field-label">Current Password</label>
          <div className="sabi-password-field">
            <input
              className="sabi-field-input"
              type={showPassword ? "text" : "password"}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
            <button type="button" className="sabi-password-toggle" onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {errors.currentPassword ? <div className="sabi-form-error">{errors.currentPassword}</div> : null}
        </div>

        <div className="sabi-field">
          <label className="sabi-field-label">New Password</label>
          <div className="sabi-field-hint">
            Use 8+ characters with a mix of uppercase letters, numbers, and symbols.
          </div>
          <div className="sabi-password-field">
            <input
              className="sabi-field-input"
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <button type="button" className="sabi-password-toggle" onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {errors.newPassword ? <div className="sabi-form-error">{errors.newPassword}</div> : null}
          <div className="sabi-password-strength" aria-live="polite">
            <div className="sabi-password-strength-bar">
              <span style={{ width: `${passwordStrength.width}%`, background: passwordStrength.score >= 3 ? "var(--sabi-success)" : passwordStrength.score >= 2 ? "var(--sabi-warning)" : "var(--sabi-danger)" }} />
            </div>
            <div className="sabi-password-strength-text">Strength: {passwordStrength.label}</div>
          </div>
        </div>

        <div className="sabi-field">
          <label className="sabi-field-label">Confirm New Password</label>
          <div className="sabi-password-field">
            <input
              className="sabi-field-input"
              type={confirmPasswordShown ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            <button type="button" className="sabi-password-toggle" onClick={() => setConfirmPasswordShown((value) => !value)}>
              {confirmPasswordShown ? "Hide" : "Show"}
            </button>
          </div>
          {errors.confirmPassword ? <div className="sabi-form-error">{errors.confirmPassword}</div> : null}
        </div>
      </Modal>

      {toast ? <div className="sabi-toast" onClick={closeToast}>{toast}</div> : null}
    </>
  );
}

export default SecurityCard;
