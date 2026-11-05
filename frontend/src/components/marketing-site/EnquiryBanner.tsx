"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlarmClock, ArrowRight, Inbox } from "lucide-react";
import { api } from "@/lib/api";
import type { ContactRequestsResponse } from "@/types/contactRequest";

/**
 * A strip at the top of the marketing home when "Talk to Our Team" enquiries are waiting: how many have had no first contact, how many of
 * those are overdue, and how many sit in the unassigned queue. Drawn only when there is something to do; a failed read draws nothing.
 */
export function EnquiryBanner({ isSuperadmin }: { isSuperadmin: boolean }) {
  const [kpis, setKpis] = useState<ContactRequestsResponse["kpis"] | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .get<ContactRequestsResponse>(`/marketing/contact-requests?scope=${isSuperadmin ? "all" : "mine"}&status=new`)
      .then((res) => alive && setKpis(res.kpis))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [isSuperadmin]);

  if (!kpis || (kpis.awaiting_first_contact === 0 && kpis.unassigned === 0)) return null;

  return (
    <Link
      href="/marketing/inquiries"
      className="group flex flex-col gap-2 rounded-panel border border-accent-primary/30 bg-accent-primary/[0.06] p-4 transition-colors hover:border-accent-primary/60 sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-primary/15 text-accent-primary">
          <Inbox className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <span>
          <span className="block text-sm font-bold text-primary">
            {kpis.awaiting_first_contact > 0
              ? `${kpis.awaiting_first_contact} ${kpis.awaiting_first_contact === 1 ? "enquiry is" : "enquiries are"} waiting for a first reply`
              : `${kpis.unassigned} ${kpis.unassigned === 1 ? "enquiry is" : "enquiries are"} waiting for someone to take ${kpis.unassigned === 1 ? "it" : "them"}`}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-medium text-text-secondary">
            {kpis.overdue > 0 && (
              <span className="inline-flex items-center gap-1 font-bold text-status-danger">
                <AlarmClock className="h-3 w-3" aria-hidden="true" /> {kpis.overdue} overdue
              </span>
            )}
            {kpis.unassigned > 0 && kpis.awaiting_first_contact > 0 && <span>{kpis.unassigned} in the unassigned queue</span>}
          </span>
        </span>
      </span>
      <span className="inline-flex items-center gap-1 text-xs font-bold text-accent-primary">
        Open the enquiry desk <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}
