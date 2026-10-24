"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUp, ArrowUpRight, Building2, CheckCircle2, Facebook, Instagram, Linkedin, Lock, Mail, MapPin, Phone, Send, ShieldCheck, Youtube } from "lucide-react";
import { Container } from "./Container";
import { LogoBadge, Wordmark } from "@/components/brand/Logo";
import type { Tone } from "@/components/ui/tones";
import { FEATURE_PAGES, FOOTER_FEATURE_GROUPS, featureHref } from "@/data/featurePages";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const SUPPORT_EMAIL = "support@mellowvault.com";
const SUPPORT_PHONE_DISPLAY = "+91 76785 78295";
const SUPPORT_PHONE_HREF = "tel:+917678578295";
const LOCATION = "Noida / New Delhi, India";

/** AptRun is a product of Mellow Vault, a unit of Prayukti Development Private Limited — the legal line is shown exactly as registered. */
const LEGAL_ENTITY = "PRAYUKTI DEVELOPMENT PRIVATE LIMITED";
const CIN = "U62099UP2024PTC207212";

/**
 * The footer is a permanently dark graphite surface in BOTH themes, like the dashboard's navigation rail, and
 * reads its text colours from the same `--sb-*` tokens (declared once on :root, never redefined under html.dark,
 * every one checked for contrast against --sb-bg). Light/dark theme tokens (text-primary, bg-surface, border-subtle…)
 * must NOT be used in here: they flip with the theme and would turn white-on-graphite into grey-on-graphite.
 */
const INK = "text-[var(--sb-text)]";
const INK_DIM = "text-[var(--sb-text-dim)]";
const INK_FAINT = "text-[var(--sb-text-faint)]";

interface SocialLink {
  label: string;
  href: string;
  icon: typeof Facebook;
  /** The platform's own colour: the tile fills with it and glows in it on hover/focus. */
  hover: string;
}

const SOCIAL_LINKS: SocialLink[] = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/p/Mellow-Vault-61581114806433/",
    icon: Facebook,
    hover: "hover:bg-[#1877F2] hover:shadow-[0_12px_28px_-8px_rgba(24,119,242,0.85)] focus-visible:bg-[#1877F2] focus-visible:shadow-[0_12px_28px_-8px_rgba(24,119,242,0.85)]",
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/mellowvaultofficial/",
    icon: Instagram,
    hover: "hover:bg-[linear-gradient(45deg,#F9A03F,#E4405F_55%,#A83BC9)] hover:shadow-[0_12px_28px_-8px_rgba(228,64,95,0.85)] focus-visible:bg-[linear-gradient(45deg,#F9A03F,#E4405F_55%,#A83BC9)] focus-visible:shadow-[0_12px_28px_-8px_rgba(228,64,95,0.85)]",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/mellow-vault/posts/",
    icon: Linkedin,
    hover: "hover:bg-[#0A66C2] hover:shadow-[0_12px_28px_-8px_rgba(10,102,194,0.85)] focus-visible:bg-[#0A66C2] focus-visible:shadow-[0_12px_28px_-8px_rgba(10,102,194,0.85)]",
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@mellowvaultofficial",
    icon: Youtube,
    hover: "hover:bg-[#FF0000] hover:shadow-[0_12px_28px_-8px_rgba(255,0,0,0.8)] focus-visible:bg-[#FF0000] focus-visible:shadow-[0_12px_28px_-8px_rgba(255,0,0,0.8)]",
  },
];

const TRUST_BADGES = [
  { label: "256-Bit SSL Secured", icon: Lock },
  { label: "ISO 27001 Certified Practice", icon: ShieldCheck },
];

/** Column-heading icon tile on the dark surface: a soft tint at rest, the column's own colour on hover. */
const COLUMN_TONE: Record<Tone, string> = {
  indigo: "text-indigo-300 group-hover:border-indigo-400/50 group-hover:bg-indigo-500/20 group-hover:shadow-[0_8px_22px_-6px_rgba(99,102,241,0.7)]",
  cyan: "text-cyan-300 group-hover:border-cyan-400/50 group-hover:bg-cyan-500/20 group-hover:shadow-[0_8px_22px_-6px_rgba(6,182,212,0.7)]",
  violet: "text-violet-300 group-hover:border-violet-400/50 group-hover:bg-violet-500/20 group-hover:shadow-[0_8px_22px_-6px_rgba(139,92,246,0.7)]",
  emerald: "text-emerald-300 group-hover:border-emerald-400/50 group-hover:bg-emerald-500/20 group-hover:shadow-[0_8px_22px_-6px_rgba(16,185,129,0.7)]",
  amber: "text-amber-300 group-hover:border-amber-400/50 group-hover:bg-amber-500/20 group-hover:shadow-[0_8px_22px_-6px_rgba(245,158,11,0.7)]",
  rose: "text-rose-300 group-hover:border-rose-400/50 group-hover:bg-rose-500/20 group-hover:shadow-[0_8px_22px_-6px_rgba(244,63,94,0.7)]",
};

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

