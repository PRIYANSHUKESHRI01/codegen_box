"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, Check, Layers, Loader2, Plus, RefreshCw, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { accentStyle, resetBranchCatalog } from "@/lib/branches";
import { DepartmentIcon } from "@/components/branches/DepartmentIcon";
import { BranchesPanel } from "./BranchesPanel";
import { type ToastTrigger } from "@/lib/toast";

type CapMap = Record<string, boolean>;

interface RegistryEntry {
  key: string;
  label: string;
  hint: string;
  default: boolean;
}

interface AdminBranchRow {
  code: string;
  name: string;
  short: string;
  is_active: boolean;
  capabilities: CapMap;
  students: number;
  questions: number;
  dedicated_questions: number;
}

interface AdminDisciplineRow {
  code: string;
  name: string;
  short: string;
  is_live: boolean;
  capabilities: CapMap;
  students: number;
  published_questions: number;
  branches: AdminBranchRow[];
}

interface AdminDepartment {
  code: string;
  name: string;
  short: string;
  description: string | null;
  icon: string;
  accent: string;
  is_active: boolean;
  capabilities: CapMap;
  resolved_capabilities: CapMap;
  settings: { domain_prep_label?: string; domain_prep_blurb?: string };
  students: number;
  colleges: number;
  disciplines: AdminDisciplineRow[];
}

interface DepartmentsResponse {
  capability_registry: RegistryEntry[];
  icons: string[];
  accents: string[];
  unclassified_students: number;
  departments: AdminDepartment[];
}

type Choice = "inherit" | "on" | "off";
const toChoice = (map: CapMap, key: string): Choice => (key in map ? (map[key] ? "on" : "off") : "inherit");

/** Inherit / On / Off — "inherit" falls through to the layer above (the department, then the registry default). */
function TriSwitch({ value, onChange, label, disabled }: { value: Choice; onChange: (v: Choice) => void; label: string; disabled?: boolean }) {
  const options: { id: Choice; text: string }[] = [
    { id: "inherit", text: "Default" },
    { id: "on", text: "On" },
    { id: "off", text: "Off" },
  ];

  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-border-subtle bg-elevated p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          disabled={disabled}
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-md px-2.5 py-1 text-3xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary disabled:opacity-50",
            value === o.id
              ? o.id === "on"
                ? "bg-status-success text-white"
                : o.id === "off"
                ? "bg-status-danger text-white"
                : "bg-surface text-primary shadow-subtle"
              : "text-text-muted hover:text-primary"
          )}
        >
          {o.text}
        </button>
      ))}
    </div>
  );
}

const withChoice = (map: CapMap, key: string, choice: Choice): CapMap => {
  const next = { ...map };
  if (choice === "inherit") delete next[key];
  else next[key] = choice === "on";
  return next;
};

/**
 * Superadmin → Departments. A department (Engineering & Technology, Management, Commerce, Arts …) decides which modules its students
 * see — coding practice, contests, Project Lab, Domain Prep … — through switches that can be overridden per discipline and per branch.
 * It also shows how well each branch is covered by Domain Prep questions, so the programmes with nothing to practise yet are obvious.
 * Everything here is data: adding a department is not a release.
 */
