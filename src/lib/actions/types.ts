/**
 * Shared shape returned by every form action.
 *
 * Lives outside the `"use server"` modules on purpose: a server-action module may only
 * export async functions, so a type exported from one becomes a build error the moment
 * anything imports it.
 */
export interface FormState {
  /** Messages for the summary at the top of the form. */
  errors: string[];
  /** Keyed by input name, rendered beneath the field it belongs to. */
  fieldErrors?: Record<string, string>;
  /** Set after a successful save that stays on the same page. */
  ok?: boolean;
}
