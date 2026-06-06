export default function ListingLoading() {
  return (
    <main className="min-h-screen" aria-busy="true" aria-label="Loading listing">
      <div className="sticky top-0 z-20 bg-bone/85 backdrop-blur-md border-b border-ink/10">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12 py-3 flex items-center justify-between gap-3">
          <Block className="h-4 w-28" />
          <div className="flex items-center gap-3">
            <Block className="h-4 w-24" />
            <Block className="h-9 w-9 rounded-full" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl md:px-8 lg:px-12 md:py-10 md:grid md:grid-cols-[1.4fr_1fr] xl:grid-cols-[1.55fr_1fr] md:gap-10 lg:gap-14">
        <div>
          <div className="shimmer aspect-[4/3] w-full md:rounded-2xl" />
          <div className="hidden md:grid grid-cols-3 gap-3 mt-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Block key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        </div>

        <div className="md:self-start">
          <div className="px-5 sm:px-8 md:px-0 py-6 md:pt-0 border-b border-ink/10 md:border-b-0">
            <div className="flex gap-2 mb-3">
              <Block className="h-6 w-20 rounded-full" />
              <Block className="h-6 w-24 rounded-full" />
            </div>
            <Block className="h-9 w-3/4" />
            <Block className="h-9 w-1/2 mt-2" />
            <Block className="h-9 w-40 mt-5" />
            <Block className="h-3 w-2/3 mt-4" />
            <div className="hidden md:flex gap-3 mt-6">
              <Block className="h-12 flex-1 rounded-full" />
              <Block className="h-12 flex-1 rounded-full" />
            </div>
          </div>

          <div className="px-5 sm:px-8 md:px-0 py-6 md:py-8 border-t border-ink/10">
            <p className="label mb-4">Vehicle</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-paper rounded-xl border border-ink/5 p-3 shadow-soft">
                  <Block className="h-3 w-14" />
                  <Block className="h-4 w-20 mt-2" />
                </div>
              ))}
            </div>
          </div>

          <div className="px-5 sm:px-8 md:px-0 py-6 md:py-8 border-t border-ink/10">
            <p className="label mb-4">Features</p>
            <div className="flex flex-wrap gap-2">
              {[80, 112, 64, 96, 72, 88, 56, 120].map((w, i) => (
                <Block key={i} className="h-6 rounded-full" style={{ width: `${w}px` }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 md:hidden bg-bone/95 backdrop-blur border-t border-ink/10 px-5 py-4 z-10">
        <div className="flex gap-3">
          <Block className="h-12 flex-1 rounded-full" />
          <Block className="h-12 flex-1 rounded-full" />
        </div>
      </div>
    </main>
  );
}

function Block({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={`shimmer rounded-md ${className}`} style={style} />;
}
