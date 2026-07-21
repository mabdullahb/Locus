import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ token }) {
        return !!token;
      },
    },
  },
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/history/:path*",
    "/settings/:path*",
    "/billing/:path*",
    "/api/leads/:path*",
    "/api/scrape/:path*",
    "/api/history/:path*",
    "/api/export/:path*",
    "/api/enrich/:path*",
    "/api/settings/:path*",
    "/api/billing/:path*",
  ],
};
