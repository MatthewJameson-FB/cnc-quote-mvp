"use server";

import { createAdminAuthClient, isAllowedAdminEmail, setAdminSessionCookies, clearAdminSessionCookies } from "@/lib/admin-auth";
import { ADMIN_ACCESS_COOKIE, ADMIN_REFRESH_COOKIE } from "@/lib/admin-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type LoginState = {
  error?: string;
};

export async function signIn(
  _state: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = createAdminAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session || !data.user) {
    await clearAdminSessionCookies();
    return { error: "Invalid email or password." };
  }

  if (!isAllowedAdminEmail(data.user.email)) {
    await supabase.auth.signOut();
    await clearAdminSessionCookies();
    return { error: "This account is not allowed to access admin." };
  }

  await setAdminSessionCookies({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in,
  });

  redirect("/internal-admin");
}

export async function signOut() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ADMIN_ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(ADMIN_REFRESH_COOKIE)?.value;

  try {
    if (accessToken && refreshToken) {
      const supabase = createAdminAuthClient();
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      await supabase.auth.signOut();
    }
  } catch {
    // Best effort: cookies are cleared below.
  }

  await clearAdminSessionCookies();
  redirect("/login");
}
