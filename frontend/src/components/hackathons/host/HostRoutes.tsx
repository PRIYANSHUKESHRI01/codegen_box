"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { HackathonForm } from "@/components/hackathons/host/HackathonForm";
import { HackathonManage } from "@/components/hackathons/host/HackathonManage";
import { SessionLoader } from "@/components/ui/SessionLoader";
import type { HostScope } from "@/types/hackathon";

/*
 * The app is a static export, so there is no /hackathons/[id] route: the id travels as `?id=`.
 * useSearchParams() has to sit under Suspense or the export build fails — these wrappers do that
 * once, for both dashboards (Ops' /admin/hackathons and a hiring partner's /admin/company/hackathons).
 */

function idFrom(params: URLSearchParams): number | undefined {
  const raw = Number(params.get("id"));
  return Number.isInteger(raw) && raw > 0 ? raw : undefined;
}

function FormRouteInner({ scope }: { scope: HostScope }) {
  return <HackathonForm scope={scope} hackathonId={idFrom(useSearchParams())} />;
}

function ManageRouteInner({ scope }: { scope: HostScope }) {
  const id = idFrom(useSearchParams());

  if (!id) return <HackathonForm scope={scope} />; // no id: nothing to manage, so start a new one

  return <HackathonManage scope={scope} id={id} />;
}

export function HackathonFormRoute({ scope }: { scope: HostScope }) {
  return (
    <Suspense fallback={<SessionLoader />}>
      <FormRouteInner scope={scope} />
    </Suspense>
  );
}

export function HackathonManageRoute({ scope }: { scope: HostScope }) {
  return (
    <Suspense fallback={<SessionLoader />}>
      <ManageRouteInner scope={scope} />
    </Suspense>
  );
}
