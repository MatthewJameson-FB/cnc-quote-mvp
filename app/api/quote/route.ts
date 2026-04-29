import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { defaultQuoteStatus } from "@/lib/quote-statuses";
import { sendQuoteNotifications } from "@/lib/notifications";
import { estimateQuote } from "@/lib/estimate-quote";
import {
  appendPreleadLearningLog,
  createPreleadConversionLearningLogRow,
} from "@/lib/prelead-learning-log";
import {
  determineStage,
  inferManufacturingType,
  routeLead,
  validateLeadIntake,
  type IntakeMaterialPreference,
  type ManufacturingType,
} from "@/lib/intake";

function isDebugEnabled() {
  return /^(1|true|yes|on)$/i.test(String(process.env.PRELEAD_DEBUG ?? "").trim());
}

function cleanString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseBoolean(value: FormDataEntryValue | null) {
  return /^(1|true|yes|on)$/i.test(cleanString(value));
}

function normalizeMaterial(value: string): IntakeMaterialPreference {
  if (
    value === "pla_standard_plastic" ||
    value === "resin" ||
    value === "abs_asa" ||
    value === "nylon" ||
    value === "petg" ||
    value === "aluminium" ||
    value === "steel" ||
    value === "stainless_steel" ||
    value === "brass" ||
    value === "other"
  ) {
    return value;
  }

  return "not_sure";
}

function getAppBaseUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.SITE_URL?.trim();

  if (explicit) {
    return explicit.startsWith("http") ? explicit : `https://${explicit}`;
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();

  if (vercelUrl) {
    return vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`;
  }

  return "http://localhost:3000";
}

async function uploadAsset(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  file: File,
  prefix: string
) {
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${prefix}/${crypto.randomUUID()}-${safeFileName}`;

  const { error } = await supabase.storage.from("quote-files").upload(filePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return filePath;
}

function estimateSummaryText(estimate: ReturnType<typeof estimateQuote>) {
  const cad = estimate.breakdown.cad
    ? `cad: £${estimate.breakdown.cad[0]}–£${estimate.breakdown.cad[1]}`
    : null;
  const manufacturing = estimate.breakdown.manufacturing
    ? `manufacturing: £${estimate.breakdown.manufacturing[0]}–£${estimate.breakdown.manufacturing[1]}`
    : null;

  return [
    `rough_estimate: £${estimate.min_price}–£${estimate.max_price} ${estimate.currency}`,
    `customer_estimate_min: ${estimate.min_price}`,
    `customer_estimate_max: ${estimate.max_price}`,
    `estimate_confidence: ${estimate.confidence}`,
    `quote_status: submitted`,
    `supplier_fee_status: not_due`,
    cad,
    manufacturing,
    `estimate_disclaimer: ${estimate.disclaimer}`,
  ]
    .filter(Boolean)
    .join("\n");
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

function buildIntakeNotes({
  existingNotes,
  preleadId,
  stage,
  material,
  manufacturingType,
  routingDecision,
  measurements,
  description,
  filePath,
  photoPaths,
  intakeValidationReason,
  partCandidate,
  estimate,
}: {
  existingNotes: string;
  preleadId: string | null;
  stage: string;
  material: IntakeMaterialPreference;
  manufacturingType: ManufacturingType;
  routingDecision: string;
  measurements: string;
  description: string;
  filePath: string | null;
  photoPaths: string[];
  intakeValidationReason: string | null;
  partCandidate: boolean;
  estimate: ReturnType<typeof estimateQuote>;
}) {
  const sections = [
    existingNotes || null,
    "--- intake ---",
    preleadId ? `prelead_id: ${preleadId}` : null,
    `stage: ${stage}`,
    `material: ${material}`,
    `manufacturing_type: ${manufacturingType}`,
    `routing_decision: ${routingDecision}`,
    `part_candidate: ${partCandidate ? "true" : "false"}`,
    intakeValidationReason ? `intake_validation_reason: ${intakeValidationReason}` : null,
    measurements ? `measurements: ${measurements}` : null,
    description ? `description: ${description}` : null,
    filePath ? `file_url: ${filePath}` : null,
    photoPaths.length ? `photo_urls: ${photoPaths.join(", ")}` : null,
    "--- estimate ---",
    estimateSummaryText(estimate),
  ].filter(Boolean);

  return sections.join("\n");
}

export async function POST(req: Request) {
  try {
    const supabase = createSupabaseAdminClient();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const photos = formData
      .getAll("photos")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    const material = normalizeMaterial(cleanString(formData.get("material")));
    const notes = cleanString(formData.get("notes"));
    const preleadId = cleanString(formData.get("prelead_id")) || null;
    const measurements = cleanString(formData.get("measurement") || formData.get("measurements"));
    const description = cleanString(formData.get("description"));
    const quantity = Number(formData.get("quantity")) || 1;
    const hasFile = file instanceof File && file.size > 0 ? true : parseBoolean(formData.get("has_file"));
    const hasPhotos = photos.length > 0 ? true : parseBoolean(formData.get("has_photos"));
    const stage = determineStage(hasFile, hasPhotos);
    const manufacturingType = (cleanString(formData.get("manufacturing_type")) as ManufacturingType) || inferManufacturingType(material, hasFile);
    const routingDecision = routeLead({ stage, manufacturing_type: manufacturingType });
    const intakeValidation = validateLeadIntake({
      has_file: hasFile,
      has_photos: hasPhotos,
      measurements,
      description,
    });
    const intakeValidationReason = intakeValidation.reason;
    const partCandidate = routingDecision === "cad_required";
    const estimate = estimateQuote({
      manufacturing_type: manufacturingType,
      material,
      stage,
      description,
      measurements,
      quantity,
      has_file: hasFile,
      has_photos: hasPhotos,
    });

    if (isDebugEnabled()) {
      console.log(
        `[preleads:debug] query_used=manual_intake has_file=${hasFile ? "yes" : "no"} has_photos=${hasPhotos ? "yes" : "no"} stage=${stage} material=${material} manufacturing_type=${manufacturingType} routing_decision=${routingDecision} estimate=£${estimate.min_price}-£${estimate.max_price} confidence=${estimate.confidence} intake_validation_reason=${intakeValidationReason ?? "ok"}`
      );
      if (preleadId) {
        console.log(`[preleads:debug] linked_prelead_id=${preleadId}`);
      }
      if (partCandidate) {
        console.log("CAD_REQUIRED");
      }
    }

    if (!intakeValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error:
            intakeValidationReason === "missing_file_or_photo"
              ? "Upload at least one file or photo."
              : intakeValidationReason === "photos_missing_measurements"
                ? "Measurements are required when uploading photos."
                : "Description is required when uploading photos.",
          intake_validation_reason: intakeValidationReason,
        },
        { status: 400 }
      );
    }

    let filePath: string | null = null;
    const photoPaths: string[] = [];

    if (file && file.size > 0) {
      try {
        filePath = await uploadAsset(supabase, file, "files");
      } catch (uploadError) {
        console.error("UPLOAD ERROR:", uploadError);
        return NextResponse.json(
          { success: false, error: "Unable to save uploaded file." },
          { status: 500 }
        );
      }
    }

    if (photos.length > 0) {
      for (const photo of photos) {
        try {
          const photoPath = await uploadAsset(supabase, photo, "photos");
          photoPaths.push(photoPath);
        } catch (uploadError) {
          console.error("PHOTO UPLOAD ERROR:", uploadError);
          return NextResponse.json(
            { success: false, error: "Unable to save uploaded photos." },
            { status: 500 }
          );
        }
      }
    }

    const primaryAssetPath = filePath ?? photoPaths[0] ?? null;
    const storage = supabase.storage.from("quote-files");
    const fileUrls = filePath
      ? [
          (await storage.createSignedUrl(filePath, 60 * 60 * 24).catch(() => ({ data: null }))).data?.signedUrl,
        ].filter((value): value is string => Boolean(value))
      : [];
    const photoUrls = (
      await Promise.all(
        photoPaths.map(async (photoPath) => {
          const { data } = await storage.createSignedUrl(photoPath, 60 * 60 * 24).catch(() => ({ data: null }));
          return data?.signedUrl ?? null;
        })
      )
    ).filter((value): value is string => Boolean(value));

    const quote = {
      name: cleanString(formData.get("name")),
      email: cleanString(formData.get("email")),
      companyName: cleanString(formData.get("companyName")),
      phone: cleanString(formData.get("phone")),
      notes: buildIntakeNotes({
        existingNotes: notes,
        preleadId,
        stage,
        material,
        manufacturingType,
        routingDecision,
        measurements,
        description,
        filePath,
        photoPaths,
        intakeValidationReason,
        partCandidate,
        estimate,
      }),
      material,
      complexity: cleanString(formData.get("complexity")) || "medium",
      volume_cm3: Number(formData.get("volumeCm3")) || 100,
      quantity,
      quote_low: Number(formData.get("quoteLow")) || 0,
      quote_high: Number(formData.get("quoteHigh")) || 0,
      quote_total: Number(formData.get("quoteTotal")) || 0,
      file_path: primaryAssetPath,
      status: defaultQuoteStatus,
    };

    const { data: insertedQuote, error } = await supabase
      .from("quotes")
      .insert([quote])
      .select("id")
      .single();

    if (error) {
      console.error("DB ERROR:", error);
      return NextResponse.json(
        { success: false, error: "Unable to save quote." },
        { status: 500 }
      );
    }

    const quoteId = String(insertedQuote?.id ?? "");
    const estimateRange = `£${estimate.min_price}–£${estimate.max_price} ${estimate.currency}`;

    if (quoteId) {
      const { error: commercialTrackingError } = await supabase
        .from("quotes")
        .update({
          quote_status: "submitted",
          supplier_fee_status: "not_due",
          customer_estimate_min: estimate.min_price,
          customer_estimate_max: estimate.max_price,
        })
        .eq("id", quoteId);

      if (commercialTrackingError && !isMissingColumnError(commercialTrackingError)) {
        console.warn("COMMERCIAL TRACKING UPDATE ERROR:", commercialTrackingError);
      }
    }

    const baseUrl = getAppBaseUrl();
    const yesUrl = quoteId
      ? `${baseUrl}/api/confirm-estimate?id=${encodeURIComponent(quoteId)}&decision=yes`
      : null;
    const noUrl = quoteId
      ? `${baseUrl}/api/confirm-estimate?id=${encodeURIComponent(quoteId)}&decision=no`
      : null;

    if (isDebugEnabled()) {
      console.log(
        `[preleads:debug] estimate_links_created=${yesUrl && noUrl ? "yes" : "no"} routing_decision=${routingDecision}`
      );
    }

    if (preleadId && quoteId) {
      void appendPreleadLearningLog([
        createPreleadConversionLearningLogRow({
          preleadId,
          quoteId,
          estimateRange,
          estimateAccepted: null,
        }),
      ]).catch((error) => {
        console.warn("PRELEAD CONVERSION LEARNING LOG ERROR:", error);
      });
    }

    if (quote.email) {
      void sendQuoteNotifications({
        name: quote.name || "Customer",
        email: quote.email,
        companyName: quote.companyName || undefined,
        phone: quote.phone || undefined,
        notes: quote.notes || undefined,
        material: quote.material,
        complexity: quote.complexity,
        volumeCm3: quote.volume_cm3,
        quantity: quote.quantity,
        quoteLow: quote.quote_low,
        quoteHigh: quote.quote_high,
        quoteTotal: quote.quote_total,
        stage,
        manufacturingType,
        routingDecision,
        hasFile,
        hasPhotos,
        fileUrls,
        photoUrls,
        measurements,
        description,
        cadRequired: partCandidate,
        estimate,
        confirmationYesUrl: yesUrl ?? undefined,
        confirmationNoUrl: noUrl ?? undefined,
      }).catch((notificationError) => {
        console.error("EMAIL NOTIFICATION ERROR:", notificationError);
      });
    }

    return NextResponse.json({
      success: true,
      quote_id: quoteId,
      prelead_id: preleadId,
      stage,
      material,
      manufacturing_type: manufacturingType,
      routing_decision: routingDecision,
      part_candidate: partCandidate,
      intake_validation_reason: intakeValidationReason,
      estimate,
      confirmation_yes_url: yesUrl,
      confirmation_no_url: noUrl,
    });
  } catch (error) {
    console.error("QUOTE API ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
