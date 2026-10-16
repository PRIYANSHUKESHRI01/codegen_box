"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * The Talent Pool became the Vault. Search results, shared links and bookmarks to the old
 * address move straight on (this is a static export, so a client-side replace is the redirect).
 */
export default function TalentPoolMovedPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/features/vault");
  }, [router]);

  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center text-sm text-text-secondary">
      The Talent Pool is now <a href="/features/vault" className="font-bold text-accent-primary underline">the Vault</a>.
    </main>
  );
}
