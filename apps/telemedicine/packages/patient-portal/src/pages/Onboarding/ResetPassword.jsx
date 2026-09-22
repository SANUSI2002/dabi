import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Lock, Eye, EyeOff, ArrowLeft, CheckCircle2 } from "lucide-react";
import { resetPassword } from "../../utils/authApi";

const PASSWORD_PATTERN = /^(?=.{8,})(?=.*\d)(?=.*[^A-Za-z0-9]).*$/;

export default function ResetPassword() {
  const navigate = useNavigate();
  const { uid, token } = useParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!success) return;

    const timer = window.setTimeout(() => {
      navigate("/login", { replace: true });
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [success, navigate]);

  const validateFields = () => {
    const errors = {};

    if (!password) {
      errors.password = "New password is required.";
    } else if (!PASSWORD_PATTERN.test(password)) {
      errors.password = "Use at least 8 characters, including a number and a symbol.";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Please confirm your new password.";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!uid || !token) {
      setError("This reset link is not valid. Request a new password reset link.");
      return;
    }

    if (!validateFields()) {
      return;
    }

    setLoading(true);

    try {
      await resetPassword(uid, token, password, confirmPassword);
      setSuccess(true);
    } catch (err) {
      setError(err?.message || "Unable to reset your password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-[2rem] bg-white shadow-2xl border border-gray-100 p-8 sm:p-10">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-900/10">
              <Lock className="text-white w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">Password reset</p>
              <h1 className="text-2xl font-bold text-slate-900">Secure your account</h1>
            </div>
          </div>
          <Link
            to="/login"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Back to Login
          </Link>
        </div>

        {success ? (
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-8 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="w-10 h-10 text-emerald-700" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Password updated</h2>
            <p className="mt-3 text-sm text-slate-600">
              Your password has been reset successfully. You will be redirected to login shortly.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-flex rounded-full bg-emerald-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-800 transition"
            >
              Go to Login
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-6">
              Enter a new password for your account. Your reset link will stay valid only for the time allowed by your email provider.
            </p>

            {error && (
              <div className="mb-6 rounded-3xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">New password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setFieldErrors((current) => ({ ...current, password: undefined }));
                    }}
                    placeholder="Create a strong password"
                    className={`w-full rounded-2xl border px-4 py-3 text-sm text-slate-900 outline-none transition ${
                      fieldErrors.password ? "border-red-300 ring-1 ring-red-100" : "border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-700"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.password ? (
                  <p className="mt-2 text-sm text-red-600">{fieldErrors.password}</p>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">
                    At least 8 characters, plus one number and one special symbol.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Confirm new password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setFieldErrors((current) => ({ ...current, confirmPassword: undefined }));
                    }}
                    placeholder="Repeat your password"
                    className={`w-full rounded-2xl border px-4 py-3 text-sm text-slate-900 outline-none transition ${
                      fieldErrors.confirmPassword ? "border-red-300 ring-1 ring-red-100" : "border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-700"
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <p className="mt-2 text-sm text-red-600">{fieldErrors.confirmPassword}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-gradient-to-r from-emerald-700 via-emerald-800 to-teal-700 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-emerald-900/20 hover:-translate-y-0.5 transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Resetting password..." : "Reset password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
