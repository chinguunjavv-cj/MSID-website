"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export interface HeroSlide {
  image: string;
  alt: string;
  /** What the photograph is — an event title. Absent for a plain hero image. */
  label?: string;
  /** When and where. Stated, never implied. */
  meta?: string;
  href?: string;
}

/**
 * The photographic backdrop to the hero.
 *
 * PRODUCT.md names "competing banner carousels" as an anti-reference, and it is right to.
 * The thing it warns against is a stack of slides each pitching something different, so
 * the visitor reads none of them. This is deliberately not that, and the difference is
 * structural rather than cosmetic:
 *
 *   The message never moves. Headline, lead and calls to action sit outside this
 *   component and never change. Only the photograph behind them does.
 *
 *   Each photograph is evidence, not a pitch. MSID is two years old; the strongest thing
 *   it can say is that it was in Xi'an in June and running training at home the same
 *   week. So every slide carries the event's name and date and links to its page — a
 *   dated record, which is what the rest of this site already is.
 *
 * Slides come from events the administrator has already published with a cover
 * photograph. There is no new screen to learn: add an event, give it a cover, and it
 * appears here.
 */
export function HeroCarousel({
  slides,
  labels,
  children,
}: {
  slides: HeroSlide[];
  labels: { showSlide: string; region: string };
  /** The hero's own content — headline, lead, calls to action. Sits above the photo. */
  children: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [animate, setAnimate] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);

  /*
    Motion is opt-in, decided after mount. The server cannot know the visitor's motion
    preference, so the first paint is always the still first slide; auto-advance only
    ever starts on a client that has told us it is welcome.
  */
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setAnimate(!query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  const advance = useCallback(() => {
    setIndex((current) => (current + 1) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (!animate || paused || slides.length < 2) return;
    // Seven seconds. These are photographs to be looked at, not slides to be got through.
    const timer = window.setInterval(advance, 7000);
    return () => window.clearInterval(timer);
  }, [animate, paused, slides.length, advance]);

  if (slides.length === 0) return null;

  const single = slides.length < 2;

  return (
    <div
      ref={regionRef}
      aria-roledescription="carousel"
      aria-label={labels.region}
      className="relative"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!regionRef.current?.contains(event.relatedTarget as Node)) setPaused(false);
      }}
    >
      {slides.map((slide, position) => (
        <div
          key={slide.image}
          /*
            All slides stay mounted and stacked. Swapping the `src` of one <img> would
            show the browser's own loading gap between photographs; crossfading between
            already-decoded layers does not.
          */
          aria-hidden={position !== index}
          className="absolute inset-0 transition-opacity duration-700 ease-[cubic-bezier(0.19,1,0.22,1)] motion-reduce:transition-none"
          style={{ opacity: position === index ? 1 : 0 }}
        >
          <Image
            src={slide.image}
            alt={position === index ? slide.alt : ""}
            fill
            // Only the first is worth blocking the render for.
            priority={position === 0}
            loading={position === 0 ? undefined : "lazy"}
            sizes="100vw"
            className="object-cover"
          />
        </div>
      ))}

      {/*
        Two scrims, not one. A flat overlay dark enough for the headline turns every
        photograph to mud; this keeps the right-hand side of the frame readable as a
        photograph while the left, where the type sits, stays comfortably past 4.5:1.
      */}
      <div aria-hidden className="absolute inset-0 bg-ink-950/45" />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-ink-950/90 via-ink-950/72 to-ink-950/30"
      />

      {/*
        Content and caption are in normal flow, not absolutely positioned over the
        panel. Pinning the caption to the bottom and reserving room with padding held
        until the calls to action wrapped to two lines on a phone — then the caption
        printed straight across a button. Two languages of differing length make that
        collision a matter of when, not if.
      */}
      <div className="relative">{children}</div>

      {!single && (
        /*
          The caption carries its own gradient rather than trusting the panel scrim.
          It sits at the foot of the frame, which is exactly where a projector screen or
          a window tends to be — on the DDWeek photograph the caption landed on a lit
          screen and all but disappeared. A local scrim makes legibility independent of
          whatever the next photograph happens to contain.
        */
        <div className="relative bg-gradient-to-t from-ink-950/95 via-ink-950/70 to-transparent pt-10">
          <div className="shell pb-6">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              {/* What you are looking at, and when. */}
              <div className="min-w-0">
                {slides[index].label &&
                  (slides[index].href ? (
                    <Link
                      href={slides[index].href}
                      className="group inline-flex max-w-full flex-col rounded-xs"
                    >
                      <span className="truncate text-small font-semibold text-paper underline-offset-4 group-hover:underline">
                        {slides[index].label}
                      </span>
                      {slides[index].meta && (
                        <span className="tabular mt-0.5 text-[0.8125rem] text-ink-300">
                          {slides[index].meta}
                        </span>
                      )}
                    </Link>
                  ) : (
                    <span className="truncate text-small font-semibold text-paper">
                      {slides[index].label}
                    </span>
                  ))}
              </div>

              {/*
                The control is the indicator. Segments rather than dots, because a
                segment can show elapsed time as well as position — and the filled
                width is the honest answer to "how long until this moves".
              */}
              <div className="flex shrink-0 items-center gap-1.5">
                {slides.map((slide, position) => (
                  <button
                    key={slide.image}
                    type="button"
                    onClick={() => setIndex(position)}
                    aria-label={`${labels.showSlide}: ${slide.label ?? position + 1}`}
                    aria-current={position === index ? "true" : undefined}
                    /*
                      The bar is 2px; the target around it is 44. A control that is
                      only as tall as the line it draws is a control for a mouse, and
                      most of this site's readers are on a phone.
                    */
                    className="group flex min-h-11 cursor-pointer items-center rounded-xs"
                  >
                    <span
                      aria-hidden
                      className="block h-0.5 w-9 bg-white/30 transition-colors group-hover:bg-white/60"
                    >
                      <span
                        className={`block h-full bg-copper-400 ${
                          position === index
                            ? animate && !paused
                              ? "animate-hero-progress"
                              : "w-full"
                            : "w-0"
                        }`}
                      />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
