import { NextResponse } from "next/server";

// Redirect with a relative Location, so the browser stays on whatever host it
// is already using. Absolute URLs built on the server can point at the wrong
// host behind proxies and port forwarding, which loses the auth cookies.
export function relativeRedirect(path: string) {
  return new NextResponse(null, { status: 307, headers: { Location: path } });
}
