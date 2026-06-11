"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { chipClassForVariant, type GameTag } from "@/lib/game-tags";
import {
  filterUrl,
  isFilterActive,
  parseGameSort,
  toggleGameFilter,
  type GameFilters,
  type GameSort,
} from "@/lib/game-filters";

import { scrollToElement } from "@/lib/scroll";

type FilterChipButtonProps = {
  tag: GameTag;
  activeFilters?: GameFilters;
  filterMode?: boolean;
  basePath?: string;
  sort?: GameSort;
  scrollToId?: string;
  onNavigate?: () => void;
};

export function FilterChipButton({
  tag,
  activeFilters,
  filterMode,
  basePath = "/games",
  sort: sortProp,
  scrollToId,
  onNavigate,
}: FilterChipButtonProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sort =
    sortProp ??
    parseGameSort(
      Object.fromEntries(searchParams.entries()) as Record<string, string>,
    );
  const baseClass = chipClassForVariant(tag.variant);
  const canFilter = filterMode && tag.filter && activeFilters;
  const isActive = canFilter ? isFilterActive(activeFilters, tag.filter!) : false;

  if (!canFilter) {
    return <span className={baseClass}>{tag.label}</span>;
  }

  return (
    <button
      type="button"
      className={`${baseClass} chip-interactive relative z-[2]${isActive ? " chip-active" : ""}`}
      aria-pressed={isActive}
      onClick={(e) => {
        e.stopPropagation();
        onNavigate?.();
        const next = toggleGameFilter(activeFilters, tag.filter!);
        router.push(filterUrl(basePath, next, sort), { scroll: false });
        if (scrollToId) scrollToElement(scrollToId);
      }}
    >
      {tag.label}
    </button>
  );
}
