import { HONEYPOT_FIELD, issueFormToken } from "@/lib/forms/guard";

/**
 * The hidden half of the spam defences, dropped into a public form.
 *
 * A server component, so the token is minted when the page renders and the client
 * never needs to know it exists.
 *
 * The honeypot is positioned off-screen rather than `display: none`, because a bot
 * worth stopping skips fields it can see are hidden that way. It carries `aria-hidden`
 * and a negative tab index so nobody using a screen reader or a keyboard ever lands on
 * it, and `autoComplete="off"` so a browser's own form-filler does not helpfully put an
 * address in it and lock a real applicant out.
 */
export function FormGuard() {
  return (
    /*
      Off-screen at full size, not collapsed to nothing. A zero-size, clipped container
      is as good as `display: none` to a scraper deciding which fields are real — the
      point is that the field looks ordinary to a machine reading the markup and is
      simply never seen by a person.
    */
    <div aria-hidden className="pointer-events-none absolute top-0 -left-[9999px]">
      <label htmlFor={HONEYPOT_FIELD}>Do not fill this in</label>
      <input
        id={HONEYPOT_FIELD}
        type="text"
        name={HONEYPOT_FIELD}
        tabIndex={-1}
        autoComplete="off"
        defaultValue=""
      />
      <input type="hidden" name="__t" value={issueFormToken()} />
    </div>
  );
}
