"use client";

import { useEffect } from "react";

/**
 * Runtime error boundary. Shown in both languages for the same reason as the 404: the
 * boundary can render above the segment that resolved the locale.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="max-w-[24ch] text-h1 font-bold">Алдаа гарлаа</h1>
      <p className="mt-3 max-w-[48ch] text-ink-600">
        Хүсэлтийг боловсруулах явцад алдаа гарлаа. Дахин оролдоно уу.
      </p>

      <h2 className="mt-10 text-h3 font-bold" lang="en">
        Something went wrong
      </h2>
      <p className="mt-2 max-w-[48ch] text-ink-600" lang="en">
        An error occurred while handling your request. Please try again.
      </p>

      {error.digest && (
        <p className="tabular mt-6 text-[0.8125rem] text-ink-600">
          Reference: {error.digest}
        </p>
      )}

      <button type="button" onClick={reset} className="btn btn-primary mt-10 cursor-pointer">
        Дахин оролдох · Try again
      </button>
    </div>
  );
}