export function DepartmentsPanel({ triggerToast }: { triggerToast: ToastTrigger }) {
  const [view, setView] = useState<"departments" | "branches">("departments");
  const [data, setData] = useState<DepartmentsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openDiscipline, setOpenDiscipline] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<DepartmentsResponse>("/superadmin/departments");
      setData(res);
      setSelected((cur) => cur ?? res.departments[0]?.code ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load the departments.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dept = useMemo(() => data?.departments.find((d) => d.code === selected) ?? null, [data, selected]);

  const save = async (key: string, request: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await request();
      resetBranchCatalog();
      triggerToast(done);
      await load();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.errors?.department?.[0] ?? err.errors?.code?.[0] ?? err.message : "That didn't work.", "error");
    } finally {
      setBusy(null);
    }
  };

  if (error) {
    return (
      <div role="alert" className="flex items-center justify-between gap-3 rounded-panel border border-status-danger/30 bg-status-danger/10 p-4 text-sm text-status-danger">
        <span>{error}</span>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 text-xs font-bold hover:underline">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  if (!data) return <div className="h-64 animate-pulse rounded-panel border border-border-subtle bg-surface" aria-busy="true" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-primary">
            <Layers className="h-4 w-4 text-accent-primary" /> Departments
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            A college runs one or more departments. Each decides which modules its students see — so a Commerce student is never shown coding problems —
            and holds its own branches and Domain Prep questions. Switches here apply instantly, to every student and every college.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-border-subtle bg-elevated p-0.5" role="tablist" aria-label="View">
          {(["departments", "branches"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn("rounded-md px-3 py-1.5 text-2xs font-bold", view === v ? "bg-accent-primary text-white" : "text-text-secondary hover:text-primary")}
            >
              {v === "departments" ? "Departments & modules" : "Branches & spellings"}
            </button>
          ))}
        </div>
      </div>

      {view === "branches" ? (
        <BranchesPanel triggerToast={triggerToast} />
      ) : (
        <>
          {data.unclassified_students > 0 && (
            <p className="flex items-start gap-2 rounded-control border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-2xs text-text-secondary">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
              {data.unclassified_students.toLocaleString("en-IN")} students have no department yet (independent sign-ups who have not answered the branch question). They are treated as Engineering until they do.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.departments.map((d) => {
              const style = accentStyle(d.accent);
              const on = selected === d.code;
              return (
                <button
                  key={d.code}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelected(d.code)}
                  className={cn(
                    "rounded-panel border bg-surface p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
                    on ? cn("border-transparent ring-2", style.ring) : "border-border-subtle hover:border-border-strong"
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", style.soft, style.text)}>
                      <DepartmentIcon name={d.icon} className="h-4.5 w-4.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-extrabold text-primary">{d.short}</span>
                      {!d.is_active && <span className="text-3xs font-bold uppercase text-status-warning">Inactive</span>}
                    </span>
                  </span>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                    {[
                      { k: "Students", v: d.students },
                      { k: "Colleges", v: d.colleges },
                      { k: "Branches", v: d.disciplines.reduce((n, x) => n + x.branches.length, 0) },
                    ].map((s) => (
                      <div key={s.k}>
                        <dd className="tabular text-base font-extrabold text-primary">{s.v.toLocaleString("en-IN")}</dd>
                        <dt className="text-3xs font-semibold uppercase tracking-wide text-text-muted">{s.k}</dt>
                      </div>
                    ))}
                  </dl>
                </button>
              );
            })}
            <AddDepartment
              data={data}
              busy={busy === "add-department"}
              onAdd={(body) => save("add-department", () => api.post("/superadmin/departments", body), "Department added.")}
            />
          </div>

          {dept && (
            <DepartmentEditor
              key={dept.code}
              dept={dept}
              registry={data.capability_registry}
              icons={data.icons}
              accents={data.accents}
              busy={busy}
              openDiscipline={openDiscipline}
              setOpenDiscipline={setOpenDiscipline}
              onSaveDepartment={(body) => save(`dept-${dept.code}`, () => api.put(`/superadmin/departments/${dept.code}`, body), `${dept.short} saved.`)}
              onSaveDiscipline={(code, body) => save(`disc-${code}`, () => api.put(`/superadmin/disciplines/${code}`, body), "Discipline saved.")}
              onSaveBranch={(code, body) => save(`branch-${code}`, () => api.put(`/superadmin/branches/${code}`, body), "Branch saved.")}
              onAddDiscipline={(body) => save("add-discipline", () => api.post("/superadmin/disciplines", { ...body, department_code: dept.code }), "Discipline added.")}
            />
          )}
        </>
      )}
    </div>
  );
}

// ───────────────────────────── add a department ─────────────────────────────

function AddDepartment({ data, busy, onAdd }: { data: DepartmentsResponse; busy: boolean; onAdd: (body: Record<string, unknown>) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", short: "", icon: "graduation-cap", accent: "teal" });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[7.5rem] flex-col items-center justify-center gap-1.5 rounded-panel border-2 border-dashed border-border-strong text-xs font-bold text-text-secondary transition-colors hover:border-accent-primary/50 hover:text-primary"
      >
        <Plus className="h-4 w-4" /> Add a department
      </button>
    );
  }

  const input = "w-full rounded-control border border-border-subtle bg-elevated px-2.5 py-1.5 text-xs text-primary";
  return (
    <form
      className="space-y-2 rounded-panel border border-border-subtle bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(form);
        setOpen(false);
      }}
    >
      <input aria-label="Department name" required placeholder="Name, e.g. Pharmacy" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, code: form.code || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 28) })} className={input} />
      <div className="grid grid-cols-2 gap-2">
        <input aria-label="Short name" required placeholder="Short name" value={form.short} onChange={(e) => setForm({ ...form, short: e.target.value })} className={input} />
        <input aria-label="Code" required placeholder="code_in_snake_case" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={cn(input, "font-mono")} />
        <select aria-label="Icon" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className={input}>
          {data.icons.map((i) => <option key={i}>{i}</option>)}
        </select>
        <select aria-label="Colour" value={form.accent} onChange={(e) => setForm({ ...form, accent: e.target.value })} className={input}>
          {data.accents.map((a) => <option key={a}>{a}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="text-2xs font-semibold text-text-muted hover:text-primary">Cancel</button>
        <button type="submit" disabled={busy} className="rounded-control bg-accent-primary px-3 py-1.5 text-2xs font-bold text-white disabled:opacity-50">Add</button>
      </div>
    </form>
  );
}

