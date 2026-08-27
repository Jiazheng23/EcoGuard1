import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Eye,
  EyeOff,
  Leaf,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import "./auth.css";
import "./auth-layout-stability.css";
import "./auth-overrides.css";
import { hadPasswordRecoveryRedirect, supabase } from "../../services/supabaseClient";
import {
  loginUser,
  registerUser,
  sendPasswordReset,
  updateRecoveredPassword,
} from "../../services/authService";
import {
  hasPasswordRecoveryEvidence,
  passwordRecoveryError,
  validateNewPassword,
} from "../../utils/passwordValidation";

const features = [
  {
    icon: Leaf,
    title: "Personal Eco Score",
    description: "Track your environmental impact in real time",
  },
  {
    icon: BarChart3,
    title: "Carbon Analytics",
    description: "Detailed trip-by-trip emission breakdowns",
  },
  {
    icon: ShieldCheck,
    title: "Early Warnings",
    description: "Alerts before ecological damage occurs",
  },
];

export default function AuthPage({ initialMode }) {
  const navigate = useNavigate();
  const mode = initialMode;
  const [role, setRole] = useState("tourist");
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState(
    initialMode === "reset" ? supabase ? "checking" : "invalid" : "not_applicable",
  );
  const [recoveryMessage, setRecoveryMessage] = useState(
    initialMode === "reset" && !supabase
      ? "Supabase is not configured, so this reset link cannot be verified."
      : "",
  );
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (mode !== "reset") return undefined;
    if (!supabase) return undefined;

    let active = true;
    let recoveryEventSeen = false;
    const linkError = passwordRecoveryError(window.location.href);
    const hasRecoveryLink = hadPasswordRecoveryRedirect || hasPasswordRecoveryEvidence(window.location.href);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || event !== "PASSWORD_RECOVERY") return;
      recoveryEventSeen = true;
      if (session) {
        setRecoveryStatus("ready");
        setRecoveryMessage("");
      }
    });

    if (linkError) {
      Promise.resolve().then(() => {
        if (!active) return;
        setRecoveryStatus("invalid");
        setRecoveryMessage(linkError);
      });
    } else {
      supabase.auth.initialize().then(async ({ error: initializationError }) => {
        if (!active) return;
        const { data, error } = await supabase.auth.getSession();
        if (!active) return;
        if (initializationError || error || !data.session || (!hasRecoveryLink && !recoveryEventSeen)) {
          setRecoveryStatus("invalid");
          setRecoveryMessage(initializationError?.message || "This password reset link is invalid, expired, or has already been used.");
          return;
        }
        setRecoveryStatus("ready");
        setRecoveryMessage("");
      });
    }

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [mode]);

  function switchMode(nextMode) {
    const paths = {
      login: "/login",
      register: "/register",
      forgot: "/forgot-password",
      reset: "/reset-password",
    };
    navigate(paths[nextMode]);
  }

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
    setMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity();
      return;
    }

    if (!supabase) {
      setMessage(
        "Supabase is not configured. Add your VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY values.",
      );
      return;
    }

    if (mode === "register" && form.password !== form.confirmPassword) {
      setMessage("Passwords do not match. Please check and try again.");
      return;
    }

    if (mode === "reset") {
      if (recoveryStatus !== "ready") {
        setMessage("Open a valid password reset link from your email before choosing a new password.");
        return;
      }
      const passwordError = validateNewPassword(form.password, form.confirmPassword);
      if (passwordError) {
        setMessage(passwordError);
        return;
      }
    }

    setMessage("");
    setIsSubmitting(true);

    const cleanEmail = form.email.trim().toLowerCase();

    try {
      if (mode === "forgot") {
        await sendPasswordReset(cleanEmail);
        setSubmitted(true);
        return;
      }

      if (mode === "reset") {
        await updateRecoveredPassword(form.password);
        setSubmitted(true);
        return;
      }

      if (mode === "login") {
        const data = await loginUser(cleanEmail, form.password);

        const accountRole = data.profile?.role || "tourist";

        if (accountRole === "super_admin") {
          navigate("/super_admin/dashboard");
        } else if (accountRole === "location_admin") {
          navigate("/location_admin/dashboard");
        } else if (accountRole === "pending_location_admin") {
          navigate("/location_admin/application");
        } else {
          navigate("/tourist/dashboard");
        }

        return;
      }

      if (mode === "register") {
        await registerUser({
          name: form.name.trim(),
          email: cleanEmail,
          password: form.password,
          role,
        });
        if (role === 'location_admin') {
          await loginUser(cleanEmail, form.password)
          navigate('/location_admin/application')
          return
        }
        navigate("/login");
      }
    } catch (error) {
      setMessage(error.message || "Authentication failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const heading = {
    login: ["Welcome back", "Sign in to your EcoGuard account"],
    register: ["Create account", "Start your sustainable journey today"],
    forgot: ["Reset password", "Enter your email and we'll send a reset link"],
    reset: ["Create new password", "Choose a secure password for your EcoGuard account"],
  }[mode];

  return (
    <main className={`auth-page auth-page--${mode}`}>
      <aside className="auth-showcase">
        <div>
          <Link className="auth-back auth-back--light" to="/">
            <ArrowLeft size={16} /> Back to Home
          </Link>
          <div className="auth-brand">
            <span className="auth-brand__mark">
              <ShieldCheck size={21} />
            </span>
            <span>EcoGuard EEWS</span>
          </div>
          <h2>
            Monitor.
            <br />
            Protect.
            <br />
            Sustain.
          </h2>
          <p>
            Join Malaysia's ecological early warning system. Track your carbon
            footprint, monitor environmental conditions, and contribute to
            sustainable tourism.
          </p>
        </div>
        <div className="auth-features">
          {features.map(({ icon: Icon, title, description }) => (
            <div className="auth-feature" key={title}>
              <span>
                <Icon size={17} />
              </span>
              <div>
                <strong>{title}</strong>
                <small>{description}</small>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className="auth-content">
        <Link className="auth-back auth-back--mobile" to="/">
          <ArrowLeft size={16} /> Back
        </Link>
        <div className={`auth-card auth-card--${mode}`}>
          <header>
            <h1>{heading[0]}</h1>
            <p>{heading[1]}</p>
          </header>

          {mode === "register" && (
            <div className="role-picker">
              <button
                className={role === "tourist" ? "selected" : ""}
                onClick={() => setRole("tourist")}
                type="button"
              >
                <span>
                  <UserRound size={20} />
                </span>
                <strong>Tourist</strong>
                <small>Track your eco impact</small>
              </button>
              <button
                className={role === "location_admin" ? "selected" : ""}
                onClick={() => setRole("location_admin")}
                type="button"
              >
                <span>
                  <ShieldCheck size={20} />
                </span>
                <strong>Location Admin</strong>
                <small>Manage your location</small>
              </button>
            </div>
          )}

          {mode === "reset" && recoveryStatus === "checking" ? (
            <div className="auth-recovery-state">
              <span className="auth-recovery-spinner" aria-hidden="true" />
              <strong>Verifying reset link</strong>
              <p>Please wait while EcoGuard verifies your recovery session.</p>
            </div>
          ) : mode === "reset" && recoveryStatus === "invalid" ? (
            <div className="auth-recovery-state auth-recovery-state--error" role="alert">
              <LockKeyhole size={42} />
              <strong>Reset link unavailable</strong>
              <p>{recoveryMessage}</p>
              <button type="button" onClick={() => switchMode("forgot")}>
                Request a New Reset Link
              </button>
            </div>
          ) : submitted ? (
            <div className="auth-success">
              <CheckCircle2 size={48} />
              <strong>{mode === "reset" ? "Password updated!" : "Reset request received!"}</strong>
              <p>{mode === "reset" ? "Your old sessions have been signed out. Sign in again with your new password." : "If an EcoGuard account exists for that email, a password reset link will arrive shortly."}</p>
              <button type="button" onClick={() => switchMode("login")}>
                Back to Sign In
              </button>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              {mode === "register" && (
                <Field
                  label="Full name"
                  icon={<UserRound size={17} />}
                  name="name"
                  placeholder="Ahmad Rizal"
                  value={form.name}
                  onChange={updateField}
                />
              )}
              {mode !== "reset" && (
                <Field
                  label="Email address"
                  icon={<Mail size={17} />}
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder={role === "location_admin" ? "location.admin@ecoguard.my" : "tourist@example.com"}
                  value={form.email}
                  onChange={updateField}
                />
              )}
              {mode !== "forgot" && (
                <div className="field">
                  <div className="field__label">
                    <label htmlFor="password">{mode === "reset" ? "New password" : "Password"}</label>
                    {mode === "login" && (
                      <button
                        type="button"
                        onClick={() => switchMode("forgot")}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="field__input">
                    <LockKeyhole size={17} />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={form.password}
                      onChange={updateField}
                      minLength={mode === "reset" ? 8 : undefined}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      required
                    />
                    <button
                      type="button"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      onClick={() => setShowPassword((visible) => !visible)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}
              {(mode === "register" || mode === "reset") && (
                <Field
                  label={mode === "reset" ? "Confirm new password" : "Confirm password"}
                  icon={<LockKeyhole size={17} />}
                  name="confirmPassword"
                  type="password"
                  minLength={mode === "reset" ? 8 : undefined}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={form.confirmPassword}
                  onChange={updateField}
                />
              )}
              {mode === "reset" && <p className="password-requirements">Use at least 8 characters with uppercase, lowercase, and a number.</p>}
              {message && (
                <p className="form-message" role="alert">
                  {message}
                </p>
              )}
              <button
                className="auth-submit"
                type="submit"
                disabled={isSubmitting}
              >
                {mode === "login"
                  ? "Sign In"
                  : mode === "register"
                    ? isSubmitting
                      ? "Creating account..."
                      : "Create Account"
                    : mode === "forgot"
                      ? isSubmitting
                        ? "Sending Reset Link..."
                        : "Send Reset Link"
                      : isSubmitting
                        ? "Updating Password..."
                        : "Update Password"}
              </button>
            </form>
          )}

          {!submitted && (
            <p className="auth-switch">
              {mode === "login" ? (
                <>
                  Don't have an account?{" "}
                  <button onClick={() => switchMode("register")}>
                    Sign up free
                  </button>
                </>
              ) : mode === "register" ? (
                <>
                  Already have an account?{" "}
                  <button onClick={() => switchMode("login")}>Sign in</button>
                </>
              ) : (
                <>
                  Remember your password?{" "}
                  <button onClick={() => switchMode("login")}>Sign in</button>
                </>
              )}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  icon,
  name,
  type = "text",
  placeholder,
  value,
  onChange,
  minLength,
  autoComplete,
}) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <div className="field__input">
        {icon}
        <input
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          minLength={minLength}
          autoComplete={autoComplete}
          required
        />
      </div>
    </div>
  );
}
