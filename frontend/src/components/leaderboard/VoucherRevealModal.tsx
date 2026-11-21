"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, ExternalLink, Gift, Sparkles, Trophy, X } from "lucide-react";
import { Confetti } from "@/components/arena/motion";
import { cn } from "@/lib/utils";
import type { MyWin } from "@/types/weeklyRewards";

interface Props {
  win: MyWin;
  onClose: () => void;
  autoReveal?: boolean;
}

export function VoucherRevealModal({ win, onClose, autoReveal = false }: Props) {
  const [opened, setOpened] = useState(autoReveal);
  const [copied, setCopied] = useState(autoReveal);
  const [burst, setBurst] = useState(autoReveal ? Date.now() : 0);

  const handleOpen = () => {
    setOpened(true);
    setBurst(Date.now());
  };

  const handleCopy = async () => {
    if (!win.voucher_code) return;
    try {
      await navigator.clipboard.writeText(win.voucher_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // fallback
    }
  };

  const brandColor = win.color || "#006491";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voucher-reveal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-surface border border-border-subtle shadow-2xl">
        {/* Celebration Confetti */}
        <Confetti burst={burst} pieces={68} />

        {/* Top header with brand gradient */}
        <div
          className="relative px-6 pt-8 pb-6 text-white text-center overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${brandColor}, color-mix(in srgb, ${brandColor} 60%, #000))` }}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 rounded-full bg-black/20 p-1.5 text-white/80 hover:bg-black/40 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Rank Badge */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-2xs font-extrabold uppercase tracking-widest text-amber-200 backdrop-blur-md ring-1 ring-white/30">
            <Trophy className="h-3 w-3 text-amber-300" />
            Rank #{win.rank} · Weekly Contest Winner
          </div>

          <h2 id="voucher-reveal-title" className="mt-3 text-xl font-black tracking-tight text-white sm:text-2xl">
            Congratulations! 🎉
          </h2>
          <p className="mt-1 text-xs text-white/85">
            You topped the leaderboard! Here is your reward.
          </p>

          {/* Brand Logo floating */}
          <div className="mt-4 flex justify-center">
            <div className="rounded-2xl bg-white p-2.5 shadow-lg ring-4 ring-white/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={win.logo}
                alt={win.brand}
                width={56}
                height={56}
                className="h-14 w-14 object-contain"
              />
            </div>
          </div>
        </div>

        {/* Content body */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {!opened ? (
              /* Sealed Unopened State */
              <motion.div
                key="unopened"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center space-y-4"
              >
                <div className="rounded-2xl border border-dashed border-accent-primary/40 bg-accent-primary/5 p-6">
                  <div className="text-3xs font-extrabold uppercase tracking-widest text-text-muted">
                    Gift Voucher
                  </div>
                  <div className="mt-1 font-mono text-2xl font-black text-primary">
                    ₹{win.amount.toLocaleString("en-IN")}
                  </div>
                  <div className="mt-0.5 text-xs font-bold text-text-secondary">
                    {win.brand} Voucher
                  </div>
                  <div className="mt-4 flex items-center justify-center gap-2 text-2xs text-text-muted">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                    <span>Click below to unseal and reveal your coupon code</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOpen}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-btn bg-accent-primary py-3.5 text-sm font-extrabold text-white shadow-lg shadow-accent-primary/25 hover:bg-accent-primary-hover hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <Gift className="h-4 w-4 animate-bounce" />
                  Open Voucher &amp; Reveal Code
                </button>
              </motion.div>
            ) : (
              /* Opened / Code Revealed State with Celebration Animation */
              <motion.div
                key="opened"
                initial={{ opacity: 0, scale: 0.8, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 350, damping: 22 }}
                className="space-y-4 text-center"
              >
                <div className="rounded-2xl border-2 border-dashed border-status-success/50 bg-status-success/5 p-5 shadow-inner">
                  <div className="inline-flex items-center gap-1 text-3xs font-extrabold uppercase tracking-widest text-status-success">
                    <Sparkles className="h-3 w-3" /> Voucher Unlocked
                  </div>

                  <div className="mt-2 text-xs text-text-muted">
                    Your official {win.brand} coupon code:
                  </div>

                  {/* Coupon Code Block */}
                  <div className="mt-2 relative group">
                    <div className="flex items-center justify-between rounded-xl border border-border-strong bg-surface px-4 py-3 font-mono text-base font-extrabold tracking-wider text-primary shadow-sm sm:text-lg">
                      <span className="select-all font-black text-primary">
                        {win.voucher_code || "VOUCHER-READY"}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopy}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-2xs font-bold transition-all",
                          copied
                            ? "bg-status-success text-white"
                            : "bg-accent-primary text-white hover:bg-accent-primary-hover"
                        )}
                        aria-label="Copy code"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3 w-3" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" /> Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 text-2xs text-text-muted">
                    Worth <strong className="text-primary font-bold">₹{win.amount.toLocaleString("en-IN")}</strong> · Week of {new Date(win.week_key).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </div>
                </div>

                {/* How to use */}
                <div className="rounded-panel border border-border-subtle bg-elevated/40 p-3.5 text-left text-2xs text-text-secondary space-y-1">
                  <div className="font-bold text-primary flex items-center gap-1.5">
                    <span>💡 How to use your {win.brand} coupon:</span>
                  </div>
                  <ol className="list-decimal pl-4 space-y-0.5 text-text-muted">
                    <li>Copy your code above.</li>
                    <li>Open the <strong>{win.brand}</strong> mobile app or website.</li>
                    <li>Add your items to cart and apply this code under &ldquo;Coupons / Promos&rdquo; at checkout.</li>
                  </ol>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setBurst(Date.now())}
                    className="inline-flex items-center gap-1 text-2xs font-bold text-text-muted hover:text-accent-primary transition-colors"
                  >
                    <Sparkles className="h-3 w-3" /> Celebrate again
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-control border border-border-subtle bg-elevated px-4 py-1.5 text-xs font-bold text-primary hover:bg-surface-hover"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
