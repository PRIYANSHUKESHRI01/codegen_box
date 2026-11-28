"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Code2,
  Download,
  Edit3,
  Loader2,
  Lock,
  Mic,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { LaunchpadProgramsSection } from "./LaunchpadProgramsSection";
import type {
  CollegeAssessmentAssignmentRow,
  CollegeAssessmentBuilderOptions,
  CollegeAssessmentSummaryItem,
  TargetScopeConfig,
  TargetStudentOption,
} from "@/types/collegeAssessment";

interface Props {
  triggerToast: (msg: string, tone?: "success" | "error") => void;
}

interface CustomInterviewQuestionDraft {
  text: string;
  category: string;
  difficulty: string;
  duration_seconds: number;
}

interface FormState {
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  enforce_sequence: boolean;
  passing_score_percent: number;
  publish_now: boolean;

  include_soft_skills: boolean;
  soft_skill_weight: number;
  soft_skill_set_ids: number[];
  soft_skill_question_ids: number[];
  soft_skill_duration_minutes: number;
  soft_skill_pass_percentage: number;

  include_coding: boolean;
  coding_weight: number;
  coding_problems: { problem_id: number; points: number }[];

  include_interview: boolean;
  interview_weight: number;
  curated_set_ids: string[];
  mock_round_ids: string[];
  question_bank_ids: number[];
  custom_questions: CustomInterviewQuestionDraft[];

  college_ids: number[];
  department_codes: string[];
  branch_codes: string[];
  student_mode: "all_matching" | "selected";
  user_ids: number[];
}

const DEFAULT_FORM: FormState = {
  title: "",
  description: "",
  starts_at: "",
  ends_at: "",
  enforce_sequence: true,
  passing_score_percent: 60,
  publish_now: true,

  include_soft_skills: true,
  soft_skill_weight: 30,
  soft_skill_set_ids: [],
  soft_skill_question_ids: [],
  soft_skill_duration_minutes: 30,
  soft_skill_pass_percentage: 60,

  include_coding: true,
  coding_weight: 40,
  coding_problems: [],

  include_interview: true,
  interview_weight: 30,
  curated_set_ids: [],
  mock_round_ids: [],
  question_bank_ids: [],
  custom_questions: [],

  college_ids: [],
  department_codes: [],
  branch_codes: [],
  student_mode: "all_matching",
  user_ids: [],
};

function toLocalDatetimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CollegeAssessmentsPanel({ triggerToast }: Props) {
  const [assessments, setAssessments] = useState<CollegeAssessmentSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<CollegeAssessmentBuilderOptions | null>(null);

  // Builder Modal state
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  // Search & stream filters inside builder pickers
  type TrackPreset = "tech" | "non_tech" | "non_tech_screening" | "core_engg";
  type InterviewStreamFilter = "all" | "non_tech_hr" | "core_engg" | "software";
  const [trackPreset, setTrackPreset] = useState<TrackPreset>("tech");
  const [softQSearch, setSoftQSearch] = useState("");
  const [softQCategory, setSoftQCategory] = useState<string>("all");
  const [problemSearch, setProblemSearch] = useState("");
  const [interviewSearch, setInterviewSearch] = useState("");
  const [interviewStream, setInterviewStream] = useState<InterviewStreamFilter>("all");
  const [interviewCategory, setInterviewCategory] = useState<string>("all");
  const [newCustomCategory, setNewCustomCategory] = useState<string>("hr");
  const [studentSearch, setStudentSearch] = useState("");
  const [matchingStudents, setMatchingStudents] = useState<TargetStudentOption[]>([]);
  const [matchingTotal, setMatchingTotal] = useState(0);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [newCustomQuestion, setNewCustomQuestion] = useState("");

  // Results & CSV drawer state
  const [resultsSlug, setResultsSlug] = useState<string | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsAssessment, setResultsAssessment] = useState<CollegeAssessmentSummaryItem | null>(null);
  const [resultsSummary, setResultsSummary] = useState<{
    assigned: number;
    in_progress: number;
    completed: number;
    avg_overall_score: number | null;
    pass_count: number;
  } | null>(null);
  const [assignments, setAssignments] = useState<CollegeAssessmentAssignmentRow[]>([]);
  const [filterCollegeId, setFilterCollegeId] = useState<string>("");
  const [filterBranchCode, setFilterBranchCode] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterResult, setFilterResult] = useState<string>("");
  const [filterMinScore, setFilterMinScore] = useState<string>("");
  const [filterSort, setFilterSort] = useState<string>("overall_desc");
  const [filterSearch, setFilterSearch] = useState<string>("");
  const [exportingCsv, setExportingCsv] = useState(false);

  const loadAssessments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<{ assessments: CollegeAssessmentSummaryItem[] }>("/superadmin/college-assessments");
      setAssessments(res.assessments ?? []);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to load college assessments.", "error");
    } finally {
      setLoading(false);
    }
  }, [triggerToast]);

  const ensureBuilderOptions = useCallback(async () => {
    if (options) return options;
    try {
      const res = await api.get<CollegeAssessmentBuilderOptions>("/superadmin/college-assessments/builder-options");
      setOptions(res);
      return res;
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to load question pools & colleges.", "error");
      return null;
    }
  }, [options, triggerToast]);

  useEffect(() => {
    loadAssessments();
  }, [loadAssessments]);

  // Live target student preview whenever college/dept/branch/search changes inside open builder
  useEffect(() => {
    if (!builderOpen) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoadingStudents(true);
      try {
        const params = new URLSearchParams();
        form.college_ids.forEach((id) => params.append("college_ids[]", String(id)));
        form.department_codes.forEach((d) => params.append("department_codes[]", d));
        form.branch_codes.forEach((b) => params.append("branch_codes[]", b));
        if (studentSearch.trim()) params.set("q", studentSearch.trim());
        params.set("limit", "300");

        const res = await api.get<{ students: TargetStudentOption[]; total: number }>(
          `/superadmin/college-assessments/students?${params.toString()}`
        );
        if (!cancelled) {
          setMatchingStudents(res.students ?? []);
          setMatchingTotal(res.total ?? 0);
        }
      } catch {
        if (!cancelled) {
          setMatchingStudents([]);
          setMatchingTotal(0);
        }
      } finally {
        if (!cancelled) setLoadingStudents(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [builderOpen, form.college_ids, form.department_codes, form.branch_codes, studentSearch]);

  const openCreateModal = async () => {
    await ensureBuilderOptions();
    setEditingSlug(null);
    setTrackPreset("tech");
    setInterviewStream("all");
    setInterviewCategory("all");
    setSoftQCategory("all");
    setForm(DEFAULT_FORM);
    setBuilderOpen(true);
  };

  const applyPreset = (preset: TrackPreset) => {
    setTrackPreset(preset);
    if (preset === "tech") {
      setInterviewStream("software");
      setInterviewCategory("all");
      setNewCustomCategory("technical");
      setForm((f) => ({
        ...f,
        include_soft_skills: true,
        soft_skill_weight: 30,
        include_coding: true,
        coding_weight: 40,
        include_interview: true,
        interview_weight: 30,
        enforce_sequence: true,
      }));
    } else if (preset === "non_tech") {
      setInterviewStream("non_tech_hr");
      setInterviewCategory("all");
      setNewCustomCategory("hr");
      setForm((f) => ({
        ...f,
        include_soft_skills: true,
        soft_skill_weight: 50,
        include_coding: false,
        coding_weight: 0,
        coding_problems: [],
        include_interview: true,
        interview_weight: 50,
        enforce_sequence: true,
      }));
    } else if (preset === "non_tech_screening") {
      setInterviewStream("non_tech_hr");
      setForm((f) => ({
        ...f,
        include_soft_skills: true,
        soft_skill_weight: 100,
        include_coding: false,
        coding_weight: 0,
        coding_problems: [],
        include_interview: false,
        interview_weight: 0,
        curated_set_ids: [],
        mock_round_ids: [],
        question_bank_ids: [],
        custom_questions: [],
        enforce_sequence: false,
      }));
    } else if (preset === "core_engg") {
      setInterviewStream("core_engg");
      setInterviewCategory("all");
      setNewCustomCategory("technical");
      setForm((f) => ({
        ...f,
        include_soft_skills: true,
        soft_skill_weight: 40,
        include_coding: false,
        coding_weight: 0,
        coding_problems: [],
        include_interview: true,
        interview_weight: 60,
        enforce_sequence: true,
      }));
    }
  };

  const openEditModal = async (slug: string) => {
    await ensureBuilderOptions();
    try {
      const res = await api.get<{
        assessment: CollegeAssessmentSummaryItem & {
          soft_skill_config?: {
            question_set_ids?: number[];
            question_ids?: number[];
            duration_minutes?: number;
            pass_percentage?: number;
          } | null;
          coding_config?: {
            problem_ids?: number[];
            problems?: { problem_id: number; points?: number }[];
          } | null;
          interview_config?: {
            curated_set_ids?: string[];
            mock_round_ids?: string[];
            question_bank_ids?: number[];
            custom_questions?: CustomInterviewQuestionDraft[];
          } | null;
        };
      }>(`/superadmin/college-assessments/${slug}`);

      const a = res.assessment;
      const scope: TargetScopeConfig = a.target_scope ?? {};
      const codingEntries =
        a.coding_config?.problems && a.coding_config.problems.length > 0
          ? a.coding_config.problems.map((p) => ({ problem_id: p.problem_id, points: p.points ?? 100 }))
          : (a.coding_config?.problem_ids ?? []).map((id) => ({ problem_id: id, points: 100 }));

      setEditingSlug(slug);
      setTrackPreset(a.include_coding ? "tech" : a.include_interview ? "non_tech" : "non_tech_screening");
      setInterviewStream(a.include_coding ? "all" : "non_tech_hr");
      setInterviewCategory("all");
      setSoftQCategory("all");
      setForm({
        title: a.title,
        description: a.description ?? "",
        starts_at: toLocalDatetimeInput(a.starts_at),
        ends_at: toLocalDatetimeInput(a.ends_at),
        enforce_sequence: a.enforce_sequence,
        passing_score_percent: a.passing_score_percent,
        publish_now: a.status === "published",

        include_soft_skills: a.include_soft_skills,
        soft_skill_weight: a.soft_skill_weight,
        soft_skill_set_ids: a.soft_skill_config?.question_set_ids ?? [],
        soft_skill_question_ids: a.soft_skill_config?.question_ids ?? [],
        soft_skill_duration_minutes: a.soft_skill_config?.duration_minutes ?? 30,
        soft_skill_pass_percentage: a.soft_skill_config?.pass_percentage ?? 60,

        include_coding: a.include_coding,
        coding_weight: a.coding_weight,
        coding_problems: codingEntries,

        include_interview: a.include_interview,
        interview_weight: a.interview_weight,
        curated_set_ids: a.interview_config?.curated_set_ids ?? [],
        mock_round_ids: a.interview_config?.mock_round_ids ?? [],
        question_bank_ids: a.interview_config?.question_bank_ids ?? [],
        custom_questions: a.interview_config?.custom_questions ?? [],

        college_ids: scope.college_ids ?? [],
        department_codes: scope.department_codes ?? [],
        branch_codes: scope.branch_codes ?? [],
        student_mode: scope.student_mode ?? "all_matching",
        user_ids: scope.user_ids ?? [],
      });
      setBuilderOpen(true);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to load assessment details.", "error");
    }
  };

  const handleSaveAssessment = async () => {
    if (!form.title.trim()) {
      triggerToast("Assessment title is required.", "error");
      return;
    }
    if (!form.include_soft_skills && !form.include_coding && !form.include_interview) {
      triggerToast("Enable at least one pillar: Soft Skills, Coding, or AI Interview.", "error");
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      enforce_sequence: form.enforce_sequence,
      passing_score_percent: form.passing_score_percent,
      publish_now: form.publish_now,

      include_soft_skills: form.include_soft_skills,
      soft_skill_weight: form.soft_skill_weight,
      soft_skill_config: form.include_soft_skills
        ? {
            question_set_ids: form.soft_skill_set_ids,
            question_ids: form.soft_skill_question_ids,
            duration_minutes: form.soft_skill_duration_minutes,
            pass_percentage: form.soft_skill_pass_percentage,
          }
        : null,

      include_coding: form.include_coding,
      coding_weight: form.coding_weight,
      coding_config: form.include_coding
        ? {
            problems: form.coding_problems,
          }
        : null,

      include_interview: form.include_interview,
      interview_weight: form.interview_weight,
      interview_config: form.include_interview
        ? {
            curated_set_ids: form.curated_set_ids,
            mock_round_ids: form.mock_round_ids,
            question_bank_ids: form.question_bank_ids,
            custom_questions: form.custom_questions,
          }
        : null,

      target_scope: {
        college_ids: form.college_ids,
        department_codes: form.department_codes,
        branch_codes: form.branch_codes,
        student_mode: form.student_mode,
        user_ids: form.student_mode === "selected" ? form.user_ids : [],
      },
    };

    try {
      setSaving(true);
      if (editingSlug) {
        await api.put(`/superadmin/college-assessments/${editingSlug}`, payload);
        triggerToast("College assessment updated and synced to students.", "success");
      } else {
        await api.post("/superadmin/college-assessments", payload);
        triggerToast("College assessment created successfully.", "success");
      }
      setBuilderOpen(false);
      await loadAssessments();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to save assessment.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (slug: string) => {
    try {
      await api.post(`/superadmin/college-assessments/${slug}/publish`);
      triggerToast("Assessment published to all targeted students.", "success");
      await loadAssessments();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to publish assessment.", "error");
    }
  };

  const handleUnpublishAssessment = async (slug: string) => {
    try {
      await api.post(`/superadmin/college-assessments/${slug}/unpublish`);
      triggerToast("Assessment unpublished.", "success");
      await loadAssessments();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to unpublish assessment.", "error");
    }
  };

  const handleCloseAssessment = async (slug: string) => {
    try {
      await api.post(`/superadmin/college-assessments/${slug}/close`);
      triggerToast("Assessment closed.", "success");
      await loadAssessments();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to close assessment.", "error");
    }
  };

  const handleDelete = async (slug: string) => {
    if (!window.confirm("Delete this unstarted assessment? This cannot be undone.")) return;
    try {
      await api.delete(`/superadmin/college-assessments/${slug}`);
      triggerToast("Assessment deleted.", "success");
      await loadAssessments();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Unable to delete assessment.", "error");
    }
  };

  const buildResultsParams = useCallback(
    (overrides?: {
      collegeId?: string;
      branchCode?: string;
      statusVal?: string;
      resultVal?: string;
      minScore?: string;
      sortVal?: string;
      qVal?: string;
    }) => {
      const params = new URLSearchParams();
      const cid = overrides?.collegeId ?? filterCollegeId;
      const br = overrides?.branchCode ?? filterBranchCode;
      const st = overrides?.statusVal ?? filterStatus;
      const res = overrides?.resultVal ?? filterResult;
      const minS = overrides?.minScore ?? filterMinScore;
      const sort = overrides?.sortVal ?? filterSort;
      const q = overrides?.qVal ?? filterSearch;
      if (cid) params.set("college_id", cid);
      if (br) params.set("branch_code", br);
      if (st) params.set("status", st);
      if (res) params.set("result", res);
      if (minS !== "") params.set("min_score", minS);
      if (sort) params.set("sort", sort);
      if (q.trim()) params.set("q", q.trim());
      return params;
    },
    [filterCollegeId, filterBranchCode, filterStatus, filterResult, filterMinScore, filterSort, filterSearch]
  );

  const loadResults = useCallback(
    async (
      slug: string,
      overrides?: {
        collegeId?: string;
        branchCode?: string;
        statusVal?: string;
        resultVal?: string;
        minScore?: string;
        sortVal?: string;
        qVal?: string;
      }
    ) => {
      try {
        setResultsLoading(true);
        await ensureBuilderOptions();
        const qs = buildResultsParams(overrides).toString();

        const res = await api.get<{
          assessment: CollegeAssessmentSummaryItem;
          summary: {
            assigned: number;
            in_progress: number;
            completed: number;
            avg_overall_score: number | null;
            pass_count: number;
          };
          assignments: CollegeAssessmentAssignmentRow[];
        }>(`/superadmin/college-assessments/${slug}${qs ? `?${qs}` : ""}`);

        setResultsAssessment(res.assessment);
        setResultsSummary(res.summary);
        setAssignments(res.assignments ?? []);
      } catch (err) {
        triggerToast(err instanceof ApiError ? err.message : "Failed to load assessment results.", "error");
      } finally {
        setResultsLoading(false);
      }
    },
    [ensureBuilderOptions, buildResultsParams, triggerToast]
  );

  const openResults = async (slug: string) => {
    setFilterCollegeId("");
    setFilterBranchCode("");
    setFilterStatus("");
    setFilterResult("");
    setFilterMinScore("");
    setFilterSort("overall_desc");
    setFilterSearch("");
    setResultsSlug(slug);
    await loadResults(slug, { collegeId: "", branchCode: "", statusVal: "", resultVal: "", minScore: "", sortVal: "overall_desc", qVal: "" });
  };

  const handleExportCsv = async () => {
    if (!resultsSlug) return;
    try {
      setExportingCsv(true);
      const qs = buildResultsParams().toString();

      const blob = await api.getFile(
        `/superadmin/college-assessments/${resultsSlug}/export${qs ? `?${qs}` : ""}`
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${resultsSlug}-results.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      triggerToast("CSV results downloaded.", "success");
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "CSV export failed.", "error");
    } finally {
      setExportingCsv(false);
    }
  };

  const filteredBranches = useMemo(() => {
    if (!options) return [];
    if (form.department_codes.length === 0) return options.branches;
    return options.branches.filter((b) => form.department_codes.includes(b.department_code));
  }, [options, form.department_codes]);

  const filteredSoftSkillQuestions = useMemo(() => {
    if (!options) return [];
    const q = softQSearch.trim().toLowerCase();
    return options.soft_skill_questions
      .filter((item) => {
        if (softQCategory !== "all" && item.category !== softQCategory) return false;
        if (!q) return true;
        return item.question_text.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
      })
      .slice(0, 80);
  }, [options, softQSearch, softQCategory]);

  const filteredProblems = useMemo(() => {
    if (!options) return [];
    const q = problemSearch.trim().toLowerCase();
    if (!q) return options.problems.slice(0, 60);
    return options.problems
      .filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.difficulty.toLowerCase().includes(q) ||
          p.tags?.some((t) => t.toLowerCase().includes(q))
      )
      .slice(0, 60);
  }, [options, problemSearch]);

  const NON_TECH_DISCIPLINES = useMemo(
    () =>
      new Set([
        "bba",
        "bcom",
        "mba",
        "mcom",
        "comm_prof",
        "economics",
        "education",
        "fine_arts",
        "geography_env",
        "history_phil",
        "lang_lit",
        "media_comm",
        "polsci_pa",
        "psychology",
        "sociology_sw",
        "other_arts",
        "other",
      ]),
    []
  );
  const CORE_ENGG_DISCIPLINES = useMemo(() => new Set(["ece", "eee", "mech", "civil"]), []);

  const filteredCuratedSets = useMemo(() => {
    if (!options) return [];
    const q = interviewSearch.trim().toLowerCase();
    return options.curated_interview_sets
      .filter((s) => {
        if (interviewStream === "non_tech_hr") {
          const isNonTechRole =
            s.role_title.toLowerCase().includes("marketing") ||
            s.stack_key.toLowerCase().includes("marketing") ||
            s.stack_key.toLowerCase().includes("seo");
          if (!isNonTechRole) return false;
        } else if (interviewStream === "core_engg") {
          return false;
        }
        if (!q) return true;
        return s.title.toLowerCase().includes(q) || s.role_title.toLowerCase().includes(q);
      })
      .slice(0, 50);
  }, [options, interviewSearch, interviewStream]);

  const filteredMockRounds = useMemo(() => {
    if (!options) return [];
    const q = interviewSearch.trim().toLowerCase();
    return options.mock_interview_rounds
      .filter((r) => {
        if (interviewStream === "non_tech_hr") {
          const isNonTech =
            r.role_title.toLowerCase().includes("marketing") ||
            r.title.toLowerCase().includes("marketing") ||
            r.title.toLowerCase().includes("hr") ||
            r.title.toLowerCase().includes("behavioral");
          if (!isNonTech) return false;
        } else if (interviewStream === "core_engg") {
          return false;
        }
        if (!q) return true;
        return r.title.toLowerCase().includes(q) || r.role_title.toLowerCase().includes(q);
      })
      .slice(0, 50);
  }, [options, interviewSearch, interviewStream]);

  const filteredInterviewBank = useMemo(() => {
    if (!options) return [];
    const q = interviewSearch.trim().toLowerCase();
    return options.interview_question_bank
      .filter((b) => {
        if (interviewCategory !== "all" && b.category !== interviewCategory) return false;
        if (interviewStream === "non_tech_hr") {
          const d = b.discipline ?? "";
          const isGeneralNonTechCat = !b.discipline && ["hr", "behavioral", "situational", "aptitude"].includes(b.category);
          if (!NON_TECH_DISCIPLINES.has(d) && !isGeneralNonTechCat) return false;
        } else if (interviewStream === "core_engg") {
          const d = b.discipline ?? "";
          const isGeneralSoftCat = !b.discipline && ["hr", "behavioral", "situational"].includes(b.category);
          if (!CORE_ENGG_DISCIPLINES.has(d) && !isGeneralSoftCat) return false;
        } else if (interviewStream === "software") {
          if (b.discipline && b.discipline !== "software") return false;
        }
        if (!q) return true;
        return (
          b.question_text.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q) ||
          (b.discipline ?? "").toLowerCase().includes(q)
        );
      })
      .slice(0, 80);
  }, [options, interviewSearch, interviewStream, interviewCategory, NON_TECH_DISCIPLINES, CORE_ENGG_DISCIPLINES]);

  const handleAutoPickNonTechQuestions = () => {
    if (!options) return;
    const branchText = [...form.branch_codes, ...form.department_codes].join(" ").toLowerCase();
    const matchedDomain = options.interview_question_bank.filter((b) => {
      if (!b.discipline || !NON_TECH_DISCIPLINES.has(b.discipline)) return false;
      if (branchText && branchText.includes(b.discipline.toLowerCase())) return true;
      if (form.department_codes.includes("management") && ["bba", "mba"].includes(b.discipline)) return true;
      if (form.department_codes.includes("commerce") && ["bcom", "mcom", "comm_prof", "economics"].includes(b.discipline)) return true;
      if (form.department_codes.includes("arts") && ["economics", "psychology", "lang_lit", "media_comm", "polsci_pa", "history_phil", "sociology_sw"].includes(b.discipline)) return true;
      return false;
    });
    const generalHr = options.interview_question_bank.filter(
      (b) => !b.discipline && (b.category === "hr" || b.category === "behavioral")
    );
    const fallbackNonTech = options.interview_question_bank.filter(
      (b) => b.discipline && NON_TECH_DISCIPLINES.has(b.discipline)
    );
    const chosenIds = Array.from(
      new Set([
        ...matchedDomain.slice(0, 3).map((b) => b.id),
        ...generalHr.slice(0, 3).map((b) => b.id),
        ...(matchedDomain.length === 0 ? fallbackNonTech.slice(0, 2).map((b) => b.id) : []),
      ])
    ).slice(0, 6);

    if (chosenIds.length === 0) {
      triggerToast("No non-tech or HR bank questions found — add custom questions below.", "error");
      return;
    }

    setForm((f) => ({
      ...f,
      question_bank_ids: Array.from(new Set([...f.question_bank_ids, ...chosenIds])),
    }));
    triggerToast(`Added ${chosenIds.length} HR / Non-Tech interview questions.`, "success");
  };

  const handleAddNonTechStarterPrompts = () => {
    const starter: CustomInterviewQuestionDraft[] = [
      {
        text: "Introduce yourself, your academic background, and why this career track or industry excites you.",
        category: "hr",
        difficulty: "easy",
        duration_seconds: 120,
      },
      {
        text: "Tell us about a team project, campus event, or internship problem you solved and how you coordinated with people.",
        category: "behavioral",
        difficulty: "medium",
        duration_seconds: 120,
      },
      {
        text: "Imagine an important client or stakeholder disagrees with your recommendation under a tight deadline. How would you handle it?",
        category: "situational",
        difficulty: "medium",
        duration_seconds: 120,
      },
    ];
    setForm((f) => {
      const existingTexts = new Set(f.custom_questions.map((c) => c.text));
      const toAdd = starter.filter((s) => !existingTexts.has(s.text));
      return { ...f, custom_questions: [...f.custom_questions, ...toAdd] };
    });
    triggerToast("Added Non-Tech communication & situational prompts.", "success");
  };

  const hasNonTechDeptSelected = useMemo(
    () => form.department_codes.some((d) => ["management", "commerce", "arts"].includes(d)),
    [form.department_codes]
  );

  const activeWeightSum =
    (form.include_soft_skills ? form.soft_skill_weight : 0) +
    (form.include_coding ? form.coding_weight : 0) +
    (form.include_interview ? form.interview_weight : 0);

  return (
    <div className="space-y-6">
      <LaunchpadProgramsSection options={options} ensureOptions={ensureBuilderOptions} triggerToast={triggerToast} />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle">
        <div>
          <h2 className="text-lg font-extrabold text-primary">College Assessments Builder</h2>
          <p className="mt-1 text-xs text-text-muted max-w-2xl">
            Combine existing Soft Skills sets, Coding problems, and AI Interview sets into a single campus assessment, map it college-wise, branch-wise, or student-wise, and export unified CSV scorecards.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadAssessments}
            className="inline-flex items-center gap-1.5 rounded-pill border border-border-subtle bg-surface-muted px-3 py-2 text-xs font-bold text-text-secondary hover:bg-surface-hover"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Assessment
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-panel border border-border-subtle bg-surface p-12 text-xs text-text-muted">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading assessments...
        </div>
      ) : assessments.length === 0 ? (
        <div className="rounded-panel border border-dashed border-border-subtle bg-surface p-12 text-center">
          <p className="text-sm font-bold text-primary">No college assessments created yet</p>
          <p className="mt-1 text-xs text-text-muted">
            Click &ldquo;Create Assessment&rdquo; to combine Soft Skills + Coding + AI Interview and assign it to a college or branch.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {assessments.map((a) => (
            <div
              key={a.id}
              className="rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-extrabold text-primary">{a.title}</span>
                  <span
                    className={cn(
                      "rounded-pill px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                      a.status === "published" && "bg-emerald-500/15 text-emerald-700",
                      a.status === "draft" && "bg-amber-500/15 text-amber-700",
                      a.status === "closed" && "bg-slate-500/15 text-slate-600"
                    )}
                  >
                    {a.status}
                  </span>
                  {a.enforce_sequence && (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      <Lock className="h-3 w-3" /> Sequential Order
                    </span>
                  )}
                </div>
                {a.description && <p className="text-xs text-text-muted max-w-2xl">{a.description}</p>}
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  {a.include_soft_skills && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-1 font-semibold text-blue-700">
                      <Sparkles className="h-3 w-3" /> Soft Skills ({a.soft_skill_weight}%)
                    </span>
                  )}
                  {a.include_coding && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/10 px-2 py-1 font-semibold text-violet-700">
                      <Code2 className="h-3 w-3" /> Coding ({a.coding_weight}%)
                    </span>
                  )}
                  {a.include_interview && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-700">
                      <Mic className="h-3 w-3" /> AI Interview ({a.interview_weight}%)
                    </span>
                  )}
                  <span className="text-text-muted">
                    Pass: {a.passing_score_percent}% &middot; Assigned:{" "}
                    <strong className="text-primary">{a.assigned_count}</strong> &middot; In Progress:{" "}
                    <strong className="text-primary">{a.in_progress_count}</strong> &middot; Completed:{" "}
                    <strong className="text-primary">{a.completed_count}</strong>
                    {a.avg_overall_score !== null && (
                      <>
                        {" "}
                        &middot; Avg: <strong className="text-primary">{a.avg_overall_score}%</strong>
                      </>
                    )}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openResults(a.slug)}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-border-subtle bg-surface-muted px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-hover"
                >
                  <Users className="h-3.5 w-3.5" />
                  Results &amp; CSV
                </button>
                <button
                  type="button"
                  onClick={() => openEditModal(a.slug)}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-border-subtle px-3 py-1.5 text-xs font-bold text-text-secondary hover:bg-surface-hover"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit
                </button>
                {a.status === "draft" && (
                  <button
                    type="button"
                    onClick={() => handlePublish(a.slug)}
                    className="inline-flex items-center gap-1.5 rounded-pill bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Publish
                  </button>
                )}
                {a.status !== "draft" && (
                  <button
                    type="button"
                    onClick={() => handleUnpublishAssessment(a.slug)}
                    className="inline-flex items-center gap-1.5 rounded-pill border border-slate-500/40 bg-surface-muted px-3 py-1.5 text-xs font-bold text-text-secondary hover:bg-surface-hover"
                  >
                    Unpublish
                  </button>
                )}
                {a.status === "published" && (
                  <button
                    type="button"
                    onClick={() => handleCloseAssessment(a.slug)}
                    className="inline-flex items-center gap-1.5 rounded-pill border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-500/20"
                  >
                    Close
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(a.slug)}
                  title="Delete unstarted assessment"
                  className="inline-flex items-center gap-1 rounded-pill border border-rose-500/30 px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BUILDER MODAL */}
      {builderOpen && options && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-panel border border-border-subtle bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
              <div>
                <h3 className="text-base font-extrabold text-primary">
                  {editingSlug ? "Edit College Assessment" : "Create Multi-Pillar College Assessment"}
                </h3>
                <p className="text-xs text-text-muted">
                  Configure Soft Skills, Coding, AI Interview, and target Colleges / Branches / Students.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBuilderOpen(false)}
                className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Quick Track Presets */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wide text-primary">
                      1-Click Assessment Track Preset
                    </h4>
                    <p className="text-[11px] text-text-muted">
                      Pick the cohort type first to configure recommended rounds, weights &amp; question filters automatically.
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => applyPreset("tech")}
                    className={cn(
                      "rounded-lg border p-2.5 text-left transition",
                      trackPreset === "tech" && form.include_coding
                        ? "border-primary bg-surface shadow-sm"
                        : "border-border-subtle bg-surface/60 hover:bg-surface"
                    )}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-primary">
                      <Code2 className="h-3.5 w-3.5 text-violet-600" /> Tech / Software
                    </div>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      Soft Skills 30% + Coding 40% + Tech/HR AI Interview 30%
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPreset("non_tech")}
                    className={cn(
                      "rounded-lg border p-2.5 text-left transition",
                      trackPreset === "non_tech" && !form.include_coding && form.include_interview
                        ? "border-primary bg-surface shadow-sm"
                        : "border-border-subtle bg-surface/60 hover:bg-surface"
                    )}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-primary">
                      <Briefcase className="h-3.5 w-3.5 text-emerald-600" /> Non-Tech (Mgmt/Comm/Arts)
                    </div>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      No Coding &middot; Aptitude/Soft Skills 50% + HR/Domain Interview 50%
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPreset("non_tech_screening")}
                    className={cn(
                      "rounded-lg border p-2.5 text-left transition",
                      trackPreset === "non_tech_screening" && !form.include_coding && !form.include_interview
                        ? "border-primary bg-surface shadow-sm"
                        : "border-border-subtle bg-surface/60 hover:bg-surface"
                    )}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-primary">
                      <Sparkles className="h-3.5 w-3.5 text-blue-600" /> Aptitude &amp; Soft Skills Only
                    </div>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      1-Round Mass Screening &middot; Soft Skills / Aptitude 100%
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPreset("core_engg")}
                    className={cn(
                      "rounded-lg border p-2.5 text-left transition",
                      trackPreset === "core_engg" && !form.include_coding && form.include_interview
                        ? "border-primary bg-surface shadow-sm"
                        : "border-border-subtle bg-surface/60 hover:bg-surface"
                    )}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-primary">
                      <Mic className="h-3.5 w-3.5 text-amber-600" /> Core Engg (No Coding)
                    </div>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      ECE/EEE/Mech/Civil &middot; Soft Skills 40% + Core AI Interview 60%
                    </p>
                  </button>
                </div>
              </div>

              {/* Section 1: Details & Weights */}
              <div className="grid gap-4 md:grid-cols-2 rounded-xl border border-border-subtle bg-surface-muted/40 p-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-primary">Assessment Title *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g., Campus Placement Tech Drive 2026 — Round 1-3"
                    className="mt-1 w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-primary focus:outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-primary">Instructions / Description</label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Overview shown to assigned students..."
                    className="mt-1 w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-xs text-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-primary">Window Starts At (optional)</label>
                  <input
                    type="datetime-local"
                    value={form.starts_at}
                    onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs text-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-primary">Window Ends At (optional)</label>
                  <input
                    type="datetime-local"
                    value={form.ends_at}
                    onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs text-primary"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-5 md:col-span-2 pt-1">
                  <label className="flex items-center gap-2 text-xs font-bold text-primary">
                    Pass Benchmark (%)
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={form.passing_score_percent}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, passing_score_percent: Number(e.target.value) || 60 }))
                      }
                      className="w-20 rounded-lg border border-border-subtle bg-surface px-2 py-1 text-xs"
                    />
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.enforce_sequence}
                      onChange={(e) => setForm((f) => ({ ...f, enforce_sequence: e.target.checked }))}
                    />
                    Enforce sequence (Soft Skills &rarr; Coding &rarr; AI Interview)
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.publish_now}
                      onChange={(e) => setForm((f) => ({ ...f, publish_now: e.target.checked }))}
                    />
                    Publish immediately to student dashboards
                  </label>
                </div>
                <div className="md:col-span-2 text-[11px] text-text-muted">
                  Active Pillar Weights Sum:{" "}
                  <strong className={cn(activeWeightSum === 100 ? "text-emerald-600" : "text-amber-600")}>
                    {activeWeightSum}%
                  </strong>{" "}
                  (normalized automatically even if not 100%).
                </div>
              </div>

              {/* Section 2: Pillar 1 - Soft Skills */}
              <div className="rounded-xl border border-border-subtle p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-sm font-extrabold text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.include_soft_skills}
                      onChange={(e) => setForm((f) => ({ ...f, include_soft_skills: e.target.checked }))}
                    />
                    1. Soft Skills Round
                  </label>
                  {form.include_soft_skills && (
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <label className="flex items-center gap-1.5 font-semibold">
                        Weight %
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={form.soft_skill_weight}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, soft_skill_weight: Number(e.target.value) || 0 }))
                          }
                          className="w-16 rounded border border-border-subtle bg-surface px-2 py-1"
                        />
                      </label>
                      <label className="flex items-center gap-1.5 font-semibold">
                        Duration (min)
                        <input
                          type="number"
                          min={5}
                          max={240}
                          value={form.soft_skill_duration_minutes}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              soft_skill_duration_minutes: Number(e.target.value) || 30,
                            }))
                          }
                          className="w-16 rounded border border-border-subtle bg-surface px-2 py-1"
                        />
                      </label>
                    </div>
                  )}
                </div>

                {form.include_soft_skills && (
                  <div className="space-y-2.5 pt-1">
                    <div className="rounded-lg bg-blue-500/10 px-3 py-2 text-[11px] font-medium text-blue-800">
                      Universal for <strong>both Tech &amp; Non-Tech students</strong> — covers Aptitude, Reasoning, Verbal English &amp; Situational Judgment.
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-bold text-text-secondary mb-1.5">
                          Existing Soft Skill Sets ({form.soft_skill_set_ids.length} selected)
                        </p>
                        <div className="max-h-44 overflow-y-auto space-y-1.5 rounded-lg border border-border-subtle p-2">
                          {options.soft_skill_sets.map((s) => {
                            const checked = form.soft_skill_set_ids.includes(s.id);
                            return (
                              <label
                                key={s.id}
                                className="flex items-start gap-2 rounded p-1.5 text-xs hover:bg-surface-hover cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setForm((f) => ({
                                      ...f,
                                      soft_skill_set_ids: checked
                                        ? f.soft_skill_set_ids.filter((id) => id !== s.id)
                                        : [...f.soft_skill_set_ids, s.id],
                                    }))
                                  }
                                />
                                <span>
                                  <strong className="text-primary">{s.title}</strong>{" "}
                                  <span className="text-text-muted">({s.questions_count} Qs)</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs font-bold text-text-secondary">
                            Or Pick Individual Bank Questions ({form.soft_skill_question_ids.length})
                          </p>
                        </div>
                        <div className="flex gap-2 mb-2">
                          <select
                            value={softQCategory}
                            onChange={(e) => setSoftQCategory(e.target.value)}
                            className="rounded-lg border border-border-subtle bg-surface px-2 py-1 text-xs"
                          >
                            <option value="all">All Categories</option>
                            <option value="aptitude">Aptitude</option>
                            <option value="reasoning">Reasoning</option>
                            <option value="english">English</option>
                            <option value="situational">Situational</option>
                            <option value="quantitative">Quantitative</option>
                            <option value="logical">Logical</option>
                            <option value="verbal">Verbal</option>
                          </select>
                          <input
                            type="text"
                            value={softQSearch}
                            onChange={(e) => setSoftQSearch(e.target.value)}
                            placeholder="Filter soft skill questions..."
                            className="flex-1 rounded-lg border border-border-subtle bg-surface px-2.5 py-1 text-xs"
                          />
                        </div>
                        <div className="max-h-36 overflow-y-auto space-y-1 rounded-lg border border-border-subtle p-2">
                          {filteredSoftSkillQuestions.map((q) => {
                            const checked = form.soft_skill_question_ids.includes(q.id);
                            return (
                              <label
                                key={q.id}
                                className="flex items-start gap-2 rounded p-1 text-[11px] hover:bg-surface-hover cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setForm((f) => ({
                                      ...f,
                                      soft_skill_question_ids: checked
                                        ? f.soft_skill_question_ids.filter((id) => id !== q.id)
                                        : [...f.soft_skill_question_ids, q.id],
                                    }))
                                  }
                                />
                                <span className="line-clamp-2 text-primary">
                                  <span className="font-bold text-text-muted uppercase">[{q.category}]</span>{" "}
                                  {q.question_text}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Pillar 2 - Coding Test */}
              <div className={cn("rounded-xl border border-border-subtle p-4", form.include_coding ? "space-y-3" : "bg-surface-muted/30")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-2 text-sm font-extrabold text-primary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.include_coding}
                        onChange={(e) => setForm((f) => ({ ...f, include_coding: e.target.checked }))}
                      />
                      2. Coding Test Round {form.include_coding ? `(${form.coding_problems.length} problems selected)` : ""}
                    </label>
                    {!form.include_coding && (
                      <span className="rounded-pill bg-surface-muted px-2.5 py-0.5 text-[11px] font-semibold text-text-muted">
                        Skipped (ideal for Non-Tech / Core / Screening)
                      </span>
                    )}
                    {form.include_coding && hasNonTechDeptSelected && (
                      <span className="inline-flex items-center gap-1 rounded-pill bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                        <AlertTriangle className="h-3 w-3" /> Non-tech department targeted — uncheck Coding or switch preset
                      </span>
                    )}
                  </div>
                  {form.include_coding && (
                    <label className="flex items-center gap-1.5 text-xs font-semibold">
                      Weight %
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={form.coding_weight}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, coding_weight: Number(e.target.value) || 0 }))
                        }
                        className="w-16 rounded border border-border-subtle bg-surface px-2 py-1"
                      />
                    </label>
                  )}
                </div>

                {form.include_coding && (
                  <div className="space-y-2 pt-1">
                    <input
                      type="text"
                      value={problemSearch}
                      onChange={(e) => setProblemSearch(e.target.value)}
                      placeholder="Search Problem Bank by title, difficulty, or tag..."
                      className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs"
                    />
                    <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-border-subtle p-2">
                      {filteredProblems.map((p) => {
                        const existing = form.coding_problems.find((cp) => cp.problem_id === p.id);
                        return (
                          <div
                            key={p.id}
                            className="flex items-center justify-between gap-2 rounded p-1.5 text-xs hover:bg-surface-hover"
                          >
                            <label className="flex items-center gap-2 cursor-pointer flex-1">
                              <input
                                type="checkbox"
                                checked={!!existing}
                                onChange={() =>
                                  setForm((f) => ({
                                    ...f,
                                    coding_problems: existing
                                      ? f.coding_problems.filter((cp) => cp.problem_id !== p.id)
                                      : [...f.coding_problems, { problem_id: p.id, points: 100 }],
                                  }))
                                }
                              />
                              <span className="font-semibold text-primary">{p.title}</span>
                              <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-text-muted">
                                {p.difficulty}
                              </span>
                            </label>
                            {existing && (
                              <label className="flex items-center gap-1 text-[11px] text-text-muted">
                                Pts:
                                <input
                                  type="number"
                                  min={10}
                                  max={1000}
                                  value={existing.points}
                                  onChange={(e) => {
                                    const pts = Number(e.target.value) || 100;
                                    setForm((f) => ({
                                      ...f,
                                      coding_problems: f.coding_problems.map((cp) =>
                                        cp.problem_id === p.id ? { ...cp, points: pts } : cp
                                      ),
                                    }));
                                  }}
                                  className="w-16 rounded border border-border-subtle bg-surface px-1.5 py-0.5 text-xs text-primary"
                                />
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 4: Pillar 3 - AI Interview */}
              <div className="rounded-xl border border-border-subtle p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-sm font-extrabold text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.include_interview}
                      onChange={(e) => setForm((f) => ({ ...f, include_interview: e.target.checked }))}
                    />
                    3. AI Interview Round
                  </label>
                  {form.include_interview && (
                    <label className="flex items-center gap-1.5 text-xs font-semibold">
                      Weight %
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={form.interview_weight}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, interview_weight: Number(e.target.value) || 0 }))
                        }
                        className="w-16 rounded border border-border-subtle bg-surface px-2 py-1"
                      />
                    </label>
                  )}
                </div>

                {form.include_interview && (
                  <div className="space-y-3 pt-1">
                    {/* Stream Filter Pills + Category Filter + Non-Tech Auto-Pick */}
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-muted/50 p-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold text-text-muted mr-1">Stream:</span>
                        {(
                          [
                            { id: "non_tech_hr", label: "Non-Tech & HR (BBA/MBA/BCom/Arts)" },
                            { id: "core_engg", label: "Core Engg" },
                            { id: "software", label: "Software / Tech" },
                            { id: "all", label: "All Streams" },
                          ] as { id: InterviewStreamFilter; label: string }[]
                        ).map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setInterviewStream(st.id)}
                            className={cn(
                              "rounded-pill border px-2.5 py-0.5 text-[11px] font-bold transition",
                              interviewStream === st.id
                                ? "border-primary bg-primary text-white"
                                : "border-border-subtle bg-surface text-text-secondary hover:bg-surface-hover"
                            )}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleAutoPickNonTechQuestions}
                          className="inline-flex items-center gap-1 rounded-pill border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-500/20"
                        >
                          <Wand2 className="h-3 w-3" /> Auto-Pick 5 HR &amp; Non-Tech Qs
                        </button>
                        <button
                          type="button"
                          onClick={handleAddNonTechStarterPrompts}
                          className="inline-flex items-center gap-1 rounded-pill border border-border-subtle bg-surface px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-surface-hover"
                        >
                          <Plus className="h-3 w-3" /> Add 3 Non-Tech Starter Prompts
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <select
                        value={interviewCategory}
                        onChange={(e) => setInterviewCategory(e.target.value)}
                        className="rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 text-xs"
                      >
                        <option value="all">All Categories</option>
                        <option value="hr">HR / Career Fit</option>
                        <option value="behavioral">Behavioral (STAR)</option>
                        <option value="situational">Situational / Case</option>
                        <option value="technical">Domain / Role Specific</option>
                        <option value="aptitude">Aptitude / Analytical</option>
                      </select>
                      <input
                        type="text"
                        value={interviewSearch}
                        onChange={(e) => setInterviewSearch(e.target.value)}
                        placeholder="Search Digital Marketing, BBA, MBA, B.Com, HR, behavioral, economics..."
                        className="flex-1 min-w-[200px] rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-border-subtle p-2">
                        <p className="text-[11px] font-bold text-text-secondary mb-1">
                          Curated AI Sets ({form.curated_set_ids.length})
                        </p>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {filteredCuratedSets.length === 0 ? (
                            <p className="p-2 text-[11px] text-text-muted">
                              No curated sets in this stream filter (use Interview Question Bank or Custom Prompts for BBA/BCom/HR).
                            </p>
                          ) : (
                            filteredCuratedSets.map((s) => {
                              const checked = form.curated_set_ids.includes(s.id);
                              return (
                                <label key={s.id} className="flex items-start gap-1.5 text-[11px] cursor-pointer p-1 hover:bg-surface-hover rounded">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      setForm((f) => ({
                                        ...f,
                                        curated_set_ids: checked
                                          ? f.curated_set_ids.filter((id) => id !== s.id)
                                          : [...f.curated_set_ids, s.id],
                                      }))
                                    }
                                  />
                                  <span>
                                    <strong className="text-primary">{s.title}</strong> ({s.question_count} Qs)
                                  </span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg border border-border-subtle p-2">
                        <p className="text-[11px] font-bold text-text-secondary mb-1">
                          Mock AI Rounds ({form.mock_round_ids.length})
                        </p>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {filteredMockRounds.length === 0 ? (
                            <p className="p-2 text-[11px] text-text-muted">
                              No mock rounds in this stream filter (use Interview Question Bank or Custom Prompts).
                            </p>
                          ) : (
                            filteredMockRounds.map((r) => {
                              const checked = form.mock_round_ids.includes(r.id);
                              return (
                                <label key={r.id} className="flex items-start gap-1.5 text-[11px] cursor-pointer p-1 hover:bg-surface-hover rounded">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      setForm((f) => ({
                                        ...f,
                                        mock_round_ids: checked
                                          ? f.mock_round_ids.filter((id) => id !== r.id)
                                          : [...f.mock_round_ids, r.id],
                                      }))
                                    }
                                  />
                                  <span>
                                    <strong className="text-primary">{r.title}</strong> ({r.question_count} Qs)
                                  </span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg border border-border-subtle p-2">
                        <p className="text-[11px] font-bold text-text-secondary mb-1">
                          Interview Question Bank ({form.question_bank_ids.length})
                        </p>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {filteredInterviewBank.length === 0 ? (
                            <p className="p-2 text-[11px] text-text-muted">No matching bank questions.</p>
                          ) : (
                            filteredInterviewBank.map((q) => {
                              const checked = form.question_bank_ids.includes(q.id);
                              return (
                                <label key={q.id} className="flex items-start gap-1.5 text-[11px] cursor-pointer p-1 hover:bg-surface-hover rounded">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      setForm((f) => ({
                                        ...f,
                                        question_bank_ids: checked
                                          ? f.question_bank_ids.filter((id) => id !== q.id)
                                          : [...f.question_bank_ids, q.id],
                                      }))
                                    }
                                  />
                                  <span className="line-clamp-2 text-primary">
                                    <span className="font-bold uppercase text-text-muted">
                                      [{q.discipline ? `${q.discipline}·` : ""}{q.category}]
                                    </span>{" "}
                                    {q.question_text}
                                  </span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <select
                        value={newCustomCategory}
                        onChange={(e) => setNewCustomCategory(e.target.value)}
                        className="rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 text-xs"
                      >
                        <option value="hr">HR</option>
                        <option value="behavioral">Behavioral</option>
                        <option value="situational">Situational</option>
                        <option value="technical">Domain / Role</option>
                      </select>
                      <input
                        type="text"
                        value={newCustomQuestion}
                        onChange={(e) => setNewCustomQuestion(e.target.value)}
                        placeholder="Add custom non-tech or HR AI interview question..."
                        className="flex-1 min-w-[220px] rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newCustomQuestion.trim()) return;
                          setForm((f) => ({
                            ...f,
                            custom_questions: [
                              ...f.custom_questions,
                              {
                                text: newCustomQuestion.trim(),
                                category: newCustomCategory,
                                difficulty: "medium",
                                duration_seconds: 120,
                              },
                            ],
                          }));
                          setNewCustomQuestion("");
                        }}
                        className="rounded-lg border border-border-subtle bg-surface-muted px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-hover"
                      >
                        Add Question
                      </button>
                    </div>
                    {form.custom_questions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {form.custom_questions.map((cq, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 rounded-pill bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
                          >
                            {cq.text}
                            <button
                              type="button"
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  custom_questions: f.custom_questions.filter((_, i) => i !== idx),
                                }))
                              }
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Section 5: Target Audience (College / Branch / Student-wise) */}
              <div className="rounded-xl border border-border-subtle p-4 space-y-4">
                <div>
                  <h4 className="text-sm font-extrabold text-primary">
                    4. Target Mapping (College-wise, Branch-wise &amp; Student-wise)
                  </h4>
                  <p className="text-xs text-text-muted">
                    Leave Colleges or Branches empty to match across all, or narrow down and select exact students.
                  </p>
                </div>

                {/* Colleges */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-text-secondary">Partner Colleges</span>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          college_ids:
                            f.college_ids.length === options.colleges.length
                              ? []
                              : options.colleges.map((c) => c.id),
                        }))
                      }
                      className="text-[11px] font-bold text-primary hover:underline"
                    >
                      {form.college_ids.length === options.colleges.length ? "Clear All" : "Select All Colleges"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {options.colleges.map((c) => {
                      const active = form.college_ids.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              college_ids: active
                                ? f.college_ids.filter((id) => id !== c.id)
                                : [...f.college_ids, c.id],
                            }))
                          }
                          className={cn(
                            "rounded-pill border px-2.5 py-1 text-[11px] font-semibold transition",
                            active
                              ? "border-primary bg-primary text-white"
                              : "border-border-subtle bg-surface-muted text-text-secondary hover:bg-surface-hover"
                          )}
                        >
                          {c.short_code || c.name} ({c.students_count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Departments */}
                <div>
                  <span className="text-xs font-bold text-text-secondary block mb-1">Departments</span>
                  <div className="flex flex-wrap gap-1.5">
                    {options.departments.map((d) => {
                      const active = form.department_codes.includes(d.code);
                      return (
                        <button
                          key={d.code}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              department_codes: active
                                ? f.department_codes.filter((c) => c !== d.code)
                                : [...f.department_codes, d.code],
                            }))
                          }
                          className={cn(
                            "rounded-pill border px-2.5 py-1 text-[11px] font-semibold transition",
                            active
                              ? "border-primary bg-primary text-white"
                              : "border-border-subtle bg-surface-muted text-text-secondary hover:bg-surface-hover"
                          )}
                        >
                          {d.short || d.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Branches */}
                <div>
                  <span className="text-xs font-bold text-text-secondary block mb-1">Branches / Programmes</span>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                    {filteredBranches.map((b) => {
                      const active = form.branch_codes.includes(b.code);
                      return (
                        <button
                          key={b.code}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              branch_codes: active
                                ? f.branch_codes.filter((c) => c !== b.code)
                                : [...f.branch_codes, b.code],
                            }))
                          }
                          className={cn(
                            "rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold transition",
                            active
                              ? "border-primary bg-primary text-white"
                              : "border-border-subtle bg-surface-muted text-text-secondary hover:bg-surface-hover"
                          )}
                        >
                          {b.short}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Student Mode & Picker */}
                <div className="space-y-2 border-t border-border-subtle pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-4 text-xs font-bold">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          checked={form.student_mode === "all_matching"}
                          onChange={() => setForm((f) => ({ ...f, student_mode: "all_matching" }))}
                        />
                        Map to ALL matching students ({matchingTotal})
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          checked={form.student_mode === "selected"}
                          onChange={() => setForm((f) => ({ ...f, student_mode: "selected" }))}
                        />
                        Pick specific students ({form.user_ids.length} selected)
                      </label>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-text-muted" />
                      <input
                        type="text"
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="Search students by name, email, roll..."
                        className="rounded-lg border border-border-subtle bg-surface pl-8 pr-3 py-1 text-xs"
                      />
                    </div>
                  </div>

                  {form.student_mode === "selected" && (
                    <div className="flex items-center gap-3 text-[11px]">
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            user_ids: Array.from(new Set([...f.user_ids, ...matchingStudents.map((s) => s.id)])),
                          }))
                        }
                        className="font-bold text-primary hover:underline"
                      >
                        Select all shown ({matchingStudents.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, user_ids: [] }))}
                        className="font-bold text-rose-600 hover:underline"
                      >
                        Clear selected
                      </button>
                    </div>
                  )}

                  <div className="max-h-48 overflow-y-auto rounded-lg border border-border-subtle">
                    {loadingStudents ? (
                      <div className="p-4 text-center text-xs text-text-muted">Loading students...</div>
                    ) : matchingStudents.length === 0 ? (
                      <div className="p-4 text-center text-xs text-text-muted">No students match these filters.</div>
                    ) : (
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-muted/70 text-[11px] uppercase text-text-muted">
                          <tr>
                            {form.student_mode === "selected" && <th className="p-2 w-8" />}
                            <th className="p-2">Name</th>
                            <th className="p-2">Email / Roll</th>
                            <th className="p-2">College</th>
                            <th className="p-2">Branch</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle">
                          {matchingStudents.map((st) => {
                            const checked = form.user_ids.includes(st.id);
                            return (
                              <tr key={st.id} className="hover:bg-surface-hover">
                                {form.student_mode === "selected" && (
                                  <td className="p-2">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() =>
                                        setForm((f) => ({
                                          ...f,
                                          user_ids: checked
                                            ? f.user_ids.filter((id) => id !== st.id)
                                            : [...f.user_ids, st.id],
                                        }))
                                      }
                                    />
                                  </td>
                                )}
                                <td className="p-2 font-semibold text-primary">{st.name}</td>
                                <td className="p-2 text-text-muted">
                                  {st.email} {st.roll_number ? `(${st.roll_number})` : ""}
                                </td>
                                <td className="p-2">{st.college_code || st.college_name || "—"}</td>
                                <td className="p-2">{st.branch || st.branch_code || st.department || "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border-subtle px-6 py-4">
              <button
                type="button"
                onClick={() => setBuilderOpen(false)}
                className="rounded-pill border border-border-subtle px-4 py-2 text-xs font-bold text-text-secondary hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveAssessment}
                className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-5 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editingSlug ? "Save Changes" : "Create & Assign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESULTS & CSV MODAL */}
      {resultsSlug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-panel border border-border-subtle bg-surface shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-6 py-4">
              <div>
                <h3 className="text-base font-extrabold text-primary">
                  {resultsAssessment?.title ?? "Assessment Results"}
                </h3>
                <p className="text-xs text-text-muted">
                  Live student progress synced from Soft Skills, Coding Contests, and Voice AI Interviews.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={exportingCsv}
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1.5 rounded-pill bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {exportingCsv ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => setResultsSlug(null)}
                  className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {resultsSummary && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <div className="rounded-xl border border-border-subtle bg-surface-muted/40 p-3">
                    <div className="text-[11px] font-bold text-text-muted">Assigned</div>
                    <div className="text-xl font-extrabold text-primary">{resultsSummary.assigned}</div>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-surface-muted/40 p-3">
                    <div className="text-[11px] font-bold text-text-muted">In Progress</div>
                    <div className="text-xl font-extrabold text-amber-600">{resultsSummary.in_progress}</div>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-surface-muted/40 p-3">
                    <div className="text-[11px] font-bold text-text-muted">Completed</div>
                    <div className="text-xl font-extrabold text-emerald-600">{resultsSummary.completed}</div>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-surface-muted/40 p-3">
                    <div className="text-[11px] font-bold text-text-muted">Passed Benchmark</div>
                    <div className="text-xl font-extrabold text-primary">{resultsSummary.pass_count}</div>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-surface-muted/40 p-3">
                    <div className="text-[11px] font-bold text-text-muted">Avg Overall</div>
                    <div className="text-xl font-extrabold text-primary">
                      {resultsSummary.avg_overall_score !== null ? `${resultsSummary.avg_overall_score}%` : "—"}
                    </div>
                  </div>
                </div>
              )}

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filterCollegeId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFilterCollegeId(val);
                    loadResults(resultsSlug, { collegeId: val });
                  }}
                  className="rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs"
                >
                  <option value="">All Colleges</option>
                  {options?.colleges.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={filterBranchCode}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFilterBranchCode(val);
                    loadResults(resultsSlug, { branchCode: val });
                  }}
                  className="rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs"
                >
                  <option value="">All Branches</option>
                  {options?.branches.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.short}
                    </option>
                  ))}
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFilterStatus(val);
                    loadResults(resultsSlug, { statusVal: val });
                  }}
                  className="rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs"
                >
                  <option value="">All Statuses</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
                <select
                  value={filterResult}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFilterResult(val);
                    loadResults(resultsSlug, { resultVal: val });
                  }}
                  className="rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs"
                >
                  <option value="">All Results</option>
                  <option value="pass">Passed Benchmark</option>
                  <option value="below_benchmark">Below Benchmark</option>
                  <option value="pending">Pending Score</option>
                </select>
                <select
                  value={filterMinScore}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFilterMinScore(val);
                    loadResults(resultsSlug, { minScore: val });
                  }}
                  className="rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs"
                >
                  <option value="">Any Score %</option>
                  <option value="80">Overall ≥ 80%</option>
                  <option value="60">Overall ≥ 60%</option>
                  <option value="40">Overall ≥ 40%</option>
                </select>
                <select
                  value={filterSort}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFilterSort(val);
                    loadResults(resultsSlug, { sortVal: val });
                  }}
                  className="rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs"
                >
                  <option value="overall_desc">Highest Overall %</option>
                  <option value="overall_asc">Lowest Overall %</option>
                  <option value="soft_desc">Highest Soft Skills %</option>
                  <option value="coding_desc">Highest Coding %</option>
                  <option value="interview_desc">Highest AI Interview %</option>
                </select>
                <input
                  type="text"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") loadResults(resultsSlug);
                  }}
                  placeholder="Search student, email, or roll..."
                  className="rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs min-w-[200px]"
                />
                <button
                  type="button"
                  onClick={() => loadResults(resultsSlug)}
                  className="rounded-lg border border-border-subtle bg-surface-muted px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-hover"
                >
                  Apply Filters
                </button>
              </div>

              {resultsLoading ? (
                <div className="p-8 text-center text-xs text-text-muted">Syncing scores...</div>
              ) : assignments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border-subtle p-8 text-center text-xs text-text-muted">
                  No student records match the selected filters.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border-subtle">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-muted/70 text-[11px] uppercase text-text-muted">
                      <tr>
                        <th className="p-3">Student</th>
                        <th className="p-3">College &amp; Branch</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Soft Skills</th>
                        <th className="p-3">Coding</th>
                        <th className="p-3">AI Interview</th>
                        <th className="p-3">Overall</th>
                        <th className="p-3">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {assignments.map((row) => (
                        <tr key={row.id} className="hover:bg-surface-hover">
                          <td className="p-3">
                            <div className="font-bold text-primary">{row.student.name ?? "Student"}</div>
                            <div className="text-[11px] text-text-muted">
                              {row.student.email} {row.student.roll_number ? `· ${row.student.roll_number}` : ""}
                            </div>
                          </td>
                          <td className="p-3">
                            <div>{row.student.college?.short_code || row.student.college?.name || "—"}</div>
                            <div className="text-[11px] text-text-muted">
                              {row.student.branch || row.student.branch_code || row.student.department || "—"}
                            </div>
                          </td>
                          <td className="p-3 capitalize font-semibold">{row.status.replace("_", " ")}</td>
                          <td className="p-3">
                            {row.soft_skill_score_percent !== null ? `${row.soft_skill_score_percent}%` : "—"}
                          </td>
                          <td className="p-3">
                            {row.coding_score_percent !== null
                              ? `${row.coding_score_percent}% (${row.coding_points ?? 0}/${row.coding_max_points ?? 0})`
                              : "—"}
                          </td>
                          <td className="p-3">
                            {row.interview_score_percent !== null ? `${row.interview_score_percent}%` : "—"}
                          </td>
                          <td className="p-3 font-extrabold text-primary">
                            {row.overall_score_percent !== null ? `${row.overall_score_percent}%` : "—"}
                          </td>
                          <td className="p-3">
                            {row.passed === null ? (
                              <span className="text-text-muted">Pending</span>
                            ) : row.passed ? (
                              <span className="rounded-pill bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                                Pass
                              </span>
                            ) : (
                              <span className="rounded-pill bg-rose-500/15 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                                Below Benchmark
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
