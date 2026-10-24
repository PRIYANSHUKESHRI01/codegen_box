"use client";

import { BookOpen, Briefcase, Building2, Calculator, Cpu, FlaskConical, GraduationCap, Hotel, Landmark, Leaf, Palette, Pill, Plane, Scale, Stethoscope, type LucideIcon } from "lucide-react";

/** The icon names Superadmin can give a department (mirrors SuperAdminDepartmentController::ICONS). */
const ICONS: Record<string, LucideIcon> = {
  cpu: Cpu,
  briefcase: Briefcase,
  calculator: Calculator,
  landmark: Landmark,
  "graduation-cap": GraduationCap,
  stethoscope: Stethoscope,
  pill: Pill,
  scale: Scale,
  palette: Palette,
  "flask-conical": FlaskConical,
  "book-open": BookOpen,
  "building-2": Building2,
  leaf: Leaf,
  plane: Plane,
  hotel: Hotel,
};

export const DEPARTMENT_ICON_NAMES = Object.keys(ICONS);

export function DepartmentIcon({ name, className }: { name?: string | null; className?: string }) {
  const Icon = ICONS[name ?? ""] ?? GraduationCap;
  return <Icon aria-hidden className={className ?? "h-4 w-4"} />;
}
