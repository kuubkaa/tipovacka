/**
 * Rozšíření Auth.js session typu — přidáváme `user.id` a `user.isAdmin`,
 * které doplňuje callback `session()` v src/auth.ts.
 */
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      isAdmin: boolean;
    };
  }
}
