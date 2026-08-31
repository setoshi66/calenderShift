import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/nav";
import { thStyle, tdStyle } from "@/lib/table-styles";
import { createStaff, toggleStaffActive } from "./actions";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "管理者",
  STORE_MANAGER: "店長",
  STAFF: "スタッフ",
};

export default async function StaffPage() {
  const session = await auth();
  const canWrite = session?.user.role === "ADMIN" || session?.user.role === "STORE_MANAGER";

  const [staffList, stores] = await Promise.all([
    prisma.staff.findMany({
      orderBy: { name: "asc" },
      include: { storeAssignments: { include: { store: true } } },
    }),
    prisma.store.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <Nav userEmail={session?.user?.email} />
      <main style={{ padding: "2rem", maxWidth: 960, margin: "0 auto" }}>
        <h1>スタッフ</h1>

        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1.5rem" }}>
          <thead>
            <tr>
              <th style={thStyle}>氏名</th>
              <th style={thStyle}>メール</th>
              <th style={thStyle}>ロール</th>
              <th style={thStyle}>所属店舗</th>
              <th style={thStyle}>状態</th>
              {canWrite && <th style={thStyle} />}
            </tr>
          </thead>
          <tbody>
            {staffList.map((staff) => (
              <tr key={staff.id}>
                <td style={tdStyle}>{staff.name}</td>
                <td style={tdStyle}>{staff.email}</td>
                <td style={tdStyle}>{ROLE_LABEL[staff.role] ?? staff.role}</td>
                <td style={tdStyle}>{staff.storeAssignments.map((a) => a.store.name).join(", ")}</td>
                <td style={tdStyle}>{staff.isActive ? "有効" : "無効"}</td>
                {canWrite && (
                  <td style={{ ...tdStyle, display: "flex", gap: "0.5rem" }}>
                    <Link href={`/staff/${staff.id}/edit`}>編集</Link>
                    <form action={toggleStaffActive}>
                      <input type="hidden" name="id" value={staff.id} />
                      <input type="hidden" name="isActive" value={String(staff.isActive)} />
                      <button type="submit">{staff.isActive ? "無効化" : "有効化"}</button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {canWrite && (
          <section style={{ marginTop: "2rem" }}>
            <h2>スタッフを登録</h2>
            <form action={createStaff} style={{ display: "grid", gap: "0.75rem", maxWidth: 420 }}>
              <label>
                氏名 *
                <input type="text" name="name" required style={{ width: "100%" }} />
              </label>
              <label>
                メールアドレス（Googleログインに使用。未入力の場合ログイン不可）
                <input type="email" name="email" style={{ width: "100%" }} />
              </label>
              <label>
                電話番号
                <input type="text" name="phone" style={{ width: "100%" }} />
              </label>
              <label>
                雇用形態
                <input type="text" name="employmentType" placeholder="正社員 / パート / アルバイト" style={{ width: "100%" }} />
              </label>
              <label>
                ロール
                <select name="role" defaultValue="STAFF" style={{ width: "100%" }}>
                  <option value="STAFF">スタッフ</option>
                  <option value="STORE_MANAGER">店長</option>
                  <option value="ADMIN">管理者</option>
                </select>
              </label>
              <fieldset>
                <legend>所属可能店舗</legend>
                {stores.map((store) => (
                  <label key={store.id} style={{ display: "block" }}>
                    <input type="checkbox" name="storeIds" value={store.id} /> {store.name}
                  </label>
                ))}
              </fieldset>
              <button type="submit">登録</button>
            </form>
          </section>
        )}
      </main>
    </>
  );
}
