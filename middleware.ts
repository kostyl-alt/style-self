import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // env vars missing → pass through without auth check
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  try {
    const { data: { user } } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;

    const appRoutes = ["/onboarding", "/self", "/discover", "/style", "/closet", "/learn"];
    const authRoutes = ["/login", "/signup"];
    const adminRoutes = ["/admin"];

    const isAppRoute = appRoutes.some((r) => pathname.startsWith(r));
    const isAuthRoute = authRoutes.some((r) => pathname === r);
    const isAdminRoute = adminRoutes.some((r) => pathname.startsWith(r));

    // ---- Admin ガード（最優先） ----
    // ADMIN_EMAILS（カンマ区切り）に列挙された email のみ /admin/* にアクセス可能。
    // 大文字小文字は両側 lowerCase 正規化して比較。
    if (isAdminRoute) {
      if (!user) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
      const adminEmails = (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const userEmail = (user.email ?? "").toLowerCase();
      if (!userEmail || !adminEmails.includes(userEmail)) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      // 認可OK: 通常のレスポンスを返す
      return supabaseResponse;
    }

    if (!user && isAppRoute) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (user && isAuthRoute) {
      // DB check happens in app/page.tsx — redirect there to branch on onboarding_completed
      return NextResponse.redirect(new URL("/", request.url));
    }
  } catch {
    // auth check failed → pass through
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
