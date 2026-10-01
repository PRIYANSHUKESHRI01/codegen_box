"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Mail, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { AuthChrome } from "@/components/auth/AuthChrome";
import { FormField, authInputClass } from "@/components/auth/FormField";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { AuthUser, homeRouteForRole } from "@/lib/auth";
import { useAuth } from "@/lib/AuthContext";

// Local-dev convenience only — see the matching comment on /login. Never
// add a customer-facing role here; this page is exclusively superadmin and
// internal Mellow staff (Ops/Marketing).
const IS_DEV = process.env.NODE_ENV !== "production";

const DEMO_LOGINS: Record<"superadmin" | "admin_mellow" | "admin_marketing", { label: string; email: string; password: string }> | null =
  IS_DEV
    ? {
        superadmin: { label: "Superadmin", email: "aryan@mellow.ai", password: "super_secure_key_2026" },
        admin_mellow: { label: "Mellow Ops", email: "priya@mellow.ai", password: "mellow_staff_ops_99" },
        admin_marketing: { label: "Mellow Marketing", email: "marketing@mellow.ai", password: "mellow_marketing_growth_26" },
      }
    : null;

/**
 * Sign-in for superadmin and internal Mellow staff only — deliberately not
 * linked from any public page (see layout.tsx's noindex + robots.ts) and
 * never mentions this exists from the customer-facing /login page. Reuses
 * the exact same POST /login endpoint and AuthChrome shell as /login; the
 * only thing different here is which persona this page is *for*, matching
 * how real platforms keep internal admin tooling off the customer login
 * surface entirely rather than exposing it as just another tab.
 */
export default function MellowInternalLoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.post<{ user: AuthUser; token: string }>("/login", { email, password });

      if (!["superadmin", "admin_internal", "admin_marketing"].includes(res.user.role)) {
        setError("This sign-in is for Mellow staff accounts only.");
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
    <AuthChrome altLabel="Student & Partner Login" altHref="/login">
      <div className="w-full max-w-md">
        <div className="relative p-6 sm:p-8 rounded-panel bg-surface/90 backdrop-blur-xl border border-border-strong shadow-card space-y-6">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-3xs font-bold uppercase tracking-wider bg-accent-primary/10 text-accent-primary border border-accent-primary/25">
              <ShieldAlert className="w-3 h-3" />
              <span>Mellow Internal</span>
            </span>
            <h2 className="text-2xl font-bold text-primary tracking-tight">Staff sign-in</h2>
            <p className="text-xs text-text-muted">For authorized Mellow superadmin and operations staff only.</p>
          </div>

          {DEMO_LOGINS && (
            <div className="flex flex-wrap items-center gap-1.5 p-3 rounded-control bg-elevated/50 border border-dashed border-border-strong">
              {Object.values(DEMO_LOGINS).map((d) => (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword(d.password);
                  }}
                  className="px-2 py-0.5 rounded text-2xs font-medium border bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20 transition-colors"
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <FormField label="Staff Email *" icon={Mail}>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@mellowvault.com"
                className={cn(authInputClass, "pl-9 pr-3")}
                autoFocus
              />
            </FormField>

            <FormField label="Password *" icon={Lock}>
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
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </FormField>

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

            <AuthSubmitButton loading={loading}>Enter Internal Console</AuthSubmitButton>
          </form>
        </div>
      </div>
    </AuthChrome>
  );
}
