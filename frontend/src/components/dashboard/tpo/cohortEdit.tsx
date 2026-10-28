"use client";

import { useState } from "react";
import { CalendarRange, Info, LayoutGrid, Pencil, UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { HpButton, HpCard, HpSectionHeader, hpInput, hpLabel } from "@/components/portal/kit";
import { HpCallout, HpFormError } from "@/components/portal/pipeline-kit";
import { HpOverlayPortal } from "@/components/portal/cohortKit";
import { YearPicker } from "@/components/dashboard/tpo/YearPicker";
import { SELECTABLE_YEARS, yearName } from "@/lib/studyYear";
import { cn } from "@/lib/utils";
import type { CohortStudent } from "@/types/cohort";

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError || err instanceof Error ? err.message : fallback);

/** Datalist of the sections already in use, so a TPO picks "B" instead of typing "b " and making a second section. */
function SectionInput({ id, value, onChange, sections }: { id: string; value: string; onChange: (value: string) => void; sections: string[] }) {
  return (
    <>
      <input id={id} list={`${id}-options`} value={value} onChange={(e) => onChange(e.target.value)} maxLength={20} placeholder="e.g. A" className={cn(hpInput)} />
      <datalist id={`${id}-options`}>
        {sections.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}

/**
 * Corrects one student's year of study and/or section. Saves straight to the server and hands back the refreshed roster row, so the
 * roster shows it at once - and the student's own screens (their Vault AI Interview countdown, a coordinator's section) follow.
 */
export function EditStudentModal({
  student,
  sections,
  onClose,
  onSaved,
}: {
  student: CohortStudent;
  sections: string[];
  onClose: () => void;
  onSaved: (student: CohortStudent) => void;
}) {
  const currentYear = student.study_year !== null && student.study_year !== undefined && SELECTABLE_YEARS.some((y) => y === student.study_year) ? String(student.study_year) : "";
  const [year, setYear] = useState(currentYear);
  const [section, setSection] = useState(student.section ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yearChanged = year !== currentYear;
  const sectionChanged = section.trim() !== (student.section ?? "");
  const passedOut = (student.study_year ?? 0) > SELECTABLE_YEARS[SELECTABLE_YEARS.length - 1];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yearChanged && !sectionChanged) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.patch<{ student: CohortStudent }>(`/tpo/students/${student.id}`, {
        ...(yearChanged ? { year: year === "" ? null : Number(year) } : {}),
        ...(sectionChanged ? { section: section.trim() === "" ? null : section.trim() } : {}),
      });
      onSaved(res.student);
    } catch (err) {
      setError(errorText(err, "Couldn't save the change. Please try again."));
      setSaving(false);
    }
  };

  return (
    <HpOverlayPortal>
      <Modal
        onClose={() => !saving && onClose()}
        title="Edit year & section"
        subtitle={student.name}
        icon={Pencil}
        size="md"
        variant="premium"
        footer={
          <>
            <HpButton type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </HpButton>
            <HpButton type="submit" form="edit-student-form" disabled={saving || (!yearChanged && !sectionChanged)} isLoading={saving}>
              Save changes
            </HpButton>
          </>
        }
      >
        <form id="edit-student-form" onSubmit={submit} className="space-y-5">
          <YearPicker
            value={year}
            onChange={setYear}
            label="Year of study"
            blankLabel="Not set"
            hint={passedOut ? "This student is past their final year. Choose a year to bring them back." : undefined}
          />

          <div>
            <label htmlFor="edit-student-section" className={hpLabel}>
              Section
            </label>
            <SectionInput id="edit-student-section" value={section} onChange={setSection} sections={sections} />
            <p className="mt-1 text-2xs text-text-muted">Leave it empty to take them out of their section.</p>
          </div>

          {error && <HpFormError>{error}</HpFormError>}

          <HpCallout icon={Info} tone="indigo">
            It takes effect immediately: the roster updates now, and {student.name.split(" ")[0]}&apos;s own screens — including when their Vault AI
            Interview unlocks — follow within a few seconds.
          </HpCallout>
        </form>
      </Modal>
    </HpOverlayPortal>
  );
}

/** Moves the selected students to a section (or takes them out of theirs). */
export function SetSectionModal({
  count,
  sections,
  onClose,
  onConfirm,
}: {
  count: number;
  sections: string[];
  onClose: () => void;
  onConfirm: (section: string | null) => Promise<void>;
}) {
  const [section, setSection] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = section.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onConfirm(trimmed === "" ? null : trimmed);
    } catch (err) {
      setError(errorText(err, "Couldn't change the section. Please try again."));
      setSaving(false);
    }
  };

  return (
    <HpOverlayPortal>
      <Modal
        onClose={() => !saving && onClose()}
        title="Set section"
        subtitle={`${count} ${count === 1 ? "student" : "students"} selected`}
        icon={LayoutGrid}
        size="md"
        variant="premium"
        footer={
          <>
            <HpButton type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </HpButton>
            <HpButton type="submit" form="set-section-form" disabled={saving} isLoading={saving}>
              {trimmed ? `Move to section ${trimmed}` : "Remove from their section"}
            </HpButton>
          </>
        }
      >
        <form id="set-section-form" onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="set-section-input" className={hpLabel}>
              Which section?
            </label>
            <SectionInput id="set-section-input" value={section} onChange={setSection} sections={sections} />
            <p className="mt-1 text-2xs text-text-muted">Leave it empty to take the selected students out of their section.</p>
          </div>
          {error && <HpFormError>{error}</HpFormError>}
        </form>
      </Modal>
    </HpOverlayPortal>
  );
}

/**
 * Shown while the TPO is looking at the students who have no year: put them all in one with a click. (Or tick a few in the roster
 * and use Set year; or open one student and edit them.) The caller confirms and does the saving.
 */
export function UnfiledStudentsPanel({ count, onAssign }: { count: number; onAssign: (year: number) => void }) {
  return (
    <HpCard spotlight={false} className="border-amber-500/25 p-4 sm:p-5">
      <HpSectionHeader
        title={`Add ${count === 1 ? "this student" : `these ${count} students`} to a year`}
        subtitle="They stay locked out of the Vault AI Interview until they have one. Move everyone shown at once, or tick some below and use Set year."
        icon={UserPlus}
        tone="amber"
      />
      <div className="mt-4 flex flex-wrap gap-2">
        {SELECTABLE_YEARS.map((y) => (
          <HpButton key={y} variant="secondary" size="sm" onClick={() => onAssign(y)} leftIcon={<CalendarRange className="h-3.5 w-3.5" />}>
            {count === 1 ? `Move to ${yearName(y)}` : `Move all ${count} to ${yearName(y)}`}
          </HpButton>
        ))}
      </div>
    </HpCard>
  );
}
