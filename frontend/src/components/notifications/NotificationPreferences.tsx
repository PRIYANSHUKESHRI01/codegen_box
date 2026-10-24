"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
import { ApiError } from "@/lib/api";
import { fetchPreferences, savePreferences, type NotificationCategory, type NotificationPreference } from "@/lib/notifications";
import { CATEGORY_META } from "./notificationUi";

/**
 * Settings → Notifications: one switch per kind of notification, saved the moment it is flipped (and put back if the
 * server refuses). Plan/payment and account/security notifications are about the person's own access and money, so
 * those show as always on rather than as a switch that would let them miss "your plan ended".
 */
export function NotificationPreferences({ onToast }: { onToast: (message: string) => void }) {
  const [prefs, setPrefs] = useState<NotificationPreference[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState<NotificationCategory | null>(null);

  useEffect(() => {
    let live = true;
    fetchPreferences()
      .then((p) => live && setPrefs(p))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const flip = async (pref: NotificationPreference, enabled: boolean) => {
    if (!prefs || pref.mandatory) return;

    setPrefs(prefs.map((p) => (p.category === pref.category ? { ...p, enabled } : p)));
    setSaving(pref.category);
    try {
      setPrefs(await savePreferences({ [pref.category]: enabled }));
      onToast(`${pref.label} notifications ${enabled ? "on" : "off"}.`);
    } catch (err) {
      setPrefs(prefs);
      onToast(err instanceof ApiError ? err.message : "Couldn't save that. Try again.");
    } finally {
      setSaving(null);
    }
  };

  if (failed) {
    return <p className="py-6 text-center text-xs text-text-muted">Couldn&apos;t load your notification settings. Refresh and try again.</p>;
  }

  if (!prefs) {
    return (
      <ul aria-label="Loading notification settings" className="divide-y divide-border-subtle">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="flex animate-pulse items-center justify-between gap-4 py-4">
            <span className="space-y-2">
              <span className="block h-3 w-40 rounded bg-elevated" />
              <span className="block h-2.5 w-72 max-w-full rounded bg-elevated" />
            </span>
            <span className="h-6 w-11 rounded-full bg-elevated" />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="divide-y divide-border-subtle">
      {prefs.map((pref) => {
        const Icon = CATEGORY_META[pref.category]?.icon;
        return (
          <li key={pref.category} className="flex items-center justify-between gap-4 py-4">
            <div className="flex min-w-0 items-start gap-3">
              {Icon && (
                <span aria-hidden="true" className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-elevated text-text-secondary">
                  <Icon className="h-4 w-4" />
                </span>
              )}
              <div className="min-w-0">
                <div className="text-xs font-bold text-primary">{pref.label}</div>
                <p className="mt-0.5 text-2xs leading-relaxed text-text-muted">{pref.description}</p>
              </div>
            </div>
            {pref.mandatory ? (
              <span title="These are about your own access and money, so they are always on." className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border-subtle bg-elevated px-2.5 py-1 text-3xs font-bold text-text-muted">
                <Lock className="h-3 w-3" /> Always on
              </span>
            ) : (
              <Toggle checked={pref.enabled} label={pref.label} disabled={saving === pref.category} onChange={(v) => void flip(pref, v)} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
