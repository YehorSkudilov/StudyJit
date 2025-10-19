import { NextAuthOptions, DefaultSession, DefaultUser } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { RowDataPacket } from "mysql2";

// Extend NextAuth types
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
      // When user first signs in, add their ID to the token
      if (user) {
        token.id = user.id;
        console.log("✅ JWT: User signed in with ID:", user.id);
      }

      // Validate that the user still exists in the database
      if (token?.id) {
        try {
          const [rows] = await db.query<DbUser[]>(
            "SELECT id FROM users WHERE id = ?", 
            [parseInt(token.id)] // ✅ Convert string to number
          );
          
          if (rows.length === 0) {
            console.warn("⚠️ JWT: User no longer exists, clearing token");
            return {}; // Clear token if user deleted
          }
        } catch (error) {
          console.error("❌ JWT: Database error:", error);
          return {}; // Clear token on error
        }
      }

      return token;
    },

    async session({ session, token }) {
      // Add user ID to the session
      if (token?.id) {
        session.user.id = token.id;
        console.log("✅ Session: User ID set to:", token.id);
      } else {
        session.user.id = "";
        console.warn("⚠️ Session: No user ID in token");
      }

      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  
  pages: {
    signIn: '/login', // Optional: customize sign-in page
  },
  
  debug: process.env.NODE_ENV === 'development', // Enable debug logs in development
};