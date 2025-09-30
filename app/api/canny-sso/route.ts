import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function GET(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const user = await currentUser();

  if (!user) {
    return new NextResponse("User not found", { status: 404 });
  }

  const redirect = request.nextUrl.searchParams.get("redirect");
  const companyID = request.nextUrl.searchParams.get("companyID");

  if (!redirect || !companyID) {
    return new NextResponse(
      "Missing required parameters: redirect and companyID",
      {
        status: 400,
      },
    );
  }

  const privateKey = process.env.CANNY_PRIVATE_KEY;

  if (!privateKey) {
    return new NextResponse("Server configuration error", { status: 500 });
  }

  const userData = {
    avatarURL: user.imageUrl,
    email: user.emailAddresses[0]?.emailAddress,
    id: user.id,
    name:
      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      user.username ||
      user.id,
  };

  const ssoToken = jwt.sign(userData, privateKey, { algorithm: "HS256" });

  const cannyUrl = new URL("https://canny.io/api/redirects/sso");
  cannyUrl.searchParams.set("redirect", redirect);
  cannyUrl.searchParams.set("companyID", companyID);
  cannyUrl.searchParams.set("ssoToken", ssoToken);

  return NextResponse.redirect(cannyUrl.toString());
}
