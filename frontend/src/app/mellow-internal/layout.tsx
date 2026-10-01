import type { Metadata } from "next";

// Unlisted internal-staff login — never indexed, never linked from any
// public page. This route's existence is "security by not advertising it,"
// not a real access boundary (that's enforced server-side by AuthController
// same as every other login), but there's no reason to make it discoverable
// via search either. See robots.ts for the matching disallow rule.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function MellowInternalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
