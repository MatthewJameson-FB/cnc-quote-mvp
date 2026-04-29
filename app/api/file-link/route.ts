import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function extractNoteValue(notes: string | null | undefined, key: string) {
  if (!notes) return null;

  const matches = Array.from(notes.matchAll(new RegExp(`^${key}:\\s*(.+)$`, "gm")));
  const lastMatch = matches.at(-1);
  return lastMatch?.[1]?.trim() || null;
}

function extractCommaNoteList(notes: string | null | undefined, key: string) {
  const raw = extractNoteValue(notes, key);
  if (!raw) return [];

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function isLikelyImagePath(path: string) {
  return /\.(jpg|jpeg|png|gif|webp|heic|heif|avif)$/i.test(path.toLowerCase());
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const quoteId = url.searchParams.get("quote_id")?.trim();
    const type = url.searchParams.get("type")?.trim();
    const indexRaw = url.searchParams.get("index")?.trim() ?? "1";
    const index = Number(indexRaw);

    if (!quoteId || (type !== "file" && type !== "photo") || !Number.isInteger(index) || index < 1) {
      return new NextResponse("Not found", { status: 404 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: quote, error } = await supabase
      .from("quotes")
      .select("id, file_path, notes")
      .eq("id", quoteId)
      .maybeSingle();

    if (error || !quote) {
      return new NextResponse("Not found", { status: 404 });
    }

    const notes = (quote.notes as string | null) ?? null;
    const filePathFromNotes = extractNoteValue(notes, "file_url") || quote.file_path || null;
    const photoPaths = extractCommaNoteList(notes, "photo_urls");
    const effectivePhotoPaths = filePathFromNotes && isLikelyImagePath(filePathFromNotes)
      ? [filePathFromNotes, ...photoPaths.filter((path) => path !== filePathFromNotes)]
      : photoPaths;

    const assetPath =
      type === "file"
        ? index === 1 && filePathFromNotes && !isLikelyImagePath(filePathFromNotes)
          ? filePathFromNotes
          : null
        : effectivePhotoPaths[index - 1] || null;

    if (!assetPath) {
      return new NextResponse("Not found", { status: 404 });
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from("quote-files")
      .createSignedUrl(assetPath, 60 * 15);

    if (signedError || !signed?.signedUrl) {
      return new NextResponse("Not found", { status: 404 });
    }

    return NextResponse.redirect(signed.signedUrl, { status: 302 });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
