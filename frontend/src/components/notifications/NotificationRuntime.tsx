"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { resetNotifications, startNotifications } from "@/lib/notifications";
import { NotificationToaster } from "./NotificationToaster";

/**
 * Mounted once at the root, inside AuthProvider: starts the notification poll for whoever is signed in — on whatever page
 * they are — and stops it (clearing everything in memory) on sign-out. It also owns the toast layer, so a notification
 * arrives the same way on the dashboard, in Settings or in the Hack Arena. Renders nothing until something arrives.
 */
export function NotificationRuntime() {
  const { user, status } = useAuth();
  const userId = status === "ready" && user ? user.id : null;

  useEffect(() => {
    if (userId === null) {
      resetNotifications();
      return;
    }
    return startNotifications(userId);
  }, [userId]);

  return userId === null ? null : <NotificationToaster />;
}
