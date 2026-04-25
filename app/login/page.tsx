import { redirect } from "next/navigation";
import { getAuthenticatedAdminUser, isAllowedAdminEmail } from "@/lib/admin-auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getAuthenticatedAdminUser();

  if (user && isAllowedAdminEmail(user.email)) {
    redirect("/internal-admin");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Admin login
        </p>
        <h1 className="mt-3 text-3xl font-bold">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Use your allowlisted Supabase Auth account to access the internal admin area.
        </p>

        <LoginForm />
      </div>
    </main>
  );
}
