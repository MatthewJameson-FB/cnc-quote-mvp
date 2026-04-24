import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { defaultQuoteStatus } from "@/lib/quote-statuses";
import { sendQuoteNotifications } from "@/lib/notifications";

export async function POST(req: Request) {
  try {
    const supabase = createSupabaseAdminClient();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    let filePath: string | null = null;

    if (file && file.size > 0) {
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      filePath = `${crypto.randomUUID()}-${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("quote-files")
        .upload(filePath, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        console.error("UPLOAD ERROR:", uploadError);
        return NextResponse.json(
          { success: false, error: "Unable to save uploaded file." },
          { status: 500 }
        );
      }
    }

    const quote = {
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      material: String(formData.get("material") ?? "").trim(),
      complexity: String(formData.get("complexity") ?? "").trim(),
      volume_cm3: Number(formData.get("volumeCm3")),
      quantity: Number(formData.get("quantity")),
      quote_low: Number(formData.get("quoteLow")),
      quote_high: Number(formData.get("quoteHigh")),
      quote_total: Number(formData.get("quoteTotal")),
      file_path: filePath,
      status: defaultQuoteStatus,
    };

    const { error } = await supabase.from("quotes").insert([quote]);

    if (error) {
      console.error("DB ERROR:", error);
      return NextResponse.json(
        { success: false, error: "Unable to save quote." },
        { status: 500 }
      );
    }

    if (quote.email) {
      void sendQuoteNotifications({
        name: quote.name || "Customer",
        email: quote.email,
        material: quote.material,
        complexity: quote.complexity,
        volumeCm3: quote.volume_cm3,
        quantity: quote.quantity,
        quoteLow: quote.quote_low,
        quoteHigh: quote.quote_high,
        quoteTotal: quote.quote_total,
      }).catch((notificationError) => {
        console.error("EMAIL NOTIFICATION ERROR:", notificationError);
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("QUOTE API ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
