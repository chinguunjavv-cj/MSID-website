"use client";

import { useState } from "react";
import type { EventFee, EventOrganiser, EventSession, Locale } from "@/lib/db/types";
import {
  deleteEventFeeAction,
  deleteEventOrganiserAction,
  deleteEventSessionAction,
  saveEventFeeAction,
  saveEventOrganiserAction,
  saveEventSessionAction,
} from "@/lib/actions/admin";

/**
 * Fee tiers and programme rows for an event.
 *
 * Both are inline editors rather than separate pages: an administrator building a
 * congress adds five fee tiers and thirty programme rows in one sitting, and a
 * page-per-row flow would make that miserable. Each row is its own form so a save
 * touches exactly one record.
 */

const AUDIENCES = [
  { value: "member", mn: "Гишүүн", en: "Member" },
  { value: "non_member", mn: "Гишүүн бус", en: "Non-member" },
  { value: "trainee", mn: "Резидент", en: "Trainee" },
  { value: "student", mn: "Оюутан", en: "Student" },
  { value: "international", mn: "Гадаад оролцогч", en: "International" },
];

export function EventFees({
  eventId,
  fees,
  locale,
  labels,
}: {
  eventId: string;
  fees: EventFee[];
  locale: Locale;
  labels: Record<string, string>;
}) {
  const mn = locale === "mn";
  const [adding, setAdding] = useState(false);

  return (
    <section className="mt-16 max-w-4xl border-t border-ink-200 pt-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-h3 font-bold">{mn ? "Оролцооны төлбөр" : "Registration fees"}</h2>
        <button
          type="button"
          onClick={() => setAdding((value) => !value)}
          className="btn btn-secondary cursor-pointer"
        >
          {adding ? labels.cancel : `+ ${labels.add}`}
        </button>
      </div>

      {fees.length === 0 && !adding && (
        <p className="mt-4 text-ink-600">
          {mn
            ? "Төлбөрийн ангилал нэмээгүй бол бүртгэл үнэгүй болно."
            : "With no fee tiers, registration is free."}
        </p>
      )}

      <div className="mt-5 space-y-3">
        {adding && (
          <FeeRow eventId={eventId} locale={locale} labels={labels} onDone={() => setAdding(false)} />
        )}
        {fees.map((fee) => (
          <FeeRow key={fee.id} eventId={eventId} fee={fee} locale={locale} labels={labels} />
        ))}
      </div>
    </section>
  );
}

function FeeRow({
  eventId,
  fee,
  locale,
  labels,
  onDone,
}: {
  eventId: string;
  fee?: EventFee;
  locale: Locale;
  labels: Record<string, string>;
  onDone?: () => void;
}) {
  const mn = locale === "mn";

  return (
    <div className="border border-ink-200 bg-ink-50 p-4">
      <form action={saveEventFeeAction} onSubmit={onDone} className="grid gap-3 lg:grid-cols-12">
        <input type="hidden" name="eventId" value={eventId} />
        {fee && <input type="hidden" name="feeId" value={fee.id} />}

        <label className="lg:col-span-3">
          <span className="field-label">{mn ? "Нэр (МН)" : "Label (MN)"}</span>
          <input name="label_mn" defaultValue={fee?.label_mn ?? ""} className="input" lang="mn" />
        </label>
        <label className="lg:col-span-3">
          <span className="field-label">{mn ? "Нэр (EN)" : "Label (EN)"}</span>
          <input name="label_en" defaultValue={fee?.label_en ?? ""} className="input" lang="en" />
        </label>
        <label className="lg:col-span-2">
          <span className="field-label">{mn ? "Ангилал" : "Audience"}</span>
          <select name="audience" defaultValue={fee?.audience ?? "non_member"} className="select">
            {AUDIENCES.map((audience) => (
              <option key={audience.value} value={audience.value}>
                {mn ? audience.mn : audience.en}
              </option>
            ))}
          </select>
        </label>
        <label className="lg:col-span-2">
          <span className="field-label">{mn ? "Үнэ (₮)" : "Amount (MNT)"}</span>
          <input
            name="amount_mnt"
            type="number"
            min="0"
            step="1000"
            defaultValue={fee?.amount_mnt ?? 0}
            className="input"
          />
        </label>
        <label className="lg:col-span-2">
          <span className="field-label">{mn ? "Хөнгөлөлттэй" : "Early-bird"}</span>
          <input
            name="early_amount_mnt"
            type="number"
            min="0"
            step="1000"
            defaultValue={fee?.early_amount_mnt ?? ""}
            className="input"
          />
        </label>

        <div className="flex items-end gap-2 lg:col-span-12">
          <input type="hidden" name="sort" value={fee?.sort ?? 0} />
          <button type="submit" className="btn btn-primary cursor-pointer">
            {labels.save}
          </button>
        </div>
      </form>

      {fee && (
        <form
          action={deleteEventFeeAction}
          className="mt-2"
          onSubmit={(event) => {
            if (!window.confirm(labels.confirmDelete)) event.preventDefault();
          }}
        >
          <input type="hidden" name="feeId" value={fee.id} />
          <button
            type="submit"
            className="cursor-pointer text-small text-ink-600 underline underline-offset-2 hover:text-status-expired"
          >
            {labels.delete}
          </button>
        </form>
      )}
    </div>
  );
}

