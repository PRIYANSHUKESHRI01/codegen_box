"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileText,
  FlaskConical,
  Loader2,
  Lock,
  Terminal,
  Timer,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { errorMessage, notifySubscriptionChanged, rupees } from "@/lib/projectLab";
import { PROJECT_LAB_ERROR, type ProjectLabSummary, type PurchaseQuote } from "@/types/projectLab";
import type { MySubscriptionResponse } from "@/types/subscription";

const LAB = "project-lab";

interface Option {
  key: string;
  /** Base plan bought alongside Lab, or null for Lab on its own. */
  planCode: string | null;
  title: string;
  blurb: string;
  quote: PurchaseQuote | null;
  badge?: string;
}

interface PurchasePanelProps {
  summary: ProjectLabSummary;
  /** Fired with the fresh summary once the purchase has gone through. */
  onPurchased: (summary: ProjectLabSummary) => void;
  /**
   * "unlock" (default): the student doesn't have Project Lab — sell it, alone or with a plan.
   * "renew": they do — offer another 30 days, which stack on the days they have left.
   */
  mode?: "unlock" | "renew";
  className?: string;
}

function quoteQuery(planCode: string | null): string {
  const params = new URLSearchParams();
  if (planCode) params.set("plan_code", planCode);
  params.append("addons[]", LAB);
  return params.toString();
}

/**
 * The "buy Project Lab" surface. Shown in place of the paid parts wherever a
 * student without Lab runs into them (the catalog, a topic's SOW).
 *
 * Prices are never computed here: each option's total is the server's own quote
 * (GET /me/purchase-quote), and the checkout sends back the total the student
 * was shown so that a price that moved in the meantime is refused with a
 * fresh quote instead of being charged unseen.
 */
