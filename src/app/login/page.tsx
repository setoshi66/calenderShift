import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <main style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button type="submit">Googleアカウントでログイン</button>
      </form>
    </main>
  );
}
