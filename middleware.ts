import { NextRequest, NextResponse } from "next/server";

const basicAuthUser = process.env.BASIC_AUTH_USER || "admin";
const basicAuthPassword = process.env.BASIC_AUTH_PASSWORD || "password";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.endsWith("js.map")) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/api/auth-webhook"))
    return NextResponse.next();

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Secure Area"',
      },
    });
  }
  const base64Credentials = authHeader.split(" ")[1];
  const credentials = Buffer.from(base64Credentials, "base64").toString(
    "utf-8",
  );
  const [username, password] = credentials.split(":");

  if (basicAuthUser !== username || basicAuthPassword !== password) {
    return new NextResponse("Invalid credentials", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Secure Area"',
      },
    });
  }

  return NextResponse.next();
}
