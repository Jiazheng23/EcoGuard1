import { useState } from "react";
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
import { supabase } from "../../services/supabaseClient";
import {
  loginUser,
  registerUser,
  sendPasswordReset,
} from "../../services/authService";

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
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    adminCode: "",
  });

  function switchMode(nextMode) {
    const paths = {
      login: "/login",
      register: "/register",
      forgot: "/forgot-password",
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

    setMessage("");
    setIsSubmitting(true);

    const cleanEmail = form.email.trim().toLowerCase();

    try {
      if (mode === "forgot") {
        await sendPasswordReset(cleanEmail);
        setSubmitted(true);
        return;
      }

      if (mode === "login") {
        const data = await loginUser(cleanEmail, form.password);

        const accountRole = data.profile?.role || "tourist";

        if (role !== accountRole) {
          await supabase.auth.signOut();

          throw new Error(
            `This account is registered as ${accountRole === "admin" ? "a Location Admin" : "a Tourist"}.`,
          );
        }

        if (accountRole === "admin") {
          navigate("/admin/dashboard");
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
          adminCode: form.adminCode,
        });
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
  }[mode];

  return (
    <main className="auth-page">
      <aside className="auth-showcase">
        <div>
          <Link className="auth-back auth-back--light" to="/login">
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
        <Link className="auth-back auth-back--mobile" to="/login">
          <ArrowLeft size={16} /> Back
        </Link>
        <div className="auth-card">
          <header>
            <h1>{heading[0]}</h1>
            <p>{heading[1]}</p>
          </header>

          {mode !== "forgot" && (
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
                className={role === "admin" ? "selected" : ""}
                onClick={() => setRole("admin")}
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

          {submitted ? (
            <div className="auth-success">
              <CheckCircle2 size={48} />
              <strong>Reset link sent!</strong>
              <p>Check your email for instructions to reset your password.</p>
              <button type="button" onClick={() => switchMode("login")}>
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
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
              {mode === "register" && role === "admin" && (
                <Field
                  label="Administrator registration code"
                  icon={<ShieldCheck size={17} />}
                  name="adminCode"
                  type="password"
                  placeholder="Code provided by EcoGuard owner"
                  value={form.adminCode}
                  onChange={updateField}
                />
              )}
              <Field
                label="Email address"
                icon={<Mail size={17} />}
                name="email"
                type="email"
                placeholder={
                  role === "admin"
                    ? "location.admin@ecoguard.my"
                    : "tourist@example.com"
                }
                value={form.email}
                onChange={updateField}
              />
              {mode !== "forgot" && (
                <div className="field">
                  <div className="field__label">
                    <label htmlFor="password">Password</label>
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
              {mode === "register" && (
                <Field
                  label="Confirm password"
                  icon={<LockKeyhole size={17} />}
                  name="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={form.confirmPassword}
                  onChange={updateField}
                />
              )}
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
                  ? `Sign In as ${role === "admin" ? "Location Admin" : "Tourist"}`
                  : mode === "register"
                    ? isSubmitting
                      ? "Creating account..."
                      : "Create Account"
                    : "Send Reset Link"}
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
          required
        />
      </div>
    </div>
  );
}
