"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Mail, Phone, Plus, Search, Trash2, Trophy, UserCheck, Briefcase, Pencil } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { Modal } from "@/components/ui/Modal";
import { HpButton, HpCard, HpEmptyState, HpIconTile, HpItem, HpPill, HpSearch, HpSkeletonCards, HpStagger, HpStatCard, hpInput, hpLabel } from "@/components/portal/kit";
import { HpErrorCard, HpFormError } from "@/components/portal/pipeline-kit";
import { HpOverlayPortal } from "@/components/portal/cohortKit";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { confirmDialog } from "@/lib/dialogs";
import { toast } from "@/lib/toast";
import type { HpTone } from "@/components/portal/kit";

interface RecruiterContact {
  id: number;
  company_id: number;
  contact_name: string;
  designation: string | null;
  email: string | null;
  phone: string | null;
  relationship_status: "active" | "warm" | "inactive";
  notes: string | null;
  last_contacted_at: string | null;
}

interface RecruiterRow {
  company: {
    id: number;
    name: string;
    slug: string;
    website_url: string | null;
    industry: string | null;
    logo: string | null;
  };
  drives_count: number;
  last_drive_date: string | null;
  offers_accepted: number;
  joined_count: number;
  avg_ctc: number | null;
  highest_ctc: number | null;
  contacts: RecruiterContact[];
}

const STATUS_TONE: Record<RecruiterContact["relationship_status"], HpTone> = {
  active: "emerald",
  warm: "amber",
  inactive: "slate",
};

