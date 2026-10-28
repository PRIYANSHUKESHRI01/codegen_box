"use client";

import { InterviewSessionView } from "@/components/dashboard/interviews/InterviewSessionView";

/** A Vault AI Interview set, live: the same voice + proctoring engine as every AI interview, inside the Vault AI Interview section. */
export default function VaultInterviewSessionPage() {
  return <InterviewSessionView variant="vault" />;
}
