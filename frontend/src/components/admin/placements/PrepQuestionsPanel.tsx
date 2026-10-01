"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AdminCompanyRow, AdminPrepQuestionRow, PREP_CATEGORIES, inputClass } from "./types";

interface PrepQuestionsPanelProps {
  companies: AdminCompanyRow[];
  onCompaniesChanged: () => void;
}

const emptyForm = {
  asked_year: new Date().getFullYear(),
  category: PREP_CATEGORIES[0] as (typeof PREP_CATEGORIES)[number],
  round_name: "",
  question: "",
  answer_notes: "",
};

export function PrepQuestionsPanel({ companies, onCompaniesChanged }: PrepQuestionsPanelProps) {
  const [companyId, setCompanyId] = useState<string>("");
  const [questions, setQuestions] = useState<AdminPrepQuestionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId && companies[0]) setCompanyId(String(companies[0].id));
  }, [companies, companyId]);

  const loadQuestions = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get<{ prep_questions: AdminPrepQuestionRow[] }>(`/admin/companies/${id}/prep-questions`);
      setQuestions(res.prep_questions);
    } catch {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuestions(companyId);
  }, [companyId, loadQuestions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/admin/companies/${companyId}/prep-questions`, form);
      setForm({ ...emptyForm, asked_year: form.asked_year });
      await loadQuestions(companyId);
      onCompaniesChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add question.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this prep question?")) return;
    try {
      await api.delete(`/admin/prep-questions/${id}`);
      await loadQuestions(companyId);
      onCompaniesChanged();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Failed to delete question.");
    }
  };

  const selectedCompany = companies.find((c) => String(c.id) === companyId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs font-semibold text-text-secondary">Company:</label>
        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={cn(inputClass, "w-auto min-w-[200px]")}>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={handleSubmit} className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-3 text-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Year</label>
            <input
              type="number"
              required
              value={form.asked_year}
              onChange={(e) => setForm({ ...form, asked_year: Number(e.target.value) })}
              className={inputClass}
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block font-semibold text-text-secondary mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as typeof form.category })}
              className={inputClass}
            >
              {PREP_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block font-semibold text-text-secondary mb-1">Round Name</label>
            <input
              value={form.round_name}
              onChange={(e) => setForm({ ...form, round_name: e.target.value })}
              placeholder="e.g. Technical Interview"
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label className="block font-semibold text-text-secondary mb-1">Question *</label>
          <textarea
            required
            rows={2}
            value={form.question}
            onChange={(e) => setForm({ ...form, question: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block font-semibold text-text-secondary mb-1">Answer / Notes</label>
          <textarea
            rows={2}
            value={form.answer_notes}
            onChange={(e) => setForm({ ...form, answer_notes: e.target.value })}
            className={inputClass}
          />
        </div>
        {error && <p className="text-2xs text-status-danger">{error}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || !companyId}
            className="flex items-center gap-1.5 px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-bold transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            <span>Add Question</span>
          </button>
        </div>
      </form>

      {loading ? (
        <div className="p-8 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading...
        </div>
      ) : questions.length === 0 ? (
        <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          No prep questions added for {selectedCompany?.name ?? "this company"} yet.
        </div>
      ) : (
        <div className="space-y-2.5">
          {questions.map((q) => (
            <div key={q.id} className="p-4 rounded-control bg-surface border border-border-subtle flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-accent-primary/10 text-accent-primary border border-accent-primary/25 text-3xs font-bold">
                    {q.category}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-elevated text-text-muted border border-border-subtle text-3xs font-bold">
                    {q.asked_year}
                  </span>
                  {q.round_name && <span className="text-3xs text-text-muted">{q.round_name}</span>}
                </div>
                <p className="text-xs font-semibold text-primary">{q.question}</p>
                {q.answer_notes && <p className="text-2xs text-text-secondary mt-1">{q.answer_notes}</p>}
              </div>
              <button
                onClick={() => handleDelete(q.id)}
                className="p-1.5 rounded text-text-muted hover:text-status-danger transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
