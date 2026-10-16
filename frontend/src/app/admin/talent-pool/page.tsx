"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SessionLoader } from "@/components/ui/SessionLoader";

/**
 * The Talent Pool became the Vault. Old bookmarks, and links in emails sent before the change,
 * land here and move straight on (this is a static export, so a client-side replace is the redirect).
 */
export default function TalentPoolMovedPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/vault");
  }, [router]);

  return <SessionLoader />;
}
