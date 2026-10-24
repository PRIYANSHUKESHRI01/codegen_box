"use client";

import { CoreStudentShell } from "@/components/core/CoreStudentShell";
import { CoreHomeBody } from "@/components/core/CoreHomeBody";
import { useDomainPrepCopy } from "@/lib/departments";

/** Domain Prep home (Core Prep, Management Prep, Commerce Prep, Subject Prep): where a student stands, and the next useful thing to do. */
export default function CorePrepHomePage() {
  const copy = useDomainPrepCopy();

  return (
    <CoreStudentShell title={copy.label} subtitle={copy.subtitle}>
      {(home) => <CoreHomeBody home={home} />}
    </CoreStudentShell>
  );
}
