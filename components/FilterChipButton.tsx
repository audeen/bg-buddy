"use client";

import { useRouter } from "next/navigation";
import { chipClassForVariant, type GameTag } from "@/lib/game-tags";
import {
  filterUrl,
  isFilterActive,
  toggleGameFilter,
  type GameFilters,
} from "@/lib/game-filters";

type FilterChipButtonProps = {
  tag: GameTag;
  activeFilters?: GameFilters;
  filterMode?: boolean;
  onNavigate?: () => void;
};

export function FilterChipButton({
  tag,
  activeFilters,
  filterMode,
  onNavigate,
}: FilterChipButtonProps) {
  const router = useRouter();
  const baseClass = chipClassForVariant(tag.variant);
  const canFilter = filterMode && tag.filter && activeFilters;
  const isActive = canFilter ? isFilterActive(activeFilters, tag.filter!) : false;

  if (!canFilter) {
    return <span className={baseClass}>{tag.label}</span>;
  }

  return (
    <button
      type="button"
      className={`${baseClass} chip-interactive${isActive ? " chip-active" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onNavigate?.();
        const next = toggleGameFilter(activeFilters, tag.filter!);
        router.push(filterUrl("/games", next), { scroll: false });
      }}
    >
      {tag.label}
    </button>
  );
}
