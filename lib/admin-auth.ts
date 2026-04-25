import { createClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_ACCESS_COOKIE = "flangie-admin-access-token";
export const ADMIN_REFRESH_COOKIE = "flangie-admin-refresh-token";

function getSupabaseAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase auth environment variables.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function getAllowedAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAllowedAdminEmail(email: string | null | undefined) {
  if (!email) {
    return false;
  }

  return getAllowedAdminEmails().has(email.trim().toLowerCase());
}

export async function getAuthenticatedAdminUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ADMIN_ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(ADMIN_REFRESH_COOKIE)?.value;

  const supabase = getSupabaseAuthClient();

  if (accessToken) {
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (!error && data.user) {
      return data.user;
    }
  }

  if (!refreshToken) {
    return null;
  }

  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

  if (error || !data.user || !data.session) {
    return null;
  }

  await setAdminSessionCookies({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in,
  });

  return data.user;
}

export async function requireAdminUser(): Promise<User> {
  const user = await getAuthenticatedAdminUser();

  if (!user) {
    redirect("/login");
  }

  if (!isAllowedAdminEmail(user.email)) {
    redirect("/");
  }

  return user;
}

export async function setAdminSessionCookies({
  accessToken,
  refreshToken,
  expiresIn,
}: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}) {
  const cookieStore = await cookies();

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: expiresIn,
  };

  cookieStore.set(ADMIN_ACCESS_COOKIE, accessToken, options);
  cookieStore.set(ADMIN_REFRESH_COOKIE, refreshToken, options);
}

export async function clearAdminSessionCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_ACCESS_COOKIE);
  cookieStore.delete(ADMIN_REFRESH_COOKIE);
}

export function createAdminAuthClient() {
  return getSupabaseAuthClient();
}
