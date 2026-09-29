"use client";

import { useState } from "react";
import Link from "next/link";
import { Zap, Mail, Command, Send, CheckCircle2, Facebook, Instagram, Linkedin, Youtube } from "lucide-react";
import { Container } from "./Container";
import { Button } from "@/components/ui/Button";
import { LogoBadge, LogoMark, Wordmark } from "@/components/brand/Logo";
import { TalkToTeamModal } from "@/components/marketing-site/TalkToTeamModal";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const CONTACT_SALES_LABEL = "Contact Sales";

// Real profile URLs go here once Mellow Vault's social accounts are handed
// over — left as "#" for now rather than a guessed/fabricated link, same
// convention this file already used for Privacy Policy/Terms before real
// pages existed.
const SOCIAL_LINKS = [
  { label: "Facebook", href: "#", icon: Facebook },
  { label: "Instagram", href: "#", icon: Instagram },
  { label: "LinkedIn", href: "#", icon: Linkedin },
  { label: "YouTube", href: "#", icon: Youtube },
];

export function Footer() {
  const [contactOpen, setContactOpen] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [newsletterError, setNewsletterError] = useState<string | null>(null);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail || newsletterStatus === "loading") return;
    setNewsletterStatus("loading");
    setNewsletterError(null);
    try {
      await api.post("/newsletter/subscribe", { email: newsletterEmail });
      setNewsletterStatus("success");
      setNewsletterEmail("");
    } catch (err) {
      setNewsletterStatus("error");
      setNewsletterError(err instanceof ApiError ? err.message : "Couldn't subscribe right now — please try again.");
    }
  };

  const footerLinks = [
    {
      title: "For Colleges",
      links: [
        { label: "Campus Drive Management", href: "#features" },
        { label: "Bulk Roster Onboarding", href: "#features" },
        { label: "Placement Analytics", href: "#features" },
        { label: "How Onboarding Works", href: "#how-it-works" },
        { label: "Pricing for Institutions", href: "/pricing" },
      ],
    },
    {
      title: "For Students",
      links: [
        { label: "Practice Arena", href: "#problems" },
        { label: "Famous DSA Sheets", href: "#dsa-sheets" },
        { label: "Company-Specific Prep", href: "#features" },
        { label: "Student Plans", href: "/pricing" },
      ],
    },
    {
      title: "Platform",
      links: [
        { label: "Role-Based Dashboards", href: "#platform-preview" },
        { label: "Supported Languages", href: "#languages" },
        { label: "Pricing", href: "/pricing" },
        { label: "Security & Compliance", href: "#" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About Mellow", href: "#" },
        { label: "Careers", href: "#", badge: "Hiring" },
        { label: "Contact Sales", href: "/pricing" },
        {
          label: "Mellow Vault",
          href: "https://mellowvault.com",
          external: true,
        },
        { label: "Privacy Policy", href: "#" },
        { label: "Terms of Service", href: "#" },
      ],
    },
  ];

  return (
    <footer className="relative w-full border-t border-border-subtle bg-surface/40 backdrop-blur-sm transition-colors pt-16 pb-10 overflow-hidden">
      {/* Top subtle gradient hairline */}
      <div className="absolute top-0 inset-x-0 h-px gradient-hairline opacity-60" />

      {/* Subtle ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-accent-primary/5 blur-3xl pointer-events-none" />

      <Container size="xl">
        {/* Get in Touch Card — a real mailto CTA, not a newsletter form with nowhere for the email to go */}
        <div className="relative rounded-card lg:rounded-panel bg-elevated/70 border border-border-strong p-6 sm:p-8 lg:p-10 mb-14 shadow-card overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-accent-secondary/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-accent-primary/10 border border-accent-primary/25 text-xs font-semibold text-accent-primary mb-3">
                <Zap className="w-3.5 h-3.5" />
                <span>Let&apos;s Talk</span>
              </div>
              <h3 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-primary tracking-tight mb-2">
                Bringing a college or hiring team on board?
              </h3>
              <p className="text-sm text-text-secondary max-w-xl leading-relaxed">
                Reach out directly — a real person on the team replies, not an automated sequence.
              </p>
            </div>

            <a href="mailto:support@mellowvault.com" className="shrink-0">
              <Button variant="primary" size="lg" rightIcon={<Mail className="w-4 h-4" />} className="shadow-glow">
                support@mellowvault.com
              </Button>
            </a>
          </div>
        </div>

        {/* Links Columns & Brand Section */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 lg:gap-10 pb-12 border-b border-border-subtle">
          {/* Brand Info (2 cols) */}
          <div className="col-span-2 flex flex-col justify-between space-y-6">
            <div>
              <Link href="/" className="inline-flex items-center gap-2.5 mb-3 group">
                <LogoBadge className="w-9 h-9 transition-transform group-hover:scale-105" />
                <div className="flex flex-col">
                  <Wordmark className="font-bold text-lg tracking-tight text-primary" />
                  <span className="text-[10px] font-mono text-text-muted tracking-wider uppercase">
                    Placements &bull; Practice
                  </span>
                </div>
              </Link>

              <a
                href="https://mellowvault.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-mono text-text-muted hover:text-accent-primary transition-colors mb-4"
              >
                <span>A product of</span>
                <span className="font-bold text-text-secondary">Mellow Vault</span>
              </a>

              <p className="text-sm text-text-secondary max-w-sm leading-relaxed mb-6">
                The placement-readiness platform colleges run their TPO cell on — campus drives,
                bulk onboarding, and company-specific prep, plus a real practice arena for students.
              </p>

              {/* Newsletter signup — a real, working subscribe, not decoration */}
              {newsletterStatus === "success" ? (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-control bg-status-success/10 border border-status-success/25 text-xs font-semibold text-status-success max-w-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>You&apos;re subscribed — check your inbox.</span>
                </div>
              ) : (
                <form onSubmit={handleNewsletterSubmit} className="max-w-sm">
                  <label htmlFor="footer-newsletter-email" className="block text-xs font-semibold text-text-secondary mb-1.5">
                    Get product updates in your inbox
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="footer-newsletter-email"
                      type="email"
                      required
                      value={newsletterEmail}
                      onChange={(e) => setNewsletterEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="flex-1 min-w-0 px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary text-xs placeholder:text-text-muted outline-none focus:border-accent-primary transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={newsletterStatus === "loading"}
                      className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-colors disabled:opacity-60"
                    >
                      <span>{newsletterStatus === "loading" ? "..." : "Subscribe"}</span>
                      {newsletterStatus !== "loading" && <Send className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {newsletterStatus === "error" && newsletterError && (
                    <p className="text-[11px] text-status-danger mt-1.5">{newsletterError}</p>
                  )}
                </form>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              {/* Shortcut command helper */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-control bg-elevated border border-border-subtle text-xs font-mono text-text-muted">
                <Command className="w-3.5 h-3.5 text-accent-primary" />
                <span>Quick Search:</span>
                <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border-subtle text-[10px] font-bold text-primary">
                  ⌘K
                </kbd>
              </div>

              {/* Social — real icons, placeholder hrefs until Mellow Vault's profile URLs are handed over */}
              <div className="flex items-center gap-2">
                {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
                  <a
                    key={label}
                    href={href}
                    aria-label={label}
                    className="w-8 h-8 rounded-control bg-elevated border border-border-subtle flex items-center justify-center text-text-muted hover:text-accent-primary hover:border-accent-primary/40 transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Categorized Link Columns (4 cols) */}
          {footerLinks.map((col) => (
            <div key={col.title} className="col-span-1">
              <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-text-primary mb-4">
                {col.title}
              </h4>
              <ul className="space-y-2.5 text-sm">
                {col.links.map((link) =>
                  link.label === CONTACT_SALES_LABEL ? (
                    <li key={link.label}>
                      <button
                        type="button"
                        onClick={() => setContactOpen(true)}
                        className="text-text-secondary hover:text-primary transition-colors inline-flex items-center gap-1.5 group"
                      >
                        <span className="group-hover:translate-x-0.5 transition-transform">{link.label}</span>
                      </button>
                    </li>
                  ) : (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        {...("external" in link && link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        className={cn(
                          "text-text-secondary hover:text-primary transition-colors inline-flex items-center gap-1.5 group",
                          "external" in link && link.external && "text-accent-primary/80 hover:text-accent-primary"
                        )}
                      >
                        <span className="group-hover:translate-x-0.5 transition-transform">
                          {link.label}
                        </span>
                        {"badge" in link && link.badge && (
                          <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase rounded bg-accent-primary/20 text-accent-primary border border-accent-primary/30">
                            {link.badge}
                          </span>
                        )}
                      </a>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar: Legal entity, Copyright, and Compliance */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <LogoMark className="w-5 h-5 opacity-70" />
            <p className="text-xs font-mono text-text-muted">
              &copy; {new Date().getFullYear()} Mellow Vault. A Unit of Prayukti Development Private Limited.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs font-mono text-text-muted">
            <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
            <span className="text-border-strong">&bull;</span>
            <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
            <span className="text-border-strong">&bull;</span>
            <a href="#" className="hover:text-primary transition-colors">Help Center</a>
          </div>
        </div>
      </Container>
      <TalkToTeamModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </footer>
  );
}
