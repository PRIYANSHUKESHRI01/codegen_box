"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUp, ArrowUpRight, Building2, CheckCircle2, Mail, Send } from "lucide-react";
import { Container } from "./Container";
import { LogoBadge, LogoMark, Wordmark } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/navigation/ThemeToggle";
import { TONES, type Tone } from "@/components/ui/tones";
import { FEATURE_PAGES, FOOTER_FEATURE_GROUPS, featureHref } from "@/data/featurePages";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const SUPPORT_EMAIL = "support@mellowvault.com";

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

interface FooterColumn {
  title: string;
  /** The hub page the heading links to. */
  href: string;
  tone: Tone;
  icon: typeof Building2;
  links: FooterLink[];
}

const COLUMNS: FooterColumn[] = [
  ...FOOTER_FEATURE_GROUPS.map((g) => ({
    title: g.title,
    href: g.href,
    tone: g.tone,
    icon: g.icon,
    links: g.slugs.map((slug) => {
      const page = FEATURE_PAGES.find((p) => p.slug === slug);
      return { label: page?.label ?? slug, href: featureHref(slug) };
    }),
  })),
  {
    title: "Company",
    href: "/about",
    tone: "amber",
    icon: Building2,
    links: [
      { label: "About", href: "/about" },
      { label: "Pricing", href: "/pricing" },
      { label: "FAQ", href: "/#faq" },
      { label: "Contact", href: "/contact" },
      { label: "Mellow Vault", href: "https://mellowvault.com", external: true },
    ],
  },
];

const LEGAL_LINKS: FooterLink[] = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Contact", href: "/contact" },
];

function FooterAnchor({ link }: { link: FooterLink }) {
  const className =
    "group inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-primary transition-colors";
  const label = (
    <span className="relative after:absolute after:left-0 after:-bottom-0.5 after:h-px after:w-0 after:bg-current after:transition-all after:duration-300 group-hover:after:w-full">
      {link.label}
    </span>
  );
  const arrow = (
    <ArrowUpRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 translate-y-0.5 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-200" />
  );

  return link.external ? (
    <a href={link.href} target="_blank" rel="noopener noreferrer" className={className}>
      {label}
      {arrow}
    </a>
  ) : (
    <Link href={link.href} className={className}>
      {label}
      {arrow}
    </Link>
  );
}

