export default function HomeLoading() {
  return (
    <main className="min-h-screen grain" aria-busy="true" aria-label="Loading listings">
      <div className="mx-auto max-w-7xl">
        <header className="px-5 sm:px-8 lg:px-12 pt-10 sm:pt-14 lg:pt-20 pb-6 sm:pb-10">
          <div className="flex items-baseline justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="label">Doha — Live feed</p>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight mt-1">
                Qatar <span className="italic text-brand">Cars</span>
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <Block className="h-7 w-12 ml-auto" />
                <p className="label mt-1">Listings tracked</p>
              </div>
              <Block className="h-9 w-9 rounded-full" />
            </div>
          </div>
          <Block className="h-4 w-full max-w-lg mt-5" />
          <Block className="h-4 w-2/3 max-w-md mt-2" />
        </header>

        <div className="sticky top-0 z-20 bg-bone/80 backdrop-blur-md border-y border-ink/10">
          <div className="px-5 sm:px-8 lg:px-12 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Block className="h-4 w-32" />
            <div className="flex items-stretch gap-2 w-full sm:w-auto">
              <Block className="h-10 flex-1 sm:w-36 rounded-md" />
              <Block className="h-10 flex-1 sm:w-36 rounded-md" />
              <Block className="h-10 flex-1 sm:w-36 rounded-md" />
            </div>
          </div>
        </div>

        <section className="px-5 sm:px-8 lg:px-12 py-6 sm:py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Block({ className = "" }: { className?: string }) {
  return <div className={`shimmer rounded-md ${className}`} />;
}

function CardSkeleton() {
  return (
    <article className="bg-paper rounded-2xl overflow-hidden border border-ink/5 shadow-soft flex flex-col">
      <div className="shimmer aspect-[4/3] w-full" />
      <div className="p-4 sm:p-5 flex-1 flex flex-col">
        <div className="flex items-baseline justify-between gap-2">
          <Block className="h-5 w-1/2" />
          <Block className="h-3 w-10" />
        </div>
        <Block className="h-3 w-1/3 mt-2" />
        <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2">
          <Block className="h-3 w-16" />
          <Block className="h-3 w-12" />
          <Block className="h-3 w-20" />
        </div>
        <Block className="h-3 w-2/3 mt-3" />
        <div className="mt-auto pt-4 flex items-center justify-between border-t border-ink/5">
          <Block className="h-3 w-24" />
          <Block className="h-3 w-16" />
        </div>
      </div>
    </article>
  );
}
