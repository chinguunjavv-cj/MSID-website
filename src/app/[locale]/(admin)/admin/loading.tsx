/**
 * Shown while an admin page fetches its data.
 *
 * The admin shell — sidebar, heading, sign-out — is layout and stays put; only this
 * region is replaced. An editor moving between Арга хэмжээ and Гишүүд sees the list
 * shape immediately instead of the previous section's rows sitting there.
 */
export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Уншиж байна…</span>

      <div className="skeleton h-8 w-56" />

      <div className="mt-8 flex flex-col">
        <div className="skeleton h-10 w-full" />
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="mt-px flex items-center gap-4 border-b border-ink-200 py-4">
            <div className="skeleton h-4 flex-1" />
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
