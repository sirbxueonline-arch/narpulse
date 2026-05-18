import createIntlMiddleware from "next-intl/middleware";
import { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { updateSession } from "./lib/supabase/middleware";

const intl = createIntlMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const response = intl(request);
  return updateSession(request, response);
}

export const config = {
  matcher: ["/((?!api|auth|_next|_vercel|.*\\..*).*)"],
};
