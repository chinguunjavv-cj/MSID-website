import "server-only";
import { all } from "@/lib/db";
import { RESOURCES } from "@/lib/admin/resources";

/**
 * Options for a relation field — the "supersedes" picker on a guideline, and anything
 * like it added later.
 *
 * This deliberately lives outside `actions/admin.ts`. Everything exported from a
 * `"use server"` module is a callable endpoint, and this function interpolates a column
 * name into SQL. As a server action, any signed-in editor could have called it with a
 * column name of their choosing and read whatever the query could reach. It is only
 * ever needed while rendering an admin page on the server, so it is a plain server
 * module instead — and the table and column are matched against the registry rather
 * than trusted.
 */

/** Columns the registry actually uses as relation labels, resolved from the registry. */
function isDeclaredRelation(table: string, labelColumn: string): boolean {
  return Object.values(RESOURCES).some((resource) =>
    resource.fields.some(
      (field) =>
        field.optionsFrom?.table === table &&
        field.optionsFrom.labelColumn === labelColumn,
    ),
  );
}

export async function relationOptions(
  table: string,
  labelColumn: string,
  excludeId?: string,
): Promise<{ value: string; label: string }[]> {
  if (!isDeclaredRelation(table, labelColumn)) return [];

  // Both names are now known to come from the registry, not from a request.
  return all<{ value: string; label: string }>(
    `SELECT id AS value, COALESCE(NULLIF(${labelColumn}_mn, ''), ${labelColumn}_en) AS label
     FROM ${table} WHERE id IS NOT ? ORDER BY created_at DESC LIMIT 200`,
    excludeId ?? null,
  );
}
