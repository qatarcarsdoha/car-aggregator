export function EmptyState({ filtered }: { filtered?: boolean }) {
  if (filtered) {
    return (
      <div className="text-center py-24">
        <p className="font-display text-2xl">No listings match these filters</p>
        <p className="text-sm text-ink-muted mt-2 max-w-xs mx-auto">
          Try clearing the search or filters and try again.
        </p>
      </div>
    );
  }
  return (
    <div className="text-center py-24">
      <p className="font-display text-2xl">No listings yet</p>
      <p className="text-sm text-ink-muted mt-2 max-w-xs mx-auto">
        Run <code className="font-mono text-ink">npm run sync</code> to fetch the first batch.
      </p>
    </div>
  );
}
