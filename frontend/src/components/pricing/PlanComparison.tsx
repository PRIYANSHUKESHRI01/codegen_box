"use client";

import { Check, Minus, X } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/utils";
import { usePublicPlans } from "@/lib/usePublicPlans";
import { ACADEMY_PLAN_CODE } from "@/lib/pricing";
import { PriceTag } from "@/components/pricing/PriceTag";
import type { PlanEntitlements, PublicPlan } from "@/types/pricing";

/** What one cell of the table says: a tick, a cross, or words. */
type Cell = { kind: "yes" } | { kind: "no" } | { kind: "text"; text: string; muted?: boolean };

interface Row {
  label: string;
  hint?: string;
  cell: (e: PlanEntitlements, plan: PublicPlan) => Cell;
}

const yes: Cell = { kind: "yes" };
const no: Cell = { kind: "no" };
const flag = (on: boolean): Cell => (on ? yes : no);

/**
 * Every row is derived from the plan's real entitlements (the same columns the
 * server enforces), so this table can't promise a plan something it doesn't
 * do — change a limit in the database and the table follows.
 */
const ROWS: Row[] = [
  {
    label: "Coding problems",
    cell: (e) =>
      e.practice_problems_per_day === null
        ? { kind: "text", text: "Unlimited" }
        : { kind: "text", text: `${e.practice_problems_per_day} per day` },
  },
  {
    label: "AI mock interviews",
    cell: (e) =>
      e.free_trial_uses !== null
        ? { kind: "text", text: `${e.free_trial_uses} free try, one time`, muted: true }
        : e.mock_interviews_per_day === null
          ? { kind: "text", text: "Unlimited" }
          : { kind: "text", text: `${e.mock_interviews_per_day} per day` },
  },
  {
    label: "Soft-skill Learning Centre",
    hint: "Speaking, Listening & Vocabulary labs",
    cell: (e) =>
      e.free_trial_uses !== null ? { kind: "text", text: `${e.free_trial_uses} free try of each lab`, muted: true } : { kind: "text", text: "Unlimited" },
  },
  { label: "Weekly rated contests", cell: () => yes },
  { label: "Placement drive access", cell: (e) => flag(e.drive_access) },
  {
    label: "Hack Arena",
    hint: "Hackathons with prizes & placement opportunities",
    cell: (e) => flag(e.hackathon_access),
  },
  {
    label: "Project Lab",
    hint: "Real full-stack projects in a browser VS Code",
    cell: (e) =>
      e.project_lab_access
        ? { kind: "text", text: `${e.workspace_hours_per_month ?? "Unlimited"} workspace-hours a month · ${e.active_projects ?? "any number of"} projects at once` }
        : no,
  },
  {
    label: "The Vault",
    hint: "Get hired directly by employers on Mellow Vault once your readiness reaches the bar",
    cell: (e) => flag(e.vault_access),
  },
  {
    label: "Access for",
    cell: (_e, plan) => (plan.term_unit ? { kind: "text", text: plan.term_unit === "year" ? "1 year" : plan.term_unit } : { kind: "text", text: "No expiry", muted: true }),
  },
  {
    label: "Mellow Academy programme",
    hint: "MERN, Laravel, Full Stack & Mobile App development",
    cell: (_e, plan) => flag(plan.code === ACADEMY_PLAN_CODE),
  },
  {
    label: "Assured placement",
    cell: (_e, plan) => flag(plan.code === ACADEMY_PLAN_CODE),
  },
];

function CellView({ cell }: { cell: Cell }) {
  if (cell.kind === "yes") {
    return (
      <span className="inline-flex items-center justify-center">
        <Check className="h-4 w-4 text-status-success" aria-hidden />
        <span className="sr-only">Included</span>
      </span>
    );
  }
  if (cell.kind === "no") {
    return (
      <span className="inline-flex items-center justify-center">
        <X className="h-4 w-4 text-text-muted/70" aria-hidden />
        <span className="sr-only">Not included</span>
      </span>
    );
  }
  return <span className={cn("text-sm", cell.muted ? "text-text-muted" : "font-semibold text-primary")}>{cell.text}</span>;
}

/** The side-by-side plan table under the cards: the quickest way to see exactly what moving up a plan unlocks. */
export function PlanComparison() {
  const { plans } = usePublicPlans();

  if (!plans || plans.length === 0) return null;

  return (
    <section aria-labelledby="compare-heading" className="w-full pb-10 sm:pb-14">
      <Container size="xl">
        <div className="mx-auto max-w-6xl">
          <h2 id="compare-heading" className="mb-5 text-center text-xl font-extrabold tracking-tight text-primary sm:text-2xl">
            Compare plans
          </h2>

          <div className="overflow-x-auto rounded-panel border border-border-subtle bg-surface shadow-subtle">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th scope="col" className="w-[34%] p-4 text-xs font-bold uppercase tracking-wide text-text-muted">
                    Features
                  </th>
                  {plans.map((plan: PublicPlan) => (
                    <th
                      key={plan.code}
                      scope="col"
                      className={cn("p-4 text-center align-top", plan.code === "expert" && "bg-accent-primary/5")}
                    >
                      <div className="text-sm font-extrabold text-primary">{plan.name}</div>
                      <div className="mt-2 flex justify-center">
                        <PriceTag plan={plan} size="compact" className="text-center [&>div]:justify-center" />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.label} className="border-b border-border-subtle last:border-b-0">
                    <th scope="row" className="p-4 align-top">
                      <div className="text-sm font-semibold text-primary">{row.label}</div>
                      {row.hint && <div className="mt-0.5 text-xs font-normal text-text-muted">{row.hint}</div>}
                    </th>
                    {plans.map((plan) => (
                      <td
                        key={plan.code}
                        className={cn("p-4 text-center align-middle", plan.code === "expert" && "bg-accent-primary/5")}
                      >
                        <CellView cell={row.cell(plan.entitlements, plan)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-text-muted">
            <Minus className="h-3 w-3" aria-hidden />
            Prices are in Indian rupees, billed once a year. The discount shown is applied automatically at checkout. Grandmaster is priced by our team.
          </p>
        </div>
      </Container>
    </section>
  );
}
