import { NextAuthOptions, DefaultSession, DefaultUser } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { RowDataPacket } from "mysql2";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
  interface User extends DefaultUser {
    id: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}

interface DbUser extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  password: string;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("MISSING_CREDENTIALS");
        }

        const [rows] = await db.query<DbUser[]>(
          "SELECT * FROM users WHERE email = ?",
          [credentials.email]
        );
        const user = rows[0];
        if (!user) throw new Error("USER_NOT_FOUND");

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) throw new Error("INVALID_PASSWORD");

        return { id: user.id.toString(), email: user.email, name: user.name };
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;

      if (token?.id) {
        const [rows] = await db.query<DbUser[]>("SELECT id FROM users WHERE id = ?", [token.id]);
        if (rows.length === 0) {
          delete token.id; // ✅ safer instead of return {}
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.user = token?.id
        ? { ...session.user, id: token.id }
        : { ...session.user, id: "" };

      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};
