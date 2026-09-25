"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  Sparkles,
  Building2,
  GraduationCap,
  CheckCircle2,
  Github,
  Zap,
  ShieldCheck,
  Fingerprint,
} from "lucide-react";
import { AuthChrome } from "@/components/auth/AuthChrome";
import { FormField, authInputClass } from "@/components/auth/FormField";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { ForgotPasswordModal } from "@/components/auth/ForgotPasswordModal";
import { ForcePasswordResetModal } from "@/components/auth/ForcePasswordResetModal";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { AuthUser, homeRouteForRole } from "@/lib/auth";
import { useAuth } from "@/lib/AuthContext";
import { usePublicStats } from "@/lib/usePublicPlatformData";

// Only the two real public account types get a toggle tab here — Mellow
// Ops/Marketing and superadmin are never self-registered or presented as a
// choosable "type of account" (see MellowStaffPanel.tsx: those are
// superadmin-provisioned, with access superadmin grants per employee).
// Staff still sign in through this exact same form — the tab only changes
// pre-fill/copy, never what credentials are accepted — they just don't get
// a dedicated persona tile advertising them as a signup-style option.
type LoginRole = "user" | "admin";

const ROLE_TABS: { id: LoginRole; label: string; icon: typeof GraduationCap; iconColor: string; fillKey: "user" | "admin_tpo" }[] = [
  { id: "user", label: "Student", icon: GraduationCap, iconColor: "text-emerald-400", fillKey: "user" },
  { id: "admin", label: "College TPO", icon: Building2, iconColor: "text-indigo-400", fillKey: "admin_tpo" },
];

const fieldVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const publicStats = usePublicStats();
  const [selectedRole, setSelectedRole] = useState<LoginRole>("user");
  const [email, setEmail] = useState("alex.chen@student.apex.edu");
  const [password, setPassword] = useState("alex_coder_codeforge");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forcePasswordResetEmail, setForcePasswordResetEmail] = useState<string | null>(null);

  // Fast Demo 1-Click Fill — the sandbox shortcuts still cover every real
  // role (staff and superadmin included), even though the toggle tabs above
  // only ever show Student/College TPO. `selectedRole` here is just which
  // tab visually lights up and which copy/placeholder shows — it has no
  // effect on which credentials the backend actually accepts.
  const handleQuickFill = (role: "superadmin" | "admin_mellow" | "admin_marketing" | "admin_tpo" | "admin_company" | "user") => {
    if (role === "superadmin") {
      setSelectedRole("admin");
      setEmail("aryan@mellow.ai");
      setPassword("super_secure_key_2026");
    } else if (role === "admin_mellow") {
      setSelectedRole("admin");
      setEmail("priya@mellow.ai");
      setPassword("mellow_staff_ops_99");
    } else if (role === "admin_marketing") {
      setSelectedRole("admin");
      setEmail("marketing@mellow.ai");
      setPassword("mellow_marketing_growth_26");
    } else if (role === "admin_tpo") {
      setSelectedRole("admin");
      setEmail("tpo@apex.edu.in");
      setPassword("apex_tpo_placement_2026");
    } else if (role === "admin_company") {
      setSelectedRole("admin");
      setEmail("hiring@nimbuslabs.example.com");
      setPassword("nimbus_hiring_demo_26");
    } else {
      setSelectedRole("user");
      setEmail("alex.chen@student.apex.edu");
      setPassword("alex_coder_codeforge");
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.post<
        { user: AuthUser; token: string } | { must_change_password: true; email: string; message: string }
      >("/login", { email, password });

      // A password an admin/TPO generated on this account's behalf is a
      // one-time credential — the backend refuses to issue a real session
      // for it (see AuthController::login) and hands back this shape
      // instead, so route into the OTP-verified change-password flow
      // rather than treating it as a failed login.
      if ("must_change_password" in res) {
        setForcePasswordResetEmail(res.email);
        setLoading(false);
        return;
      }

      login(res.token, res.user);
      router.push(homeRouteForRole(res.user.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in. Please try again.");
      setLoading(false);
    }
  };

  return (
    <AuthChrome altLabel="Create Account" altHref="/signup">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Brand Hero & Platform Credibility (5 cols) */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="hidden lg:flex lg:col-span-5 flex-col justify-between space-y-6 pr-4"
        >
          <div className="space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-accent-primary/10 text-accent-primary border border-accent-primary/25">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Enterprise & Campus Edition</span>
            </span>

            <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-primary leading-tight">
              One Login. Every Command Center You Need.
            </h1>

            <p className="text-sm text-text-secondary leading-relaxed">
              Sign in to prepare for your next placement drive, run your campus's recruitment pipeline,
              or govern the platform — whichever dashboard is yours.
            </p>
          </div>

          {/* Platform Highlight */}
          <div className="p-4 rounded-panel bg-surface/70 backdrop-blur-md border border-border-subtle space-y-3 shadow-subtle hover:shadow-card hover:border-border-strong transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-control bg-accent-secondary/10 border border-accent-secondary/25 text-accent-secondary flex items-center justify-center">
                <Zap className="w-4.5 h-4.5" />
              </div>
              <div>
                <div className="font-bold text-xs text-primary">Bulk Roster Onboarding</div>
                <div className="text-[11px] text-text-muted">Built for placement cells</div>
              </div>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Onboard an entire batch from a single CSV, and map a new recruiter in minutes instead of a
              week of back-and-forth emails — account creation and welcome emails run automatically.
            </p>
          </div>

          {/* Real Platform Depth */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-subtle text-xs">
            <div>
              <strong className="block text-primary font-mono text-base">{publicStats ? publicStats.problems_total : "—"}</strong>
              <span className="text-[11px] text-text-muted">Practice Problems</span>
            </div>
            <div>
              <strong className="block text-primary font-mono text-base">{publicStats ? publicStats.languages_total : "—"}</strong>
              <span className="text-[11px] text-text-muted">Judge Languages</span>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Production Login Card (7 cols) */}
        <div className="lg:col-span-7">
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="relative w-full max-w-xl mx-auto"
          >
            {/* Ambient glow ring behind the card */}
            <div className="absolute -inset-0.5 rounded-panel bg-gradient-to-r from-accent-primary/20 via-indigo-400/10 to-accent-secondary/20 blur-lg opacity-60 pointer-events-none" />

            <div className="relative p-6 sm:p-8 rounded-panel bg-surface/90 backdrop-blur-xl border border-border-strong shadow-card space-y-6">
              {/* Header Title */}
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-primary tracking-tight">
                  Welcome back
                </h2>
                <p className="text-xs text-text-muted">
                  Choose your account type and authenticate to access your dashboard.
                </p>
              </div>

              {/* 1. Account Role Selector Tabs — sliding pill indicator */}
              <div className="relative p-1 rounded-control bg-elevated border border-border-subtle grid grid-cols-2 gap-1">
                {ROLE_TABS.map((tab) => {
                  const isActive = selectedRole === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleQuickFill(tab.fillKey)}
                      className="relative py-2 rounded-control text-xs font-semibold transition-colors duration-150"
                    >
                      {isActive && (
                        <motion.span
                          layoutId="role-pill"
                          className="absolute inset-0 bg-surface border border-border-strong rounded-control shadow-subtle"
                          transition={{ type: "spring", stiffness: 450, damping: 32 }}
                        />
                      )}
                      <span
                        className={cn(
                          "relative z-10 flex items-center justify-center gap-1.5",
                          isActive ? "text-primary" : "text-text-muted hover:text-primary transition-colors"
                        )}
                      >
                        <Icon className={cn("w-3.5 h-3.5 shrink-0", tab.iconColor)} />
                        <span className="whitespace-nowrap">{tab.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Quick Demo Fill Shortcut Bar */}
              <div className="relative p-3 rounded-control bg-elevated/50 border border-dashed border-border-strong text-xs space-y-2 overflow-hidden">
                <div className="absolute -top-6 -right-6 w-16 h-16 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
                <span className="relative text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-amber-500" />
                  <span>Sandbox &mdash; Quick Demo Logins</span>
                </span>
                <div className="relative flex items-center gap-1.5 flex-wrap">
                  {[
                    { key: "superadmin" as const, label: "Superadmin", emoji: "👑", cls: "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20" },
                    { key: "admin_mellow" as const, label: "Mellow Ops", emoji: "🛠️", cls: "bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border-indigo-500/20" },
                    { key: "admin_marketing" as const, label: "Mellow Marketing", emoji: "📣", cls: "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/20" },
                    { key: "admin_tpo" as const, label: "College TPO", emoji: "🎓", cls: "bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border-cyan-500/20" },
                    { key: "admin_company" as const, label: "Hiring Partner", emoji: "💼", cls: "bg-teal-500/10 text-teal-500 hover:bg-teal-500/20 border-teal-500/20" },
                    { key: "user" as const, label: "Student", emoji: "💻", cls: "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20" },
                  ].map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => handleQuickFill(d.key)}
                      className={cn(
                        "px-2 py-0.5 rounded text-[11px] font-medium border transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0",
                        d.cls
                      )}
                    >
                      {d.emoji} {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Login Form */}
              <motion.form
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                onSubmit={handleLoginSubmit}
                className="space-y-4 text-xs"
              >
                <motion.div variants={fieldVariants}>
                  <FormField label={selectedRole === "admin" ? "Staff / Institutional Email *" : "Email or Handle *"} icon={Mail}>
                    <input
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@domain.com"
                      className={cn(authInputClass, "pl-9 pr-3")}
                    />
                  </FormField>
                </motion.div>

                <motion.div variants={fieldVariants}>
                  <FormField
                    label="Password *"
                    icon={Lock}
                    hint={
                      <button
                        type="button"
                        onClick={() => setShowForgotModal(true)}
                        className="text-[11px] text-accent-primary hover:underline font-medium"
                      >
                        Forgot password?
                      </button>
                    }
                  >
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className={cn(authInputClass, "pl-9 pr-10 font-mono")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={showPassword ? "hide" : "show"}
                          initial={{ opacity: 0, rotate: -45 }}
                          animate={{ opacity: 1, rotate: 0 }}
                          exit={{ opacity: 0, rotate: 45 }}
                          transition={{ duration: 0.15 }}
                          className="flex"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </motion.span>
                      </AnimatePresence>
                    </button>
                  </FormField>
                </motion.div>

                {/* Remember Me */}
                <motion.div variants={fieldVariants} className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-border-subtle text-accent-primary focus:ring-accent-primary"
                    />
                    <span className="text-text-secondary text-xs">Remember this device for 30 days</span>
                  </label>
                </motion.div>

                {/* Auth Error Banner */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-2.5 rounded-control bg-status-danger/10 border border-status-danger/30 text-[11px] text-status-danger font-medium">
                        {error}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit Action Button */}
                <motion.div variants={fieldVariants}>
                  <AuthSubmitButton loading={loading}>
                    {selectedRole === "admin" ? "Enter Admin Portal" : "Launch Candidate Arena"}
                  </AuthSubmitButton>
                </motion.div>
              </motion.form>

              {/* Social / SSO Single Sign-On */}
              <div className="space-y-3 pt-2 border-t border-border-subtle">
                <div className="relative flex justify-center text-[10px] uppercase font-bold text-text-muted">
                  <span className="bg-surface px-2">Or continue with institutional credentials</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleQuickFill("user")}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-xs font-semibold text-text-secondary hover:text-primary transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <Github className="w-4 h-4" />
                    <span>GitHub</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickFill("admin_tpo")}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-xs font-semibold text-text-secondary hover:text-primary transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <Building2 className="w-4 h-4 text-accent-secondary" />
                    <span>University SSO</span>
                  </button>
                </div>
              </div>

              {/* Trust row */}
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[10px] text-text-muted font-mono pt-1">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Encrypted Credentials
                </span>
                <span className="flex items-center gap-1">
                  <Fingerprint className="w-3 h-3 text-emerald-400" />
                  Role-Based Access
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Real Judge Execution
                </span>
              </div>

              {/* Sign Up Redirect */}
              <div className="text-center text-xs text-text-muted">
                Don&apos;t have an account yet?{" "}
                <Link href="/signup" className="text-accent-primary font-bold hover:underline">
                  Sign up now &rarr;
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal open={showForgotModal} onClose={() => setShowForgotModal(false)} />

      {/* First-login gate: a one-time (admin/TPO-generated) password never
          reaches the dashboard directly — this forces an OTP-verified
          permanent password first. */}
      <ForcePasswordResetModal
        open={forcePasswordResetEmail !== null}
        email={forcePasswordResetEmail ?? ""}
        onCancel={() => setForcePasswordResetEmail(null)}
        onComplete={(token, user) => {
          setForcePasswordResetEmail(null);
          login(token, user);
          router.push(homeRouteForRole(user.role));
        }}
      />
    </AuthChrome>
  );
}
