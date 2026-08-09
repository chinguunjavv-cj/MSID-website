"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Photographs documenting one event, shown one at a time.
 *
 * This is the hero carousel's dialect — crossfade between already-decoded layers,
 * seven seconds, paused under the pointer, segments that show elapsed time — because a
 * site should have one way of turning pages through photographs, not two. It differs
 * from the hero where the job differs: these photographs are the content rather than a
 * backdrop, so nothing is overlaid on the frame — no scrim, no type — and the caption
 * sits under the photograph on paper.
 *
 * There is deliberately no heading above the frame. The photographs announce
 * themselves; the section name survives as the region's accessible label.
 *
 * The frame is a uniform 4:3 because every photograph MSID sends is 4:3 off a phone,
 * so in practice nothing is cropped. Anything of another shape is cropped in the frame
 * only — clicking opens the whole photograph, `object-contain`, in a native <dialog>.
 */

export interface GalleryPhoto {
  id: string;
  image: string;
  alt: string;
  caption: string;
}

export function EventGallery({
  photos,
  labels,
  className = "mt-14",
  frameClassName = "aspect-4/3",
}: {
  photos: GalleryPhoto[];
  labels: { heading: string; show: string; enlarge: string; close: string };
  /* The event page stacks this under the prose, so it keeps the original top margin.
     Beside a column of text it needs none — hence a prop rather than a hardcoded rule. */
  className?: string;
  /* The frame's shape. An event page gives its photographs a 4:3 plate; beside a column
     of text a fixed, shorter height keeps the panel from towering over the paragraph. */
  frameClassName?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<GalleryPhoto | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [animate, setAnimate] = useState(false);

  /*
    Motion is opt-in, decided after mount — the server cannot know the visitor's
    preference, so the first paint is always the still first photograph.
  */
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setAnimate(!query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  const advance = useCallback(() => {
    setIndex((current) => (current + 1) % photos.length);
  }, [photos.length]);

  useEffect(() => {
    // The dialog holds the page still: nothing advances behind an enlarged photograph.
    if (!animate || paused || open !== null || photos.length < 2) return;
    const timer = window.setInterval(advance, 7000);
    return () => window.clearInterval(timer);
  }, [animate, paused, open, photos.length, advance]);

  if (photos.length === 0) return null;

  const single = photos.length < 2;
  const current = photos[index];

  function show(photo: GalleryPhoto) {
    setOpen(photo);
    dialogRef.current?.showModal();
  }

  function hide() {
    dialogRef.current?.close();
    setOpen(null);
  }

  return (
    <section
      ref={regionRef}
      aria-roledescription={single ? undefined : "carousel"}
      aria-label={labels.heading}
      className={className}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!regionRef.current?.contains(event.relatedTarget as Node)) setPaused(false);
      }}
    >
      {/*
        `contain`, not `cover`. These photographs arrive in several shapes — 4:3 off a
        phone, the odd portrait, a wide conference cover — and filling a fixed frame with
        them sliced the tops off rooms and left a picture of a ceiling. A photograph on
        this site is a record, and a record is shown whole; the frame letterboxes onto a
        quiet ground rather than cropping to fit (Chinguun, August 2026).
      */}
      <div
        className={`relative w-full overflow-hidden rounded-lg bg-ink-50 ${frameClassName}`}
      >
        {photos.map((photo, position) => (
          <div
            key={photo.id}
            /*
              All photographs stay mounted and stacked, exactly as the hero does it:
              swapping one <img>'s src would show the browser's loading gap between
              frames; crossfading between decoded layers does not.
            */
            aria-hidden={position !== index}
            className="absolute inset-0 transition-opacity duration-700 ease-[cubic-bezier(0.19,1,0.22,1)] motion-reduce:transition-none"
            style={{ opacity: position === index ? 1 : 0 }}
          >
            <button
              type="button"
              onClick={() => show(photo)}
              tabIndex={position === index ? undefined : -1}
              className="group block h-full w-full cursor-pointer"
              aria-label={`${labels.enlarge}: ${photo.alt}`}
            >
              <Image
                src={photo.image}
                alt={position === index ? photo.alt : ""}
                fill
                loading={position === 0 ? undefined : "lazy"}
                sizes="(min-width: 64rem) 60vw, 100vw"
                className="object-contain transition-opacity duration-100 group-hover:opacity-95"
              />
            </button>
          </div>
        ))}
      </div>

      {/*
        Caption first, across the full width, then the controls beneath it. These used
        to sit side by side, which is fine on a wide event page and cramped the caption
        into a six-line ribbon when the gallery stands in a column beside text.
      */}
      <div className="mt-3">
        <p className="max-w-[60ch] text-small text-ink-600 text-pretty">
          {current.caption || current.alt}
        </p>

        {!single && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {photos.map((photo, position) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setIndex(position)}
                aria-label={`${labels.show}: ${photo.alt || position + 1}`}
                aria-current={position === index ? "true" : undefined}
                /* The bar is 2px; the target around it is 44 — most readers are on a phone. */
                className="group flex min-h-11 cursor-pointer items-center rounded-xs"
              >
                <span
                  aria-hidden
                  className="block h-0.5 w-9 bg-ink-200 transition-colors group-hover:bg-ink-400"
                >
                  <span
                    className={`block h-full bg-copper-600 ${
                      position === index
                        ? animate && !paused && open === null
                          ? "animate-hero-progress"
                          : "w-full"
                        : "w-0"
                    }`}
                  />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/*
        Native <dialog>: it takes the top layer, so it cannot be clipped by an ancestor's
        overflow, and it brings focus trapping and Escape without a library.
      */}
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(null)}
        onClick={(event) => {
          // Clicking the backdrop — the dialog element itself — dismisses.
          if (event.target === dialogRef.current) hide();
        }}
        className="max-h-[92dvh] max-w-[94vw] overscroll-contain bg-transparent backdrop:bg-ink-950/85"
      >
        {open && (
          <figure className="flex max-h-[92dvh] flex-col">
            <Image
              src={open.image}
              alt={open.alt}
              width={2200}
              height={1650}
              /* Without this the enlarged photograph is served at full width to a
                 phone — the heaviest request on the site, on hospital wifi. */
              sizes="94vw"
              className="min-h-0 w-auto object-contain"
            />
            <figcaption className="mt-3 flex items-start justify-between gap-6">
              <span className="max-w-[68ch] text-small text-paper">
                {open.caption || open.alt}
              </span>
              <button
                type="button"
                onClick={hide}
                className="shrink-0 cursor-pointer text-small font-semibold text-paper underline underline-offset-2"
              >
                {labels.close}
              </button>
            </figcaption>
          </figure>
        )}
      </dialog>
    </section>
  );
}