const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sb-bg)]";

function FooterAnchor({ link }: { link: FooterLink }) {
  const classes = cn("group inline-flex items-center gap-1 rounded-sm text-sm font-medium transition-colors hover:text-white focus-visible:text-white", INK, FOCUS);
  const label = (
    <span className="relative after:absolute after:left-0 after:-bottom-0.5 after:h-px after:w-0 after:bg-current after:transition-all after:duration-300 group-hover:after:w-full">
      {link.label}
    </span>
  );
  const arrow = (
    <ArrowUpRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 translate-y-0.5 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-200" />
  );

  return link.external ? (
    <a href={link.href} target="_blank" rel="noopener noreferrer" className={classes}>
      {label}
      {arrow}
    </a>
  ) : (
    <Link href={link.href} className={classes}>
      {label}
      {arrow}
    </Link>
  );
}

/** One contact detail: a small caption over the value, in a tinted tile — a link when it can be tapped. */
function ContactItem({ icon: Icon, caption, value, href }: { icon: typeof Mail; caption: string; value: string; href?: string }) {
  const body = (
    <>
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-indigo-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-200 group-hover:border-indigo-400/50 group-hover:bg-indigo-500/20 group-hover:text-white"
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className={cn("block text-3xs font-mono font-bold uppercase tracking-wider", INK_FAINT)}>{caption}</span>
        <span className="block break-words text-sm font-semibold text-white">{value}</span>
      </span>
    </>
  );

  return href ? (
    <a href={href} className={cn("group flex items-center gap-3 rounded-xl", FOCUS)}>
      {body}
    </a>
  ) : (
    <div className="group flex items-center gap-3">{body}</div>
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
    <footer
      className={cn(
        "relative isolate w-full overflow-hidden bg-[var(--sb-bg)] pt-14 sm:pt-20",
        // A rounded, lifted top edge so the dark band sits on the page like a sheet rather than a hard cut.
        "rounded-t-[28px] sm:rounded-t-[44px] shadow-[0_-24px_70px_-30px_rgba(39,47,92,0.55)] ring-1 ring-inset ring-white/[0.07]",
        INK
      )}
    >
      {/* Atmosphere: brand-colour hairline, three soft glows (indigo, cyan, a touch of the logo's yellow) and a faint dot grid fading out from the top edge */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-10 top-0 h-px opacity-80" style={{ background: "linear-gradient(90deg, transparent, #818CF8 28%, #22D3EE 72%, transparent)" }} />
        <div className="absolute -top-36 left-[4%] h-[320px] w-[560px] rounded-full bg-indigo-500/20 blur-[120px]" />
        <div className="absolute -top-28 right-[2%] h-[280px] w-[480px] rounded-full bg-cyan-400/[0.13] blur-[120px]" />
        <div className="absolute -bottom-40 left-[38%] h-[280px] w-[560px] rounded-full bg-amber-400/[0.07] blur-[130px]" />
        <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_80%_55%_at_50%_0%,black,transparent)]" />
      </div>

      <Container size="xl">
        {/* 1 — Brand and site map */}
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-x-8 2xl:gap-x-14">
          <div className="lg:col-span-4 xl:col-span-3">
            <Link href="/" aria-label="AptRun home" className={cn("group flex w-fit items-center gap-3 rounded-md", FOCUS)}>
              <LogoBadge className="h-11 w-11 drop-shadow-[0_6px_18px_rgba(99,102,241,0.45)] transition-transform duration-200 group-hover:scale-105" />
              <div className="flex flex-col">
                <Wordmark className="text-xl" />
                <span className={cn("mt-0.5 text-3xs font-mono uppercase tracking-wider", INK_FAINT)}>Placement Sandbox</span>
              </div>
            </Link>

            <p className={cn("mt-5 max-w-xs text-sm leading-relaxed", INK_DIM)}>
              Campus drives, a personal learning centre for every student, and a network of hiring partners.
            </p>

            <a
              href="https://mellowvault.com"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "group mt-5 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.05] py-1.5 pl-3 pr-2.5 text-xs font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-200 hover:border-indigo-400/50 hover:bg-white/[0.08]",
                INK,
                FOCUS
              )}
            >
              <span>
                AptRun is a product of <strong className="font-bold text-white">Mellow Vault</strong>
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-indigo-300 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>

            <div className="mt-7">
              <p className={cn("mb-3 text-3xs font-mono font-bold uppercase tracking-wider", INK_FAINT)}>Follow us</p>
              <ul className="flex items-center gap-2.5">
                {SOCIAL_LINKS.map(({ label, href, icon: Icon, hover }) => (
                  <li key={label}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Mellow Vault on ${label}`}
                      title={label}
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-transparent hover:text-white focus-visible:-translate-y-0.5 focus-visible:border-transparent focus-visible:text-white focus-visible:ring-2 focus-visible:ring-indigo-400/60",
                        INK,
                        hover
                      )}
                    >
                      <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:col-span-8 xl:col-span-9">
            {COLUMNS.map((col) => {
              const Icon = col.icon;
              return (
                <div key={col.title}>
                  <h3 className="mb-5">
                    <Link href={col.href} className={cn("group inline-flex items-center gap-2.5 rounded-md", FOCUS)}>
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-200",
                          COLUMN_TONE[col.tone]
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="whitespace-nowrap text-2xs font-mono font-bold uppercase tracking-wide text-white sm:text-xs sm:tracking-wider">{col.title}</span>
                      <ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-indigo-300 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
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

        {/* 2 — Contact and product updates, on one raised glass card */}
        <div className="mt-14 flex flex-col gap-6 rounded-2xl border border-white/10 bg-gradient-to-b from-indigo-300/[0.10] to-white/[0.02] p-5 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm sm:p-6 xl:flex-row xl:items-center xl:justify-between xl:gap-10">
          <ul aria-label="Contact" className="flex min-w-0 flex-col gap-5 sm:flex-row sm:flex-wrap sm:gap-x-9 sm:gap-y-4">
            <li>
              <ContactItem icon={Mail} caption="Email" value={SUPPORT_EMAIL} href={`mailto:${SUPPORT_EMAIL}`} />
            </li>
            <li>
              <ContactItem icon={Phone} caption="Phone" value={SUPPORT_PHONE_DISPLAY} href={SUPPORT_PHONE_HREF} />
            </li>
            <li>
              <ContactItem icon={MapPin} caption="Based in" value={LOCATION} />
            </li>
          </ul>

          <div className="w-full max-xl:border-t max-xl:border-white/10 max-xl:pt-6 xl:w-[26rem] xl:shrink-0">
            {newsletterStatus === "success" ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>You&apos;re subscribed. Check your inbox.</span>
              </div>
            ) : (
              <form onSubmit={handleNewsletterSubmit}>
                <label htmlFor="footer-newsletter-email" className="block text-sm font-bold text-white">
                  Product updates
                </label>
                <p className={cn("mb-2.5 mt-0.5 text-xs", INK_DIM)}>New features and placement news. No spam.</p>
                <div className="flex items-center gap-2">
                  <input
                    id="footer-newsletter-email"
                    type="email"
                    required
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="you@college.edu"
                    className="h-10 min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-3.5 text-sm text-white outline-none transition-all placeholder:text-[var(--sb-text-faint)] focus:border-indigo-400 focus:bg-white/[0.09] focus:ring-2 focus:ring-indigo-400/30"
                  />
                  <button
                    type="submit"
                    disabled={newsletterStatus === "loading"}
                    aria-label="Subscribe to product updates"
                    className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-b from-indigo-500 to-indigo-600 px-4 text-sm font-bold text-white shadow-[0_10px_26px_-8px_rgba(99,102,241,0.85),inset_0_1px_0_rgba(255,255,255,0.22)] outline-none transition-all hover:-translate-y-px hover:from-indigo-400 hover:to-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-300/70 disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    <span>{newsletterStatus === "loading" ? "..." : "Subscribe"}</span>
                    {newsletterStatus !== "loading" && <Send className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {newsletterStatus === "error" && newsletterError && <p className="mt-2 text-xs font-medium text-rose-300">{newsletterError}</p>}
              </form>
            )}
          </div>
        </div>

        {/* 3 — Legal: who we are on the left, what to read and how we're secured on the right */}
        <div className="mt-10 flex flex-col gap-6 border-t border-white/10 pb-8 pt-7 xl:flex-row xl:items-center xl:justify-between xl:gap-8">
          <div className="space-y-2.5">
            <p className={cn("text-xs font-semibold leading-relaxed", INK)}>&copy; {new Date().getFullYear()} Mellow Vault. All rights reserved.</p>
            <p className={cn("text-2xs font-medium leading-relaxed", INK_DIM)}>
              A Unit of {LEGAL_ENTITY} <span aria-hidden="true">&bull;</span> <span className={cn("whitespace-nowrap font-mono", INK_FAINT)}>CIN: {CIN}</span>
            </p>
            <ul aria-label="Security and compliance" className="flex flex-wrap items-center gap-2 pt-1.5">
              {TRUST_BADGES.map(({ label, icon: Icon }) => (
                <li
                  key={label}
                  className={cn("inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-2xs font-semibold", INK)}
                >
                  <Icon aria-hidden="true" className="h-3.5 w-3.5 text-emerald-400" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {LEGAL_LINKS.map((link) => (
              <FooterAnchor key={link.label} link={link} />
            ))}
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              aria-label="Back to top"
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-400 hover:bg-indigo-500 hover:text-white hover:shadow-[0_12px_28px_-8px_rgba(99,102,241,0.8)] focus-visible:ring-2 focus-visible:ring-indigo-400/60",
                INK
              )}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Container>
    </footer>
  );
}
