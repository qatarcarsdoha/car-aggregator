"use client";

import * as React from "react";
import Image from "next/image";
import { Expand } from "lucide-react";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function GalleryDialog({
  images,
  alt,
  badges,
}: {
  images: string[];
  alt: string;
  badges?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [startIndex, setStartIndex] = React.useState(0);
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);

  React.useEffect(() => {
    if (!api) return;
    api.scrollTo(startIndex, true);
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => setCurrent(api.selectedScrollSnap()));
  }, [api, startIndex]);

  const openAt = (i: number) => {
    setStartIndex(i);
    setOpen(true);
  };

  if (images.length === 0) return null;

  return (
    <>
      <div className="md:space-y-4">
        {/* Mobile: snap-x carousel */}
        <div className="md:hidden flex overflow-x-auto snap-x snap-mandatory bg-sand no-scrollbar">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => openAt(i)}
              className="relative shrink-0 w-full aspect-[4/3] snap-center cursor-zoom-in"
            >
              <Image
                src={src}
                alt={`${alt} — ${i + 1}`}
                fill
                sizes="100vw"
                className="object-cover"
                unoptimized
                priority={i === 0}
              />
              {i === 0 && badges}
              <span className="absolute bottom-3 right-3 chip bg-ink/70 text-bone border-transparent">
                {i + 1} / {images.length}
              </span>
            </button>
          ))}
        </div>

        {/* Desktop: hero + grid */}
        <div className="hidden md:block">
          <button
            type="button"
            onClick={() => openAt(0)}
            className="relative w-full aspect-[16/10] bg-sand rounded-2xl overflow-hidden shadow-soft cursor-zoom-in group"
          >
            <Image
              src={images[0]}
              alt={alt}
              fill
              sizes="(max-width: 1280px) 60vw, 800px"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              unoptimized
              priority
            />
            {badges}
            <span className="absolute bottom-3 right-3 chip bg-ink/70 text-bone border-transparent opacity-0 group-hover:opacity-100 transition">
              <Expand size={10} /> Expand
            </span>
          </button>
          {images.length > 1 && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              {images.slice(1, 7).map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => openAt(i + 1)}
                  className="relative aspect-[4/3] bg-sand rounded-xl overflow-hidden shadow-soft cursor-zoom-in group"
                >
                  <Image
                    src={src}
                    alt={`${alt} — ${i + 2}`}
                    fill
                    sizes="(max-width: 1280px) 20vw, 260px"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    unoptimized
                  />
                  {i === 5 && images.length > 7 && (
                    <div className="absolute inset-0 bg-ink/60 flex items-center justify-center">
                      <span className="font-display text-bone text-2xl">
                        +{images.length - 7}
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton
          className="max-w-[min(96vw,1400px)] sm:max-w-[min(96vw,1400px)] w-[96vw] p-0 bg-ink/95 border-ink/20 overflow-hidden"
        >
          <DialogTitle className="sr-only">{alt} — gallery</DialogTitle>
          <DialogDescription className="sr-only">
            Photo gallery, {images.length} {images.length === 1 ? "image" : "images"}
          </DialogDescription>

          <Carousel
            setApi={setApi}
            opts={{ loop: images.length > 1, startIndex }}
            className="w-full"
          >
            <CarouselContent className="ml-0">
              {images.map((src, i) => (
                <CarouselItem key={i} className="pl-0">
                  <div className="relative w-full h-[min(85vh,900px)] bg-ink">
                    <Image
                      src={src}
                      alt={`${alt} — ${i + 1}`}
                      fill
                      sizes="96vw"
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {images.length > 1 && (
              <>
                <CarouselPrevious className="left-3 md:left-5 h-12 w-12 md:h-14 md:w-14 bg-bone text-ink border-transparent hover:bg-bone hover:text-brand [&_svg]:size-6 md:[&_svg]:size-7 shadow-lift ring-1 ring-ink/10" />
                <CarouselNext className="right-3 md:right-5 h-12 w-12 md:h-14 md:w-14 bg-bone text-ink border-transparent hover:bg-bone hover:text-brand [&_svg]:size-6 md:[&_svg]:size-7 shadow-lift ring-1 ring-ink/10" />
              </>
            )}
          </Carousel>

          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 chip bg-ink/70 text-bone border-bone/20">
              {current + 1} / {images.length}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
