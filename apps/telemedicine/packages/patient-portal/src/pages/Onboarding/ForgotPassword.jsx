import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, HeartPulse, ArrowLeft, CheckCircle2 } from "lucide-react";
import { isValidEmail, requestPasswordReset } from "../../utils/authApi";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmedEmail = String(email).trim();
    if (!trimmedEmail) {
      setError("Enter the email address associated with your account.");
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(trimmedEmail);
      setSent(true);
    } catch (err) {
      setError(err?.message || "Unable to send the reset link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-6">

      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-gray-100 p-8">

        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center">
            <HeartPulse className="text-white w-6 h-6" />
          </div>

          <span className="text-xl font-bold bg-gradient-to-r from-emerald-900 to-emerald-600 bg-clip-text text-transparent">
            Sabi Health
          </span>
        </div>

        {!sent ? (
          <>
            <div className="mt-8 flex justify-center">
              <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center">
                <Mail className="w-10 h-10 text-emerald-700" />
              </div>
            </div>

            <h1 className="mt-6 text-center text-3xl font-bold text-gray-900">
              Forgot Password?
            </h1>

            <p className="mt-3 text-center text-gray-500 leading-relaxed">
              Enter the email associated with your account and we'll send you a secure password reset link.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">

              {error && (
                <div className="rounded-3xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600" />

                <input
                  type="email"
                  value={email}
                  placeholder="Email address"
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 py-3 pl-12 pr-4 text-sm focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 outline-none"
                />
              </div>

              <button
                disabled={loading}
                className="w-full rounded-xl py-3 bg-gradient-to-r from-emerald-700 via-emerald-800 to-teal-700 text-white font-semibold shadow-lg hover:-translate-y-0.5 transition disabled:opacity-70"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>

            </form>

            <Link
              to="/login"
              className="mt-8 flex items-center justify-center gap-2 text-sm font-semibold text-emerald-700 hover:underline"
            >
              <ArrowLeft size={16} />
              Back to Login
            </Link>
          </>
        ) : (
          <>
            <div className="mt-4 flex justify-center">
              <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-700" />
              </div>
            </div>

            <h2 className="mt-6 text-center text-3xl font-bold">
              Check your email
            </h2>

            <p className="mt-4 text-center text-gray-500 leading-relaxed">
              We've sent a secure password reset link to
            </p>

            <p className="text-center font-bold text-emerald-700 mt-2 break-all">
              {email}
            </p>

            <div className="mt-8 rounded-2xl bg-emerald-50 border border-emerald-100 p-5">

              <p className="text-sm text-gray-600">
                • The link expires in <strong>30 minutes</strong>.
              </p>

              <p className="mt-2 text-sm text-gray-600">
                • Check your Spam or Junk folder if you don't see it.
              </p>

              <p className="mt-2 text-sm text-gray-600">
                • For your security, each link can only be used once.
              </p>

            </div>

            <Link
              to="/login"
              className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-emerald-700 hover:underline"
            >
              <ArrowLeft size={16} />
              Back to Login
            </Link>
          </>
        )}

      </div>
    </div>
  );
}