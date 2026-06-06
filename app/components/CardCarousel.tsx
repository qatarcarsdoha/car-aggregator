"use client";

import * as React from "react";
import Image from "next/image";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

export function CardCarousel({
  images,
  alt,
  priority = false,
  overlay,
}: {
  images: string[];
  alt: string;
  priority?: boolean;
  overlay?: React.ReactNode;
}) {
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);

  React.useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => setCurrent(api.selectedScrollSnap()));
  }, [api]);

  if (images.length === 0) return null;

  return (
    <div className="relative">
      <Carousel
        setApi={setApi}
        opts={{ loop: images.length > 1, dragFree: false }}
        className="w-full"
      >
        <CarouselContent className="ml-0">
          {images.map((src, i) => (
            <CarouselItem key={i} className="pl-0">
              <div className="relative aspect-[4/3] bg-sand overflow-hidden">
                <Image
                  src={src}
                  alt={`${alt} — ${i + 1}`}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                  className="object-cover transition-transform duration-700 md:group-hover:scale-105"
                  unoptimized
                  priority={priority && i === 0}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

        {images.length > 1 && (
          <>
            <CarouselPrevious
              className="left-2 h-11 w-11 sm:h-9 sm:w-9 border-ink/10 bg-paper/85 text-ink shadow-soft hover:bg-paper [&_svg]:size-5 md:opacity-0 md:group-hover:opacity-100 transition"
              onClick={(e) => e.stopPropagation()}
            />
            <CarouselNext
              className="right-2 h-11 w-11 sm:h-9 sm:w-9 border-ink/10 bg-paper/85 text-ink shadow-soft hover:bg-paper [&_svg]:size-5 md:opacity-0 md:group-hover:opacity-100 transition"
              onClick={(e) => e.stopPropagation()}
            />
          </>
        )}
      </Carousel>

      {overlay}

      {images.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-none">
          {images.slice(0, Math.min(images.length, 8)).map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === current % Math.min(images.length, 8)
                  ? "w-4 bg-bone"
                  : "w-1 bg-bone/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