export default function RecruitersCrmPage() {
  const { status } = useAuthGuard(["admin_tpo"]);
  const [recruiters, setRecruiters] = useState<RecruiterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [contactModal, setContactModal] = useState<{ companyId: number; companyName: string; contact?: RecruiterContact } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ recruiters: RecruiterRow[] }>("/tpo/recruiters");
      setRecruiters(res.recruiters);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load recruiters directory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready") void load();
  }, [status, load]);

  if (status !== "ready") return <SessionLoader />;

  const deleteContact = async (c: RecruiterContact) => {
    if (!(await confirmDialog({ title: `Remove ${c.contact_name}?`, message: "This deletes the HR contact note from your campus CRM.", tone: "danger", confirmLabel: "Delete" }))) return;
    try {
      await api.delete(`/tpo/recruiters/contacts/${c.id}`);
      toast.success("Contact removed.");
      void load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove contact.");
    }
  };

  const q = query.trim().toLowerCase();
  const visible = recruiters.filter((r) => {
    if (!q) return true;
    return (
      r.company.name.toLowerCase().includes(q) ||
      (r.company.industry ?? "").toLowerCase().includes(q) ||
      r.contacts.some((c) => c.contact_name.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q))
    );
  });

  const totalOffers = recruiters.reduce((s, r) => s + r.offers_accepted, 0);
  const totalContacts = recruiters.reduce((s, r) => s + r.contacts.length, 0);
  const activePartners = recruiters.filter((r) => r.drives_count > 0 || r.contacts.some((c) => c.relationship_status === "active")).length;

  return (
    <DashboardShell
      role="admin_tpo"
      currentTpoView="tpo"
      title="Recruiter CRM"
      subtitle="Campus hiring partners, HR point-of-contacts, offer conversion history, and outreach notes."
    >
      <HpStagger className="space-y-6">
        <HpItem>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <HpStatCard label="Hiring Partners" value={recruiters.length} icon={Building2} tone="indigo" loading={loading} />
            <HpStatCard label="Active Accounts" value={activePartners} icon={Briefcase} tone="sky" loading={loading} />
            <HpStatCard label="Accepted Offers" value={totalOffers} icon={Trophy} tone="emerald" loading={loading} />
            <HpStatCard label="HR POCs On File" value={totalContacts} icon={UserCheck} tone="violet" loading={loading} />
          </div>
        </HpItem>

        <HpItem>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <HpSearch
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search company, industry or HR contact…"
              wrapperClassName="w-full sm:w-80"
            />
          </div>
        </HpItem>

        {error && (
          <HpItem>
            <HpErrorCard message={error} onRetry={load} />
          </HpItem>
        )}

        <HpItem>
          {loading ? (
            <HpSkeletonCards count={4} />
          ) : visible.length === 0 ? (
            <HpEmptyState
              icon={Building2}
              tone="indigo"
              title={recruiters.length === 0 ? "No recruiters yet" : "No recruiters match"}
              description={
                recruiters.length === 0
                  ? "Map or create a campus drive first — every recruiting partner automatically appears here with its drive history and HR contacts."
                  : "Try clearing your search filter."
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {visible.map((r) => (
                <HpCard key={r.company.id} className="flex flex-col justify-between p-5">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <CompanyLogo name={r.company.name} slug={r.company.slug} logo={r.company.logo} size="md" />
                        <div className="min-w-0">
                          <h3 className="truncate text-15 font-bold text-primary">{r.company.name}</h3>
                          <p className="truncate text-2xs text-text-muted">
                            {r.company.industry || "Campus hiring partner"}
                          </p>
                        </div>
                      </div>
                      <HpButton
                        size="sm"
                        variant="secondary"
                        leftIcon={<Plus className="h-3.5 w-3.5" />}
                        onClick={() => setContactModal({ companyId: r.company.id, companyName: r.company.name })}
                      >
                        Add POC
                      </HpButton>
                    </div>

                    <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border-subtle bg-elevated/40 p-3 text-center">
                      <div>
                        <div className="tabular text-base font-extrabold text-primary">{r.drives_count}</div>
                        <div className="text-3xs font-bold uppercase tracking-wider text-text-muted">Drives</div>
                      </div>
                      <div>
                        <div className="tabular text-base font-extrabold text-emerald-700 dark:text-emerald-300">{r.offers_accepted}</div>
                        <div className="text-3xs font-bold uppercase tracking-wider text-text-muted">Offers</div>
                      </div>
                      <div>
                        <div className="tabular text-base font-extrabold text-primary">
                          {r.highest_ctc ? `${r.highest_ctc} LPA` : "—"}
                        </div>
                        <div className="text-3xs font-bold uppercase tracking-wider text-text-muted">Top CTC</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-3xs font-bold uppercase tracking-wider text-text-muted">HR / TA Contacts</p>
                      {r.contacts.length === 0 ? (
                        <p className="text-2xs italic text-text-muted">No POC saved yet — click &quot;Add POC&quot; to record recruiter phone/email &amp; outreach notes.</p>
                      ) : (
                        <ul className="space-y-2">
                          {r.contacts.map((c) => (
                            <li key={c.id} className="rounded-xl border border-border-subtle bg-elevated/30 p-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-primary">{c.contact_name}</span>
                                    <HpPill tone={STATUS_TONE[c.relationship_status]} size="sm" className="capitalize">
                                      {c.relationship_status}
                                    </HpPill>
                                  </div>
                                  {c.designation && <p className="text-3xs text-text-muted">{c.designation}</p>}
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    aria-label={`Edit ${c.contact_name}`}
                                    onClick={() => setContactModal({ companyId: r.company.id, companyName: r.company.name, contact: c })}
                                    className="rounded-lg p-1 text-text-muted hover:bg-elevated hover:text-primary"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Delete ${c.contact_name}`}
                                    onClick={() => void deleteContact(c)}
                                    className="rounded-lg p-1 text-text-muted hover:bg-rose-500/10 hover:text-status-danger"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-2xs text-text-secondary">
                                {c.email && (
                                  <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:underline">
                                    <Mail className="h-3 w-3 text-text-muted" />
                                    {c.email}
                                  </a>
                                )}
                                {c.phone && (
                                  <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:underline">
                                    <Phone className="h-3 w-3 text-text-muted" />
                                    {c.phone}
                                  </a>
                                )}
                              </div>
                              {c.notes && <p className="mt-1.5 text-2xs text-text-muted">{c.notes}</p>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </HpCard>
              ))}
            </div>
          )}
        </HpItem>
      </HpStagger>

      {contactModal && (
        <ContactModal
          companyId={contactModal.companyId}
          companyName={contactModal.companyName}
          existing={contactModal.contact}
          onClose={() => setContactModal(null)}
          onSaved={() => {
            setContactModal(null);
            void load();
          }}
        />
      )}
    </DashboardShell>
  );
}

function ContactModal({
  companyId,
  companyName,
  existing,
  onClose,
  onSaved,
}: {
  companyId: number;
  companyName: string;
  existing?: RecruiterContact;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(existing?.contact_name ?? "");
  const [designation, setDesignation] = useState(existing?.designation ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [relStatus, setRelStatus] = useState<RecruiterContact["relationship_status"]>(existing?.relationship_status ?? "active");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      company_id: companyId,
      contact_name: name.trim(),
      designation: designation.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      relationship_status: relStatus,
      notes: notes.trim() || null,
      last_contacted_at: new Date().toISOString(),
    };
    try {
      if (existing) {
        await api.put(`/tpo/recruiters/contacts/${existing.id}`, payload);
        toast.success("HR contact updated.");
      } else {
        await api.post("/tpo/recruiters/contacts", payload);
        toast.success("HR contact saved.");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save contact.");
      setSaving(false);
    }
  };

  return (
    <HpOverlayPortal>
      <Modal
        onClose={() => !saving && onClose()}
        title={existing ? "Edit Recruiter Contact" : "Add Recruiter Contact"}
        subtitle={companyName}
        icon={Building2}
        size="md"
        variant="premium"
        footer={
          <>
            <HpButton type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</HpButton>
            <HpButton type="submit" form="recruiter-contact-form" isLoading={saving}>Save Contact</HpButton>
          </>
        }
      >
        <form id="recruiter-contact-form" onSubmit={submit} className="space-y-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="rc-name" className={hpLabel}>Name *</label>
              <input id="rc-name" required value={name} onChange={(e) => setName(e.target.value)} className={hpInput} />
            </div>
            <div>
              <label htmlFor="rc-desig" className={hpLabel}>Role / Title</label>
              <input id="rc-desig" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Campus TA Lead" className={hpInput} />
            </div>
            <div>
              <label htmlFor="rc-email" className={hpLabel}>Email</label>
              <input id="rc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={hpInput} />
            </div>
            <div>
              <label htmlFor="rc-phone" className={hpLabel}>Phone</label>
              <input id="rc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={hpInput} />
            </div>
          </div>
          <div>
            <label htmlFor="rc-status" className={hpLabel}>Relationship Status</label>
            <select id="rc-status" value={relStatus} onChange={(e) => setRelStatus(e.target.value as RecruiterContact["relationship_status"])} className={hpInput}>
              <option value="active">Active Hiring</option>
              <option value="warm">Warm / Follow-up</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label htmlFor="rc-notes" className={hpLabel}>Outreach Notes</label>
            <textarea id="rc-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Preferred intake months, panel requirements, historical feedback…" className={hpInput} />
          </div>
          {error && <HpFormError>{error}</HpFormError>}
        </form>
      </Modal>
    </HpOverlayPortal>
  );
}
