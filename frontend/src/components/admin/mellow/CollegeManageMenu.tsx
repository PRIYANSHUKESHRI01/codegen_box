"use client";

import { CreditCard, Layers, Pencil, KeyRound, ShieldCheck, ShieldOff, Trash2, Upload, UserCog, Users, Settings2 } from "lucide-react";
import { ActionMenu } from "@/components/ui/ActionMenu";
import type { College } from "./partnerColleges";

export interface CollegeCardActions {
  onEditDetails?: () => void;
  onSetTpoPassword?: () => void;
  onChangePlan: () => void;
  onAdjustSeats: () => void;
  onImportStudents: () => void;
  onDepartments: () => void;
  onCoordinators: () => void;
  onToggleTpoBlock: () => void;
  onDelete?: () => void;
}

/**
 * Everything staff can do to one college, in one menu — the same list in the table row and on the card, so the two views can
 * never offer different things. Superadmin-only items (edit, TPO password, delete) are simply absent when their callback is.
 */
export function CollegeManageMenu({ college, actions, className }: { college: College; actions: CollegeCardActions; className?: string }) {
  const hasTpo = college.tpoUserId !== undefined;

  return (
    <ActionMenu
      label="Manage"
      icon={Settings2}
      ariaLabel={`Manage ${college.name}`}
      className={className}
      groups={[
        [
          actions.onEditDetails && { key: "edit", label: "Edit details", icon: Pencil, onSelect: actions.onEditDetails },
          actions.onSetTpoPassword && hasTpo && { key: "tpo-password", label: "TPO password", icon: KeyRound, onSelect: actions.onSetTpoPassword },
        ],
        [
          { key: "plan", label: "Renew / Change Plan", icon: CreditCard, onSelect: actions.onChangePlan },
          { key: "seats", label: "Adjust Seats", icon: Users, onSelect: actions.onAdjustSeats },
        ],
        [
          { key: "import", label: "Import Students", icon: Upload, onSelect: actions.onImportStudents },
          { key: "departments", label: "Departments", icon: Layers, badge: college.departments.length, onSelect: actions.onDepartments },
          { key: "coordinators", label: "Coordinators", icon: UserCog, onSelect: actions.onCoordinators },
        ],
        [
          hasTpo && {
            key: "block",
            label: college.tpoBlocked ? "Unblock TPO" : "Block TPO",
            icon: college.tpoBlocked ? ShieldCheck : ShieldOff,
            tone: college.tpoBlocked ? "success" : "default",
            onSelect: actions.onToggleTpoBlock,
          },
          actions.onDelete && { key: "delete", label: "Delete", icon: Trash2, tone: "danger", onSelect: actions.onDelete },
        ],
      ]}
    />
  );
}
