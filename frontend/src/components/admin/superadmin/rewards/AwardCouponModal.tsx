"use client";

import { useState } from "react";
import { Gift, Loader2, Sparkles, Trophy } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ToastTrigger } from "@/lib/toast";

export interface CompanyOption {
  key: string;
  brand: string;
  amount: number;
  logo: string;
  color: string;
  tagline?: string;
}

export const VOUCHER_COMPANIES: CompanyOption[] = [
  { key: "dominos", brand: "Domino's", amount: 299, logo: "/rewards/dominos.svg", color: "#006491", tagline: "Pizza night, sorted" },
  { key: "mcdonalds", brand: "McDonald's", amount: 199, logo: "/rewards/mcdonalds.svg", color: "#DA291C", tagline: "A Maharaja Mac or two" },
  { key: "burger_king", brand: "Burger King", amount: 499, logo: "/rewards/burger-king.svg", color: "#D62300", tagline: "A Whopper meal on us" },
  { key: "zomato", brand: "Zomato", amount: 399, logo: "/rewards/zomato.svg", color: "#E23744", tagline: "Order in, on us" },
  { key: "swiggy", brand: "Swiggy", amount: 299, logo: "/rewards/swiggy.svg", color: "#FC8019", tagline: "Dinner delivered" },
  { key: "kfc", brand: "KFC", amount: 399, logo: "/rewards/kfc.svg", color: "#F40027", tagline: "A bucket of finger-lickin' good" },
  { key: "amazon", brand: "Amazon", amount: 499, logo: "/rewards/amazon.svg", color: "#FF9900", tagline: "Shop for anything you like" },
  { key: "starbucks", brand: "Starbucks", amount: 299, logo: "/rewards/starbucks.svg", color: "#006241", tagline: "Coffee for the all-nighter" },
];

interface StudentTarget {
  id: number;
  name: string;
  handle?: string;
  email?: string | null;
  college?: string | null;
  rank?: number;
  contest_score?: number;
  initialCard?: string | null;
  initialCode?: string | null;
  initialNote?: string | null;
}

interface Props {
  student: StudentTarget;
  weekKey: string;
  onClose: () => void;
  onSuccess: () => void;
  triggerToast: ToastTrigger;
}

export function AwardCouponModal({ student, weekKey, onClose, onSuccess, triggerToast }: Props) {
  const [selectedKey, setSelectedKey] = useState<string>(student.initialCard || "dominos");
  const [code, setCode] = useState(student.initialCode || "");
  const [note, setNote] = useState(student.initialNote || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const company = VOUCHER_COMPANIES.find((c) => c.key === selectedKey) || VOUCHER_COMPANIES[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError("Please type a coupon code.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await api.post("/superadmin/weekly-rewards/give-coupon", {
        user_id: student.id,
        card: company.key,
        voucher_code: code.trim(),
        week: weekKey,
        rank: student.rank ?? 1,
        contest_score: student.contest_score ?? 0,
        note: note.trim() || undefined,
      });

      triggerToast(`🎉 ${company.brand} voucher awarded to ${student.name}! Notification and email sent.`);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't award the voucher. Try again.");
      setBusy(false);
    }
  };

  return (
    <Modal
      onClose={() => !busy && onClose()}
      title="Give Contest Reward Coupon"
      subtitle={`${student.name} · Rank #${student.rank ?? 1} on Weekly Leaderboard`}
      icon={Gift}
      size="md"
      closeOnBackdrop={false}
      showCloseButton={!busy}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-control border border-border-subtle px-4 py-2 text-xs font-semibold text-text-muted transition-colors hover:text-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="award-coupon-form"
            disabled={busy || !code.trim()}
            className="inline-flex items-center gap-2 rounded-control bg-accent-primary px-4 py-2 text-xs font-bold text-white shadow-subtle transition-all hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Give Coupon to Student
          </button>
        </>
      }
    >
      <form id="award-coupon-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Student card info */}
        <div className="rounded-panel border border-border-subtle bg-elevated/40 p-3.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-primary">{student.name}</span>
                {student.handle && <span className="font-mono text-2xs text-text-muted">@{student.handle}</span>}
              </div>
              <div className="mt-0.5 font-medium text-text-secondary">
                {student.email ? (
                  <span className="text-accent-primary">{student.email}</span>
                ) : (
                  <span className="text-text-muted">No email on file</span>
                )}
                {student.college && <span> · {student.college}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-2xs font-bold text-amber-700 dark:text-amber-300">
              <Trophy className="h-3 w-3" />
              <span>Rank #{student.rank ?? 1} · {student.contest_score ?? 0} pts</span>
            </div>
          </div>
        </div>

        {/* Company Dropdown */}
        <div>
          <label htmlFor="reward-company-select" className="mb-1 block text-xs font-semibold text-text-secondary">
            Select Company / Brand
          </label>
          <select
            id="reward-company-select"
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            className="w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs font-bold text-primary outline-none focus:border-accent-primary"
          >
            {VOUCHER_COMPANIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.brand} — ₹{c.amount} ({c.tagline})
              </option>
            ))}
          </select>
        </div>

        {/* Visual Company Preview */}
        <div
          className="relative flex items-center gap-3 overflow-hidden rounded-xl p-3.5 text-white shadow-sm ring-1 ring-white/20"
          style={{ background: `linear-gradient(135deg, ${company.color}, color-mix(in srgb, ${company.color} 65%, #000))` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={company.logo}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 select-none rounded-lg bg-white object-contain p-1 shadow-sm"
          />
          <div className="min-w-0">
            <div className="text-3xs font-extrabold uppercase tracking-widest text-white/80">Weekly Contest Prize</div>
            <div className="text-sm font-black">{company.brand}</div>
            <div className="font-mono text-xs font-bold text-white/90">₹{company.amount} Gift Voucher</div>
          </div>
        </div>

        {/* Coupon Code Input */}
        <div>
          <label htmlFor="voucher-code-input" className="mb-1 block text-xs font-semibold text-text-secondary">
            Coupon Code <span className="text-status-danger">*</span>
          </label>
          <input
            id="voucher-code-input"
            type="text"
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. DOMINOS-PIZZA-50 or MCD-BURGER-FREE"
            className="w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 font-mono text-sm font-bold text-primary placeholder:font-sans placeholder:font-normal placeholder:text-text-muted outline-none focus:border-accent-primary"
          />
          <p className="mt-1 text-3xs text-text-muted">
            The code is encrypted and sent to the student via email and dashboard notification.
          </p>
        </div>

        {/* Optional Note */}
        <div>
          <label htmlFor="voucher-note-input" className="mb-1 block text-xs font-semibold text-text-secondary">
            Note <span className="text-3xs font-normal text-text-muted">(optional, for internal record)</span>
          </label>
          <input
            id="voucher-note-input"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Sent via email and SMS"
            className="w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs text-primary placeholder:text-text-muted outline-none focus:border-accent-primary"
          />
        </div>

        {error && (
          <div role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs font-semibold text-status-danger">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
