"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Mail,
  User,
  GraduationCap,
  Zap,
  Check,
  AtSign,
  Calendar,
  Briefcase,
  Trophy,
  ArrowUpRight,
  Info,
} from "lucide-react";
import { AuthChrome } from "@/components/auth/AuthChrome";
import { FormField, authInputClass } from "@/components/auth/FormField";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { TalkToTeamModal } from "@/components/marketing-site/TalkToTeamModal";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { AuthUser, homeRouteForRole } from "@/lib/auth";
import { useAuth } from "@/lib/AuthContext";
import { usePublicStats } from "@/lib/usePublicPlatformData";

// This page only ever creates STUDENT accounts. `/register` (AuthController)
// hardcodes the new user's role server-side and never accepts a role or
// college_id from the caller, so a self-service "College TPO" option here
// could never have worked beyond the picker UI — it used to exist, show
// TPO-shaped fields, and then just error on submit. College/employer
// workspaces are staff-provisioned as part of onboarding a paying
// institution (AdminController::storeCollege creates the College record and
// its first admin_tpo user together, credentials emailed directly) — the
// same reasoning that already keeps Mellow Staff accounts off this page.
// Anyone who isn't a student is routed to TalkToTeamModal instead of a form
// that was always going to dead-end.
const fieldVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
};

const STRENGTH_META = [
  { label: "Enter a password", color: "bg-elevated" },
  { label: "Weak password", color: "bg-status-danger" },
  { label: "Fair password", color: "bg-status-warning" },
  { label: "Good password", color: "bg-accent-primary" },
  { label: "Strong password", color: "bg-status-success" },
];

