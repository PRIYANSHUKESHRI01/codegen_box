"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { HeroBackground } from "@/components/hero/HeroBackground";

interface PageIntroProps {
  /** The last crumb: "For colleges". */
  crumb: string;
  eyebrow: { icon: LucideIcon; label: string };
  title: ReactNode;
  description: string;
  /** The buttons. */
  actions: ReactNode;
  /** A line of reassurance under the buttons. */
  note?: ReactNode;
  /** What the page is about, drawn: a product card, a live board, a simulator. */
  visual: ReactNode;
}

/**
 * The opening of a content page (Colleges, Students, Rewards, Mellow Vault): the same aurora as the landing page, a breadcrumb, the
 * promise on the left and the thing itself on the right. The text rises in a beat apart; the visual arrives with the page.
 */
export function PageIntro({ crumb, eyebrow, title, description, actions, note, visual }: PageIntroProps) {
  const reduce = useReducedMotion();
  const EyebrowIcon = eyebrow.icon;

  const container = { hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : 0.08 } } };
  const item = { hidden: { opacity: 0, y: reduce ? 0 : 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } } };

  return (
    <section aria-label={crumb} className="relative isolate overflow-hidden pb-16 pt-5 sm:pb-24">
      <HeroBackground />
      <Container size="xl">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
          <Link href="/" className="transition-colors hover:text-primary">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
          <span aria-current="page" className="font-semibold text-primary">
            {crumb}
          </span>
        </nav>

        <div className="grid items-center gap-12 pt-8 lg:grid-cols-12 lg:gap-12 lg:pt-14">
          <motion.div variants={container} initial="hidden" animate="show" className="lg:col-span-6">
            <motion.span
              variants={item}
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent-primary/25 bg-accent-primary/10 px-3 py-1.5 text-2xs font-mono font-bold uppercase tracking-wider text-accent-primary"
            >
              <EyebrowIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {eyebrow.label}
            </motion.span>
            <motion.h1
              variants={item}
              className="mb-5 text-balance text-[clamp(2rem,9vw,2.6rem)] font-bold leading-[1.06] tracking-[-0.035em] text-primary sm:text-5xl lg:text-[3.25rem]"
            >
              {title}
            </motion.h1>
            <motion.p variants={item} className="mb-8 max-w-xl text-base font-medium leading-relaxed text-text-secondary sm:text-lg">
              {description}
            </motion.p>
            <motion.div variants={item} className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              {actions}
            </motion.div>
            {note && (
              <motion.div variants={item} className="mt-6 text-13 font-medium text-text-secondary">
                {note}
              </motion.div>
            )}
          </motion.div>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="relative lg:col-span-6"
          >
            <div aria-hidden="true" className="absolute -inset-4 -z-10 rounded-[40px] bg-gradient-to-r from-accent-primary/25 via-violet-400/20 to-accent-secondary/25 opacity-60 blur-3xl dark:opacity-40" />
            {visual}
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