export function EventProgramme({
  eventId,
  sessions,
  locale,
  labels,
}: {
  eventId: string;
  sessions: EventSession[];
  locale: Locale;
  labels: Record<string, string>;
}) {
  const mn = locale === "mn";
  const [adding, setAdding] = useState(false);

  return (
    <section className="mt-16 max-w-4xl border-t border-ink-200 pt-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-h3 font-bold">{mn ? "Хөтөлбөр" : "Programme"}</h2>
        <button
          type="button"
          onClick={() => setAdding((value) => !value)}
          className="btn btn-secondary cursor-pointer"
        >
          {adding ? labels.cancel : `+ ${labels.add}`}
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {adding && (
          <SessionRow
            eventId={eventId}
            locale={locale}
            labels={labels}
            onDone={() => setAdding(false)}
          />
        )}
        {sessions.map((session) => (
          <SessionRow
            key={session.id}
            eventId={eventId}
            session={session}
            locale={locale}
            labels={labels}
          />
        ))}
      </div>
    </section>
  );
}

function SessionRow({
  eventId,
  session,
  locale,
  labels,
  onDone,
}: {
  eventId: string;
  session?: EventSession;
  locale: Locale;
  labels: Record<string, string>;
  onDone?: () => void;
}) {
  const mn = locale === "mn";

  return (
    <div className="border border-ink-200 bg-ink-50 p-4">
      <form action={saveEventSessionAction} onSubmit={onDone} className="grid gap-3 lg:grid-cols-12">
        <input type="hidden" name="eventId" value={eventId} />
        {session && <input type="hidden" name="sessionId" value={session.id} />}

        <label className="lg:col-span-3">
          <span className="field-label">{mn ? "Өдөр" : "Day"}</span>
          <input name="day" type="date" defaultValue={session?.day ?? ""} className="input" />
        </label>
        <label className="lg:col-span-2">
          <span className="field-label">{mn ? "Эхлэх" : "From"}</span>
          <input name="starts_at" defaultValue={session?.starts_at ?? ""} placeholder="09:00" className="input" />
        </label>
        <label className="lg:col-span-2">
          <span className="field-label">{mn ? "Дуусах" : "To"}</span>
          <input name="ends_at" defaultValue={session?.ends_at ?? ""} placeholder="09:45" className="input" />
        </label>
        <label className="lg:col-span-2">
          <span className="field-label">{mn ? "Танхим (МН)" : "Room (MN)"}</span>
          <input name="room_mn" defaultValue={session?.room_mn ?? ""} className="input" lang="mn" />
        </label>
        <label className="lg:col-span-3">
          <span className="field-label">{mn ? "Танхим (EN)" : "Room (EN)"}</span>
          <input name="room_en" defaultValue={session?.room_en ?? ""} className="input" lang="en" />
        </label>

        <label className="lg:col-span-6">
          <span className="field-label">{mn ? "Сэдэв (МН)" : "Title (MN)"}</span>
          <input name="title_mn" defaultValue={session?.title_mn ?? ""} className="input" lang="mn" />
        </label>
        <label className="lg:col-span-6">
          <span className="field-label">{mn ? "Сэдэв (EN)" : "Title (EN)"}</span>
          <input name="title_en" defaultValue={session?.title_en ?? ""} className="input" lang="en" />
        </label>

        <label className="lg:col-span-6">
          <span className="field-label">{mn ? "Илтгэгч (МН)" : "Speaker (MN)"}</span>
          <input name="speaker_mn" defaultValue={session?.speaker_mn ?? ""} className="input" lang="mn" />
        </label>
        <label className="lg:col-span-4">
          <span className="field-label">{mn ? "Илтгэгч (EN)" : "Speaker (EN)"}</span>
          <input name="speaker_en" defaultValue={session?.speaker_en ?? ""} className="input" lang="en" />
        </label>
        <label className="lg:col-span-2">
          <span className="field-label">{mn ? "Эрэмбэ" : "Order"}</span>
          <input name="sort" type="number" defaultValue={session?.sort ?? 0} className="input" />
        </label>

        <div className="lg:col-span-12">
          <button type="submit" className="btn btn-primary cursor-pointer">
            {labels.save}
          </button>
        </div>
      </form>

      {session && (
        <form
          action={deleteEventSessionAction}
          className="mt-2"
          onSubmit={(event) => {
            if (!window.confirm(labels.confirmDelete)) event.preventDefault();
          }}
        >
          <input type="hidden" name="sessionId" value={session.id} />
          <button
            type="submit"
            className="cursor-pointer text-small text-ink-600 underline underline-offset-2 hover:text-status-expired"
          >
            {labels.delete}
          </button>
        </form>
      )}
    </div>
  );
}

