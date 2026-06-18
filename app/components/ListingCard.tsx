import Link from "next/link";
import { Sparkles, MapPin, Gauge, Fuel, Calendar } from "lucide-react";
import type { Listing } from "@prisma/client";
import { formatQAR, formatKM, formatRelative, sourceTag } from "@/lib/utils";
import { toFeedThumbnail } from "@/lib/images";
import { CardCarousel } from "./CardCarousel";

export function ListingCard({
  listing: l,
  index,
}: {
  listing: Listing;
  index: number;
}) {
  const images = ((l.images as string[]) ?? []).map(toFeedThumbnail);
  const isFresh =
    Date.now() - new Date(l.firstSeenAt).getTime() < 24 * 60 * 60 * 1000;
  const features = (l.features as string[]) ?? [];

  const overlayBadges = (
    <>
      <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start z-10">
        {isFresh && (
          <span className="chip bg-brand/95 text-bone border-transparent">
            <Sparkles size={10} /> Just added
          </span>
        )}
        {l.isBrandNew && (
          <span className="chip bg-ink text-bone border-transparent">New</span>
        )}
      </div>
      <span className="absolute top-3 right-3 chip z-10">
        {sourceTag(l.source)}
      </span>
      <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-ink/80 via-ink/30 to-transparent pointer-events-none">
        <p className="font-display text-xl text-bone tracking-tight drop-shadow">
          {formatQAR(l.priceQAR)}
        </p>
      </div>
    </>
  );

  return (
    <Link
      href={`/listing/${l.id}`}
      className="block group animate-fadeUp"
      style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
    >
      <article className="bg-paper rounded-2xl overflow-hidden border border-ink/5 shadow-soft md:hover:shadow-lift md:hover:-translate-y-1 transition-all duration-300 h-full flex flex-col">
        {images.length > 0 ? (
          <CardCarousel
            images={images}
            alt={`${l.make ?? ""} ${l.model ?? ""}`.trim() || "Car"}
            priority={index < 4}
            overlay={overlayBadges}
          />
        ) : (
          <div className="relative aspect-[4/3] bg-sand overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center text-ink-muted-2 text-xs uppercase tracking-wider font-mono">
              No image
            </div>
            {overlayBadges}
          </div>
        )}

        <div className="p-4 sm:p-5 flex-1 flex flex-col">
          <div className="flex items-baseline justify-between gap-2 min-w-0">
            <h2 className="font-display text-lg leading-tight truncate">
              {l.make} {l.model}
            </h2>
            {l.year != null && (
              <span className="font-mono text-xs text-ink-muted whitespace-nowrap">
                {l.year}
              </span>
            )}
          </div>
          {l.trim && (
            <p className="text-xs text-ink-muted-2 truncate mt-0.5">{l.trim}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-muted">
            <SpecPill icon={<Gauge size={12} />} text={formatKM(l.mileageKM)} />
            {l.fuelType && (
              <SpecPill icon={<Fuel size={12} />} text={l.fuelType} />
            )}
            {l.location && (
              <SpecPill icon={<MapPin size={12} />} text={l.location} />
            )}
          </div>

          {features.length > 0 && (
            <p className="text-xs text-ink-muted-2 mt-3 truncate">
              {features.slice(0, 3).join(" · ")}
              {features.length > 3 && ` · +${features.length - 3} more`}
            </p>
          )}

          <div className="mt-auto pt-4 flex items-center justify-between border-t border-ink/5 mt-4">
            <p className="text-[10px] text-ink-muted-2 font-mono truncate flex-1">
              {l.dealerName ?? "Private seller"}
            </p>
            <p className="text-[10px] text-ink-muted-2 font-mono whitespace-nowrap ml-2 flex items-center gap-1">
              <Calendar size={10} />
              {formatRelative(l.sourceUpdatedAt ?? l.firstSeenAt)}
            </p>
          </div>
        </div>
      </article>
    </Link>
  );
}

function SpecPill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span className="text-ink-muted-2">{icon}</span>
      {text}
    </span>
  );
}
