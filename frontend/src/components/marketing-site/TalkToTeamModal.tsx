"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, GraduationCap, Briefcase, User, Mail, Phone, Building2, MessageSquare, CheckCircle2 } from "lucide-react";
import { FormField, authInputClass } from "@/components/auth/FormField";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

type Audience = "institution" | "company";

interface TalkToTeamModalProps {
  open: boolean;
  onClose: () => void;
}

const AUDIENCE_COPY: Record<Audience, { orgLabel: string; orgPlaceholder: string; subtitle: string }> = {
  institution: {
    orgLabel: "College / University Name",
    orgPlaceholder: "e.g. Apex Institute of Technology",
    subtitle: "Tell us a bit about your college and we'll reach out within one business day.",
  },
  company: {
    orgLabel: "Company Name",
    orgPlaceholder: "e.g. Acme Corp",
    subtitle: "Tell us a bit about your hiring needs and we'll reach out within one business day.",
  },
};

/**
 * The public "Talk to Our Team" form — replaces the three landing-page CTAs
 * that used to just link to /pricing. Backdrop/panel pattern copies
 * LogoutConfirmModal's proven flash-free structure (static blur layer +
 * separately-animated tint); form/loading/error/success flow copies
 * ForgotPasswordModal's step-based conventions.
 */
export function TalkToTeamModal({ open, onClose }: TalkToTeamModalProps) {
  const [audience, setAudience] = useState<Audience>("institution");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const copy = AUDIENCE_COPY[audience];

  const resetAndClose = () => {
    onClose();
    // Wait for the exit animation before wiping state, so the form doesn't
    // visibly flash back to blank while it's still fading out.
    setTimeout(() => {
      setSubmitted(false);
      setAudience("institution");
      setName("");
      setEmail("");
      setPhone("");
      setOrganizationName("");
      setMessage("");
      setError(null);
    }, 250);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/contact-requests", {
        name,
        email,
        phone: phone || undefined,
        audience,
        organization_name: organizationName,
        message: message || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={resetAndClose}>
          {/* Static blur — never opacity-animated, avoids the Chromium
              backdrop-filter flash (see LogoutConfirmModal for the full
              explanation). The tint below carries the actual fade. */}
          <div className="absolute inset-0 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/75"
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md rounded-panel bg-surface border border-border-strong shadow-card p-6 sm:p-7 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={resetAndClose}
              className="absolute top-4 right-4 p-1 rounded text-text-muted hover:text-primary transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {submitted ? (
              <div className="space-y-5 py-4 text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-status-success/15 border border-status-success/30 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-status-success" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-primary mb-1.5">Thanks, {name.split(" ")[0]}!</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    We&apos;ve got your message — someone from our team will reach out to{" "}
                    <strong className="text-primary">{email}</strong> within one business day.
                  </p>
                </div>
                <button
                  onClick={resetAndClose}
                  className="w-full py-3 rounded-btn bg-accent-primary hover:bg-accent-primary-hover text-white font-bold text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <h3 className="text-lg font-bold text-primary">Talk to Our Team</h3>
                  <p className="text-xs text-text-secondary mt-1">{copy.subtitle}</p>
                </div>

                {/* Audience toggle — same bespoke two-button pattern as PricingHero's audience switch */}
                <div className="inline-flex items-center gap-1 p-1 rounded-btn bg-elevated border border-border-strong w-full">
                  <button
                    type="button"
                    onClick={() => setAudience("institution")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-control text-xs font-bold transition-all",
                      audience === "institution" ? "bg-accent-primary text-white shadow-glow" : "text-text-secondary hover:text-primary"
                    )}
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>College / TPO</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudience("company")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-control text-xs font-bold transition-all",
                      audience === "company" ? "bg-accent-secondary text-white shadow-glow-cyan" : "text-text-secondary hover:text-primary"
                    )}
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>Employer</span>
                  </button>
                </div>

                {error && <p className="text-[11px] text-status-danger">{error}</p>}

                <FormField label="Full Name *" icon={User}>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className={cn(authInputClass, "pl-9 pr-3")}
                  />
                </FormField>

                <FormField label="Work Email *" icon={Mail}>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@organization.com"
                    className={cn(authInputClass, "pl-9 pr-3")}
                  />
                </FormField>

                <FormField label="Phone (optional)" icon={Phone}>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className={cn(authInputClass, "pl-9 pr-3")}
                  />
                </FormField>

                <FormField label={`${copy.orgLabel} *`} icon={Building2}>
                  <input
                    type="text"
                    required
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder={copy.orgPlaceholder}
                    className={cn(authInputClass, "pl-9 pr-3")}
                  />
                </FormField>

                <FormField label="Message (optional)" icon={MessageSquare}>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="What are you looking for?"
                    rows={3}
                    className={cn(authInputClass, "pl-9 pr-3 py-2.5 resize-none")}
                  />
                </FormField>

                <AuthSubmitButton loading={loading}>Send Message</AuthSubmitButton>

                <p className="text-center text-[11px] text-text-muted">
                  Prefer email? Write to us at{" "}
                  <a href="mailto:campus@mellow.ai" className="text-accent-primary hover:underline">
                    campus@mellow.ai
                  </a>
                </p>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