/**
 * The institutions holding the meeting.
 *
 * A congress in this field is jointly organised as a rule — the September course runs
 * across four institutions — and naming them inside the summary paragraph buries the
 * fact that establishes whose authority the meeting carries. Two fields each: what the
 * institution is called, and what it is to this meeting.
 */
export function EventOrganisers({
  eventId,
  organisers,
  locale,
  labels,
}: {
  eventId: string;
  organisers: EventOrganiser[];
  locale: Locale;
  labels: Record<string, string>;
}) {
  const mn = locale === "mn";
  const [adding, setAdding] = useState(false);

  return (
    <section className="mt-16 max-w-4xl border-t border-ink-200 pt-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-h3 font-bold">{mn ? "Зохион байгуулагчид" : "Organisers"}</h2>
        <button
          type="button"
          onClick={() => setAdding((value) => !value)}
          className="btn btn-secondary cursor-pointer"
        >
          {adding ? labels.cancel : `+ ${labels.add}`}
        </button>
      </div>

      <p className="mt-2 max-w-[60ch] text-small text-ink-600">
        {mn
          ? "Арга хэмжээг хамтран зохион байгуулж буй байгууллагууд. Нэг ч байгууллага оруулаагүй бол уг хэсэг харагдахгүй."
          : "The institutions holding this meeting jointly. The section is hidden when none are listed."}
      </p>

      <div className="mt-5 space-y-3">
        {adding && (
          <OrganiserRow
            eventId={eventId}
            locale={locale}
            labels={labels}
            onDone={() => setAdding(false)}
          />
        )}
        {organisers.map((organiser) => (
          <OrganiserRow
            key={organiser.id}
            eventId={eventId}
            organiser={organiser}
            locale={locale}
            labels={labels}
          />
        ))}
      </div>
    </section>
  );
}

function OrganiserRow({
  eventId,
  organiser,
  locale,
  labels,
  onDone,
}: {
  eventId: string;
  organiser?: EventOrganiser;
  locale: Locale;
  labels: Record<string, string>;
  onDone?: () => void;
}) {
  const mn = locale === "mn";

  return (
    <div className="border border-ink-200 bg-ink-50 p-4">
      <form
        action={saveEventOrganiserAction}
        onSubmit={onDone}
        className="grid gap-3 lg:grid-cols-12"
      >
        <input type="hidden" name="eventId" value={eventId} />
        {organiser && <input type="hidden" name="organiserId" value={organiser.id} />}

        <label className="lg:col-span-6">
          <span className="field-label">{mn ? "Нэр (МН)" : "Name (MN)"}</span>
          <input name="name_mn" defaultValue={organiser?.name_mn ?? ""} className="input" lang="mn" />
        </label>
        <label className="lg:col-span-6">
          <span className="field-label">{mn ? "Нэр (EN)" : "Name (EN)"}</span>
          <input name="name_en" defaultValue={organiser?.name_en ?? ""} className="input" lang="en" />
        </label>

        <label className="lg:col-span-5">
          <span className="field-label">{mn ? "Гүйцэтгэх үүрэг (МН)" : "Role (MN)"}</span>
          <input
            name="role_mn"
            defaultValue={organiser?.role_mn ?? ""}
            placeholder={mn ? "Академик түнш" : ""}
            className="input"
            lang="mn"
          />
        </label>
        <label className="lg:col-span-5">
          <span className="field-label">{mn ? "Гүйцэтгэх үүрэг (EN)" : "Role (EN)"}</span>
          <input
            name="role_en"
            defaultValue={organiser?.role_en ?? ""}
            placeholder="Academic partner"
            className="input"
            lang="en"
          />
        </label>
        <label className="lg:col-span-2">
          <span className="field-label">{mn ? "Эрэмбэ" : "Order"}</span>
          <input name="sort" type="number" defaultValue={organiser?.sort ?? 0} className="input" />
        </label>

        <div className="lg:col-span-12">
          <button type="submit" className="btn btn-primary cursor-pointer">
            {labels.save}
          </button>
        </div>
      </form>

      {organiser && (
        <form
          action={deleteEventOrganiserAction}
          className="mt-2"
          onSubmit={(event) => {
            if (!window.confirm(labels.confirmDelete)) event.preventDefault();
          }}
        >
          <input type="hidden" name="organiserId" value={organiser.id} />
          <button
            type="submit"
            className="cursor-pointer text-small text-ink-600 underline underline-offset-2 hover:text-status-expired"
          >
            {labels.delete}
          </button>
        </form>
      )}
    </div>
  );
}
