import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login", // redirect if not authenticated
  },
});

export const config = {
  matcher: [
    "/((?!_next|favicon.ico|images|api/auth|api/db/initDB|login|public|$).*)",
  ],
};
