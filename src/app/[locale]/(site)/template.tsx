import { ViewTransition } from "react";

/**
 * Crossfades the page body between routes.
 *
 * This is a template rather than part of the layout, and that is the whole trick: Next
 * gives a template a fresh key on every navigation, so its contents genuinely unmount
 * and remount. A `<ViewTransition>` in the layout animates nothing, because `main` is
 * still the same `main` and React sees no element entering or leaving — which is
 * exactly what happened on the first attempt here.
 *
 * `default="none"` keeps the boundary out of transitions it has nothing to do with;
 * only an actual enter or exit plays.
 */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      {children}
    </ViewTransition>
  );
}
