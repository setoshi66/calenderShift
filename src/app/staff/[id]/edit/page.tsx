import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/nav";
import { getViewMode } from "@/lib/view-mode";
import { updateStaff } from "../../actions";

export default async function EditStaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const [staff, stores, viewMode] = await Promise.all([
    prisma.staff.findUnique({ where: { id }, include: { storeAssignments: true } }),
    prisma.store.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    getViewMode(),
  ]);
  if (!staff) notFound();

  const assignedStoreIds = new Set(staff.storeAssignments.map((a) => a.storeId));

  return (
    <>
      <Nav userEmail={session?.user?.email} viewMode={viewMode} />
      <main style={{ padding: "2rem", maxWidth: 480, margin: "0 auto" }}>
        <h1>スタッフを編集</h1>
        <form action={updateStaff} style={{ display: "grid", gap: "0.75rem", marginTop: "1.5rem" }}>
          <input type="hidden" name="id" value={staff.id} />
          <label>
            氏名 *
            <input type="text" name="name" required defaultValue={staff.name} style={{ width: "100%" }} />
          </label>
          <label>
            メールアドレス（Googleログインに使用。未入力の場合ログイン不可）
            <input type="email" name="email" defaultValue={staff.email ?? ""} style={{ width: "100%" }} />
          </label>
          <label>
            電話番号
            <input type="text" name="phone" defaultValue={staff.phone ?? ""} style={{ width: "100%" }} />
          </label>
          <label>
            雇用形態
            <input
              type="text"
              name="employmentType"
              defaultValue={staff.employmentType ?? ""}
              placeholder="正社員 / パート / アルバイト"
              style={{ width: "100%" }}
            />
          </label>
          <label>
            ロール
            <select name="role" defaultValue={staff.role} style={{ width: "100%" }}>
              <option value="STAFF">スタッフ</option>
              <option value="STORE_MANAGER">店長</option>
              <option value="ADMIN">管理者</option>
            </select>
          </label>
          <fieldset>
            <legend>所属可能店舗</legend>
            {stores.map((store) => (
              <label key={store.id} style={{ display: "block" }}>
                <input
                  type="checkbox"
                  name="storeIds"
                  value={store.id}
                  defaultChecked={assignedStoreIds.has(store.id)}
                />{" "}
                {store.name}
              </label>
            ))}
          </fieldset>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button type="submit">保存</button>
            <a href="/staff">キャンセル</a>
          </div>
        </form>
      </main>
    </>
  );
}
