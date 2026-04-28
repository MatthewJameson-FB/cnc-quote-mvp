import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdminEnvStatus() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

  return {
    urlPresent: Boolean(url),
    serviceRoleKeyPresent: Boolean(serviceRoleKey),
    url,
    serviceRoleKey,
  };
}

export function createSupabaseAdminClient() {
  const { url, serviceRoleKey } = getSupabaseAdminEnvStatus();

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
