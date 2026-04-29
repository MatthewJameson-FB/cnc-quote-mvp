import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendChecklistEmail } from "@/lib/notifications";
import {
  appendPreleadLearningLog,
  createPreleadConversionLearningLogRow,
} from "@/lib/prelead-learning-log";

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
      body { margin: 0; font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; }
      .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      .card { width: min(640px, 100%); background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; box-shadow: 0 8px 30px rgba(0,0,0,0.06); }
      h1 { margin: 0 0 12px; font-size: 28px; }
      p { margin: 0 0 10px; line-height: 1.6; }
      .muted { color: #64748b; }
      .error { color: #b91c1c; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">${body}</div>
    </div>
  </body>
</html>`;
}

function successPage(decision: "yes" | "no", emailFollowUpDelayed = false) {
  if (decision === "yes") {
    return htmlPage(
      "Estimate confirmed",
      `
        <h1>Thanks — we’ll email you for the final details we need.</h1>
        <p>We’ve recorded that the rough estimate looks reasonable.</p>
        <p class="muted">${emailFollowUpDelayed ? "Your estimate was accepted. We’ll follow up shortly." : "Next step: reply to our checklist email with the key dimensions, fit details, material and quantity so we can prepare an exact quote."}</p>
      `
    );
  }

  return htmlPage(
    "Estimate declined",
    `
      <h1>No problem — if you had a different budget in mind, reply to the email and let us know.</h1>
      <p>We’ve recorded that the rough estimate was higher than expected.</p>
      <p class="muted">You can always come back later if you want us to revisit the request.</p>
    `
  );
}

function errorPage(message: string) {
  return htmlPage(
    "Unable to process estimate confirmation",
    `
      <h1>Unable to process estimate confirmation</h1>
      <p class="error">${escapeHtml(message)}</p>
    `
  );
}

function extractNoteValue(notes: string | null, key: string) {
  if (!notes) return null;

  const matches = Array.from(notes.matchAll(new RegExp(`^${key}:\\s*(.+)$`, "gm")));
  const lastMatch = matches.at(-1);
  return lastMatch?.[1]?.trim() || null;
}

function extractNoteList(notes: string | null, key: string) {
  const raw = extractNoteValue(notes, key);
  if (!raw) return [];
  return raw
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean);
}

function appendDecisionNote(existingNotes: string | null, decision: "yes" | "no", preleadId: string | null) {
  const lines = [
    existingNotes?.trim() || null,
    "--- estimate confirmation ---",
    `decision: ${decision}`,
    `estimate_accepted: ${decision === "yes" ? "true" : "false"}`,
    decision === "yes" ? "quote_status: awaiting_final_details" : null,
    `timestamp: ${new Date().toISOString()}`,
    decision === "yes" && preleadId ? "prelead_converted: true" : null,
    decision === "yes" && preleadId ? "conversion_status: ready_for_supplier" : null,
    decision === "yes" ? "internal_status: awaiting_final_details" : "internal_status: estimate_declined",
  ].filter(Boolean);

  return lines.join("\n");
}

function isMissingColumnError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : String(error ?? "");

  return /column .* does not exist|could not find the .* column|schema cache/i.test(message);
}

function isDebugEnabled() {
  return /^(1|true|yes|on)$/i.test(String(process.env.PRELEAD_DEBUG ?? "").trim());
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id")?.trim();
    const decision = url.searchParams.get("decision")?.trim();

    if (!id) {
      return new Response(errorPage("Missing quote id."), {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (decision !== "yes" && decision !== "no") {
      return new Response(errorPage("Invalid decision."), {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const supabase = createSupabaseAdminClient();
    const { data: quote, error } = await supabase
      .from("quotes")
      .select("id, quote_ref, notes")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("CONFIRM ESTIMATE LOOKUP ERROR:", error);
      return new Response(errorPage("We could not verify this request."), {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (!quote) {
      return new Response(errorPage("This confirmation link is invalid or has expired."), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const existingNotes = (quote.notes as string | null) ?? null;
    const preleadId = extractNoteValue(existingNotes, "prelead_id");
    const estimateRange = extractNoteValue(existingNotes, "rough_estimate");
    const updatedNotes = appendDecisionNote(existingNotes, decision, preleadId);

    const commercialUpdatePayload: Record<string, unknown> = { notes: updatedNotes };

    if (decision === "yes") {
      commercialUpdatePayload.quote_status = "awaiting_final_details";
    }

    let { error: updateError } = await supabase
      .from("quotes")
      .update(commercialUpdatePayload)
      .eq("id", id);

    if (updateError && isMissingColumnError(updateError)) {
      const fallbackResult = await supabase.from("quotes").update({ notes: updatedNotes }).eq("id", id);
      updateError = fallbackResult.error;
    }

    if (updateError) {
      console.error("CONFIRM ESTIMATE UPDATE ERROR:", updateError);
    }

    console.log(`estimate_confirmation quote_id=${id} decision=${decision}`);
    if (isDebugEnabled()) {
      console.log(`quote_status_change quote_id=${id} quote_status=${decision === "yes" ? "awaiting_final_details" : "unchanged"}`);
    }
    if (preleadId && decision === "yes") {
      console.log(`prelead_converted: true prelead_id=${preleadId} quote_id=${id}`);
    }

    if (preleadId) {
      void appendPreleadLearningLog([
        createPreleadConversionLearningLogRow({
          preleadId,
          quoteId: id,
          estimateRange,
          estimateAccepted: decision === "yes",
        }),
      ]).catch((error) => {
        console.warn("PRELEAD ESTIMATE LEARNING LOG ERROR:", error);
      });
    }

    let emailFollowUpDelayed = false;

    if (decision === "yes") {
      const { data: refreshedQuote, error: fetchError } = await supabase
        .from("quotes")
        .select("id, email, notes, quote_status")
        .eq("id", id)
        .single();

      if (fetchError) {
        console.error("CHECKLIST EMAIL QUOTE FETCH ERROR:", fetchError);
        return new Response(errorPage("We updated your request, but could not prepare the follow-up email."), {
          status: 500,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      if (!refreshedQuote.email) {
        console.error("CHECKLIST EMAIL MISSING EMAIL FOR QUOTE:", refreshedQuote.id);
        emailFollowUpDelayed = true;
      } else {
        try {
          console.log("About to send checklist email", {
            quoteId: refreshedQuote.id,
            recipientEmail: refreshedQuote.email,
          });
          const result = await sendChecklistEmail({
            to: refreshedQuote.email,
            quoteId: refreshedQuote.id,
            photoReadiness: extractNoteValue(refreshedQuote.notes, "photo_readiness"),
            missingItems: extractNoteList(refreshedQuote.notes, "photo_missing_items"),
          });
          if (result.sent) {
            console.log("Checklist email sent", {
              quoteId: refreshedQuote.id,
              recipientEmail: refreshedQuote.email,
              providerResponseId: result.providerId,
            });
          } else {
            emailFollowUpDelayed = true;
            console.error("Checklist email failed", {
              quoteId: refreshedQuote.id,
              recipientEmail: refreshedQuote.email,
              error: result.error,
            });
          }
        } catch (emailError) {
          emailFollowUpDelayed = true;
          console.error("Checklist email failed", {
            quoteId: refreshedQuote.id,
            recipientEmail: refreshedQuote.email,
            error: emailError instanceof Error ? emailError.message : String(emailError),
          });
        }
      }

      return new Response(successPage(decision, emailFollowUpDelayed), {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return new Response(successPage(decision), {
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
