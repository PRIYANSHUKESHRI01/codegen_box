// Comprehensive mock data store for CodeGen Box dashboards

export interface PartnerCollege {
  id: string;
  name: string;
  shortCode: string;
  logo: string;
  tpoName: string;
  tpoEmail: string;
  activeStudents: number;
  tier: "Academic Enterprise" | "Pro Campus" | "Standard";
  placementRate: number;
  status: "Active" | "Pending" | "Suspended";
  joinedDate: string;
}

// -------------------------------------------------------------
// College TPO Data
// -------------------------------------------------------------
export interface CollegeTPOProfile {
  institutionName: string;
  campusLocation: string;
  tpoOfficer: string;
  tpoDesignation: string;
  batchYear: number;
  totalStudents: number;
  placedStudents: number;
  averageRating: number;
  placementPercentage: number;
  highPackageOffers: number; // >20 LPA
  activeDrives: number;
}

export interface CampusDrive {
  id: string;
  companyName: string;
  logo: string;
  role: string;
  ctcRange: string;
  eligibilityCgpa: number;
  minRating: number;
  testDate: string;
  durationMinutes: number;
  registeredCount: number;
  status: "Upcoming" | "Active Now" | "Evaluation" | "Completed";
}

export interface BatchStudent {
  id: string;
  name: string;
  rollNumber: string;
  branch: "CSE" | "IT" | "ECE" | "EE" | "MECH";
  cgpa: number;
  codeForgeRating: number;
  ratingTier: string;
  solvedProblems: number;
  readinessScore: number; // 0 - 100
  placementStatus: "Placed" | "Shortlisted" | "In Assessment" | "Needs Training";
  companyPlaced?: string;
}

export interface DepartmentReadiness {
  branch: string;
  avgDsaScore: number;
  avgSpeedScore: number;
  placedPercentage: number;
  totalEnrolled: number;
}

// -------------------------------------------------------------
// Student / User Data
// -------------------------------------------------------------
export interface StudentProfile {
  name: string;
  handle: string;
  avatar: string;
  email: string;
  college: string;
  branch: string;
  graduationYear: number;
  rating: number;
  rankTitle: string;
  globalRank: number;
  collegeRank: number;
  totalSolved: number;
  easySolved: number;
  easyTotal: number;
  mediumSolved: number;
  mediumTotal: number;
  hardSolved: number;
  hardTotal: number;
  streakDays: number;
  maxStreak: number;
  readinessScore: number;
  readinessBreakdown: {
    dsa: number;
    systemDesign: number;
    csFundamentals: number;
    problemSolvingSpeed: number;
  };
}

export interface StudentSubmission {
  id: string;
  problemTitle: string;
  difficulty: "Easy" | "Medium" | "Hard";
  language: string;
  verdict: "Accepted" | "Wrong Answer" | "Time Limit Exceeded" | "Runtime Error";
  runtimeMs: number;
  memoryMb: number;
  submittedAt: string;
}

export interface StudentAssessment {
  id: string;
  title: string;
  organizer: string;
  type: "Campus Drive" | "College Mock Test" | "Mellow Weekly";
  scheduledTime: string;
  duration: string;
  totalQuestions: number;
  status: "Mandatory" | "Optional" | "Completed";
  badgeColor: string;
}

// =============================================================
// ACTUAL MOCK DATASETS
// =============================================================

// SUPERADMIN_STATS, JUDGE_NODES and FEATURE_FLAGS (formerly here), plus
// PARTNER_COLLEGES/USER_MANAGEMENT_RECORDS/AUDIT_LOGS before them, were
// removed once the superadmin dashboard was wired to real, DB-backed data —
// /api/superadmin/overview, /api/superadmin/judge-nodes, and
// /api/superadmin/feature-flags respectively (2026-09-17).
//
// CURATED_PROBLEMS, PLAGIARISM_FLAGS and SUPPORT_TICKETS (formerly here)
// were removed the same way once the Mellow Ops dashboard was rebuilt on
// real data (2026-09-18) — see AdminController::overview()/
// AdminProblemController::index(). Plagiarism detection and a support-ticket
// system don't exist in this codebase at all yet, so unlike the sections
// above, nothing replaced these 1:1 — the dashboard just no longer shows a
// feature that was never real.

