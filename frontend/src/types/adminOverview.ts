/** GET /admin/overview — real, live counts for Mellow Internal Ops. See AdminController::overview(). */
export interface AdminOverview {
  segments: {
    colleges: number;
    platform_users: number;
    companies: number;
    contests: number;
    interviews: number;
    placement_drives: number;
    problems: number;
    articles: number;
  };
  submissions_today: number;
  signups_last_7_days: number;
  colleges_renewing_soon: { id: number; name: string; days_remaining: number }[];
}
