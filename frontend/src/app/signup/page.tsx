"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Mail,
  User,
  Building2,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  AtSign,
  Calendar,
  Briefcase,
  Trophy,
} from "lucide-react";
import { AuthChrome } from "@/components/auth/AuthChrome";
import { FormField, authInputClass } from "@/components/auth/FormField";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { AuthUser, homeRouteForRole } from "@/lib/auth";
import { useAuth } from "@/lib/AuthContext";
import { usePublicStats } from "@/lib/usePublicPlatformData";

// Mellow Staff (Ops/Marketing) used to be a third self-signup option here —
// it never actually worked (submitting it always just showed an error, and
// its "invite token" field validated nothing). Those accounts are now
// exclusively superadmin-provisioned, with access superadmin grants
// per-employee — see MellowStaffPanel.tsx — so there is no self-signup path
// for them at all, and no reason to advertise one.
type SignupType = "student" | "tpo";

const ACCOUNT_TYPES: {
  id: SignupType;
  emoji: string;
  title: string;
  description: string;
  activeCls: string;
}[] = [
  {
    id: "student",
    emoji: "💻",
    title: "Student Coder",
    description: "Company-specific prep, campus drives, and a real practice arena.",
    activeCls: "bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/40",
  },
  {
    id: "tpo",
    emoji: "🎓",
    title: "College TPO",
    description: "Campus recruitment drives, bulk onboarding & placement reports.",
    activeCls: "bg-cyan-500/10 border-cyan-500/40 ring-1 ring-cyan-500/40",
  },
];

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
  const [accountType, setAccountType] = useState<SignupType>("student");
  const publicStats = usePublicStats();

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [institution, setInstitution] = useState("");
  const [gradYear, setGradYear] = useState("2026");
  const [designation, setDesignation] = useState("Head of Training & Placement");
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    if (accountType !== "student") {
      setError(
        "College TPO accounts are provisioned by an administrator, not self-registered. Ask your Mellow account manager to onboard your institution, or sign in if you've already received credentials."
      );
      return;
    }

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
        {/* Left Column: value props (4 cols) */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="hidden lg:flex lg:col-span-4 flex-col justify-between space-y-6 pr-4"
        >
          <div className="space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-accent-primary/10 text-accent-primary border border-accent-primary/25">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Free for Students</span>
            </span>

            <h1 className="text-3xl font-extrabold tracking-tight text-primary leading-tight">
              Start Preparing in Minutes.
            </h1>

            <p className="text-sm text-text-secondary leading-relaxed">
              Create your account to unlock company-specific interview prep, a real practice arena, and
              a live countdown to every drive your campus maps.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { icon: Trophy, text: "Company-specific prep packs, not generic tips" },
              { icon: Briefcase, text: "See every drive your placement cell opens up" },
              { icon: GraduationCap, text: "A real coding arena to sharpen before interviews" },
            ].map((item) => (
              <div
                key={item.text}
                className="flex items-center gap-3 p-3 rounded-control bg-surface/70 backdrop-blur-md border border-border-subtle shadow-subtle hover:border-border-strong hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="w-8 h-8 rounded-control bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center text-accent-primary shrink-0">
                  <item.icon className="w-4 h-4" />
                </div>
                <span className="text-xs text-text-secondary">{item.text}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-subtle text-xs">
            <div>
              <strong className="block text-primary font-mono text-base">{publicStats ? publicStats.problems_total : "—"}</strong>
              <span className="text-[11px] text-text-muted">Practice Problems</span>
            </div>
            <div>
              <strong className="block text-primary font-mono text-base">{publicStats ? publicStats.topics_total : "—"}</strong>
              <span className="text-[11px] text-text-muted">DSA Topics</span>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Signup Card (8 cols) */}
        <div className="lg:col-span-8">
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="relative w-full max-w-2xl mx-auto"
          >
            <div className="absolute -inset-0.5 rounded-panel bg-gradient-to-r from-accent-primary/20 via-indigo-400/10 to-accent-secondary/20 blur-lg opacity-60 pointer-events-none" />

            <div className="relative p-6 sm:p-8 rounded-panel bg-surface/90 backdrop-blur-xl border border-border-strong shadow-card space-y-6">
              {/* Headline */}
              <div className="text-center space-y-1">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">
                  Create your CodeGen Box account
                </h1>
                <p className="text-xs text-text-muted">
                  Select your role to configure your dedicated workspace and dashboards.
                </p>
              </div>

              {/* 1. Account Type Picker Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ACCOUNT_TYPES.map((type) => {
                  const isActive = accountType === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setAccountType(type.id)}
                      className={cn(
                        "p-4 rounded-panel text-left border transition-all duration-200 relative flex flex-col justify-between space-y-2 hover:-translate-y-0.5",
                        isActive
                          ? cn(type.activeCls, "shadow-subtle")
                          : "bg-elevated/60 border-border-subtle hover:border-border-strong hover:bg-surface-hover"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xl">{type.emoji}</span>
                        <AnimatePresence>
                          {isActive && (
                            <motion.span
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 25 }}
                            >
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
                      <div>
                        <div className="font-bold text-xs text-primary">{type.title}</div>
                        <div className="text-[11px] text-text-muted leading-tight mt-0.5">{type.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Form */}
              <motion.form
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                onSubmit={handleSignupSubmit}
                className="space-y-4 text-xs"
              >
                <motion.div variants={fieldVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                  <FormField label={accountType === "tpo" ? "Official College Email *" : "Email Address *"} icon={Mail}>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={accountType === "tpo" ? "tpo@institution.edu" : "alex@example.com"}
                      className={cn(authInputClass, "pl-9 pr-3")}
                    />
                  </FormField>
                </motion.div>

                {/* Dynamic Role-specific Fields */}
                <AnimatePresence mode="wait">
                  {accountType === "student" && (
                    <motion.div
                      key="student-fields"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField label="Coder Handle *" icon={AtSign}>
                          <input
                            type="text"
                            required
                            value={handle}
                            onChange={(e) => setHandle(e.target.value)}
                            placeholder="e.g. alex_coder"
                            className={cn(authInputClass, "pl-9 pr-3 font-mono")}
                          />
                        </FormField>
                        <FormField label="Graduation Year" icon={Calendar}>
                          <select
                            value={gradYear}
                            onChange={(e) => setGradYear(e.target.value)}
                            className={cn(authInputClass, "pl-9 pr-3")}
                          >
                            <option value="2025">Class of 2025</option>
                            <option value="2026">Class of 2026</option>
                            <option value="2027">Class of 2027</option>
                            <option value="2028">Class of 2028</option>
                          </select>
                        </FormField>
                      </div>

                      {/* No college field here on purpose — self-signup can never
                          attach a real college (only a TPO's roster import or admin
                          action can), so this path is always a personal/"Mellow
                          Direct" account. Campus-affiliated students should never
                          reach this form at all; they get credentials emailed to
                          them directly once their TPO adds them. */}
                      <div className="p-3 rounded-control bg-elevated border border-border-subtle text-[11px] text-text-muted flex items-start gap-2">
                        <GraduationCap className="w-3.5 h-3.5 text-accent-primary shrink-0 mt-0.5" />
                        <span>
                          This creates a personal CodeGen Box account, usable on its own — no college required.
                          Already part of a partner campus? Your placement cell (TPO) sets up your official login
                          for you; look out for a welcome email instead of signing up here.
                        </span>
                      </div>
                    </motion.div>
                  )}

                  {accountType === "tpo" && (
                    <motion.div
                      key="tpo-fields"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                    >
                      <FormField label="University / College Name *" icon={Building2}>
                        <input
                          type="text"
                          required
                          value={institution}
                          onChange={(e) => setInstitution(e.target.value)}
                          placeholder="e.g. Indian Institute of Tech, Bombay"
                          className={cn(authInputClass, "pl-9 pr-3")}
                        />
                      </FormField>
                      <FormField label="Official Designation *" icon={Briefcase}>
                        <input
                          type="text"
                          required
                          value={designation}
                          onChange={(e) => setDesignation(e.target.value)}
                          placeholder="Head of Corporate Relations / TPO"
                          className={cn(authInputClass, "pl-9 pr-3")}
                        />
                      </FormField>
                    </motion.div>
                  )}
                </AnimatePresence>

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
                          <div className="text-[10px] text-text-muted">{STRENGTH_META[strength].label}</div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Terms Agreement */}
                <motion.div variants={fieldVariants} className="pt-1">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      required
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="w-4 h-4 rounded mt-0.5 border-border-subtle text-accent-primary focus:ring-accent-primary"
                    />
                    <span className="text-text-secondary text-xs leading-tight">
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
                      <div className="p-3 rounded-control bg-status-danger/10 border border-status-danger/30 text-[11px] text-status-danger leading-relaxed">
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
              <div className="text-center text-xs text-text-muted pt-2 border-t border-border-subtle">
                Already registered?{" "}
                <Link href="/login" className="text-accent-primary font-bold hover:underline">
                  Sign in to your dashboard &rarr;
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AuthChrome>
  );
}
