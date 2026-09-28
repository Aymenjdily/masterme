import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const session = getSessionCookie(request);

  const isPublicRoute =
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname.startsWith("/api/auth") ||
    request.nextUrl.pathname.startsWith("/images") ||
    // These routes authenticate themselves via a CRON_SECRET bearer token, not a
    // browser session, since they're meant to be called by an external scheduler.
    request.nextUrl.pathname === "/api/jobs/scrape" ||
    request.nextUrl.pathname === "/api/news/fetch" ||
    request.nextUrl.pathname === "/api/infra/recalculate";

  // Logged in users go straight to the dashboard
  if (session && isPublicRoute && request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Not logged in → back to login
  if (!session && !isPublicRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