// -------------------------------------------------------------
// College TPO Mock Data (Apex Institute of Technology)
// -------------------------------------------------------------
export const COLLEGE_TPO_PROFILE: CollegeTPOProfile = {
  institutionName: "Apex Institute of Technology & Research",
  campusLocation: "Bangalore, India",
  tpoOfficer: "Dr. Rajeshwar Sharma",
  tpoDesignation: "Head of Training & Corporate Relations",
  batchYear: 2026,
  totalStudents: 1450,
  placedStudents: 986,
  averageRating: 1684,
  placementPercentage: 68.0,
  highPackageOffers: 142,
  activeDrives: 4,
};

export const CAMPUS_DRIVES: CampusDrive[] = [
  { id: "drv-01", companyName: "Google India", logo: "🌐", role: "Software Development Engineer - I (Full Time)", ctcRange: "₹34 - 42 LPA", eligibilityCgpa: 8.0, minRating: 1750, testDate: "Tomorrow, 10:00 AM", durationMinutes: 90, registeredCount: 248, status: "Active Now" },
  { id: "drv-02", companyName: "Microsoft", logo: "🪟", role: "Software Engineer Trainee (Batch 2026)", ctcRange: "₹28 - 36 LPA", eligibilityCgpa: 7.5, minRating: 1600, testDate: "14 Sep 2026, 02:00 PM", durationMinutes: 120, registeredCount: 412, status: "Upcoming" },
  { id: "drv-03", companyName: "Amazon Web Services", logo: "📦", role: "Cloud Support & Systems Associate", ctcRange: "₹22 - 28 LPA", eligibilityCgpa: 7.0, minRating: 1500, testDate: "18 Sep 2026, 11:00 AM", durationMinutes: 75, registeredCount: 520, status: "Upcoming" },
  { id: "drv-04", companyName: "TCS Digital / Prime", logo: "🏢", role: "Digital Systems Architect (Pan-College)", ctcRange: "₹9 - 14 LPA", eligibilityCgpa: 6.5, minRating: 1350, testDate: "08 Sep 2026 (Finished)", durationMinutes: 90, registeredCount: 910, status: "Completed" },
];

export const BATCH_STUDENTS: BatchStudent[] = [
  { id: "std-01", name: "Alex Chen", rollNumber: "2022CSE014", branch: "CSE", cgpa: 9.32, codeForgeRating: 1945, ratingTier: "Candidate Master", solvedProblems: 680, readinessScore: 94, placementStatus: "Shortlisted", companyPlaced: "Google India (Shortlist)" },
  { id: "std-02", name: "Sneha Reddy", rollNumber: "2022CSE088", branch: "CSE", cgpa: 9.14, codeForgeRating: 1880, ratingTier: "Expert", solvedProblems: 540, readinessScore: 91, placementStatus: "Placed", companyPlaced: "Microsoft (₹32 LPA)" },
  { id: "std-03", name: "Kartik Mehta", rollNumber: "2022IT045", branch: "IT", cgpa: 8.84, codeForgeRating: 1760, ratingTier: "Expert", solvedProblems: 410, readinessScore: 84, placementStatus: "In Assessment" },
  { id: "std-04", name: "Tanvi Saxena", rollNumber: "2022ECE021", branch: "ECE", cgpa: 8.92, codeForgeRating: 1640, ratingTier: "Specialist", solvedProblems: 320, readinessScore: 78, placementStatus: "In Assessment" },
  { id: "std-05", name: "Rahul Deshmukh", rollNumber: "2022CSE105", branch: "CSE", cgpa: 7.62, codeForgeRating: 1410, ratingTier: "Apprentice", solvedProblems: 190, readinessScore: 56, placementStatus: "Needs Training" },
  { id: "std-06", name: "Ananya Iyer", rollNumber: "2022IT012", branch: "IT", cgpa: 9.45, codeForgeRating: 1910, ratingTier: "Candidate Master", solvedProblems: 620, readinessScore: 93, placementStatus: "Placed", companyPlaced: "Adobe Systems (₹29 LPA)" },
  { id: "std-07", name: "Vikram Malhotra", rollNumber: "2022EE034", branch: "EE", cgpa: 7.20, codeForgeRating: 1320, ratingTier: "Apprentice", solvedProblems: 140, readinessScore: 48, placementStatus: "Needs Training" },
];

