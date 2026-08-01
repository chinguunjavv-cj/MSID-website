import { notFound } from "next/navigation";
import { tr } from "@/lib/db/types";
import { currentUser } from "@/lib/auth/session";
import { isLocale } from "@/lib/i18n/config";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { listStaffUsers } from "@/lib/queries";
import { deleteStaffAction, updateStaffRoleAction } from "@/lib/actions/admin";
import { formatDateNumeric } from "@/lib/format";
import { StaffForm } from "@/components/admin/StaffForm";
import { Notice } from "@/components/ui/Primitives";

export default async function AdminUsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const mn = locale === "mn";
  const me = await currentUser();
  const staff = listStaffUsers();
  const isAdmin = me?.role === "admin";

  const roles = [
    { value: "editor", label: mn ? "Редактор" : "Editor" },
    { value: "admin", label: mn ? "Администратор" : "Administrator" },
  ];

  return (
    <div>
      <h1 className="text-h2 font-bold">{mn ? "Хэрэглэгчид" : "Users"}</h1>
      <p className="mt-3 max-w-[68ch] text-ink-600">
        {mn
          ? "Редактор нь агуулга нэмж засварлана. Администратор нэмэлтээр хэрэглэгч үүсгэх, эрх өөрчлөх боломжтой."
          : "Editors can add and change content. Administrators can additionally create users and change roles."}
      </p>

      {!isAdmin && (
        <div className="mt-6 max-w-2xl">
          <Notice tone="info">
            {mn
              ? "Зөвхөн администратор хэрэглэгч үүсгэх, эрх өөрчлөх боломжтой."
              : "Only an administrator can create users or change roles."}
          </Notice>
        </div>
      )}

      <div className="table-scroll mt-8">
        <table className="data-table">
          <caption className="sr-only">{mn ? "Хэрэглэгчид" : "Users"}</caption>
          <thead>
            <tr>
              <th scope="col">{mn ? "Нэр" : "Name"}</th>
              <th scope="col">{mn ? "И-мэйл" : "Email"}</th>
              <th scope="col">{mn ? "Сүүлд нэвтэрсэн" : "Last sign-in"}</th>
              <th scope="col">{mn ? "Эрх" : "Role"}</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((user) => (
              <tr key={user.id}>
                <td className="font-medium text-ink-900">
                  {tr(user, "name", locale) || "—"}
                  {user.id === me?.id && (
                    <span className="pill pill-info ml-2">{mn ? "Та" : "You"}</span>
                  )}
                </td>
                <td>{user.email}</td>
                <td className="tabular whitespace-nowrap">
                  {user.last_login_at
                    ? formatDateNumeric(user.last_login_at.slice(0, 10))
                    : "—"}
                </td>
                <td>
                  {isAdmin ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <form action={updateStaffRoleAction} className="flex gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <select
                          name="role"
                          defaultValue={user.role}
                          aria-label={mn ? "Эрх" : "Role"}
                          className="select w-auto py-1.5 text-[0.8125rem]"
                        >
                          {roles.map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="btn btn-secondary cursor-pointer px-3 py-1.5 text-[0.8125rem]"
                        >
                          {mn ? "Хадгалах" : "Save"}
                        </button>
                      </form>

                      {user.id !== me?.id && (
                        <form action={deleteStaffAction}>
                          <input type="hidden" name="userId" value={user.id} />
                          <button
                            type="submit"
                            className="cursor-pointer text-[0.8125rem] text-ink-600 underline underline-offset-2 hover:text-status-expired"
                          >
                            {mn ? "Устгах" : "Remove"}
                          </button>
                        </form>
                      )}
                    </div>
                  ) : (
                    <span>
                      {roles.find((role) => role.value === user.role)?.label ?? user.role}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <section className="mt-14 border-t border-ink-200 pt-8">
          <h2 className="text-h3 font-bold">{mn ? "Шинэ хэрэглэгч" : "New user"}</h2>
          <div className="mt-6">
            <StaffForm
              locale={locale}
              roles={roles}
              labels={{
                errorTitle: mn ? "Маягтад алдаа байна." : "The form has errors.",
                created: mn ? "Хэрэглэгч үүслээ." : "User created.",
                name: mn ? "Овог, нэр" : "Full name",
                email: mn ? "И-мэйл хаяг" : "Email address",
                password: mn ? "Нууц үг" : "Password",
                passwordHint: mn
                  ? `Доод тал нь ${MIN_PASSWORD_LENGTH} тэмдэгт.`
                  : `At least ${MIN_PASSWORD_LENGTH} characters.`,
                role: mn ? "Эрх" : "Role",
                create: mn ? "Үүсгэх" : "Create",
                saving: mn ? "Хадгалж байна…" : "Saving…",
              }}
            />
          </div>
        </section>
      )}
    </div>
  );
}
