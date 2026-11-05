"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { CampusCard, RewardsCard, TonightCard, VaultChip } from "@/components/landing/StageCards";
import { landingFacts, useLandingData } from "@/lib/useLandingData";

/**
 * The product, in one composed frame. Three cards float on a glass canvas and drift a few pixels against the pointer:
 *   - a placement cell's console (the pipeline of a campus drive, its eligibility rules, readiness by department),
 *   - tonight's AptRun Daily Challenge, counting down to the real start time,
 *   - this week's vouchers, the ones the superadmin actually has live.
 * The last two are read from the backend; the first is a sketch with no figures in it, and says so. Nothing here is a made-up customer.
 */
export function HeroStage() {
  const { data, status, refresh } = useLandingData();
  const reduce = useReducedMotion();
  const facts = landingFacts(data);

  // Pointer parallax: one spring-smoothed pair, three depths. Skipped entirely for people who ask for reduced motion.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const px = useSpring(mx, { stiffness: 80, damping: 18, mass: 0.6 });
  const py = useSpring(my, { stiffness: 80, damping: 18, mass: 0.6 });
  const campus = { x: useTransform(px, [-0.5, 0.5], [7, -7]), y: useTransform(py, [-0.5, 0.5], [5, -5]) };
  const tonight = { x: useTransform(px, [-0.5, 0.5], [-12, 12]), y: useTransform(py, [-0.5, 0.5], [-8, 8]) };
  const rewards = { x: useTransform(px, [-0.5, 0.5], [-5, 5]), y: useTransform(py, [-0.5, 0.5], [-10, 10]) };

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  const layer = (t: { x: typeof campus.x; y: typeof campus.y }) => (reduce ? undefined : { x: t.x, y: t.y });
  const enter = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 28 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: [0.21, 0.47, 0.32, 0.98] as const },
  });

  return (
    <div className="relative mx-auto w-full max-w-6xl px-0 sm:px-2" onMouseMove={onMove} onMouseLeave={onLeave}>
      {/* Coloured glow under the frame so it floats off the page */}
      <div
        aria-hidden="true"
        className="absolute -inset-x-6 -bottom-8 top-12 -z-10 rounded-[48px] bg-gradient-to-r from-accent-primary/30 via-violet-400/25 to-accent-secondary/30 opacity-60 blur-3xl dark:opacity-40"
      />

      <div className="relative rounded-[28px] border border-border-strong bg-surface/70 p-3 shadow-[0_40px_100px_-30px_rgba(39,47,92,0.45)] backdrop-blur-xl sm:p-5 dark:shadow-[0_40px_100px_-30px_rgba(0,0,0,0.85)]">
        <div aria-hidden="true" className="gradient-hairline absolute inset-x-8 top-0 h-px opacity-80" />

        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-12">
          <motion.div {...enter(0.1)} className="lg:col-span-7 lg:row-span-2">
            <motion.div style={layer(campus)} className="h-full">
              <CampusCard departments={data?.departments ?? []} loaded={status !== "loading"} />
            </motion.div>
          </motion.div>

          <motion.div {...enter(0.22)} className="lg:col-span-5">
            <motion.div style={layer(tonight)} className="h-full">
              <TonightCard contest={data?.contest ?? null} status={status} facts={facts} onDone={refresh} />
            </motion.div>
          </motion.div>

          <motion.div {...enter(0.34)} className="lg:col-span-5">
            <motion.div style={layer(rewards)} className="h-full">
              <RewardsCard rewards={data?.rewards ?? null} status={status} resets={facts.weekResets} onDone={refresh} />
            </motion.div>
          </motion.div>
        </div>

        <motion.div {...enter(0.5)} className="relative z-10 mt-3 flex justify-center lg:absolute lg:-bottom-9 lg:left-10 lg:mt-0 lg:block">
          <VaultChip bar={facts.vaultBar} />
        </motion.div>
      </div>

      <p className="mt-9 text-center text-2xs font-medium text-text-muted lg:mt-14">
        Tonight&apos;s contest and this week&apos;s vouchers are live. The campus console is a preview, shown without figures.
      </p>
    </div>
  );
}

