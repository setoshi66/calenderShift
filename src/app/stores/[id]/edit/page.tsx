import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/nav";
import { getViewMode } from "@/lib/view-mode";
import { updateStore } from "../../actions";

export default async function EditStorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const [store, viewMode] = await Promise.all([prisma.store.findUnique({ where: { id } }), getViewMode()]);
  if (!store) notFound();

  return (
    <>
      <Nav userEmail={session?.user?.email} viewMode={viewMode} title="店舗を編集" />
      <main style={{ padding: "2rem", maxWidth: 480, margin: "0 auto" }}>
        <form action={updateStore} style={{ display: "grid", gap: "0.75rem", marginTop: "1.5rem" }}>
          <input type="hidden" name="id" value={store.id} />
          <label>
            店舗名 *
            <input type="text" name="name" required defaultValue={store.name} style={{ width: "100%" }} />
          </label>
          <label>
            住所
            <input type="text" name="address" defaultValue={store.address ?? ""} style={{ width: "100%" }} />
          </label>
          <label>
            電話番号
            <input type="text" name="phone" defaultValue={store.phone ?? ""} style={{ width: "100%" }} />
          </label>
          <label>
            タイムゾーン
            <input type="text" name="timezone" defaultValue={store.timezone} style={{ width: "100%" }} />
          </label>
          <label>
            Google カレンダーID
            <input
              type="text"
              name="googleCalendarId"
              defaultValue={store.googleCalendarId ?? ""}
              placeholder="xxxx@group.calendar.google.com"
              style={{ width: "100%" }}
            />
          </label>
          <label>
            識別色（カレンダー・勤務表での表示色）
            <input type="color" name="color" defaultValue={store.color} style={{ display: "block" }} />
          </label>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button type="submit">保存</button>
            <a href="/stores">キャンセル</a>
          </div>
        </form>
      </main>
    </>
  );
}
