import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Eye,
  EyeOff,
  Leaf,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./auth.css";
import "./auth-layout-stability.css";
import "./auth-overrides.css";
import { hadPasswordRecoveryRedirect, supabase } from "../../services/supabaseClient";
import LoadingScreen from "../../components/LoadingScreen";
import LocationAdminCheckingPage from "../location_admin/LocationAdminCheckingPage";
import {
  loginUser,
  signInWithGoogle,
  registerUser,
  sendPasswordReset,
  updateRecoveredPassword,
} from "../../services/authService";
import {
  hasPasswordRecoveryEvidence,
  passwordRecoveryError,
  validateNewPassword,
} from "../../utils/passwordValidation";
import { getApplicationSetup } from "../../services/locationAdminApplicationService";
import { authenticatedRequest } from "../../services/authenticatedRequest";
import { getOwnProfile } from "../../services/profileService";
import { useToast } from "../../components/toastContext";

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
  const location = useLocation();
  const toast = useToast();
  const mode = initialMode;
  const [role, setRole] = useState(location.state?.registrationRole === "location_admin" ? "location_admin" : "tourist");
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState(location.state?.authError || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleRoleUser, setGoogleRoleUser] = useState(null);
  const [googleRoleChoice, setGoogleRoleChoice] = useState("");
  const [googleRoleMessage, setGoogleRoleMessage] = useState("");
  const [isCheckingLocationAdmin, setIsCheckingLocationAdmin] = useState(false);
  const showGoogleRoleModal = location.state?.googleRoleSelection === true;
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
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!showGoogleRoleModal || !supabase) return undefined;
    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error || !data.user) {
        setGoogleRoleMessage("Your Google session could not be verified. Please sign in again.");
        return;
      }
      setGoogleRoleUser(data.user);
    });
    return () => { active = false; };
  }, [showGoogleRoleModal]);

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
    setFieldErrors((current) => ({ ...current, [event.target.name]: undefined }));
  }

  function validateForm() {
    const errors = {};
    const cleanEmail = form.email.trim();
    if (mode === "register" && form.name.trim().length < 2) errors.name = "Enter your full name (at least 2 characters).";
    if (mode !== "reset") {
      if (!cleanEmail) errors.email = "Email address is required.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) errors.email = "Enter a valid email address.";
    }
    if (mode !== "forgot") {
      if (!form.password) errors.password = "Password is required.";
      else if ((mode === "register" || mode === "reset") && form.password.length < 8) errors.password = "Password must contain at least 8 characters.";
    }
    if (mode === "register" || mode === "reset") {
      if (!form.confirmPassword) errors.confirmPassword = "Please confirm your password.";
      else if (form.password !== form.confirmPassword) errors.confirmPassword = "Passwords do not match.";
    }
    return errors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting || isGoogleLoading) return;

    const nextErrors = validateForm();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast.reminder("Please correct the highlighted fields before continuing.");
      return;
    }

    if (!supabase) {
      setMessage(
        "Supabase is not configured. Add your VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY values.",
      );
      toast.error("Supabase is not configured. Authentication is unavailable.");
      return;
    }

    if (mode === "register" && form.password !== form.confirmPassword) {
      setMessage("Passwords do not match. Please check and try again.");
      setFieldErrors({ confirmPassword: "Passwords do not match." });
      toast.reminder("Please correct the highlighted field.");
      return;
    }

    if (mode === "reset") {
      if (recoveryStatus !== "ready") {
        setMessage("Open a valid password reset link from your email before choosing a new password.");
        toast.reminder("Open a valid password reset link before continuing.");
        return;
      }
      const passwordError = validateNewPassword(form.password, form.confirmPassword);
      if (passwordError) {
        setMessage(passwordError);
        setFieldErrors({ password: passwordError });
        toast.reminder(passwordError);
        return;
      }
    }

    setMessage("");
    setIsSubmitting(true);

    const cleanEmail = form.email.trim().toLowerCase();

    try {
      if (mode === "forgot") {
        await sendPasswordReset(cleanEmail);
        toast.success("Password reset instructions have been requested.");
        setSubmitted(true);
        return;
      }

      if (mode === "reset") {
        await updateRecoveredPassword(form.password);
        toast.success("Your password has been updated successfully.");
        setSubmitted(true);
        return;
      }

      if (mode === "login") {
        const data = await loginUser(cleanEmail, form.password);
        toast.success("Signed in successfully.");

        const accountRole = data.profile?.role || "tourist";

        if (accountRole === "super_admin") {
          navigate("/super_admin/dashboard", { replace: true });
        } else if (accountRole === "location_admin") {
          navigate("/location_admin/dashboard", { replace: true });
        } else if (accountRole === "pending_location_admin") {
          setIsCheckingLocationAdmin(true);
          const applicationSetup = await getApplicationSetup();
          const destination = applicationSetup.applicationStatus === "pending"
            ? "/location_admin/pending"
            : "/location_admin/application";
          navigate(destination, { replace: true, state: { applicationSetup } });
        } else {
          navigate("/tourist/dashboard", { replace: true });
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
        toast.success("Account created successfully.");
        if (role === 'location_admin') {
          await loginUser(cleanEmail, form.password)
          navigate('/location_admin/application', { replace: true })
          return
        }
        navigate("/login", { replace: true });
      }
    } catch (error) {
      setIsCheckingLocationAdmin(false);
      setMessage(error.message || "Authentication failed. Please try again.");
      toast.error(error.message || "Authentication failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function chooseGoogleRole(selectedRole) {
    if (!googleRoleUser || googleRoleChoice) return;
    setGoogleRoleChoice(selectedRole);
    setGoogleRoleMessage("");
    try {
      if (selectedRole === "location_admin") {
        await authenticatedRequest("/api/auth/google-application", {
          method: "POST",
          body: JSON.stringify({ initialGoogleOnboarding: true }),
        });
      }
      const profile = await getOwnProfile(googleRoleUser);
      if (profile.role === "pending_location_admin") {
        const applicationSetup = await getApplicationSetup();
        navigate(applicationSetup.applicationStatus === "pending"
          ? "/location_admin/pending"
          : "/location_admin/application", { replace: true, state: { applicationSetup } });
        return;
      }
      navigate(profile.role === "location_admin"
        ? "/location_admin/dashboard"
        : profile.role === "super_admin"
          ? "/super_admin/dashboard"
          : "/tourist/dashboard", { replace: true });
    } catch (error) {
      setGoogleRoleMessage(error.message || "Your account could not be registered. Please try again.");
      setGoogleRoleChoice("");
    }
  }

  async function cancelGoogleRegistration() {
    if (googleRoleChoice) return;
    setGoogleRoleChoice("cancel");
    setGoogleRoleMessage("");
    try {
      await authenticatedRequest("/api/auth/google-onboarding/cancel", {
        method: "POST",
        keepalive: true,
      });
      await supabase.auth.signOut({ scope: "local" });
      navigate("/login", { replace: true, state: null });
    } catch (error) {
      // A role was never selected, but the backend's short onboarding window may
      // have expired while this page was closed. Account switching must still
      // sign out locally instead of presenting that expiry as a completed signup.
      if (error.message === "This Google account has already completed registration.") {
        await supabase.auth.signOut({ scope: "local" });
        navigate("/login", { replace: true, state: null });
        return;
      }
      setGoogleRoleMessage(error.message || "Could not switch Google accounts. Please try again.");
      setGoogleRoleChoice("");
    }
  }

  const heading = {
    login: ["Welcome back", "Sign in to your EcoGuard account"],
    register: ["Create account", "Start your sustainable journey today"],
    forgot: ["Reset password", "Enter your email and we'll send a reset link"],
    reset: ["Create new password", "Choose a secure password for your EcoGuard account"],
  }[mode];

  if (mode === "reset" && recoveryStatus === "checking") {
    return <LoadingScreen fullScreen label="Checking your password reset link..." />;
  }

  if (isCheckingLocationAdmin) {
    return <LocationAdminCheckingPage />;
  }

  return (
    <main className={`auth-page auth-page--${mode}${showGoogleRoleModal ? " auth-page--modal-open" : ""}`}>
      <aside className="auth-showcase" aria-hidden={showGoogleRoleModal || undefined} inert={showGoogleRoleModal ? "" : undefined}>
        <div>
          <Link className="auth-back auth-back--light" to="/">
            <ArrowLeft size={16} /> Back to Home
          </Link>
          <div className="auth-brand">
            <span className="auth-brand__mark">
              <Leaf size={19} />
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

      <section className="auth-content" aria-hidden={showGoogleRoleModal || undefined} inert={showGoogleRoleModal ? "" : undefined}>
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
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {mode === "register" && (
                <Field
                  label="Full name"
                  icon={<UserRound size={17} />}
                  name="name"
                  placeholder="Ahmad Rizal"
                  value={form.name}
                  onChange={updateField}
                  error={fieldErrors.name}
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
                  error={fieldErrors.email}
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
                  <div className={`field__input ${fieldErrors.password ? "field__input--error" : ""}`}>
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
                      aria-invalid={Boolean(fieldErrors.password)}
                      aria-describedby={fieldErrors.password ? "password-error" : undefined}
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
                  {fieldErrors.password && <small id="password-error" className="field-error">{fieldErrors.password}</small>}
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
                  error={fieldErrors.confirmPassword}
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
                disabled={isSubmitting || isGoogleLoading}
              >
                {mode === "login"
                  ? isSubmitting
                    ? "Signing In..."
                    : "Sign In"
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

          {(mode === "login" || mode === "register") && (
            <div className="auth-social">
              <div className="auth-divider"><span>or continue with</span></div>
              <button className="auth-google" type="button" disabled={isSubmitting || isGoogleLoading}
                onClick={async () => {
                  setMessage("");
                  setIsGoogleLoading(true);
                  try {
                    await signInWithGoogle();
                  } catch (error) {
                    setMessage(error.message || "Google sign-in could not start. Please try again.");
                    setIsGoogleLoading(false);
                  }
                }}>
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.02 46.98 31.86 46.98 24.55Z" />
                  <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.79-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
                </svg>
                {isGoogleLoading ? "Connecting to Google..." : "Continue with Google"}
              </button>
              {mode === "register" && (
                <p className="auth-social-note">New Google users choose their role after Google verifies the account.</p>
              )}
            </div>
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
      {showGoogleRoleModal && (
        <>
          <div className="google-role-backdrop" aria-hidden="true" />
          <section className="google-role-modal" role="dialog" aria-modal="true" aria-labelledby="google-role-title">
            <div className="google-role-topline">
              <span className="google-role-brand"><Leaf size={21} /> EcoGuard</span>
              <span className="google-role-step">Final step</span>
            </div>
            <div className="google-role-heading">
              <h1 id="google-role-title">Create your EcoGuard account</h1>
              <p>
                {googleRoleUser
                  ? <><strong>{googleRoleUser.email}</strong> is not registered yet. Choose how you want to use EcoGuard.</>
                  : "Checking your Google account before registration..."}
              </p>
            </div>
            <div className="google-role-options">
              <button type="button" disabled={!googleRoleUser || Boolean(googleRoleChoice)} onClick={() => chooseGoogleRole("tourist")}>
                <span><UserRound size={22} /></span>
                <div><strong>Continue as Tourist</strong><small>Track trips, eco score, and environmental impact</small></div>
                {googleRoleChoice === "tourist" ? <em>Creating...</em> : <ArrowRight className="google-role-arrow" size={19} />}
              </button>
              <button type="button" disabled={!googleRoleUser || Boolean(googleRoleChoice)} onClick={() => chooseGoogleRole("location_admin")}>
                <span><ShieldCheck size={22} /></span>
                <div><strong>Apply as Location Admin</strong><small>Continue to the location and document application</small></div>
                {googleRoleChoice === "location_admin" ? <em>Preparing...</em> : <ArrowRight className="google-role-arrow" size={19} />}
              </button>
            </div>
            {googleRoleMessage && (
              <div className="google-role-error" role="alert">
                <AlertCircle size={19} />
                <p>{googleRoleMessage}</p>
                <button type="button" aria-label="Dismiss message" onClick={() => setGoogleRoleMessage("")}>
                  <X size={17} />
                </button>
              </div>
            )}
            <button className="google-role-cancel" type="button" disabled={Boolean(googleRoleChoice)} onClick={cancelGoogleRegistration}>
              {googleRoleChoice === "cancel" ? "Switching account..." : "Use a different account"}
            </button>
          </section>
        </>
      )}
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
  error,
}) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <div className={`field__input ${error ? "field__input--error" : ""}`}>
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
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : undefined}
        />
      </div>
      {error && <small id={`${name}-error`} className="field-error">{error}</small>}
    </div>
  );
}
