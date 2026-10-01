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
  Briefcase,
  GraduationCap,
  CheckCircle2,
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

// The three real customer-facing account types — every one of them is
// something a real visitor could plausibly land on this page needing.
// Superadmin/Mellow-staff are NEVER presented here, in dev or production —
// see /mellow-internal, a separate unlisted route. Keeping that boundary on
// this page too (not just in prod) means there's exactly one login surface
// to ever audit for "does this leak an internal credential."
type LoginRole = "user" | "admin_tpo" | "admin_company";

// Each role gets its own accent so the whole card reacts to the selected
// tab (pill glow, ambient backdrop, header icon, CTA copy) instead of
// everything staying one flat indigo regardless of who's signing in —
// mirrors the per-role accent treatment /signup already uses for its
// account-type cards (see ACCOUNT_TYPES there).
const ROLE_TABS: {
  id: LoginRole;
  label: string;
  icon: typeof GraduationCap;
  subtitle: string;
  cta: string;
  accent: {
    idleIcon: string;
    activeIcon: string;
    pill: string;
    glow: string;
    ring: string;
    chipBg: string;
    chipBorder: string;
  };
}[] = [
  {
    id: "user",
    label: "Student",
    icon: GraduationCap,
    subtitle: "Sign in to practice, compete, and track every placement drive you're eligible for.",
    cta: "Launch Candidate Arena",
    accent: {
      idleIcon: "text-emerald-500/60 dark:text-emerald-400/50",
      activeIcon: "text-emerald-600 dark:text-emerald-400",
      pill: "bg-emerald-500/10 border-emerald-500/40",
      glow: "shadow-[0_0_18px_-6px_rgba(16,185,129,0.55)]",
      ring: "from-emerald-400/30 via-emerald-300/10 to-accent-primary/25",
      chipBg: "bg-emerald-500/10",
      chipBorder: "border-emerald-500/25",
    },
  },
  {
    id: "admin_tpo",
    label: "College TPO",
    icon: Building2,
    subtitle: "Sign in to run your campus placement pipeline, drives, and student readiness.",
    cta: "Enter Placement Console",
    accent: {
      idleIcon: "text-indigo-500/60 dark:text-indigo-400/50",
      activeIcon: "text-indigo-600 dark:text-indigo-400",
      pill: "bg-indigo-500/10 border-indigo-500/40",
      glow: "shadow-[0_0_18px_-6px_rgba(99,102,241,0.55)]",
      ring: "from-indigo-400/30 via-indigo-300/10 to-accent-primary/25",
      chipBg: "bg-indigo-500/10",
      chipBorder: "border-indigo-500/25",
    },
  },
  {
    id: "admin_company",
    label: "Hiring Partner",
    icon: Briefcase,
    subtitle: "Sign in to manage your candidate pipeline, interviews, and hiring drives.",
    cta: "Enter Hiring Console",
    accent: {
      idleIcon: "text-amber-500/60 dark:text-amber-400/50",
      activeIcon: "text-amber-600 dark:text-amber-400",
      pill: "bg-amber-500/10 border-amber-500/40",
      glow: "shadow-[0_0_18px_-6px_rgba(245,158,11,0.55)]",
      ring: "from-amber-400/30 via-amber-300/10 to-accent-secondary/25",
      chipBg: "bg-amber-500/10",
      chipBorder: "border-amber-500/25",
    },
  },
];

// Local-dev convenience only. `IS_DEV` is `process.env.NODE_ENV !== "production"`,
// which Next.js/webpack inlines at build time — in a real `next build` this
// evaluates to the literal `false`, and Terser's dead-code elimination then
// strips the whole DEMO_LOGINS object (credentials included) out of the
// shipped bundle, the same way React strips its own dev-only code. This is
// NOT just hiding the panel with CSS: the plaintext strings themselves never
// reach the production JS. Verified by building and grepping `out/` for
// these values — see the verification step in this change's plan.
const IS_DEV = process.env.NODE_ENV !== "production";