export function Footer() {
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
      setNewsletterError(err instanceof ApiError ? err.message : "Couldn't subscribe right now. Please try again.");
    }
  };

  return (
    <footer className="relative isolate w-full overflow-hidden border-t border-border-subtle bg-surface/40 pt-16 sm:pt-20">
      {/* Atmosphere: hairline, two soft glows and a faint dot texture */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 inset-x-0 h-px gradient-hairline opacity-70" />
        <div className="absolute -top-24 left-[10%] w-[420px] h-[260px] rounded-full bg-accent-primary/10 blur-[90px]" />
        <div className="absolute -top-16 right-[8%] w-[380px] h-[240px] rounded-full bg-accent-secondary/10 blur-[90px]" />
        <div className="absolute inset-0 bg-dot-pattern opacity-50 [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,black,transparent)]" />
      </div>

      <Container size="xl">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          {/* Brand */}
          <div className="lg:col-span-4 flex flex-col">
            <Link href="/" className="flex w-fit items-center gap-2.5 group mb-4">
              <LogoBadge className="w-10 h-10 transition-transform duration-200 group-hover:scale-105" />
              <div className="flex flex-col">
                <Wordmark className="text-xl" />
                <span className="text-3xs font-mono text-text-secondary tracking-wider uppercase mt-0.5">Placement Sandbox</span>
              </div>
            </Link>

            <p className="text-sm text-text-secondary leading-relaxed max-w-sm mb-6">
              The placement sandbox for colleges: campus drives, a personal learning centre for every student, and a
              network of hiring partners.
            </p>

            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="group inline-flex w-fit items-center gap-2.5 px-3.5 py-2 rounded-btn bg-surface border border-border-strong shadow-subtle text-sm font-semibold text-primary hover:border-accent-primary/50 hover:shadow-card transition-all mb-6"
            >
              <span className="w-7 h-7 rounded-md bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-center text-accent-primary">
                <Mail className="w-3.5 h-3.5" />
              </span>
              {SUPPORT_EMAIL}
            </a>

            {newsletterStatus === "success" ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-control bg-status-success/10 border border-status-success/25 text-xs font-semibold text-status-success max-w-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>You&apos;re subscribed. Check your inbox.</span>
              </div>
            ) : (
              <form onSubmit={handleNewsletterSubmit} className="max-w-sm">
                <label htmlFor="footer-newsletter-email" className="block text-xs font-bold text-text-secondary mb-1.5">
                  Product updates
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="footer-newsletter-email"
                    type="email"
                    required
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="you@college.edu"
                    className="flex-1 min-w-0 px-3 py-2 rounded-control bg-surface border border-border-strong text-primary text-sm placeholder:text-text-muted outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={newsletterStatus === "loading"}
                    aria-label="Subscribe to product updates"
                    className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-sm font-bold transition-colors disabled:opacity-60"
                  >
                    <span>{newsletterStatus === "loading" ? "..." : "Subscribe"}</span>
                    {newsletterStatus !== "loading" && <Send className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {newsletterStatus === "error" && newsletterError && (
                  <p className="text-2xs font-medium text-status-danger mt-1.5">{newsletterError}</p>
                )}
              </form>
            )}
          </div>

          {/* Link columns */}
          <nav aria-label="Footer" className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-10">
            {COLUMNS.map((col) => {
              const Icon = col.icon;
              const tone = TONES[col.tone];
              return (
                <div key={col.title}>
                  <h3 className="mb-5">
                    <Link href={col.href} className="group inline-flex items-center gap-2">
                      <span className={cn("w-6 h-6 rounded-md border flex items-center justify-center transition-all duration-200", tone.icon, tone.iconHover)}>
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <span className="text-2xs sm:text-xs font-mono font-bold uppercase tracking-wide sm:tracking-wider whitespace-nowrap text-primary group-hover:text-accent-primary transition-colors">
                        {col.title}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-accent-primary opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                    </Link>
                  </h3>
                  <ul className="space-y-3">
                    {col.links.map((link) => (
                      <li key={link.label}>
                        <FooterAnchor link={link} />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="mt-14 pt-6 border-t border-border-subtle flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-2.5">
            <LogoMark className="w-5 h-5 shrink-0 opacity-80" />
            <p className="text-xs font-medium text-text-secondary leading-relaxed">
              &copy; {new Date().getFullYear()} Mellow Vault. A Unit of Prayukti Development Private Limited.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            {LEGAL_LINKS.map((link) => (
              <FooterAnchor key={link.label} link={link} />
            ))}
            <ThemeToggle compact />
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              aria-label="Back to top"
              className="w-9 h-9 rounded-full bg-surface border border-border-strong shadow-subtle flex items-center justify-center text-text-secondary hover:text-white hover:bg-accent-primary hover:border-accent-primary hover:-translate-y-0.5 transition-all duration-200"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Container>

      {/* Oversized, faded wordmark: a quiet brand moment under the legal line. Uses the real logo lettering at low opacity, fading out toward the page edge. */}
      <div
        aria-hidden="true"
        className="select-none pointer-events-none mt-8 flex justify-center overflow-hidden [mask-image:linear-gradient(to_bottom,black_25%,transparent_95%)] h-[17vw] lg:h-[190px]"
      >
        <Wordmark className="text-[13vw] lg:text-[140px] opacity-[0.07] dark:opacity-[0.06]" />
      </div>
    </footer>
  );
}
