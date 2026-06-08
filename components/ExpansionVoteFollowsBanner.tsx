import { expansionVoteFollowsLabel } from "@/lib/expansion-label";

export function ExpansionVoteFollowsBanner() {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[2] px-2 py-1.5 bg-[var(--surface)]/95 border-t border-[var(--border)] text-center"
      aria-hidden="true"
    >
      <span className="text-[10px] font-semibold text-[var(--muted)] tracking-tight">
        {expansionVoteFollowsLabel()}
      </span>
    </div>
  );
}
