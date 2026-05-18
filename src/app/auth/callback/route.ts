import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const errorDesc = url.searchParams.get("error_description");
  const next = url.searchParams.get("next") ?? "/";

  if (errorDesc) {
    return NextResponse.redirect(
      new URL(`/giris?error=${encodeURIComponent(errorDesc)}`, url.origin)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/giris?error=missing_code", url.origin)
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[auth/callback] exchange failed:", error.message);
      return NextResponse.redirect(
        new URL(
          `/giris?error=${encodeURIComponent(error.message)}`,
          url.origin
        )
      );
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[auth/callback] unexpected error:", e);
    return NextResponse.redirect(
      new URL("/giris?error=callback_failed", url.origin)
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
