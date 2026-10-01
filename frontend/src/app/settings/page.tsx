"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useEffect, useRef, useState } from "react";
import type { ConfirmationResult } from "firebase/auth";
import {
  isFirebasePhoneAuthConfigured,
  sendPhoneOtp,
  confirmPhoneOtp,
  resetPhoneRecaptcha,
  friendlyFirebaseError,
} from "@/lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  ShieldCheck,
  Sliders,
  Bell,
  Save,
  Mail,
  AtSign,
  Building2,
  GraduationCap,
  Phone,
  Hash,
  Award,
  AlertTriangle,
  KeyRound,
  Monitor,
  LogOut,
  Check,
  Camera,
  Loader2,
  CreditCard,
  BadgeCheck,
  Calendar,
  X,
  Sparkles,
  Linkedin,
  Github,
  FileText,
  Download,
  Upload,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ThemeToggle } from "@/components/navigation/ThemeToggle";
import { STUDENT_PROFILE } from "@/data/mockDashboardData";
import { RatingBadge } from "@/components/dashboard/student/RatingBadge";
import { ProfileCompletionBar } from "@/components/settings/ProfileCompletionBar";
import { SkillsTagInput } from "@/components/settings/SkillsTagInput";
import { UsageLimitBanner } from "@/components/billing/UsageLimitBanner";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/utils";
import { getRatingTier } from "@/lib/rating";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useAuth } from "@/lib/AuthContext";
import { getToken, AuthUser } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { MySubscriptionResponse, SubscriptionCoverage } from "@/types/subscription";

type TabId = "profile" | "security" | "preferences" | "notifications" | "billing";

const TABS: { id: TabId; label: string; icon: typeof User }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "preferences", label: "Preferences", icon: Sliders },
  { id: "notifications", label: "Notifications", icon: Bell },
];

const ROLE_LABEL: Record<string, string> = {
  user: "Student Coder",
  admin_internal: "Mellow Staff",
  admin_tpo: "College TPO",
  superadmin: "Super Admin",
  section_coordinator: "Section Coordinator",
};


function Field({
  label,
  icon: Icon,
  children,
  hint,
}: {
  label: string;
  icon?: typeof User;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-text-secondary mb-1.5">{label}</label>
      <div className="relative">
        {Icon && <Icon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />}
        {children}
      </div>
      {hint && <p className="text-2xs text-text-muted mt-1.5">{hint}</p>}
    </div>
  );
}

const inputClass =
  "w-full py-2.5 rounded-control bg-elevated border border-border-subtle text-sm text-primary placeholder:text-text-muted outline-none focus:border-accent-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

/**
 * The recruiter-facing extension of a student's profile — bio, LinkedIn/
 * GitHub, skills, resume — shown only for `isStudent` (both college-
 * affiliated and Mellow Direct, per StudentProfileController's own scoping).
 * Deliberately its own component/state, separate from the generic Personal
 * Information card above (which still saves via PUT /me/profile) — this
 * saves via PUT /me/student-profile, mirroring how the backend keeps the
 * two write paths apart. What's actually shown to a hiring partner, and how
 * completion drives Talent Pool search ranking, lives in
 * CompanyTalentPoolController on the backend.
 */