// ───────────────────────────── one department ─────────────────────────────

function DepartmentEditor({
  dept,
  registry,
  icons,
  accents,
  busy,
  openDiscipline,
  setOpenDiscipline,
  onSaveDepartment,
  onSaveDiscipline,
  onSaveBranch,
  onAddDiscipline,
}: {
  dept: AdminDepartment;
  registry: RegistryEntry[];
  icons: string[];
  accents: string[];
  busy: string | null;
  openDiscipline: string | null;
  setOpenDiscipline: (code: string | null) => void;
  onSaveDepartment: (body: Record<string, unknown>) => void;
  onSaveDiscipline: (code: string, body: Record<string, unknown>) => void;
  onSaveBranch: (code: string, body: Record<string, unknown>) => void;
  onAddDiscipline: (body: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    name: dept.name,
    short: dept.short,
    description: dept.description ?? "",
    icon: dept.icon,
    accent: dept.accent,
    is_active: dept.is_active,
    domain_prep_label: dept.settings.domain_prep_label ?? "",
    domain_prep_blurb: dept.settings.domain_prep_blurb ?? "",
  });
  const [caps, setCaps] = useState<CapMap>(dept.capabilities);
  const [addingDiscipline, setAddingDiscipline] = useState(false);
  const [newDiscipline, setNewDiscipline] = useState({ code: "", name: "", short: "" });

  const dirty =
    form.name !== dept.name ||
    form.short !== dept.short ||
    form.description !== (dept.description ?? "") ||
    form.icon !== dept.icon ||
    form.accent !== dept.accent ||
    form.is_active !== dept.is_active ||
    form.domain_prep_label !== (dept.settings.domain_prep_label ?? "") ||
    form.domain_prep_blurb !== (dept.settings.domain_prep_blurb ?? "") ||
    JSON.stringify(Object.entries(caps).sort()) !== JSON.stringify(Object.entries(dept.capabilities).sort());

  const input = "w-full rounded-control border border-border-subtle bg-elevated px-2.5 py-1.5 text-xs text-primary";
  const style = accentStyle(form.accent);

  return (
    <div className="space-y-5">
      <section className="rounded-panel border border-border-subtle bg-surface p-5" aria-label={`${dept.name} settings`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-primary">
            <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", style.soft, style.text)}>
              <DepartmentIcon name={form.icon} className="h-4 w-4" />
            </span>
            {dept.name}
          </h3>
          <label className="flex items-center gap-2 text-2xs font-semibold text-text-secondary">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-3.5 w-3.5" />
            Active (offered to colleges and students)
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-3xs font-bold uppercase tracking-wide text-text-muted">Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={cn(input, "mt-1 normal-case")} /></label>
          <label className="text-3xs font-bold uppercase tracking-wide text-text-muted">Short name<input value={form.short} onChange={(e) => setForm({ ...form, short: e.target.value })} className={cn(input, "mt-1 normal-case")} /></label>
          <label className="text-3xs font-bold uppercase tracking-wide text-text-muted">Icon
            <select value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className={cn(input, "mt-1 normal-case")}>{icons.map((i) => <option key={i}>{i}</option>)}</select>
          </label>
          <label className="text-3xs font-bold uppercase tracking-wide text-text-muted">Colour
            <select value={form.accent} onChange={(e) => setForm({ ...form, accent: e.target.value })} className={cn(input, "mt-1 normal-case")}>{accents.map((a) => <option key={a}>{a}</option>)}</select>
          </label>
          <label className="text-3xs font-bold uppercase tracking-wide text-text-muted sm:col-span-2">Description<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={cn(input, "mt-1 normal-case")} /></label>
          <label className="text-3xs font-bold uppercase tracking-wide text-text-muted">Domain Prep is called<input value={form.domain_prep_label} placeholder="e.g. Management Prep" onChange={(e) => setForm({ ...form, domain_prep_label: e.target.value })} className={cn(input, "mt-1 normal-case")} /></label>
          <label className="text-3xs font-bold uppercase tracking-wide text-text-muted">…and described as<input value={form.domain_prep_blurb} onChange={(e) => setForm({ ...form, domain_prep_blurb: e.target.value })} className={cn(input, "mt-1 normal-case")} /></label>
        </div>

        <h4 className="mt-6 text-xs font-extrabold text-primary">Modules students of this department see</h4>
        <p className="mt-0.5 text-2xs text-text-muted">“Default” uses the platform default shown in brackets. A discipline or a branch below can override what is set here.</p>
        <ul className="mt-3 divide-y divide-border-subtle rounded-panel border border-border-subtle">
          {registry.map((c) => {
            const effective = c.key in caps ? caps[c.key] : c.default;
            return (
              <li key={c.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1 basis-60">
                  <p className="text-xs font-bold text-primary">
                    {c.label} <span className={cn("ml-1 rounded-full px-1.5 py-px text-3xs font-bold", effective ? "bg-status-success/15 text-status-success" : "bg-status-danger/10 text-status-danger")}>{effective ? "Shown" : "Hidden"}</span>
                  </p>
                  <p className="text-3xs text-text-muted">{c.hint} (platform default: {c.default ? "on" : "off"})</p>
                </div>
                <TriSwitch label={c.label} value={toChoice(caps, c.key)} onChange={(v) => setCaps((cur) => withChoice(cur, c.key, v))} />
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex items-center justify-end gap-3">
          {!dirty && <span className="text-2xs text-text-muted">All changes saved</span>}
          <button
            type="button"
            disabled={!dirty || busy === `dept-${dept.code}`}
            onClick={() =>
              onSaveDepartment({
                name: form.name, short: form.short, description: form.description || null, icon: form.icon, accent: form.accent, is_active: form.is_active,
                capabilities: caps, settings: { domain_prep_label: form.domain_prep_label, domain_prep_blurb: form.domain_prep_blurb },
              })
            }
            className="inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-4 py-2 text-2xs font-bold text-white disabled:opacity-40"
          >
            {busy === `dept-${dept.code}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save department
          </button>
        </div>
      </section>

      <section className="rounded-panel border border-border-subtle bg-surface" aria-label={`${dept.short} programmes`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-5 py-3.5">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-primary"><Building2 className="h-4 w-4 text-accent-primary" /> Programmes in {dept.short}</h3>
          <button type="button" onClick={() => setAddingDiscipline((v) => !v)} className="inline-flex items-center gap-1 text-2xs font-bold text-accent-primary hover:underline"><Plus className="h-3.5 w-3.5" /> Add a discipline</button>
        </div>

        {addingDiscipline && (
          <form
            className="flex flex-wrap items-end gap-2 border-b border-border-subtle bg-elevated/40 px-5 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              onAddDiscipline(newDiscipline);
              setAddingDiscipline(false);
              setNewDiscipline({ code: "", name: "", short: "" });
            }}
          >
            <input aria-label="Discipline name" required placeholder="Name" value={newDiscipline.name} onChange={(e) => setNewDiscipline({ ...newDiscipline, name: e.target.value, code: newDiscipline.code || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 18) })} className={cn(input, "max-w-xs")} />
            <input aria-label="Discipline short name" required placeholder="Short" value={newDiscipline.short} onChange={(e) => setNewDiscipline({ ...newDiscipline, short: e.target.value })} className={cn(input, "max-w-[8rem]")} />
            <input aria-label="Discipline code" required placeholder="code" value={newDiscipline.code} onChange={(e) => setNewDiscipline({ ...newDiscipline, code: e.target.value })} className={cn(input, "max-w-[9rem] font-mono")} />
            <button type="submit" className="rounded-control bg-accent-primary px-3 py-1.5 text-2xs font-bold text-white">Add</button>
          </form>
        )}

        <ul className="divide-y divide-border-subtle">
          {dept.disciplines.map((d) => {
            const open = openDiscipline === d.code;
            const uncovered = d.branches.filter((b) => b.is_active && b.dedicated_questions === 0 && b.questions === 0).length;
            return (
              <li key={d.code}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenDiscipline(open ? null : d.code)}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-left transition-colors hover:bg-elevated/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-primary"
                >
                  <span className="min-w-0 flex-1 basis-56 text-sm font-bold text-primary">{d.name}</span>
                  <span className="tabular text-2xs text-text-muted">{d.students.toLocaleString("en-IN")} students</span>
                  <span className="tabular text-2xs text-text-muted">{d.branches.length} branches</span>
                  <span className="tabular text-2xs text-text-muted">{d.published_questions} questions</span>
                  {d.is_live && <span className="rounded-full bg-status-success/15 px-2 py-0.5 text-3xs font-bold text-status-success">Domain Prep live</span>}
                  {uncovered > 0 && <span className="rounded-full bg-status-warning/15 px-2 py-0.5 text-3xs font-bold text-status-warning">{uncovered} without questions</span>}
                </button>
                {open && (
                  <div className="space-y-3 border-t border-border-subtle bg-elevated/30 px-5 py-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-2xs font-bold uppercase tracking-wide text-text-muted">Override for the whole discipline:</span>
                      {registry.filter((c) => ["coding_practice", "domain_prep", "skill_drills"].includes(c.key)).map((c) => (
                        <span key={c.key} className="flex items-center gap-1.5 text-2xs text-text-secondary">
                          {c.label}
                          <TriSwitch label={`${d.name}: ${c.label}`} value={toChoice(d.capabilities, c.key)} disabled={busy === `disc-${d.code}`} onChange={(v) => onSaveDiscipline(d.code, { capabilities: withChoice(d.capabilities, c.key, v) })} />
                        </span>
                      ))}
                    </div>
                    <div className="overflow-x-auto rounded-panel border border-border-subtle bg-surface">
                      <table className="w-full text-left text-2xs">
                        <thead className="bg-elevated text-3xs font-bold uppercase tracking-wide text-text-muted">
                          <tr>
                            <th className="px-3 py-2">Branch</th>
                            <th className="px-3 py-2 text-right">Students</th>
                            <th className="px-3 py-2 text-right" title="Published questions this branch's own subjects hold">Own questions</th>
                            <th className="px-3 py-2 text-right" title="Everything its students are offered: shared subjects plus their own">Offered</th>
                            <th className="px-3 py-2">Coding practice</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle">
                          {d.branches.map((b) => (
                            <tr key={b.code} className={cn(!b.is_active && "opacity-50")}>
                              <td className="px-3 py-2 font-semibold text-primary">{b.name}<span className="ml-1.5 font-mono text-3xs font-normal text-text-muted">{b.code}</span></td>
                              <td className="tabular px-3 py-2 text-right">{b.students}</td>
                              <td className={cn("tabular px-3 py-2 text-right font-bold", b.dedicated_questions === 0 ? "text-status-warning" : "text-status-success")}>
                                {b.dedicated_questions === 0 ? "—" : <><Check className="mr-0.5 inline h-3 w-3" aria-hidden />{b.dedicated_questions}</>}
                              </td>
                              <td className="tabular px-3 py-2 text-right text-text-secondary">{b.questions}</td>
                              <td className="px-3 py-2">
                                <TriSwitch label={`${b.name}: coding practice`} value={toChoice(b.capabilities, "coding_practice")} disabled={busy === `branch-${b.code}`} onChange={(v) => onSaveBranch(b.code, { capabilities: withChoice(b.capabilities, "coding_practice", v) })} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