export default function SignupPage() {
  const router = useRouter();
  const { login } = useAuth();
  const publicStats = usePublicStats();

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [gradYear, setGradYear] = useState("2026");
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);

  // Compute password strength
  const getPasswordStrength = () => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  };

  const strength = getPasswordStrength();

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeTerms) return;

    setError(null);
    setLoading(true);

    try {
      const { user, token } = await api.post<{ user: AuthUser; token: string }>("/register", {
        name,
        email,
        handle,
        password,
        password_confirmation: password,
      });
      login(token, user);
      router.push(homeRouteForRole(user.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create your account. Please try again.");
      setLoading(false);
    }
  };

  return (
    <AuthChrome altLabel="Sign In Instead" altHref="/login">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: value props — 5/7 split and max-w-xl card below,
            matching /login exactly instead of drifting to a narrower 4/8 +
            max-w-md layout that made the two auth pages feel unrelated. */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="hidden lg:flex lg:col-span-5 flex-col justify-between space-y-6 pr-4"
        >
          <div className="space-y-4">
            {/* "No approval needed" rather than "Free for Students" — the
                page right below it already explains students sign up
                instantly while everyone else talks to the team, so the
                badge now names the thing that's actually distinctive about
                this path instead of repeating the headline's point. */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-accent-primary/10 text-accent-primary border border-accent-primary/25">
              <Zap className="w-3.5 h-3.5 animate-pulse-subtle" />
              <span>Instant Access, No Approval Needed</span>
            </span>

            <h1 className="text-3xl font-extrabold tracking-tight text-primary leading-tight">
              Start Preparing in{" "}
              <span className="bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent">
                Minutes
              </span>
              .
            </h1>

            <p className="text-base font-medium text-text-secondary leading-relaxed text-pretty">
              Create your account to unlock company-specific interview prep, a real practice arena, and
              a live countdown to every drive your campus maps.
            </p>
          </div>

          <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-3">
            {[
              { icon: Trophy, text: "Company-specific prep packs, not generic tips" },
              { icon: Briefcase, text: "See every drive your placement cell opens up" },
              { icon: GraduationCap, text: "A real coding arena to sharpen before interviews" },
            ].map((item) => (
              <motion.div
                key={item.text}
                variants={fieldVariants}
                className="flex items-center gap-3 p-3 rounded-control bg-surface/70 backdrop-blur-md border border-border-subtle shadow-subtle hover:border-border-strong hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="w-8 h-8 rounded-control bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center text-accent-primary shrink-0">
                  <item.icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-text-secondary">{item.text}</span>
              </motion.div>
            ))}
          </motion.div>

          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border-subtle text-xs">
            <div>
              <strong className="block text-primary font-mono text-xl">{publicStats ? publicStats.problems_total : "—"}</strong>
              <span className="text-xs font-medium text-text-muted">Practice Problems</span>
            </div>
            <div>
              <strong className="block text-primary font-mono text-xl">{publicStats ? publicStats.topics_total : "—"}</strong>
              <span className="text-xs font-medium text-text-muted">DSA Topics</span>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Signup Card (7 cols) */}
        <div className="lg:col-span-7">
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="relative w-full max-w-xl mx-auto"
          >
            <div className="absolute -inset-0.5 rounded-panel bg-gradient-to-r from-accent-primary/20 via-indigo-400/10 to-accent-secondary/20 blur-lg opacity-60 pointer-events-none" />

            <div className="relative p-6 sm:p-8 rounded-panel bg-surface/90 backdrop-blur-xl border border-border-strong shadow-card space-y-6 overflow-hidden">
              {/* Brand-gradient cap along the top edge, matching /login and the
                  marketing navbar/footer cards. */}
              <div className="absolute top-0 inset-x-0 h-px gradient-hairline opacity-80 pointer-events-none" />

              {/* Headline — icon chip + title row, matching /login's
                  "Welcome back" header exactly instead of a bare text block.
                  Emerald ties back to the "Student" accent /login uses for
                  this same role. */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-control bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
                    <GraduationCap className="w-4.5 h-4.5" />
                  </div>
                  <h1 className="text-2xl font-bold text-primary tracking-tight">
                    Create your student account
                  </h1>
                </div>
                <p className="text-sm font-medium leading-relaxed text-text-secondary">
                  Free, instant access — practice, prep, and track every drive.
                </p>
              </div>

              {/* Not a student? — a slim single-line notice rather than a
                  boxed callout, so it reads as a secondary aside instead of
                  competing with the form for attention. Routes to the same
                  lead-capture flow the marketing site already uses, instead
                  of a form that was always going to dead-end on submit. */}
              <div className="flex items-center justify-between gap-3 px-3.5 py-3 rounded-control bg-indigo-500/[0.07] border border-indigo-500/25">
                <span className="flex items-center gap-2.5 text-xs font-medium text-text-secondary leading-snug">
                  <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>
                    <span className="font-bold text-primary">Not a student?</span> College & hiring-partner
                    access is set up by our team.
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setContactOpen(true)}
                  className="shrink-0 inline-flex items-center gap-0.5 text-xs font-bold text-indigo-700 dark:text-indigo-400 hover:underline"
                >
                  Talk to us
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Form */}
              <motion.form
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                onSubmit={handleSignupSubmit}
                className="space-y-4 text-sm"
              >
                {/* Name and email each get their own row rather than a 2-up
                    grid — keeps a real email address from ever clipping,
                    regardless of card width. */}
                <motion.div variants={fieldVariants}>
                  <FormField label="Full Name *" icon={User}>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Alex Chen"
                      className={cn(authInputClass, "pl-9 pr-3")}
                    />
                  </FormField>
                </motion.div>

                <motion.div variants={fieldVariants}>
                  <FormField label="Email Address *" icon={Mail}>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alex@example.com"
                      className={cn(authInputClass, "pl-9 pr-3")}
                    />
                  </FormField>
                </motion.div>

                <motion.div variants={fieldVariants} className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Coder Handle *" icon={AtSign}>
                      <input
                        type="text"
                        required
                        value={handle}
                        onChange={(e) => setHandle(e.target.value)}
                        placeholder="alex_coder"
                        className={cn(authInputClass, "pl-9 pr-3 font-mono")}
                      />
                    </FormField>
                    <FormField label="Grad. Year" icon={Calendar}>
                      <select
                        value={gradYear}
                        onChange={(e) => setGradYear(e.target.value)}
                        className={cn(authInputClass, "pl-9 pr-3")}
                      >
                        <option value="2025">2025</option>
                        <option value="2026">2026</option>
                        <option value="2027">2027</option>
                        <option value="2028">2028</option>
                      </select>
                    </FormField>
                  </div>

                  {/* No college field here on purpose — self-signup can never
                      attach a real college (only a TPO's roster import or admin
                      action can), so this path is always a personal/"Mellow
                      Direct" account. Campus-affiliated students should never
                      reach this form at all; they get credentials emailed to
                      them directly once their TPO adds them. Plain helper
                      text rather than a boxed callout — this is useful
                      context, not a warning, so it shouldn't carry the same
                      visual weight as one. */}
                  <p className="text-xs font-medium text-text-secondary leading-snug flex items-start gap-2">
                    <GraduationCap className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 -mt-px" />
                    <span>
                      No college required. Already on a partner campus? Your TPO emails you official
                      login credentials directly — no need to sign up here.
                    </span>
                  </p>
                </motion.div>

                {/* Password with Strength Meter */}
                <motion.div variants={fieldVariants}>
                  <FormField label="Password *" icon={Lock}>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a strong password"
                      className={cn(authInputClass, "pl-9 pr-3 font-mono")}
                    />
                  </FormField>

                  {/* Strength Bar */}
                  <AnimatePresence>
                    {password && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 space-y-1.5">
                          <div className="h-1.5 rounded-full bg-elevated overflow-hidden">
                            <motion.div
                              className={cn("h-full rounded-full", STRENGTH_META[strength].color)}
                              initial={false}
                              animate={{ width: `${(strength / 4) * 100}%` }}
                              transition={{ duration: 0.3, ease: "easeOut" }}
                            />
                          </div>
                          <div className="text-xs font-semibold text-text-secondary">{STRENGTH_META[strength].label}</div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Terms Agreement — a custom animated checkbox (same button +
                    AnimatePresence language as the role tabs / remember-me
                    switch on /login) instead of a bare native checkbox. */}
                <motion.div variants={fieldVariants} className="pt-1">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={agreeTerms}
                      onClick={() => setAgreeTerms((v) => !v)}
                      className={cn(
                        "mt-0.5 flex items-center justify-center w-4 h-4 rounded-[5px] border shrink-0 transition-colors duration-150",
                        agreeTerms ? "bg-accent-primary border-accent-primary" : "bg-elevated border-border-subtle"
                      )}
                    >
                      <AnimatePresence>
                        {agreeTerms && (
                          <motion.span
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 25 }}
                            className="flex"
                          >
                            <Check className="w-3 h-3 text-white" strokeWidth={3} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </button>
                    <span className="text-text-secondary text-sm font-medium leading-snug">
                      I agree to the CodeGen Box{" "}
                      <Link href="/#" className="text-accent-primary hover:underline">
                        Terms of Service
                      </Link>
                      ,{" "}
                      <Link href="/#" className="text-accent-primary hover:underline">
                        Contest Honor Code
                      </Link>
                      , and{" "}
                      <Link href="/#" className="text-accent-primary hover:underline">
                        Privacy Policy
                      </Link>
                      .
                    </span>
                  </label>
                </motion.div>

                {/* Signup Error / Notice Banner */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 rounded-control bg-status-danger/10 border border-status-danger/30 text-xs font-semibold text-status-danger leading-relaxed">
                        {error}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <motion.div variants={fieldVariants}>
                  <AuthSubmitButton loading={loading} disabled={!agreeTerms}>
                    Create Account & Continue
                  </AuthSubmitButton>
                </motion.div>
              </motion.form>

              {/* Already have an account */}
              <div className="text-center text-sm font-medium text-text-secondary pt-3 border-t border-border-subtle">
                Already registered?{" "}
                <Link href="/login" className="text-accent-primary font-bold hover:underline">
                  Sign in to your dashboard &rarr;
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <TalkToTeamModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </AuthChrome>
  );
}
