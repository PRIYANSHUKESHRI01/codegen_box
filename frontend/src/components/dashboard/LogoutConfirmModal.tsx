"use client";

import { LogOut } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

interface LogoutConfirmModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Sign-out confirmation — a small confirm dialog built on the shared Modal shell. */
export function LogoutConfirmModal({ open, onCancel, onConfirm }: LogoutConfirmModalProps) {
  if (!open) return null;

  return (
    <Modal
      onClose={onCancel}
      title="Sign out of CodeGen Box?"
      icon={LogOut}
      iconClassName="bg-status-danger/10 text-status-danger"
      size="sm"
      footer={
        <>
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
        </>
      }
    >
      <p className="text-xs text-text-secondary leading-relaxed">
        You&apos;ll be signed out of this device and need to log back in to continue. Any code you haven&apos;t
        submitted in the editor won&apos;t be saved.
      </p>
    </Modal>
  );
}
