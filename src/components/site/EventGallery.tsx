"use client";

import Image from "next/image";
import { useRef, useState } from "react";

/**
 * Photographs documenting one event.
 *
 * The grid is server-rendered and useful with no JavaScript at all — the photographs are
 * already there, at a readable size, each with its caption. The dialog is an enhancement
 * on top of that, not the thing that makes the section work; on hospital wifi the record
 * is legible before any script has run.
 *
 * Thumbnails are a uniform 4:3 because every photograph MSID sends is 4:3 off a phone,
 * so in practice nothing is cropped. Anything of another shape is cropped in the
 * thumbnail only — the dialog always shows the whole frame, `object-contain`.
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
}: {
  photos: GalleryPhoto[];
  labels: { heading: string; enlarge: string; close: string };
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<GalleryPhoto | null>(null);

  if (photos.length === 0) return null;

  function show(photo: GalleryPhoto) {
    setOpen(photo);
    dialogRef.current?.showModal();
  }

  function hide() {
    dialogRef.current?.close();
    setOpen(null);
  }

  return (
    <section className="mt-14">
      <h2 className="text-h3 font-bold">{labels.heading}</h2>

      <ul className="mt-6 grid gap-x-6 gap-y-8 sm:grid-cols-2">
        {photos.map((photo) => (
          <li key={photo.id}>
            <figure>
              <button
                type="button"
                onClick={() => show(photo)}
                className="group block w-full cursor-pointer"
                aria-label={`${labels.enlarge}: ${photo.alt}`}
              >
                <Image
                  src={photo.image}
                  alt={photo.alt}
                  width={1200}
                  height={900}
                  className="aspect-4/3 w-full object-cover transition-opacity duration-100 group-hover:opacity-90"
                />
              </button>
              {photo.caption && (
                <figcaption className="mt-2 max-w-[52ch] text-small text-ink-600 text-pretty">
                  {photo.caption}
                </figcaption>
              )}
            </figure>
          </li>
        ))}
      </ul>

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
        className="max-h-[92dvh] max-w-[94vw] bg-transparent backdrop:bg-ink-950/85"
      >
        {open && (
          <figure className="flex max-h-[92dvh] flex-col">
            <Image
              src={open.image}
              alt={open.alt}
              width={2200}
              height={1650}
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
