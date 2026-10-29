"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AccessDeniedNotice } from "@/components/admin/AccessDeniedNotice";
import { MockQuestionBank } from "@/components/admin/mockInterviews/MockQuestionBank";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { userHasPermission } from "@/lib/auth";
import { useToast } from "@/lib/toast";

/**
 * The Mock AI Interview's question bank (students practise by domain -> tech stack -> round). Empty until staff fill it; every stack
 * shows as "Coming soon" to students until it has questions. See MockQuestionBank.
 */
export default function MockInterviewQuestionsPage() {
  const { status, user } = useAuthGuard(["admin_internal", "superadmin"]);
  const showToast = useToast();

  if (status !== "ready") return <SessionLoader />;

  return (
    <DashboardShell role="admin_internal" title="AI Interviews" subtitle="Mock interview questions — what students practise on, by domain and tech stack.">
      {userHasPermission(user, "interviews") ? <MockQuestionBank onToast={showToast} /> : <AccessDeniedNotice section="AI Interviews" />}
    </DashboardShell>
  );
}
