import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlPage(title: string, body: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; background: #f6f7fb; color: #111827; }
      .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      .card { width: min(640px, 100%); background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 28px; box-shadow: 0 8px 30px rgba(0,0,0,0.06); }
      h1 { margin: 0 0 12px; font-size: 28px; }
      p { margin: 0 0 10px; line-height: 1.5; }
      .muted { color: #6b7280; }
      .error { color: #b91c1c; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        ${body}
      </div>
    </div>
  </body>
</html>`;
}

function successPage(quoteRef: string, customerName: string, customerEmail: string, accepted = true) {
  return htmlPage(
    accepted ? "Lead accepted" : "Lead already accepted",
    accepted
      ? `
        <h1>Lead accepted ✅</h1>
        <p><strong>Quote reference:</strong> ${escapeHtml(quoteRef)}</p>
        <p><strong>Customer name:</strong> ${escapeHtml(customerName)}</p>
        <p><strong>Customer email:</strong> ${escapeHtml(customerEmail)}</p>
        <p>You have accepted this lead and should contact the customer directly.</p>
      `
      : `
        <h1>This lead has already been accepted.</h1>
        <p><strong>Quote reference:</strong> ${escapeHtml(quoteRef)}</p>
        <p><strong>Customer name:</strong> ${escapeHtml(customerName)}</p>
        <p><strong>Customer email:</strong> ${escapeHtml(customerEmail)}</p>
      `
  );
}

function errorPage(message: string) {
  return htmlPage(
    "Lead acceptance error",
    `
      <h1>Unable to accept lead</h1>
      <p class="error">${escapeHtml(message)}</p>
    `
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token")?.trim();

    if (!token) {
      return new Response(errorPage("Missing acceptance token."), {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const supabase = createSupabaseAdminClient();
    const { data: quote, error } = await supabase
      .from("quotes")
      .select("quote_ref, name, email, partner_accepted, status")
      .eq("partner_accept_token", token)
      .maybeSingle();

    if (error) {
      return new Response(errorPage("We could not verify this lead."), {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (!quote) {
      return new Response(errorPage("This acceptance link is invalid or has expired."), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (quote.partner_accepted || quote.status === "accepted") {
      return new Response(successPage(quote.quote_ref ?? "Unknown", quote.name ?? "Customer", quote.email ?? "", false), {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const { error: updateError } = await supabase
      .from("quotes")
      .update({
        partner_accepted: true,
        accepted_at: new Date().toISOString(),
        status: "accepted",
      })
      .eq("partner_accept_token", token);

    if (updateError) {
      return new Response(errorPage("We could not record the acceptance."), {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return new Response(successPage(quote.quote_ref ?? "Unknown", quote.name ?? "Customer", quote.email ?? ""), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return new Response(errorPage(message), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
