import { NavLink } from "@/types/common";

// Hash links point at "/#…" so they work from every public page, not only the landing page. The hiring-partner
// page is parked for now (the product is sold to colleges and students): it stays reachable from the footer.
export const NAV_LINKS: NavLink[] = [
  { label: "Colleges", href: "/colleges" },
  { label: "Students", href: "/students" },
  { label: "Rewards", href: "/rewards" },
  { label: "Mellow Vault", href: "/vault" },
  { label: "Pricing", href: "/pricing" },
];

// Note: Footer.tsx defines its own inline `footerLinks` (richer shape than
// NavLink, with its own column titles) rather than reading from a shared
// export here — there is no FOOTER_COLUMNS consumer, so it was removed
// 2026-09-13 rather than kept as dead, unmaintained-in-practice data.
