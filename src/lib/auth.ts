import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      // staffマスタに登録済みのメールアドレスのみログインを許可する
      const staff = await prisma.staff.findUnique({
        where: { email: user.email },
      });
      return Boolean(staff?.isActive);
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const staff = await prisma.staff.findUnique({
          where: { email: user.email },
        });
        if (staff) {
          token.staffId = staff.id;
          token.role = staff.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.staffId as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});
