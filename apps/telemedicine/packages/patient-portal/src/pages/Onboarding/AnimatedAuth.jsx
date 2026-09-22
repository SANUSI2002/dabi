import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, User, Eye, EyeOff, HeartPulse } from "lucide-react";
import "./styles/index.css";

export default function AnimatedAuth() {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [signInForm, setSignInForm] = useState({ email: "", password: "" });
  const [signUpForm, setSignUpForm] = useState({ name: "", email: "", password: "" });

  const updateSignIn = (field) => (e) =>
    setSignInForm((f) => ({ ...f, [field]: e.target.value }));
  const updateSignUp = (field) => (e) =>
    setSignUpForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSignIn = (e) => {
    e.preventDefault();
    navigate("/dashboard");
  };

  const handleSignUp = (e) => {
    e.preventDefault();
    navigate("/verify");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4 sm:p-6">
      {/* Desktop: animated sliding panel */}
      <div className={`sabi-auth-container ${isSignUp ? "right-panel-active" : ""}`}>
        {/* Sign In form */}
        <div className="sabi-auth-form-container sabi-auth-signin-container">
          <div className="w-full h-full flex items-center px-10 lg:px-14 bg-white">
            <div className="w-full">
              <Brand />
              <h2 className="mt-6 text-2xl font-bold text-gray-900">Welcome back</h2>
              <p className="mt-1 text-sm text-gray-500">
                Sign in to access your health dashboard.
              </p>
              <SignInFormFields
                form={signInForm}
                update={updateSignIn}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                onSubmit={handleSignIn}
              />
            </div>
          </div>
        </div>

        {/* Sign Up form */}
        <div className="sabi-auth-form-container sabi-auth-signup-container">
          <div className="w-full h-full flex items-center px-10 lg:px-14 bg-white">
            <div className="w-full">
              <Brand />
              <h2 className="mt-6 text-2xl font-bold text-gray-900">Register Now</h2>
              <p className="mt-1 text-sm text-gray-500">
                Create your account to get started.
              </p>
              <SignUpFormFields
                form={signUpForm}
                update={updateSignUp}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                onSubmit={handleSignUp}
              />
            </div>
          </div>
        </div>

        {/* Overlay */}
        <div className="sabi-auth-overlay-container">
          <div className="sabi-auth-overlay">
            <div className="sabi-auth-overlay-panel sabi-auth-overlay-left">
              <HeartPulse className="w-10 h-10 mb-4 text-emerald-200" />
              <h3 className="text-2xl font-bold">Welcome Back!</h3>
              <p className="mt-3 text-sm text-emerald-100/90 leading-relaxed">
                Already have an account? Sign in to keep track of your health
                journey.
              </p>
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
                className="mt-6 px-8 py-3 rounded-xl border-2 border-white/70 font-semibold text-sm hover:bg-white hover:text-emerald-800 transition-colors"
              >
                Sign In
              </button>
            </div>

            <div className="sabi-auth-overlay-panel sabi-auth-overlay-right">
              <HeartPulse className="w-10 h-10 mb-4 text-emerald-200" />
              <h3 className="text-2xl font-bold">Hello, Friend!</h3>
              <p className="mt-3 text-sm text-emerald-100/90 leading-relaxed">
                New to Sabi Health? Register now to unlock personalized care
                and insights.
              </p>
              <button
                type="button"
                onClick={() => setIsSignUp(true)}
                className="mt-6 px-8 py-3 rounded-xl border-2 border-white/70 font-semibold text-sm hover:bg-white hover:text-emerald-800 transition-colors"
              >
                Register Now
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: tabbed single-column card (sliding panel doesn't fit small screens) */}
      <div className="md:hidden w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 p-6">
        <Brand />
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-gray-100 mt-6 mb-6">
          <button
            type="button"
            onClick={() => setIsSignUp(false)}
            className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${
              !isSignUp ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setIsSignUp(true)}
            className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${
              isSignUp ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500"
            }`}
          >
            Register Now
          </button>
        </div>

        {isSignUp ? (
          <SignUpFormFields
            form={signUpForm}
            update={updateSignUp}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            onSubmit={handleSignUp}
          />
        ) : (
          <SignInFormFields
            form={signInForm}
            update={updateSignIn}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            onSubmit={handleSignIn}
          />
        )}
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center shadow-sm shadow-emerald-900/20">
        <HeartPulse className="w-5 h-5 text-white" />
      </div>
      <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-emerald-900 to-emerald-600 bg-clip-text text-transparent">
        Sabi Health
      </span>
    </div>
  );
}

function SignInFormFields({ form, update, showPassword, setShowPassword, onSubmit }) {
  return (
    <form className="mt-5 space-y-3.5" onSubmit={onSubmit}>
      <InputField
        icon={Mail}
        type="email"
        placeholder="Email address"
        value={form.email}
        onChange={update("email")}
      />
      <InputField
        icon={Lock}
        type={showPassword ? "text" : "password"}
        placeholder="Password"
        value={form.password}
        onChange={update("password")}
        trailing={
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="text-gray-400 hover:text-emerald-700 transition-colors"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        }
      />
      <div className="text-right">
        <a href="#" className="text-xs text-emerald-700 font-semibold hover:underline">
          Forgot password?
        </a>
      </div>
      <button
        type="submit"
        className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-700 via-emerald-800 to-teal-700 text-white font-semibold text-sm shadow-md shadow-emerald-900/25 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all"
      >
        Sign In
      </button>
    </form>
  );
}

function SignUpFormFields({ form, update, showPassword, setShowPassword, onSubmit }) {
  return (
    <form className="mt-5 space-y-3.5" onSubmit={onSubmit}>
      <InputField
        icon={User}
        type="text"
        placeholder="Full name"
        value={form.name}
        onChange={update("name")}
      />
      <InputField
        icon={Mail}
        type="email"
        placeholder="Email address"
        value={form.email}
        onChange={update("email")}
      />
      <InputField
        icon={Lock}
        type={showPassword ? "text" : "password"}
        placeholder="Password"
        value={form.password}
        onChange={update("password")}
        trailing={
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="text-gray-400 hover:text-emerald-700 transition-colors"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        }
      />
      <button
        type="submit"
        className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-700 via-emerald-800 to-teal-700 text-white font-semibold text-sm shadow-md shadow-emerald-900/25 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all"
      >
        Register Now
      </button>
    </form>
  );
}

function InputField({ icon: Icon, trailing, ...inputProps }) {
  return (
    <div className="relative group">
      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 group-focus-within:text-emerald-700 transition-colors" />
      <input
        {...inputProps}
        className={`w-full pl-10 ${
          trailing ? "pr-11" : "pr-4"
        } py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 transition-all`}
      />
      {trailing && (
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{trailing}</div>
      )}
    </div>
  );
}
