"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { InterviewSessionView } from "@/components/dashboard/interviews/InterviewSessionView";
import { InterviewBoot } from "@/components/dashboard/interviews/room/InterviewBoot";
import { api } from "@/lib/api";
import type { StudentInterviewSummary } from "@/types/interview";

/**
 * The Mock AI Interview's live session. A Vault AI Interview set is sat in the Vault AI Interview's own pages, so one that arrives
 * here (an old link, a bookmark) is handed over before anything starts - the session itself is the same engine either way.
 */
function MockSession() {
  const router = useRouter();
  const params = useSearchParams();
  const slug = params.get("slug") ?? "";
  const assessmentSlug = params.get("assessment") ?? "";
  // In Launchpad / Campus Assessment flows (`?assessment=`), mount InterviewSessionView immediately so kept
  // proctoring streams & fullscreen are claimed on frame 0 without waiting for an extra gating HTTP check.
  const [checked, setChecked] = useState(Boolean(assessmentSlug));

  useEffect(() => {
    let alive = true;
    api
      .get<StudentInterviewSummary>(`/interviews/${encodeURIComponent(slug)}`)
      .then((summary) => {
        if (!alive) return;
        if (summary.is_qualification) {
          const suffix = assessmentSlug ? `&assessment=${encodeURIComponent(assessmentSlug)}` : "";
          router.replace(`/dashboard/vault-interviews/session?slug=${encodeURIComponent(slug)}${suffix}`);
        } else {
          setChecked(true);
        }
      })
      // If the check itself fails, the session page below reports the real problem in its own words.
      .catch(() => alive && setChecked(true));

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return checked ? <InterviewSessionView variant="mock" /> : <InterviewBoot />;
}

export default function InterviewSessionPage() {
  return (
    <Suspense fallback={<InterviewBoot />}>
      <MockSession />
    </Suspense>
  );
}