export const DEPARTMENT_READINESS: DepartmentReadiness[] = [
  { branch: "Computer Science (CSE)", avgDsaScore: 88, avgSpeedScore: 84, placedPercentage: 82.5, totalEnrolled: 620 },
  { branch: "Information Tech (IT)", avgDsaScore: 82, avgSpeedScore: 79, placedPercentage: 74.0, totalEnrolled: 380 },
  { branch: "Electronics (ECE)", avgDsaScore: 71, avgSpeedScore: 68, placedPercentage: 58.2, totalEnrolled: 290 },
  { branch: "Electrical (EE)", avgDsaScore: 62, avgSpeedScore: 59, placedPercentage: 45.0, totalEnrolled: 160 },
];

// -------------------------------------------------------------
// Student / User Mock Data (Alex Chen)
// -------------------------------------------------------------
export const STUDENT_PROFILE: StudentProfile = {
  name: "Alex Chen",
  handle: "alex_coder",
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  email: "alex.chen@student.apex.edu",
  college: "Apex Institute of Technology",
  branch: "Computer Science & Engineering",
  graduationYear: 2026,
  rating: 1945,
  rankTitle: "Candidate Master",
  globalRank: 342,
  collegeRank: 3,
  totalSolved: 684,
  easySolved: 280,
  easyTotal: 450,
  mediumSolved: 312,
  mediumTotal: 720,
  hardSolved: 92,
  hardTotal: 340,
  streakDays: 34,
  maxStreak: 61,
  readinessScore: 92,
  readinessBreakdown: {
    dsa: 95,
    systemDesign: 84,
    csFundamentals: 92,
    problemSolvingSpeed: 89,
  },
};

export const STUDENT_SUBMISSIONS: StudentSubmission[] = [
  { id: "sub-901", problemTitle: "Median of Two Distributed Streams", difficulty: "Hard", language: "C++20", verdict: "Accepted", runtimeMs: 14, memoryMb: 12.4, submittedAt: "18 mins ago" },
  { id: "sub-902", problemTitle: "Valid Route in Constrained Grid", difficulty: "Medium", language: "Python 3.12", verdict: "Accepted", runtimeMs: 68, memoryMb: 24.1, submittedAt: "2 hours ago" },
  { id: "sub-903", problemTitle: "Dynamic Tree Diameter with Edge Updates", difficulty: "Hard", language: "C++20", verdict: "Time Limit Exceeded", runtimeMs: 2004, memoryMb: 48.0, submittedAt: "5 hours ago" },
  { id: "sub-904", problemTitle: "Lexicographically Smallest Subsequence", difficulty: "Medium", language: "Java 21", verdict: "Wrong Answer", runtimeMs: 94, memoryMb: 36.2, submittedAt: "Yesterday" },
  { id: "sub-905", problemTitle: "Two Sum: Prefix XOR Variation", difficulty: "Easy", language: "C++20", verdict: "Accepted", runtimeMs: 4, memoryMb: 8.2, submittedAt: "Yesterday" },
  { id: "sub-906", problemTitle: "Longest Valid Parentheses Chain", difficulty: "Hard", language: "C++20", verdict: "Accepted", runtimeMs: 8, memoryMb: 10.5, submittedAt: "2 days ago" },
];

export const STUDENT_ASSESSMENTS: StudentAssessment[] = [
  { id: "asm-01", title: "Google SDE-1 On-Campus Placement Test", organizer: "Apex TPO Cell x Google", type: "Campus Drive", scheduledTime: "Tomorrow at 10:00 AM", duration: "90 Mins", totalQuestions: 3, status: "Mandatory", badgeColor: "bg-status-danger/15 text-status-danger border-status-danger/30" },
  { id: "asm-02", title: "Microsoft Coding Assessment Prep Mock", organizer: "Apex Placement Cell", type: "College Mock Test", scheduledTime: "Sunday, 4:00 PM", duration: "120 Mins", totalQuestions: 4, status: "Optional", badgeColor: "bg-accent-primary/15 text-accent-primary border-accent-primary/30" },
  { id: "asm-03", title: "CodeGen Box Weekly Challenge #25", organizer: "CodeGen Box Global", type: "Mellow Weekly", scheduledTime: "Saturday, 8:00 PM", duration: "120 Mins", totalQuestions: 4, status: "Optional", badgeColor: "bg-accent-secondary/15 text-accent-secondary border-accent-secondary/30" },
];
