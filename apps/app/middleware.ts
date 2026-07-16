import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, NextRequest } from "next/server";

// Mirrors `isAuthEnabled` from src/global-config
const isAuthEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const isProtectedRoute = createRouteMatcher(["/api/canny-sso(.*)"]);

const withCacheHeaders = (request: NextRequest): NextResponse => {
  if (request.nextUrl.pathname.startsWith("/api")) return NextResponse.next();

  const response = NextResponse.next();
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
};

export default isAuthEnabled
  ? clerkMiddleware(
      async (auth, request) => {
        if (isProtectedRoute(request)) {
          await auth.protect();
        }
        return withCacheHeaders(request);
      },
      {
        publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      },
    )
  : withCacheHeaders;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|inp|csv|docx?|xlsx?|zip|txt|webmanifest)).*)",
  ],
};