export function PurchasePanel({ summary, onPurchased, mode = "unlock", className }: PurchasePanelProps) {
  const renew = mode === "renew";
  const [options, setOptions] = useState<Option[]>([]);
  const [selected, setSelected] = useState<string>("lab");
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offer = summary.offer;

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const me = await api.get<MySubscriptionResponse>("/me/subscription");
      const individual = me.coverage?.source === "individual" || me.coverage?.source === "none";
      const onFreePlan = individual && (!me.coverage?.plan || me.coverage.plan.code === "coder");

      // Someone already on a paid plan gets the bundle price on Lab alone, so a
      // separate "plan + Lab" row would only repeat it. Bundles are offered to
      // students on the free plan (and never to college-covered students, whose plan isn't theirs to change).
      const plans: { planCode: string | null; key: string; title: string; blurb: string; badge?: string }[] = [
        {
          planCode: null,
          key: "lab",
          title: renew ? "Renew Project Lab" : "Project Lab",
          blurb: renew
            ? "Another 30 days, added on top of the days you have left."
            : onFreePlan || !individual
            ? "Just the projects, on your current plan."
            : "Included at your member price.",
        },
      ];
      if (onFreePlan && !renew) {
        plans.push(
          { planCode: "expert", key: "expert", title: "Expert + Project Lab", blurb: "Unlimited practice, 3 AI mock interviews a day and full drive access — with Project Lab.", badge: "Best value" },
          { planCode: "grandmaster", key: "grandmaster", title: "Grandmaster + Project Lab", blurb: "Everything in Expert, 10 AI mock interviews a day and the AI coach — with Project Lab." }
        );
      }

      const quotes = await Promise.all(
        plans.map((p) =>
          api
            .get<{ quote: PurchaseQuote }>(`/me/purchase-quote?${quoteQuery(p.planCode)}`)
            .then((r) => r.quote)
            .catch(() => null)
        )
      );

      setOptions(plans.map((p, i) => ({ ...p, quote: quotes[i] })));
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [renew]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  const current = useMemo(() => options.find((o) => o.key === selected) ?? options[0], [options, selected]);

  const buy = async () => {
    if (!current?.quote) return;
    setBuying(true);
    setError(null);
    try {
      const res = await api.post<MySubscriptionResponse>("/me/subscription", {
        plan_code: current.planCode ?? undefined,
        addons: [LAB],
        expected_total: current.quote.total,
      });
      notifySubscriptionChanged();
      if (res.project_lab) onPurchased(res.project_lab);
    } catch (err) {
      if (err instanceof ApiError && err.code === PROJECT_LAB_ERROR.priceChanged) {
        setError("The price changed just now — please review the updated total and confirm again.");
        await loadQuotes();
      } else {
        setError(errorMessage(err, "We couldn't activate that. Please try again."));
      }
    } finally {
      setBuying(false);
    }
  };

  const features = [
    { icon: FileText, text: "A proper Statement of Work for every project — read it online or download it as a PDF." },
    { icon: Terminal, text: "A full VS Code in your browser: terminal, git, Node, PHP/Laravel, Python and Java ready to go." },
    { icon: Database, text: "MySQL, PostgreSQL, Redis and SQLite one command away. Run your whole stack, then preview it live." },
    {
      icon: Timer,
      text: `${offer?.workspace_hours ? `${offer.workspace_hours} workspace hours` : "Generous workspace hours"} and ${offer?.active_projects ? `${offer.active_projects} projects` : "several projects"} at a time, every month.`,
    },
    { icon: ClipboardCheck, text: "Submit your code and get it reviewed against each milestone's acceptance criteria." },
  ];

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-panel border border-accent-primary/25 bg-surface shadow-card",
        className
      )}
      aria-label="Get Project Lab"
    >
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-accent-primary/10 blur-3xl" />

      <div className="relative grid gap-0 lg:grid-cols-[1.05fr_1fr]">
        {/* What you get */}
        <div className="p-5 sm:p-7">
          {renew ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-status-success/30 bg-status-success/10 px-2.5 py-1 text-3xs font-bold uppercase tracking-wide text-status-success">
              <CheckCircle2 className="h-3 w-3" />
              Active{summary.days_remaining !== null ? ` · ${summary.days_remaining} day${summary.days_remaining === 1 ? "" : "s"} left` : ""}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-primary/25 bg-accent-primary/10 px-2.5 py-1 text-3xs font-bold uppercase tracking-wide text-accent-primary">
              <Lock className="h-3 w-3" />
              Not on your plan yet
            </span>
          )}
          <h2 className="mt-3 flex items-center gap-2.5 text-xl font-extrabold tracking-tight text-primary sm:text-2xl">
            <FlaskConical className="h-6 w-6 text-accent-primary" />
            {renew ? "Keep building with Project Lab" : "Build real projects, the way teams do"}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">
            {renew
              ? "Your hours reset when you renew, and the new 30 days start after the ones you have left."
              : "Pick a project — an LMS, a hospital system, an e-commerce store — follow its SOW milestone by milestone in a real full-stack environment, and submit your code for review."}
          </p>

          <ul className="mt-5 space-y-3">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-text-secondary">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-primary/10 text-accent-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="leading-snug">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* What it costs */}
        <div className="border-t border-border-subtle bg-elevated/50 p-5 sm:p-7 lg:border-l lg:border-t-0">
          <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Choose how to get it</h3>

          {loading ? (
            <div className="mt-4 space-y-2.5" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[76px] animate-pulse rounded-control border border-border-subtle bg-surface" />
              ))}
            </div>
          ) : options.length === 0 || options.every((o) => o.quote === null) ? (
            <p className="mt-4 rounded-control border border-border-subtle bg-surface p-4 text-sm text-text-secondary">
              Project Lab isn&apos;t available to buy right now. Please check back soon.
            </p>
          ) : (
            <div role="radiogroup" aria-label="Purchase option" className="mt-4 space-y-2.5">
              {options.map((o) => {
                const active = o.key === current?.key;
                const q = o.quote;
                if (!q) return null;
                return (
                  <button
                    key={o.key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSelected(o.key)}
                    className={cn(
                      "w-full rounded-control border p-3.5 text-left transition-all",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
                      active
                        ? "border-accent-primary bg-surface shadow-subtle ring-1 ring-accent-primary/40"
                        : "border-border-subtle bg-surface hover:border-border-strong"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-primary">{o.title}</span>
                          {o.badge && (
                            <span className="rounded-full bg-accent-primary px-2 py-0.5 text-3xs font-bold uppercase tracking-wide text-white">
                              {o.badge}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs leading-snug text-text-secondary">{o.blurb}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-mono text-lg font-black leading-none text-primary">{rupees(q.total)}</div>
                        <div className="mt-1 text-2xs font-medium text-text-secondary">per month</div>
                      </div>
                    </div>
                    {q.discount > 0 && (
                      <p className="mt-2 flex items-center gap-1.5 text-2xs font-semibold text-status-success">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        You save {rupees(q.discount)} a month on Project Lab
                        {q.lines.length > 1 ? ` (${rupees(q.subtotal)} → ${rupees(q.total)})` : ""}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <p role="alert" className="mt-3 rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs text-status-danger">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={buy}
            disabled={buying || loading || !current?.quote}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-btn bg-accent-primary py-3 text-sm font-bold text-white shadow-subtle transition-all hover:bg-accent-primary-hover hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
          >
            {buying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                {current?.quote ? (renew ? current.title : `Get ${current.title}`) : renew ? "Renew Project Lab" : "Get Project Lab"}
                {current?.quote && <span className="font-mono">· {rupees(current.quote.total)}/mo</span>}
              </>
            )}
          </button>
          <p className="mt-2.5 text-center text-2xs font-medium text-text-secondary">
            Each purchase gives you 30 days of access. Renew any time from Your Plan.
          </p>
        </div>
      </div>
    </section>
  );
}
