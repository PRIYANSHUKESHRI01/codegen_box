"use client";

import { departmentName, useBranchCatalog } from "@/lib/branches";
import { useCoreDisciplines } from "@/lib/core";

/**
 * The <option>s of a discipline select, grouped by department ("Engineering & Technology" › ECE · EEE …). A single department renders
 * flat — nothing to group. Used by every Ops select that picks a branch family for Domain Prep.
 */
export function DisciplineOptions() {
  const catalog = useBranchCatalog();
  const disciplines = useCoreDisciplines();
  const departments = Array.from(new Set(disciplines.map((d) => d.department)));

  if (departments.length <= 1) {
    return (
      <>
        {disciplines.map((d) => (
          <option key={d.code} value={d.code}>
            {d.name}
          </option>
        ))}
      </>
    );
  }

  return (
    <>
      {departments.map((dep) => (
        <optgroup key={dep} label={departmentName(catalog, dep) ?? dep}>
          {disciplines
            .filter((d) => d.department === dep)
            .map((d) => (
              <option key={d.code} value={d.code}>
                {d.name}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  );
}
