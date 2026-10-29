"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { MyDriveApplication, UpcomingPlacementDrive } from "@/types/placement";

/** One drive as `GET /drives` sends it (snake_case); the student's own college, published drives only. */
export interface ApiDriveSummary {
  id: number;
  title: string;
  company: { id: number; name: string; slug: string; logo: string | null };
  role_title: string;
  ctc_range: string | null;
  drive_date: string;
  duration_minutes: number | null;
  eligibility: { min_cgpa: string | null; max_backlogs: number | null; eligible_branches: string[] | null };
  student_eligibility: { status: "eligible" | "not_eligible" | "unknown"; reasons: string[] };
  my_application: MyDriveApplication | null;
}

/** A drive plus how far away it is, measured once when it was loaded (a ticking CountdownTimer must never be handed a fresh value per render). */
export interface DriveCard extends UpcomingPlacementDrive {
  minutesFromNow: number;
}

export function mapDriveFromApi(d: ApiDriveSummary, now: number = Date.now()): DriveCard {
  return {
    id: d.id,
    title: d.title,
    company: d.company,
    roleTitle: d.role_title,
    ctcRange: d.ctc_range,
    driveDate: d.drive_date,
    durationMinutes: d.duration_minutes,
    eligibility: {
      minCgpa: d.eligibility.min_cgpa !== null ? Number(d.eligibility.min_cgpa) : null,
      maxBacklogs: d.eligibility.max_backlogs,
      eligibleBranches: d.eligibility.eligible_branches,
    },
    studentEligibility: d.student_eligibility,
    myApplication: d.my_application,
    minutesFromNow: Math.round((new Date(d.drive_date).getTime() - now) / 60000),
  };
}

/** Where the student stands with a drive that is still ahead of them: an application they have not yet had rejected or withdrawn. */
export function isApplied(drive: Pick<DriveCard, "myApplication">): boolean {
  return !!drive.myApplication;
}

export interface DriveGroups {
  /** Still ahead of the student, soonest first. */
  upcoming: DriveCard[];
  /** Already happened, most recent first. */
  past: DriveCard[];
  /** The soonest upcoming one, if any. */
  next: DriveCard | null;
  /** Upcoming drives the student meets every requirement for. */
  eligible: number;
  /** Drives (any date) the student has an application in. */
  applied: number;
}

/** Splits drives into what is ahead and what is behind, and counts what the student can act on. */
export function groupDrives(drives: DriveCard[]): DriveGroups {
  const upcoming = drives.filter((d) => d.minutesFromNow > 0).sort((a, b) => a.minutesFromNow - b.minutesFromNow);
  const past = drives.filter((d) => d.minutesFromNow <= 0).sort((a, b) => b.minutesFromNow - a.minutesFromNow);

  return {
    upcoming,
    past,
    next: upcoming[0] ?? null,
    eligible: upcoming.filter((d) => d.studentEligibility.status === "eligible").length,
    applied: drives.filter(isApplied).length,
  };
}

export interface StudentDrivesState {
  drives: DriveCard[];
  /** False when the student's plan (or lack of a college) does not include drives; the server says so rather than sending an empty list silently. */
  access: boolean;
  loading: boolean;
  /** The request failed — different from "there are none", and the page says so. */
  failed: boolean;
  reload: () => void;
}

/** The student's drives, loaded once `enabled` turns true. Shared by the Overview and the Upcoming Drives page. */
export function useStudentDrives(enabled: boolean): StudentDrivesState {
  const [drives, setDrives] = useState<DriveCard[]>([]);
  const [access, setAccess] = useState(true);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);

    api
      .get<{ drives: ApiDriveSummary[]; drive_access?: boolean }>("/drives")
      .then((res) => {
        if (cancelled) return;
        const now = Date.now();
        setDrives(res.drives.map((d) => mapDriveFromApi(d, now)));
        setAccess(res.drive_access ?? true);
      })
      .catch(() => {
        if (cancelled) return;
        setDrives([]);
        setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { drives, access, loading, failed, reload };
}
