"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Key, Mail, Lock, X, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { FormField, authInputClass } from "./FormField";
import { AuthSubmitButton } from "./AuthSubmitButton";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";

type Step = "email" | "code" | "password" | "success";

const RESEND_COOLDOWN_SECONDS = 30;

interface ForgotPasswordModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Real 3-step forgot-password flow, gated by a one-time code emailed to the
 * account's own address — replaces the old static "not available yet"
 * panel. Deliberately never auto-signs the user in after a successful
 * reset; they land back on the login form and sign in with the new
 * password, same as any other credential change.
 */
export function ForgotPasswordModal({ open, onClose }: ForgotPasswordModalProps) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Reset all internal state whenever the modal is closed, so reopening it
  // always starts a fresh flow rather than resuming a stale one.
  useEffect(() => {
    if (!open) {
      setStep("email");
      setEmail("");
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

  const handleEmailSubmit = (e: React.FormEvent) => {
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
      setStep("success");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const titleForStep: Record<Step, string> = {
    email: "Forgot Your Password?",
    code: "Enter Verification Code",
    password: "Set a New Password",
    success: "Password Reset",
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
              <Key className="w-4 h-4 text-accent-primary" />
              <span>{titleForStep[step]}</span>
            </h3>
            <button onClick={onClose} className="p-1 rounded text-text-muted hover:text-primary transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && <p className="text-[11px] text-status-danger">{error}</p>}

          {step === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <p className="text-xs text-text-secondary">
                Enter your account&apos;s email address and we&apos;ll send you a verification code to reset your password.
              </p>
              <FormField label="Email *" icon={Mail}>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  className={cn(authInputClass, "pl-9 pr-3")}
                />
              </FormField>
              <AuthSubmitButton loading={loading}>Send Code</AuthSubmitButton>
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
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary transition-colors"
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
              <AuthSubmitButton loading={loading}>Reset Password</AuthSubmitButton>
            </form>
          )}

          {step === "success" && (
            <div className="space-y-4">
              <div className="p-4 rounded-control bg-status-success/10 border border-status-success/25 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-status-success shrink-0 mt-0.5" />
                <p className="text-xs text-text-secondary">
                  Your password has been reset. You can now sign in with your new password.
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-btn bg-accent-primary hover:bg-accent-primary-hover text-white font-bold text-xs transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