const DEMO_LOGINS: Record<LoginRole, { email: string; password: string }> | null = IS_DEV
  ? {
      user: { email: "alex.chen@student.apex.edu", password: "alex_coder_codeforge" },
      admin_tpo: { email: "tpo@apex.edu.in", password: "apex_tpo_placement_2026" },
      admin_company: { email: "hiring@nimbuslabs.example.com", password: "nimbus_hiring_demo_26" },
    }
  : null;

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
  const [email, setEmail] = useState(DEMO_LOGINS ? DEMO_LOGINS.user.email : "");
  const [password, setPassword] = useState(DEMO_LOGINS ? DEMO_LOGINS.user.password : "");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forcePasswordResetEmail, setForcePasswordResetEmail] = useState<string | null>(null);

  // Selecting a tab always updates which persona's copy/labels show; in dev
  // only, it also convenience-prefills that persona's demo credentials
  // (DEMO_LOGINS is null in production, so this is a no-op there).
  const handleTabClick = (role: LoginRole) => {
    setSelectedRole(role);
    if (DEMO_LOGINS) {
      setEmail(DEMO_LOGINS[role].email);
      setPassword(DEMO_LOGINS[role].password);
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

  const activeTab = ROLE_TABS.find((tab) => tab.id === selectedRole) ?? ROLE_TABS[0];
  const ActiveIcon = activeTab.icon;
  const isStudent = selectedRole === "user";

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
              <Sparkles className="w-3.5 h-3.5 animate-pulse-subtle" />
              <span>Enterprise & Campus Edition</span>
            </span>

            <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-primary leading-tight">
              One Login. Every{" "}
              <span className="bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent">
                Command Center
              </span>{" "}
              You Need.
            </h1>

            <p className="text-sm text-text-secondary leading-relaxed">
              Sign in to prepare for your next placement drive, run your campus's recruitment pipeline,
              or manage your hiring pipeline — whichever dashboard is yours.
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
                <div className="text-2xs text-text-muted">Built for placement cells</div>
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
              <span className="text-2xs text-text-muted">Practice Problems</span>
            </div>
            <div>
              <strong className="block text-primary font-mono text-base">{publicStats ? publicStats.languages_total : "—"}</strong>
              <span className="text-2xs text-text-muted">Judge Languages</span>
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
            {/* Ambient glow ring behind the card — crossfades to the
                selected role's accent instead of staying one flat gradient,
                so switching tabs reads as the whole card responding. */}
            <AnimatePresence>
              <motion.div
                key={selectedRole}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.65 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                className={cn(
                  "absolute -inset-0.5 rounded-panel bg-gradient-to-r blur-lg pointer-events-none",
                  activeTab.accent.ring
                )}
              />
            </AnimatePresence>

            <div className="relative p-6 sm:p-8 rounded-panel bg-surface/90 backdrop-blur-xl border border-border-strong shadow-card space-y-6 overflow-hidden">
              {/* Brand-gradient cap along the top edge, matching the same
                  accent line used on the marketing navbar/footer cards. */}
              <div className="absolute top-0 inset-x-0 h-px gradient-hairline opacity-80 pointer-events-none" />

              {/* Header Title */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={selectedRole}
                      initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.6, rotate: 8 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className={cn(
                        "w-9 h-9 rounded-control flex items-center justify-center border shrink-0",
                        activeTab.accent.chipBg,
                        activeTab.accent.chipBorder
                      )}
                    >
                      <ActiveIcon className={cn("w-4.5 h-4.5", activeTab.accent.activeIcon)} />
                    </motion.div>
                  </AnimatePresence>
                  <h2 className="text-2xl font-bold text-primary tracking-tight">
                    Welcome back
                  </h2>
                </div>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={selectedRole}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.2 }}
                    className="text-xs text-text-muted"
                  >
                    {activeTab.subtitle}
                  </motion.p>
                </AnimatePresence>
              </div>

              {/* 1. Account Role Selector Tabs — sliding pill indicator,
                  tinted to whichever role is active */}
              <div className="relative p-1 rounded-control bg-elevated border border-border-subtle grid grid-cols-3 gap-1">
                {ROLE_TABS.map((tab) => {
                  const isActive = selectedRole === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleTabClick(tab.id)}
                      className="relative py-2.5 rounded-control text-xs font-semibold transition-colors duration-150"
                    >
                      {isActive && (
                        <motion.span
                          layoutId="role-pill"
                          className={cn(
                            "absolute inset-0 rounded-control border",
                            tab.accent.pill,
                            tab.accent.glow
                          )}
                          transition={{ type: "spring", stiffness: 500, damping: 34 }}
                        />
                      )}
                      <span
                        className={cn(
                          "relative z-10 flex items-center justify-center gap-1.5",
                          isActive ? "text-primary" : "text-text-muted hover:text-primary transition-colors"
                        )}
                      >
                        <motion.span
                          animate={{ scale: isActive ? 1.12 : 1 }}
                          transition={{ type: "spring", stiffness: 400, damping: 20 }}
                          className="flex"
                        >
                          <Icon
                            className={cn(
                              "w-3.5 h-3.5 shrink-0 transition-colors duration-200",
                              isActive ? tab.accent.activeIcon : tab.accent.idleIcon
                            )}
                          />
                        </motion.span>
                        <span className="whitespace-nowrap">{tab.label}</span>
                      </span>
                    </button>
                  );
                })}
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
                  <FormField label={isStudent ? "Email or Handle *" : "Staff / Institutional Email *"} icon={Mail}>
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
                        className="text-2xs text-accent-primary hover:underline font-medium"
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

                {/* Remember Me — a real sliding switch rather than a bare
                    checkbox, consistent with the sliding-pill language used
                    by the role tabs and theme toggle above. */}
                <motion.div variants={fieldVariants} className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rememberMe}
                      onClick={() => setRememberMe((v) => !v)}
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                        rememberMe ? "bg-accent-primary border-accent-primary" : "bg-elevated border-border-subtle"
                      )}
                    >
                      <motion.span
                        animate={{ x: rememberMe ? 18 : 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 32 }}
                        className="absolute left-0.5 top-[3px] h-3.5 w-3.5 rounded-full bg-white shadow-sm"
                      />
                    </button>
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
                      <div className="p-2.5 rounded-control bg-status-danger/10 border border-status-danger/30 text-2xs text-status-danger font-medium">
                        {error}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit Action Button */}
                <motion.div variants={fieldVariants}>
                  <AuthSubmitButton loading={loading}>{activeTab.cta}</AuthSubmitButton>
                </motion.div>
              </motion.form>

              {/* Trust row — rendered as badge chips (matching the
                  "Enterprise & Campus Edition" pill up in the hero) instead
                  of bare monospace text, so credibility signals read as
                  deliberate UI rather than a footnote. */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 border-t border-border-subtle mt-2 pt-4">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-3xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-3 h-3" />
                  Encrypted Credentials
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-3xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <Fingerprint className="w-3 h-3" />
                  Role-Based Access
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-3xs font-semibold text-sky-600 dark:text-sky-400">
                  <CheckCircle2 className="w-3 h-3" />
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
