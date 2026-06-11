import { expansionVoteFollowsLabel } from "@/lib/expansion-label";

export function ExpansionVoteFollowsBanner() {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[2] px-2 py-1.5 pointer-events-none bg-[var(--surface)]/95 border-t border-[var(--border)] text-center"
      aria-hidden="true"
    >
      <span className="text-[0.72rem] font-semibold text-[var(--muted)] tracking-tight">
        {expansionVoteFollowsLabel()}
      </span>
    </div>
  );
}
