"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Key, Lock, Eye, EyeOff } from "lucide-react";
import { FormField, authInputClass } from "./FormField";
import { AuthSubmitButton } from "./AuthSubmitButton";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { AuthUser } from "@/lib/auth";

type Step = "intro" | "code" | "password";

const RESEND_COOLDOWN_SECONDS = 30;

interface ForcePasswordResetModalProps {
  open: boolean;
  email: string;
  onCancel: () => void;
  /** Fired once the new password is set AND the follow-up sign-in succeeds — the login page treats this exactly like a normal successful login. */
  onComplete: (token: string, user: AuthUser) => void;
}

/**
 * Gates a first-time sign-in with a password an admin/TPO generated on the
 * account's behalf (see AuthController::login's must_change_password check)
 * — that password proves "you received the welcome email," never a real
 * session key. Reuses the exact same OTP-verified /password/forgot →
 * /password/otp/verify → /password/reset endpoints as ForgotPasswordModal
 * (there is only one "prove you own this inbox" implementation in the app),
 * but — unlike that flow — already knows the email (just typed into the
 * login form) and, on success, signs the user straight into the dashboard
 * instead of dead-ending on a "please sign in" screen.
 */
export function ForcePasswordResetModal({ open, email, onCancel, onComplete }: ForcePasswordResetModalProps) {
  const [step, setStep] = useState<Step>("intro");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (!open) {
      setStep("intro");
      setCode("");
      setResetToken(null);
      setNewPassword("");
      setConfirmPassword("");
      setError(null);
      setResendCooldown(0);
    }
  }, [open]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  if (!open) return null;

  const requestCode = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.post("/password/forgot", { email });
      setStep("code");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleIntroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    requestCode();
  };

  const handleResend = () => {
    if (resendCooldown > 0 || loading) return;
    requestCode();
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ reset_token: string }>("/password/otp/verify", { email, code });
      setResetToken(res.reset_token);
      setStep("password");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post("/password/reset", {
        email,
        reset_token: resetToken,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      // The one-time-password lock is cleared server-side the moment the
      // reset succeeds (see PasswordResetService::resetPassword) — sign in
      // again with the password they just set so they land straight in the
      // dashboard instead of dead-ending on a "please sign in" screen.
      const { user, token } = await api.post<{ user: AuthUser; token: string }>("/login", {
        email,
        password: newPassword,
      });
      onComplete(token, user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const titleForStep: Record<Step, string> = {
    intro: "Set Your Permanent Password",
    code: "Verify Your Email",
    password: "Choose a New Password",
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md rounded-panel bg-surface border border-border-strong shadow-card p-6 space-y-4"
        >
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <h3 className="text-base font-bold text-primary flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-accent-primary" />
              <span>{titleForStep[step]}</span>
            </h3>
          </div>

          {error && <p className="text-[11px] text-status-danger">{error}</p>}

          {step === "intro" && (
            <form onSubmit={handleIntroSubmit} className="space-y-4">
              <p className="text-xs text-text-secondary leading-relaxed">
                The password you just used was a one-time credential emailed to you — it can&apos;t be reused to sign
                in again. Verify <strong className="text-primary">{email}</strong> with a code and choose your own
                permanent password to continue.
              </p>
              <AuthSubmitButton loading={loading}>Send Verification Code</AuthSubmitButton>
              <button
                type="button"
                onClick={onCancel}
                className="w-full text-center text-[11px] text-text-muted hover:text-primary transition-colors"
              >
                Cancel and go back
              </button>
            </form>
          )}

          {step === "code" && (
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <p className="text-xs text-text-secondary">
                We sent a 6-digit code to <strong className="text-primary">{email}</strong>. It expires in 10 minutes.
              </p>
              <FormField
                label="Verification Code *"
                icon={Key}
                hint={
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || loading}
                    className="text-[11px] text-accent-primary hover:underline font-medium disabled:opacity-50 disabled:no-underline"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                  </button>
                }
              >
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className={cn(authInputClass, "pl-9 pr-3 font-mono tracking-widest text-center")}
                  autoFocus
                />
              </FormField>
              <AuthSubmitButton loading={loading} disabled={code.length !== 6}>
                Verify Code
              </AuthSubmitButton>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <FormField label="New Password *" icon={Lock}>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className={cn(authInputClass, "pl-9 pr-10 font-mono")}
                  autoFocus
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
              <FormField label="Confirm New Password *" icon={Lock}>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  className={cn(authInputClass, "pl-9 pr-3 font-mono")}
                />
              </FormField>
              <AuthSubmitButton loading={loading}>Set Password &amp; Continue</AuthSubmitButton>
            </form>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
