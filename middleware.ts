import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const signInUrl = process.env.SIGN_IN_URL as string;

export default clerkMiddleware(
  async (auth, request) => {
    if (request.headers.get("Authorization")?.startsWith("Basic ")) {
      const headers = new Headers(request.headers);
      headers.set("WWW-Authenticate", "Bearer"); // Remove Basic
      return NextResponse.json(
        { error: "Invalid auth" },
        { status: 401, headers },
      );
    }

    const authData = await auth();

    const isGuestFeatureOn =
      request.nextUrl.searchParams.get("FLAG_GUEST") === "true";

    if (!authData.userId && !isGuestFeatureOn) {
      return NextResponse.redirect(signInUrl);
    }

    const response = NextResponse.next();
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    return response;
  },
  {
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|inp|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
