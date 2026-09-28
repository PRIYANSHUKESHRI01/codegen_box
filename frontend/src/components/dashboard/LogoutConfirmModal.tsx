"use client";

import { AnimatePresence, motion } from "framer-motion";
import { LogOut, X } from "lucide-react";

interface LogoutConfirmModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Sign-out confirmation — mirrors ForgotPasswordModal's backdrop/panel/animation pattern, the closest existing modal precedent in the app. */
export function LogoutConfirmModal({ open, onCancel, onConfirm }: LogoutConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
          {/* Blur is applied statically (never opacity-animated) so its own
              compositing layer is never mid-transition when the backdrop
              mounts — animating opacity on an element that also carries
              backdrop-filter is what causes Chromium to flash an unblurred/
              bright frame on entry. The tint below carries the actual fade. */}
          <div className="absolute inset-0 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/75"
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-sm rounded-panel bg-surface border border-border-strong shadow-card p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <h3 className="text-base font-bold text-primary flex items-center gap-2">
                <LogOut className="w-4 h-4 text-status-danger" />
                <span>Sign out of CodeGen Box?</span>
              </h3>
              <button onClick={onCancel} className="p-1 rounded text-text-muted hover:text-primary transition-colors" aria-label="Cancel">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              You&apos;ll be signed out of this device and need to log back in to continue. Any code you haven&apos;t
              submitted in the editor won&apos;t be saved.
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-btn text-xs font-bold bg-elevated text-primary border border-border-strong hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-btn text-xs font-bold bg-status-danger text-white hover:bg-status-danger/90 transition-colors shadow-subtle"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
