"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Brain, Library, Plus, Rocket } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { HpButton, hpInput, hpLabel } from "@/components/portal/kit";
import { ScNotice } from "@/components/portal/screeningKit";
import type { QuestionSetItem } from "@/types/softSkill";
import { QuestionSetPicker } from "./QuestionSetPicker";
import { AudienceChip, audienceForRequest, BranchAudienceField, EVERYONE, type BranchAudience } from "@/components/branches/BranchAudienceField";

export interface SoftSkillCreatedResult {
  title: string;
  published: boolean;
  /** "Set 12" when the test was built from a library set, otherwise null. */
  setLabel: string | null;
}

interface CreateSoftSkillAssessmentModalProps {
  basePath: string;
  /** The caller's own question-set library endpoint, e.g. "/tpo/soft-skill-question-sets". */
  setsPath: string;
  onClose: () => void;
  onCreated: (result: SoftSkillCreatedResult) => void;
  /** "premium" is the hiring-portal look. Default leaves Ops/TPO markup exactly as before. */
  variant?: "default" | "premium";
  /** Offer "Who is this for?" (a branch audience). Mellow and TPO tests can be aimed at branches; a hiring partner's cannot. */
  allowAudience?: boolean;
}

/** One button for both looks, so the two variants share the same wiring. A real component (not defined inside the modal), so it keeps its identity — and its focus — across renders. */
function Btn({
  premium,
  children,
  onClick,
  type = "button",
  form,
  kind = "primary",
  disabled,
  busy,
  icon,
  title,
}: {
  premium: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  form?: string;
  kind?: "primary" | "secondary";
  disabled?: boolean;
  busy?: boolean;
  icon?: React.ReactNode;
  title?: string;
}) {
  return premium ? (
    <HpButton type={type} form={form} variant={kind} onClick={onClick} disabled={disabled} isLoading={busy} leftIcon={icon} title={title}>
      {children}
    </HpButton>
  ) : (
    <button
      type={type}
      form={form}
      onClick={onClick}
      disabled={disabled || busy}
      title={title}
      className={cn(
        "flex items-center gap-1.5 px-4 py-2 rounded-control font-bold transition-colors disabled:opacity-60",
        kind === "primary" ? "bg-accent-primary hover:bg-accent-primary-hover text-white" : "border border-border-subtle text-text-muted hover:text-primary"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/**
 * Shared across Mellow Ops/TPO/Company — schedules a new Soft Skills test in two steps:
 *   1. details (title, timing, passing bar);
 *   2. the questions — pick one of AptRun's ready-made question sets (sets this organisation has already used
 *      are marked, so the next test can start from a fresh one), then publish straight away or keep it as a draft.
 * The set is optional: "create without a set" keeps the old route of attaching bank questions afterwards.
 * The test, its questions and its published state are created by ONE request, so a refused set never leaves a
 * half-built draft behind.
 */
export function CreateSoftSkillAssessmentModal({ basePath, setsPath, onClose, onCreated, variant = "default", allowAudience = false }: CreateSoftSkillAssessmentModalProps) {
  const premium = variant === "premium";
  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [passPercentage, setPassPercentage] = useState(60);
  const [audience, setAudience] = useState<BranchAudience>(EVERYONE);
  const [chosen, setChosen] = useState<QuestionSetItem | null>(null);
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const detailsValid = title.trim().length > 0 && durationMinutes >= 5 && durationMinutes <= 240 && passPercentage >= 1 && passPercentage <= 100;

  const create = async (publish: boolean) => {
    setSaving(publish ? "publish" : "draft");
    setError(null);
    try {
      await api.post(basePath, {
        title: title.trim(),
        description: description.trim() || undefined,
        duration_minutes: durationMinutes,
        pass_percentage: passPercentage,
        ...(allowAudience ? { branch_audience: audienceForRequest(audience) } : {}),
        question_set_id: chosen?.id,
        publish: chosen ? publish : undefined,
      });
      onCreated({ title: title.trim(), published: publish && !!chosen, setLabel: chosen?.label ?? null });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create the test.");
    } finally {
      setSaving(null);
    }
  };

  const goNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (detailsValid) {
      setError(null);
      setStep(2);
    }
  };

  const input = premium ? hpInput : "w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary";
  const label = premium ? hpLabel : "block font-semibold text-text-secondary mb-1";

  const footer =
    step === 1 ? (
      <>
        <Btn premium={premium} kind="secondary" onClick={onClose}>
          Cancel
        </Btn>
        <Btn premium={premium} kind="secondary" onClick={() => create(false)} disabled={!detailsValid || saving !== null} busy={saving === "draft"} icon={premium ? <Plus className="h-4 w-4" /> : undefined} title="Create an empty draft — add questions afterwards">
          Create empty draft
        </Btn>
        <Btn premium={premium} type="submit" form="create-soft-skill-form" disabled={!detailsValid} icon={<ArrowRight className="h-4 w-4" />}>
          Next: question set
        </Btn>
      </>
    ) : (
      <>
        <Btn premium={premium} kind="secondary" onClick={() => setStep(1)} disabled={saving !== null} icon={<ArrowLeft className="h-4 w-4" />}>
          Back
        </Btn>
        <Btn premium={premium} kind="secondary" onClick={() => create(false)} busy={saving === "draft"} disabled={saving !== null} title={chosen ? undefined : "Questions can be added afterwards from Manage Questions"}>
          {chosen ? `Save as draft with ${chosen.label}` : "Create without a set"}
        </Btn>
        <Btn premium={premium} onClick={() => create(true)} busy={saving === "publish"} disabled={!chosen || saving !== null} icon={<Rocket className="h-4 w-4" />} title={chosen ? undefined : "Choose a question set to publish with"}>
          {chosen ? `Add ${chosen.label} & publish` : "Publish"}
        </Btn>
      </>
    );

  return (
    <Modal
      variant={premium ? "premium" : "default"}
      onClose={onClose}
      title="New Soft Skills Test"
      subtitle={step === 1 ? "Step 1 of 2 · Details" : "Step 2 of 2 · Question set"}
      icon={step === 1 ? Brain : Library}
      size="3xl"
      footer={footer}
    >
      {step === 1 ? (
        <>
          {premium ? (
            <ScNotice tone="violet" className="mb-5">
              Next you&apos;ll pick one of AptRun&apos;s ready-made question sets and can publish straight away.
            </ScNotice>
          ) : (
            <p className="mb-3 text-2xs text-text-muted">Next you&apos;ll pick one of AptRun&apos;s ready-made question sets and can publish straight away.</p>
          )}

          <form id="create-soft-skill-form" onSubmit={goNext} className={cn(premium ? "space-y-4" : "space-y-3")}>
            <div>
              <label htmlFor="css-title" className={label}>
                Title *
              </label>
              <input id="css-title" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} placeholder="e.g. Campus Drive — Round 1 Aptitude" className={input} />
            </div>
            <div>
              <label htmlFor="css-desc" className={label}>
                Description
              </label>
              <textarea id="css-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={cn(input, premium && "resize-y")} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="css-duration" className={label}>
                  Duration (minutes)
                </label>
                <input id="css-duration" type="number" min={5} max={240} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className={cn(input, "tabular")} />
              </div>
              <div>
                <label htmlFor="css-pass" className={label}>
                  Pass percentage
                </label>
                <input id="css-pass" type="number" min={1} max={100} value={passPercentage} onChange={(e) => setPassPercentage(Number(e.target.value))} className={cn(input, "tabular")} />
              </div>
            </div>
            {allowAudience && <BranchAudienceField value={audience} onChange={setAudience} />}
            {error && (premium ? <ScNotice tone="rose">{error}</ScNotice> : <p className="text-2xs text-status-danger">{error}</p>)}
          </form>
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-text-muted">
            Choose the question set for <strong className="text-primary">{title.trim()}</strong>. Each set is a ready-made paper of 25 questions; ones you have already used are marked so you can start from a fresh one.
          </p>
          <QuestionSetPicker catalogueUrl={setsPath} selected={chosen} onSelect={setChosen} />
          {error && (premium ? <ScNotice tone="rose">{error}</ScNotice> : <p role="alert" className="text-2xs text-status-danger">{error}</p>)}
        </div>
      )}
    </Modal>
  );
}