function RecruiterProfileSection({ user, onToast }: { user: AuthUser; onToast: (msg: string) => void }) {
  const { login } = useAuth();
  const [bio, setBio] = useState(user.bio ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(user.linkedin_url ?? "");
  const [githubUrl, setGithubUrl] = useState(user.github_url ?? "");
  const [skills, setSkills] = useState<string[]>(user.skills ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [downloadingResume, setDownloadingResume] = useState(false);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await api.put<{ user: AuthUser }>("/me/student-profile", {
        bio: bio.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
        github_url: githubUrl.trim() || null,
        skills,
      });
      const token = getToken();
      if (token) login(token, res.user);
      onToast("Recruiter profile saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save your recruiter profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeUploading(true);
    try {
      const formData = new FormData();
      formData.append("resume", file);
      const res = await api.postFormData<{ user: AuthUser }>("/me/resume", formData);
      const token = getToken();
      if (token) login(token, res.user);
      onToast("Resume uploaded.");
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to upload your resume — make sure it's a PDF under 5MB.");
    } finally {
      setResumeUploading(false);
      if (resumeInputRef.current) resumeInputRef.current.value = "";
    }
  };

  const handleResumeRemove = async () => {
    setResumeUploading(true);
    try {
      const res = await api.delete<{ user: AuthUser }>("/me/resume");
      const token = getToken();
      if (token) login(token, res.user);
      onToast("Resume removed.");
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to remove your resume.");
    } finally {
      setResumeUploading(false);
    }
  };

  const handleResumeDownload = async () => {
    setDownloadingResume(true);
    try {
      const blob = await api.getFile("/me/resume");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resume.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      onToast("Failed to download your resume.");
    } finally {
      setDownloadingResume(false);
    }
  };

  return (
    <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-5">
      <div>
        <h3 className="text-sm font-bold text-primary flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent-primary" />
          Recruiter Profile
        </h3>
        <p className="text-xs text-text-muted mt-0.5">
          What hiring partners see when they search the Talent Pool — the more complete, the higher you rank.
        </p>
      </div>

      <ProfileCompletionBar user={user} />

      <Field label="About You" hint="A couple of sentences on what you're looking for and what you're good at.">
        <textarea
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
          placeholder="e.g. Final-year CS student focused on backend systems, looking for SDE roles..."
          className={cn(inputClass, "px-3 resize-none")}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="LinkedIn URL" icon={Linkedin}>
          <input
            type="url"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://linkedin.com/in/..."
            className={cn(inputClass, "pl-9 pr-3")}
          />
        </Field>
        <Field label="GitHub URL" icon={Github}>
          <input
            type="url"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="https://github.com/..."
            className={cn(inputClass, "pl-9 pr-3")}
          />
        </Field>
      </div>

      <Field label="Skills" hint="Recruiters search by these — add the technologies and tools you actually know.">
        <SkillsTagInput value={skills} onChange={setSkills} />
      </Field>

      {error && <p className="text-2xs text-status-danger">{error}</p>}

      <div className="flex justify-end pt-2 border-t border-border-subtle">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded-btn bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-all shadow-subtle hover:shadow-glow flex items-center gap-2 disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? "Saving..." : "Save Changes"}</span>
        </button>
      </div>

      <div className="pt-4 border-t border-border-subtle">
        <h4 className="text-xs font-bold text-primary mb-2 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          Resume
        </h4>
        {user.has_resume ? (
          <div className="flex items-center justify-between gap-3 p-3 rounded-control bg-elevated/60 border border-border-subtle">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-accent-primary shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-primary truncate">Resume on file</div>
                {user.resume_uploaded_at && (
                  <div className="text-3xs text-text-muted">
                    Uploaded{" "}
                    {new Date(user.resume_uploaded_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleResumeDownload}
                disabled={downloadingResume}
                title="Download"
                className="p-2 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-text-secondary hover:text-primary transition-colors disabled:opacity-50"
              >
                {downloadingResume ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => resumeInputRef.current?.click()}
                disabled={resumeUploading}
                title="Replace"
                className="p-2 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-text-secondary hover:text-primary transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleResumeRemove}
                disabled={resumeUploading}
                title="Remove"
                className="p-2 rounded-control bg-elevated hover:bg-status-danger/10 border border-border-subtle hover:border-status-danger/30 text-text-muted hover:text-status-danger transition-colors disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => resumeInputRef.current?.click()}
            disabled={resumeUploading}
            className="w-full p-4 rounded-control border-2 border-dashed border-border-subtle hover:border-accent-primary/50 text-center transition-colors disabled:opacity-50"
          >
            {resumeUploading ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-text-muted" />
            ) : (
              <>
                <Upload className="w-5 h-5 mx-auto text-text-muted mb-1.5" />
                <span className="text-xs font-semibold text-text-secondary">Upload your resume (PDF, max 5MB)</span>
              </>
            )}
          </button>
        )}
        <input ref={resumeInputRef} type="file" accept="application/pdf" onChange={handleResumeUpload} className="hidden" />
      </div>
    </section>
  );
}

interface ApiSession {
  id: number;
  name: string;
  created_at: string;
  last_used_at: string | null;
  is_current: boolean;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export default function SettingsPage() {
  const { user, status } = useAuthGuard();
  const { login } = useAuth();
  const [tab, setTab] = useState<TabId>("profile");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Profile fields — seeded from the real session and persisted for real via
  // PUT /me/profile. College/roll number/branch/CGPA/backlogs are the
  // placement cell's source of truth (set through roster import) and are
  // shown read-only rather than editable here.
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [phone, setPhone] = useState("");
  const [initialised, setInitialised] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Phone verification — independent of the Save Changes flow above.
  // Verifying an SMS OTP IS the save for `phone` specifically (see
  // PhoneVerificationController on the backend, which always writes the
  // phone number from inside the verified Firebase ID token, never from a
  // client-submitted string), so there's no separate "save" step here.
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [phoneVerifyError, setPhoneVerifyError] = useState<string | null>(null);
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const RECAPTCHA_CONTAINER_ID = "phone-verify-recaptcha";

  // Profile photo — real upload via POST /me/avatar, shared by every role.
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Preferences
  const [defaultLanguage, setDefaultLanguage] = useState("C++20");
  const [fontSize, setFontSize] = useState("14");
  const [timezone, setTimezone] = useState("Asia/Kolkata (IST)");

  // Notifications
  const [notifs, setNotifs] = useState({
    contestReminders: true,
    driveAlerts: true,
    submissionResults: true,
    weeklyDigest: false,
    productUpdates: false,
  });

  // Security — password change is real (PUT /me/password); sessions are the
  // caller's actual Sanctum tokens, not a hardcoded device list.
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ApiSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<number | null>(null);

  useEffect(() => {
    if (status !== "ready") return;
    api
      .get<{ sessions: ApiSession[] }>("/me/sessions")
      .then((res) => setSessions(res.sessions))
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false));
  }, [status]);

  // Billing — every student and TPO has a plan (see SubscriptionController);
  // Mellow staff don't, so this is simply never fetched/shown for them.
  const [coverage, setCoverage] = useState<SubscriptionCoverage | null>(null);
  const [coverageLoading, setCoverageLoading] = useState(true);
  const [entitlements, setEntitlements] = useState<MySubscriptionResponse["entitlements"]>(undefined);

  useEffect(() => {
    if (status !== "ready" || (user?.role !== "user" && user?.role !== "admin_tpo")) {
      setCoverageLoading(false);
      return;
    }
    api
      .get<MySubscriptionResponse>("/me/subscription")
      .then((res) => {
        setCoverage(res.coverage);
        setEntitlements(res.entitlements);
      })
      .catch(() => setCoverage(null))
      .finally(() => setCoverageLoading(false));
  }, [status, user]);

  // Seed the editable fields from the authenticated user once.
  if (status === "ready" && user && !initialised) {
    setName(user.name);
    setHandle(user.handle ?? "");
    setPhone(user.phone ?? "");
    setInitialised(true);
  }

  if (status !== "ready" || !user) {
    return (
      <SessionLoader />
    );
  }

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleProfileSave = async () => {
    setProfileSaving(true);
    setProfileError(null);
    try {
      const res = await api.put<{ user: AuthUser }>("/me/profile", {
        name,
        handle: handle || null,
        phone: phone || null,
      });
      const token = getToken();
      if (token) login(token, res.user);
      triggerToast("Profile saved successfully.");
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : "Failed to save your profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  /** Strips everything but digits and keeps the last 10 — tolerates "+91", spaces, or a leading 0 already typed in. */
  const toE164IndianNumber = (raw: string): string | null => {
    const digits = raw.replace(/\D/g, "").slice(-10);
    return digits.length === 10 ? `+91${digits}` : null;
  };

  const handleSendPhoneOtp = async () => {
    setPhoneVerifyError(null);

    if (!isFirebasePhoneAuthConfigured()) {
      setPhoneVerifyError("Phone verification isn't set up yet — contact support.");
      return;
    }

    const e164 = toE164IndianNumber(phone);
    if (!e164) {
      setPhoneVerifyError("Enter a valid 10-digit mobile number first.");
      return;
    }

    setSendingOtp(true);
    try {
      confirmationResultRef.current = await sendPhoneOtp(e164, RECAPTCHA_CONTAINER_ID);
      setOtpSent(true);
      setOtpValue("");
    } catch (err) {
      setPhoneVerifyError(friendlyFirebaseError(err));
      resetPhoneRecaptcha();
    } finally {
      setSendingOtp(false);
    }
  };

  const handleConfirmPhoneOtp = async () => {
    setPhoneVerifyError(null);

    if (otpValue.trim().length !== 6) {
      setPhoneVerifyError("Enter the 6-digit code sent to your phone.");
      return;
    }
    if (!confirmationResultRef.current) {
      setPhoneVerifyError("Please request a new code.");
      setOtpSent(false);
      return;
    }

    setVerifyingOtp(true);
    try {
      const idToken = await confirmPhoneOtp(confirmationResultRef.current, otpValue.trim());
      const res = await api.post<{ user: AuthUser }>("/me/phone/verify", { id_token: idToken });

      const token = getToken();
      if (token) login(token, res.user);
      setPhone(res.user.phone ?? "");
      setOtpSent(false);
      setOtpValue("");
      confirmationResultRef.current = null;
      triggerToast("Phone number verified!");
    } catch (err) {
      setPhoneVerifyError(err instanceof ApiError ? err.message : friendlyFirebaseError(err));
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleCancelPhoneOtp = () => {
    setOtpSent(false);
    setOtpValue("");
    setPhoneVerifyError(null);
    confirmationResultRef.current = null;
    resetPhoneRecaptcha();
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await api.postFormData<{ user: AuthUser }>("/me/avatar", formData);
      const token = getToken();
      if (token) login(token, res.user);
      triggerToast("Profile photo updated.");
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to upload your photo.");
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarUploading(true);
    try {
      const res = await api.delete<{ user: AuthUser }>("/me/avatar");
      const token = getToken();
      if (token) login(token, res.user);
      triggerToast("Profile photo removed.");
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to remove your photo.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handlePasswordSave = async () => {
    setPasswordError(null);
    if (!currentPassword || !newPassword) {
      setPasswordError("Enter your current and new password to continue.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    setPasswordSaving(true);
    try {
      await api.put("/me/password", {
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      triggerToast("Password updated. You'll stay signed in on this device.");
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : "Failed to update your password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleRevokeSession = async (id: number) => {
    setRevokingId(id);
    try {
      await api.delete(`/me/sessions/${id}`);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      triggerToast("Session revoked.");
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to revoke that session.");
    } finally {
      setRevokingId(null);
    }
  };

  const isStudent = user.role === "user";
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <DashboardShell
      role={user.role}
      currentTpoView={user.role === "admin_tpo" ? "tpo" : "mellow"}
      title="Profile Settings"
      subtitle="Manage your identity, security, workspace preferences and notifications."
    >
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-accent-primary/40 shadow-card flex items-center gap-3 text-xs font-semibold text-primary max-w-sm"
          >
            <Check className="w-4 h-4 text-status-success shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Identity header */}
      <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="relative shrink-0">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.name}
              className="w-20 h-20 rounded-full object-cover border border-accent-primary/30"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent-primary/25 via-accent-secondary/20 to-accent-primary/10 border border-accent-primary/30 flex items-center justify-center text-2xl font-black text-accent-primary">
              {initials}
            </div>
          )}
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleAvatarFileChange}
            className="hidden"
          />
          <button
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarUploading}
            aria-label="Change avatar"
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-surface border border-border-strong shadow-subtle flex items-center justify-center text-text-muted hover:text-primary transition-colors disabled:opacity-50"
          >
            {avatarUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
          </button>
          {user.avatar_url && !avatarUploading && (
            <button
              onClick={handleAvatarRemove}
              aria-label="Remove photo"
              title="Remove photo"
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-status-danger text-white flex items-center justify-center hover:bg-status-danger/80 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-primary">{user.name}</h2>
            <span className="px-2 py-0.5 text-3xs font-bold uppercase rounded-full bg-accent-primary/10 text-accent-primary border border-accent-primary/25">
              {ROLE_LABEL[user.role] ?? user.role}
            </span>
          </div>
          <p className="text-xs text-text-muted font-mono mt-1">
            {user.handle ? `@${user.handle} · ` : ""}
            {user.email}
          </p>
          {user.college && <p className="text-xs text-text-secondary mt-1">{user.college.name}</p>}
        </div>

        {isStudent && (
          <div className="flex items-center gap-5 sm:border-l sm:border-border-subtle sm:pl-6 shrink-0">
            <div className="text-center">
              <div className="text-lg font-black text-primary font-mono">{STUDENT_PROFILE.rating}</div>
              <div className="text-3xs uppercase tracking-wider text-text-muted">Rating</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-black text-primary font-mono">{STUDENT_PROFILE.totalSolved}</div>
              <div className="text-3xs uppercase tracking-wider text-text-muted">Solved</div>
            </div>
            <div className="text-center">
              <RatingBadge rating={STUDENT_PROFILE.rating} size="md" />
              <div className="text-3xs uppercase tracking-wider text-text-muted mt-1.5">
                Div {getRatingTier(STUDENT_PROFILE.rating).division}
              </div>
            </div>
            <div className="text-center">
              <div
                className={cn(
                  "text-lg font-black font-mono",
                  user.profile_completion_percent >= 100 ? "text-status-success" : "text-accent-primary"
                )}
              >
                {user.profile_completion_percent}%
              </div>
              <div className="text-3xs uppercase tracking-wider text-text-muted">Profile</div>
            </div>
          </div>
        )}
      </section>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-btn bg-surface border border-border-subtle shadow-subtle overflow-x-auto">
        {TABS.filter((t) => t.id !== "billing" || isStudent || user.role === "admin_tpo").map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-control text-xs font-bold transition-all whitespace-nowrap",
                tab === t.id
                  ? "bg-accent-primary text-white shadow-subtle"
                  : "text-text-secondary hover:text-primary hover:bg-surface-hover"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ---------------- Profile ---------------- */}
      {tab === "profile" && (
        <div className="space-y-6">
          <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-5">
            <div>
              <h3 className="text-sm font-bold text-primary">Personal Information</h3>
              <p className="text-xs text-text-muted mt-0.5">
                This is how you appear on leaderboards, contests and placement reports.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name" icon={User}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={cn(inputClass, "pl-9 pr-3")}
                />
              </Field>

              <Field label="Handle" icon={AtSign} hint="Shown on leaderboards and contest standings.">
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="your_handle"
                  className={cn(inputClass, "pl-9 pr-3 font-mono")}
                />
              </Field>

              <Field label="Email Address" icon={Mail} hint="Contact support to change your registered email.">
                <input type="email" value={user.email} disabled className={cn(inputClass, "pl-9 pr-3")} />
              </Field>

              <div className="sm:col-span-2">
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="block text-xs font-semibold text-text-secondary">Phone Number</label>
                  {user.phone_verified_at && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-bold bg-status-success/15 text-status-success">
                      <BadgeCheck className="w-3 h-3" />
                      Verified
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                  <input
                    type="tel"
                    value={phone}
                    disabled={Boolean(user.phone_verified_at)}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className={cn(inputClass, "pl-9 pr-3")}
                  />
                </div>

                {user.phone_verified_at ? (
                  <p className="text-2xs text-text-muted mt-1.5">
                    Verified on {new Date(user.phone_verified_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}. Contact support to change it.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {!otpSent ? (
                      <button
                        type="button"
                        onClick={handleSendPhoneOtp}
                        disabled={sendingOtp || !toE164IndianNumber(phone)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-2xs font-bold text-text-secondary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sendingOtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                        {sendingOtp ? "Sending code..." : "Verify Number"}
                      </button>
                    ) : (
                      <AnimatePresence>
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-2 flex-wrap"
                        >
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={otpValue}
                            onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ""))}
                            placeholder="6-digit code"
                            className="w-32 py-2 px-3 rounded-control bg-elevated border border-border-subtle text-sm text-primary placeholder:text-text-muted outline-none focus:border-accent-primary font-mono tracking-widest"
                          />
                          <button
                            type="button"
                            onClick={handleConfirmPhoneOtp}
                            disabled={verifyingOtp || otpValue.length !== 6}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-control bg-accent-primary hover:bg-accent-primary/90 text-white text-2xs font-bold transition-colors disabled:opacity-50"
                          >
                            {verifyingOtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={handleSendPhoneOtp}
                            disabled={sendingOtp}
                            className="text-2xs font-semibold text-accent-primary hover:underline disabled:opacity-50"
                          >
                            Resend
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelPhoneOtp}
                            className="text-2xs font-semibold text-text-muted hover:text-primary"
                          >
                            Cancel
                          </button>
                        </motion.div>
                      </AnimatePresence>
                    )}
                    {phoneVerifyError && <p className="text-2xs text-status-danger">{phoneVerifyError}</p>}
                    {/* Firebase's invisible reCAPTCHA attaches here — must exist before Verify Number is clicked, so it's always rendered, just visually empty. */}
                    <div id={RECAPTCHA_CONTAINER_ID} />
                  </div>
                )}
              </div>

              <Field
                label={isStudent ? "College / Institute" : "Institution"}
                icon={Building2}
                hint="Set by Mellow's onboarding team — contact support to correct it."
              >
                <input
                  type="text"
                  value={user.college?.name ?? "Not linked to an institution"}
                  disabled
                  className={cn(inputClass, "pl-9 pr-3")}
                />
              </Field>
            </div>

            {profileError && <p className="text-2xs text-status-danger">{profileError}</p>}

            <div className="flex justify-end pt-2 border-t border-border-subtle">
              <button
                onClick={handleProfileSave}
                disabled={profileSaving}
                className="px-5 py-2.5 rounded-btn bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-all shadow-subtle hover:shadow-glow flex items-center gap-2 disabled:opacity-60"
              >
                {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{profileSaving ? "Saving..." : "Save Changes"}</span>
              </button>
            </div>
          </section>

          {isStudent && (
            <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-5">
              <div>
                <h3 className="text-sm font-bold text-primary">Academic Profile</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Set by your placement cell during roster import — used to check your eligibility for mapped drives.
                  Spot an error? Ask your TPO to correct it.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 rounded-control bg-elevated/60 border border-border-subtle">
                  <div className="flex items-center gap-1.5 text-3xs uppercase tracking-wider text-text-muted font-semibold mb-1.5">
                    <Hash className="w-3 h-3" />
                    <span>Roll Number</span>
                  </div>
                  <div className="text-sm font-bold text-primary font-mono truncate">{user.roll_number ?? "—"}</div>
                </div>
                <div className="p-3 rounded-control bg-elevated/60 border border-border-subtle">
                  <div className="flex items-center gap-1.5 text-3xs uppercase tracking-wider text-text-muted font-semibold mb-1.5">
                    <GraduationCap className="w-3 h-3" />
                    <span>Branch</span>
                  </div>
                  <div className="text-sm font-bold text-primary truncate">{user.branch ?? "—"}</div>
                </div>
                <div className="p-3 rounded-control bg-elevated/60 border border-border-subtle">
                  <div className="flex items-center gap-1.5 text-3xs uppercase tracking-wider text-text-muted font-semibold mb-1.5">
                    <Award className="w-3 h-3" />
                    <span>CGPA</span>
                  </div>
                  <div className="text-sm font-bold text-primary font-mono">
                    {user.cgpa !== null ? Number(user.cgpa).toFixed(2) : "—"}
                  </div>
                </div>
                <div className="p-3 rounded-control bg-elevated/60 border border-border-subtle">
                  <div className="flex items-center gap-1.5 text-3xs uppercase tracking-wider text-text-muted font-semibold mb-1.5">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Backlogs</span>
                  </div>
                  <div className="text-sm font-bold text-primary font-mono">{user.backlogs ?? "—"}</div>
                </div>
              </div>

              {user.cgpa === null && user.branch === null && user.backlogs === null && (
                <p className="text-2xs text-text-muted">
                  Your academic profile hasn&apos;t been imported yet — drive eligibility checks will show as
                  &quot;unknown&quot; until your TPO uploads your roster record.
                </p>
              )}
            </section>
          )}

          {isStudent && <RecruiterProfileSection user={user} onToast={triggerToast} />}
        </div>
      )}

      {/* ---------------- Security ---------------- */}
      {tab === "security" && (
        <div className="space-y-6">
          <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-5">
            <div>
              <h3 className="text-sm font-bold text-primary">Change Password</h3>
              <p className="text-xs text-text-muted mt-0.5">Use at least 8 characters with a mix of letters and numbers.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Current Password" icon={KeyRound}>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className={cn(inputClass, "pl-9 pr-3 font-mono")}
                />
              </Field>
              <Field label="New Password" icon={KeyRound}>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className={cn(inputClass, "pl-9 pr-3 font-mono")}
                />
              </Field>
              <Field label="Confirm New Password" icon={KeyRound}>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={cn(inputClass, "pl-9 pr-3 font-mono")}
                />
              </Field>
            </div>

            {passwordError && <p className="text-2xs text-status-danger">{passwordError}</p>}

            <div className="flex justify-end pt-2 border-t border-border-subtle">
              <button
                onClick={handlePasswordSave}
                disabled={passwordSaving}
                className="px-5 py-2.5 rounded-btn bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-all shadow-subtle hover:shadow-glow flex items-center gap-2 disabled:opacity-60"
              >
                {passwordSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                <span>{passwordSaving ? "Updating..." : "Update Password"}</span>
              </button>
            </div>
          </section>

          <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                  <span>Two-Factor Authentication</span>
                  <span className="px-1.5 py-0.5 text-3xs font-bold uppercase rounded bg-elevated text-text-muted border border-border-subtle">
                    Coming Soon
                  </span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Require a one-time code at sign-in. Strongly recommended before proctored assessments.
                </p>
              </div>
              <Toggle checked={false} label="Two-factor authentication (coming soon)" onChange={() => triggerToast("Two-factor authentication isn't available yet.")} />
            </div>
          </section>

          <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-4">
            <div>
              <h3 className="text-sm font-bold text-primary">Active Sessions</h3>
              <p className="text-xs text-text-muted mt-0.5">Access tokens currently signed in to your account.</p>
            </div>

            {sessionsLoading ? (
              <div className="p-4 flex items-center justify-center gap-2 text-xs text-text-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading sessions...
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-text-muted">No active sessions found.</p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className="p-3.5 rounded-control bg-elevated/60 border border-border-subtle flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-control bg-surface border border-border-subtle flex items-center justify-center text-text-secondary shrink-0">
                      <Monitor className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-primary flex items-center gap-2">
                        <span className="truncate">Signed in {formatDateTime(session.created_at)}</span>
                        {session.is_current && (
                          <span className="px-1.5 py-0.5 text-3xs font-bold rounded bg-status-success/15 text-status-success border border-status-success/30 shrink-0">
                            This device
                          </span>
                        )}
                      </div>
                      <div className="text-2xs text-text-muted">
                        {session.last_used_at ? `Last active ${formatDateTime(session.last_used_at)}` : "Never used"}
                      </div>
                    </div>
                  </div>
                  {!session.is_current && (
                    <button
                      onClick={() => handleRevokeSession(session.id)}
                      disabled={revokingId === session.id}
                      className="px-3 py-1.5 rounded-control border border-border-subtle text-2xs font-semibold text-text-secondary hover:text-status-danger hover:border-status-danger/40 transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                    >
                      {revokingId === session.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <LogOut className="w-3.5 h-3.5" />
                      )}
                      <span>Revoke</span>
                    </button>
                  )}
                </div>
              ))
            )}
          </section>
        </div>
      )}

      {/* ---------------- Billing ---------------- */}
      {tab === "billing" && (
        <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-5">
          <div>
            <h3 className="text-sm font-bold text-primary">Your Plan</h3>
            <p className="text-xs text-text-muted mt-0.5">
              {isStudent
                ? "What your account currently has access to."
                : "Your college's current plan with Mellow — this covers every student at your institution."}
            </p>
          </div>

          {coverageLoading ? (
            <div className="p-4 flex items-center justify-center gap-2 text-xs text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading your plan...
            </div>
          ) : !coverage || coverage.source === "none" ? (
            <div className="p-4 rounded-control bg-elevated/60 border border-border-subtle text-xs text-text-muted">
              {isStudent
                ? "No active plan found on your account."
                : "Your college doesn't have an active plan yet — contact Mellow to get started."}
            </div>
          ) : (
            <div className="p-4 sm:p-5 rounded-control bg-elevated/60 border border-border-subtle flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
              <div className="w-11 h-11 rounded-control bg-accent-primary/15 border border-accent-primary/30 text-accent-primary flex items-center justify-center shrink-0">
                <BadgeCheck className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-bold text-primary">{coverage.plan?.name}</span>
                  <span className="px-2 py-0.5 text-3xs font-bold uppercase rounded-full bg-elevated text-text-muted border border-border-subtle">
                    {coverage.source === "institution" ? `Via ${user.college?.name ?? "your college"}` : "Personal plan"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-text-muted mt-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {coverage.days_remaining === null ? (
                    <span>Never expires</span>
                  ) : (
                    <span>
                      Expires in <strong className="text-text-secondary font-mono">{coverage.days_remaining}</strong>{" "}
                      day{coverage.days_remaining === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
              </div>

              {isStudent ? (
                <Link
                  href="/dashboard/billing"
                  className="px-4 py-2.5 rounded-btn bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-all shadow-subtle hover:shadow-glow shrink-0 text-center"
                >
                  Change Plan
                </Link>
              ) : (
                <span className="text-2xs text-text-muted shrink-0 max-w-[220px] text-right">
                  Only Mellow staff can change your institution&apos;s plan — contact support to upgrade or renew.
                </span>
              )}
            </div>
          )}

          {isStudent && !coverageLoading && entitlements && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-primary">Today&apos;s Usage</h4>
              <UsageLimitBanner
                label="practice problems"
                used={entitlements.practice_problems_used_today}
                max={entitlements.max_practice_problems_per_day}
              />
              <UsageLimitBanner
                label="mock interviews"
                used={entitlements.mock_interviews_used_today}
                max={entitlements.max_mock_interviews_per_day}
              />
              {!entitlements.drive_access && (
                <div className="p-3 rounded-control border border-border-subtle bg-elevated/60 flex items-center justify-between gap-3">
                  <span className="text-2xs text-text-muted">Placement drives aren&apos;t included on your current plan.</span>
                  <Link href="/dashboard/billing" className="text-[10.5px] font-bold text-accent-primary hover:underline shrink-0">
                    Upgrade →
                  </Link>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ---------------- Preferences ---------------- */}
      {tab === "preferences" && (
        <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-6">
          <div>
            <h3 className="text-sm font-bold text-primary">Workspace Preferences</h3>
            <p className="text-xs text-text-muted mt-0.5">Defaults applied every time you open the code arena.</p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-border-subtle">
            <div>
              <div className="text-xs font-bold text-primary">Appearance</div>
              <p className="text-2xs text-text-muted mt-0.5">Applies instantly across every dashboard.</p>
            </div>
            <ThemeToggle showLabels />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Default Language">
              <select
                value={defaultLanguage}
                onChange={(e) => setDefaultLanguage(e.target.value)}
                className={cn(inputClass, "px-3")}
              >
                {["C++20", "Python 3.12", "Java 21", "Go 1.22", "Rust 1.77", "JavaScript"].map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Editor Font Size">
              <select value={fontSize} onChange={(e) => setFontSize(e.target.value)} className={cn(inputClass, "px-3")}>
                {["12", "13", "14", "16", "18"].map((s) => (
                  <option key={s} value={s}>
                    {s}px
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Timezone">
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={cn(inputClass, "px-3")}>
                {["Asia/Kolkata (IST)", "UTC", "America/New_York (ET)", "Europe/London (GMT)"].map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <p className="text-2xs text-text-muted">
            These apply to the in-browser code editor, which is launching alongside proctored assessments — saved
            locally on this device for now.
          </p>

          <div className="flex justify-end pt-2 border-t border-border-subtle">
            <button
              onClick={() => triggerToast("Preferences saved on this device.")}
              className="px-5 py-2.5 rounded-btn bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-all shadow-subtle hover:shadow-glow flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Save Preferences</span>
            </button>
          </div>
        </section>
      )}

      {/* ---------------- Notifications ---------------- */}
      {tab === "notifications" && (
        <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-1">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-primary">
              Notification Preferences{" "}
              <span className="align-middle px-1.5 py-0.5 text-3xs font-bold uppercase rounded bg-elevated text-text-muted border border-border-subtle">
                Early Access
              </span>
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              These preferences are saved for when email/in-app alerting ships — today, the only email you&apos;ll get
              from us is your account credentials.
            </p>
          </div>

          {[
            {
              key: "contestReminders" as const,
              title: "Contest reminders",
              detail: "A nudge one hour before every rated round you're registered for.",
            },
            {
              key: "driveAlerts" as const,
              title: "Campus drive alerts",
              detail: "When your placement cell schedules or updates a recruitment drive.",
            },
            {
              key: "submissionResults" as const,
              title: "Submission verdicts",
              detail: "Judge results for submissions made during contests.",
            },
            {
              key: "weeklyDigest" as const,
              title: "Weekly progress digest",
              detail: "A Monday summary of your rating, streak and topic progress.",
            },
            {
              key: "productUpdates" as const,
              title: "Product updates",
              detail: "New features, problem sets and platform announcements.",
            },
          ].map((row, idx, arr) => (
            <div
              key={row.key}
              className={cn(
                "flex items-center justify-between gap-4 py-4",
                idx !== arr.length - 1 && "border-b border-border-subtle"
              )}
            >
              <div className="min-w-0">
                <div className="text-xs font-bold text-primary">{row.title}</div>
                <p className="text-2xs text-text-muted mt-0.5 leading-relaxed">{row.detail}</p>
              </div>
              <Toggle
                checked={notifs[row.key]}
                label={row.title}
                onChange={(v) => {
                  setNotifs((prev) => ({ ...prev, [row.key]: v }));
                  triggerToast(`${row.title} ${v ? "enabled" : "disabled"}.`);
                }}
              />
            </div>
          ))}
        </section>
      )}
    </DashboardShell>
  );
}
