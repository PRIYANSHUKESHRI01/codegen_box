"use client";

import { useState } from "react";
import { GraduationCap, Briefcase, User, Mail, Phone, Building2, MessageSquare, CheckCircle2 } from "lucide-react";
import { FormField, authInputClass } from "@/components/auth/FormField";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";

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
 * that used to just link to /pricing. Uses the shared Modal shell for its
 * backdrop/panel chrome; form/loading/error/success flow copies
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
    // Wait a beat before wiping state so the form doesn't visibly flash
    // back to blank while the modal is still on its way out.
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

  if (!open) return null;

  return (
    <Modal
      onClose={resetAndClose}
      title={submitted ? `Thanks, ${name.split(" ")[0]}!` : "Talk to Our Team"}
      subtitle={submitted ? undefined : copy.subtitle}
      icon={submitted ? undefined : MessageSquare}
      iconClassName="bg-accent-primary/10 text-accent-primary"
      size="md"
    >
      {submitted ? (
        <div className="space-y-5 py-2 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-status-success/15 border border-status-success/30 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-status-success" />
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">
            We&apos;ve got your message — someone from our team will reach out to{" "}
            <strong className="text-primary">{email}</strong> within one business day.
          </p>
          <button
            onClick={resetAndClose}
            className="w-full py-3 rounded-btn bg-accent-primary hover:bg-accent-primary-hover text-white font-bold text-sm transition-colors"
          >
            Close
          </button>
        </div>
      ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
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

                {error && <p className="text-2xs text-status-danger">{error}</p>}

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

                <p className="text-center text-2xs text-text-muted">
                  Prefer email? Write to us at{" "}
                  <a href="mailto:support@mellowvault.com" className="text-accent-primary hover:underline">
                    support@mellowvault.com
                  </a>
                </p>
              </form>
      )}
    </Modal>
  );
}
