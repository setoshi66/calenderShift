import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/nav";
import { thStyle, tdStyle } from "@/lib/table-styles";
import { createStore, toggleStoreActive } from "./actions";

export default async function StoresPage() {
  const session = await auth();
  const canWrite = session?.user.role === "ADMIN" || session?.user.role === "STORE_MANAGER";
  const stores = await prisma.store.findMany({ orderBy: { name: "asc" } });

  return (
    <>
      <Nav userEmail={session?.user?.email} />
      <main style={{ padding: "2rem", maxWidth: 960, margin: "0 auto" }}>
        <h1>店舗</h1>

        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1.5rem" }}>
          <thead>
            <tr>
              <th style={thStyle}>色</th>
              <th style={thStyle}>店舗名</th>
              <th style={thStyle}>住所</th>
              <th style={thStyle}>電話番号</th>
              <th style={thStyle}>Google カレンダーID</th>
              <th style={thStyle}>状態</th>
              {canWrite && <th style={thStyle} />}
            </tr>
          </thead>
          <tbody>
            {stores.map((store) => (
              <tr key={store.id}>
                <td style={tdStyle}>
                  <span
                    style={{
                      display: "inline-block",
                      width: "1.1rem",
                      height: "1.1rem",
                      borderRadius: 3,
                      background: store.color,
                      border: "1px solid #ccc",
                    }}
                  />
                </td>
                <td style={tdStyle}>{store.name}</td>
                <td style={tdStyle}>{store.address}</td>
                <td style={tdStyle}>{store.phone}</td>
                <td style={tdStyle}>{store.googleCalendarId}</td>
                <td style={tdStyle}>{store.isActive ? "営業中" : "無効"}</td>
                {canWrite && (
                  <td style={{ ...tdStyle, display: "flex", gap: "0.5rem" }}>
                    <Link href={`/stores/${store.id}/edit`}>編集</Link>
                    <form action={toggleStoreActive}>
                      <input type="hidden" name="id" value={store.id} />
                      <input type="hidden" name="isActive" value={String(store.isActive)} />
                      <button type="submit">{store.isActive ? "無効化" : "有効化"}</button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {canWrite && (
          <section style={{ marginTop: "2rem" }}>
            <h2>店舗を登録</h2>
            <form action={createStore} style={{ display: "grid", gap: "0.75rem", maxWidth: 420 }}>
              <label>
                店舗名 *
                <input type="text" name="name" required style={{ width: "100%" }} />
              </label>
              <label>
                住所
                <input type="text" name="address" style={{ width: "100%" }} />
              </label>
              <label>
                電話番号
                <input type="text" name="phone" style={{ width: "100%" }} />
              </label>
              <label>
                タイムゾーン（未入力時は Asia/Tokyo）
                <input type="text" name="timezone" placeholder="Asia/Tokyo" style={{ width: "100%" }} />
              </label>
              <label>
                Google カレンダーID（後から設定も可）
                <input type="text" name="googleCalendarId" style={{ width: "100%" }} />
              </label>
              <label>
                識別色（カレンダー・勤務表での表示色）
                <input type="color" name="color" defaultValue="#4a90d9" style={{ display: "block" }} />
              </label>
              <button type="submit">登録</button>
            </form>
          </section>
        )}
      </main>
    </>
  );
}
