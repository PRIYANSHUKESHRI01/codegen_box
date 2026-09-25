"use client";

import { ShieldAlert } from "lucide-react";

/**
 * Shown in place of a whole page when the signed-in admin_internal account
 * hasn't been granted the permission that section requires (see
 * User::hasPermission on the backend — this is UX only, the real 403
 * already comes from the matching `permission:` route middleware).
 * Superadmin never sees this: userHasPermission() always passes for them.
 */
export function AccessDeniedNotice({ section }: { section: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-3">
        <div className="w-12 h-12 mx-auto rounded-full bg-status-warning/10 flex items-center justify-center">
          <ShieldAlert className="w-5 h-5 text-status-warning" />
        </div>
        <h2 className="text-base font-bold text-primary">Access not granted</h2>
        <p className="text-xs text-text-muted leading-relaxed">
          You haven&apos;t been granted access to {section} yet. Ask your superadmin to grant it from the Mellow Staff
          tab&apos;s &quot;Manage Access&quot;.
        </p>
      </div>
    </div>
  );
}
