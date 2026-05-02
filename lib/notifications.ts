import type { EstimateQuoteResult } from "@/lib/estimate-quote";

type QuoteNotificationDetails = {
  name: string;
  email: string;
  companyName?: string;
  phone?: string;
  notes?: string;
  material: string;
  complexity: string;
  volumeCm3: number;
  quantity: number;
  quoteLow: number;
  quoteHigh: number;
  quoteTotal: number;
  stage?: string;
  manufacturingType?: string;
  routingDecision?: string;
  hasFile?: boolean;
  hasPhotos?: boolean;
  fileUrls?: string[];
  photoUrls?: string[];
  measurements?: string;
  description?: string;
  cadRequired?: boolean;
  photoReadiness?: string;
  photoAssessmentConfidence?: string;
  photoMissingItems?: string[];
  cadBrief?: string;
  estimate?: EstimateQuoteResult;
  confirmationYesUrl?: string;
  confirmationNoUrl?: string;
  adminLink?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: string;
};

type IntroductionEmailDetails = {
  quote_ref: string;
  accept_url: string;
  partner_accept_token: string;
  customer_name: string;
  email: string;
  partner_email: string;
  partner_name: string;
  material: string;
  quantity: number;
  created_at: string;
  fileUrl?: string | null;
};

type ChecklistEmailDetails = {
  to: string;
  quoteId: string;
  photoReadiness?: string | null;
  missingItems?: string[];
};

type PreleadSummaryItem = {
  source: string;
  source_url: string;
  title: string;
  snippet: string;
  detected_keywords: string[];
  detected_materials: string[];
  lead_score: number;
  suggested_reply: string;
  created_at: string;
};

type InboundPartSubmissionEmailDetails = {
  contactEmail: string;
  description: string;
  imageUrl?: string | null;
  valueScore: number;
  valueTier: 'low' | 'medium' | 'high';
  adminLink?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendResendEmail({
  to,
  cc,
  replyTo,
  subject,
  text,
  html,
}: {
  to: string;
  cc?: string[];
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const resolvedReplyTo = replyTo?.trim() || process.env.RESEND_REPLY_TO_EMAIL?.trim() || from?.trim() || "";

  console.log(`sending email to: ${to ? "configured" : "missing"}`);
  console.log(`reply_to configured: ${resolvedReplyTo ? "yes" : "no"}`);

  if (!apiKey || !from || !to) {
    return { sent: false, skipped: true, providerId: null, error: "Missing email config or recipient." };
  }

  // Replies are handled manually via inbox (quotes@...)
  // Future: inbound parsing / webhook
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      ...(cc?.length ? { cc } : {}),
      ...(resolvedReplyTo ? { reply_to: resolvedReplyTo } : {}),
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("EMAIL ERROR:", body);
    return { sent: false, skipped: false, providerId: null, error: body || `HTTP ${response.status}` };
  }

  const payload = (await response.json().catch(() => null)) as { id?: string } | null;
  console.log("EMAIL SENT:", { to, providerId: payload?.id ?? null });

  return {
    sent: true,
    skipped: false,
    providerId: payload?.id ?? null,
    error: null,
  };
}

function vehicleLabel(details: Pick<QuoteNotificationDetails, "vehicleMake" | "vehicleModel" | "vehicleYear">) {
  return [details.vehicleMake, details.vehicleModel, details.vehicleYear].filter(Boolean).join(" ");
}

function partSummary(details: QuoteNotificationDetails) {
  const title = details.description?.trim() || "Part request";
  const vehicle = vehicleLabel(details);
  return vehicle ? `${title} · ${vehicle}` : title;
}

function summaryBullets(details: QuoteNotificationDetails) {
  const photos = details.photoUrls?.length || 0;
  return [
    details.cadRequired ? "CAD required" : "Likely manufacturable",
    `${photos} photo${photos === 1 ? "" : "s"}`,
    details.measurements?.trim() ? `Measurement: ${details.measurements.trim()}` : null,
  ].filter(Boolean) as string[];
}

function primaryPhotoLink(details: QuoteNotificationDetails) {
  return details.photoUrls?.[0] || details.fileUrls?.[0] || null;
}

function customerQuoteEmailText(details: QuoteNotificationDetails) {
  const vehicle = vehicleLabel(details);

  return [
    "Thanks — we’ve received your part request.",
    "",
    "We’ll review the photos/details manually and come back with a realistic next step.",
    "",
    `Part: ${details.description?.trim() || "Part request"}`,
    vehicle ? `Vehicle: ${vehicle}` : null,
    details.photoUrls?.length ? `Photos received: ${details.photoUrls.length}` : null,
    details.fileUrls?.length ? "File received: yes" : null,
    "",
    "Photos are enough to start. If we need measurements or a scale photo, we’ll ask for them before confirming the next step.",
    "If you already have a CAD file, STL, or 3D model, you can reply with it — it can make things faster and more accurate.",
    "",
    "Thanks,",
    "Flangie",
  ]
    .filter(Boolean)
    .join("\n");
}

function customerQuoteEmailHtml(details: QuoteNotificationDetails) {
  const vehicle = vehicleLabel(details);
  const photoCount = details.photoUrls?.length ?? 0;
  const fileCount = details.fileUrls?.length ?? 0;

  return `
    <div style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
      <div style="max-width:640px;margin:0 auto">
        <div style="padding:24px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px">
          <h2 style="margin:0 0 12px;font-size:28px">Thanks — we’ve got your part request</h2>
          <p style="margin:0 0 14px;color:#475569">We’ll review the photos/details manually and come back with a realistic next step.</p>

          <div style="margin:16px 0;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px">
            <div style="margin:0 0 8px;color:#64748b;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Request summary</div>
            <p style="margin:0 0 6px;color:#0f172a"><strong>Part:</strong> ${escapeHtml(details.description?.trim() || "Part request")}</p>
            ${vehicle ? `<p style="margin:0 0 6px;color:#0f172a"><strong>Vehicle:</strong> ${escapeHtml(vehicle)}</p>` : ""}
            ${photoCount ? `<p style="margin:0 0 6px;color:#0f172a"><strong>Photos received:</strong> ${photoCount}</p>` : ""}
            ${fileCount ? `<p style="margin:0;color:#0f172a"><strong>File received:</strong> yes</p>` : ""}
          </div>

          <p style="margin:0 0 12px;color:#334155">Photos are enough to start. If we need measurements or a scale photo, we’ll ask for them before confirming the next step.</p>
          <p style="margin:0;color:#64748b">If you already have a CAD file, STL, or 3D model, you can reply with it — it can make things faster and more accurate.</p>
        </div>
      </div>
    </div>
  `;
}

function internalQuoteEmailText(details: QuoteNotificationDetails) {
  const adminLink = details.adminLink || "/admin/quotes";
  const photoLink = primaryPhotoLink(details);
  const summary = summaryBullets(details);

  return [
    "New part request",
    "",
    `Customer: ${details.name} <${details.email}>`,
    `Part: ${partSummary(details)}`,
    details.vehicleMake || details.vehicleModel || details.vehicleYear ? `Vehicle: ${vehicleLabel(details)}` : null,
    "",
    "Summary:",
    ...summary.map((item) => `- ${item}`),
    "",
    "Quick actions:",
    photoLink ? `- Open photos: ${photoLink}` : null,
    `- Open admin dashboard: ${adminLink}`,
    "",
    "Next step: Review photos and decide:",
    "- proceed with CAD",
    "- ask for more details",
    "- reject",
  ]
    .filter(Boolean)
    .join("\n");
}

function internalQuoteEmailHtml(details: QuoteNotificationDetails) {
  const bg = "#f8fafc";
  const card = "#ffffff";
  const border = "#e2e8f0";
  const adminLink = details.adminLink || "/admin/quotes";
  const photoLink = primaryPhotoLink(details);
  const vehicle = vehicleLabel(details);
  const summary = summaryBullets(details);

  return `
    <div style="margin:0;padding:20px;background:${bg};font-family:Arial,sans-serif;color:#0f172a;line-height:1.45">
      <div style="max-width:640px;margin:0 auto">
        <div style="padding:18px 20px;background:${card};border:1px solid ${border};border-radius:18px">
          <div style="display:inline-block;margin:0 0 10px;padding:5px 10px;border-radius:999px;background:#e0f2fe;color:#0c4a6e;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">New part request</div>
          <h1 style="margin:0 0 6px;font-size:24px;line-height:1.15">New part request</h1>
          <p style="margin:0 0 14px;color:#475569;font-size:14px">Fast scan: decide in under 10 seconds.</p>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:0 0 14px">
            <div>
              <div style="color:#64748b;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px">Customer</div>
              <div style="color:#0f172a;font-size:14px;font-weight:600">${escapeHtml(details.name)}</div>
              <div style="color:#475569;font-size:14px">${escapeHtml(details.email)}</div>
            </div>
            <div>
              <div style="color:#64748b;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px">Part</div>
              <div style="color:#0f172a;font-size:14px;font-weight:600;line-height:1.35">${escapeHtml(partSummary(details))}</div>
              ${vehicle ? `<div style="color:#475569;font-size:13px;margin-top:3px">Vehicle: ${escapeHtml(vehicle)}</div>` : ""}
            </div>
          </div>

          <div style="margin:0 0 14px;padding:12px 14px;background:#f8fafc;border:1px solid ${border};border-radius:14px">
            <div style="color:#64748b;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px">Summary</div>
            <ul style="margin:0;padding:0 0 0 18px;color:#334155;font-size:14px;line-height:1.45">
              ${summary.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </div>

          <div style="display:flex;flex-wrap:wrap;gap:10px;margin:0 0 14px">
            ${photoLink ? `<a href="${escapeHtml(photoLink)}" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#0f766e;color:#fff;text-decoration:none;font-weight:700;font-size:14px">Open photos</a>` : ""}
            <a href="${escapeHtml(adminLink)}" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#ffffff;color:#334155;text-decoration:none;font-weight:700;font-size:14px;border:1px solid ${border}">Open admin dashboard</a>
          </div>

          <div style="padding:12px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;color:#1d4ed8;font-weight:600;font-size:14px">
            Review photos and decide: proceed with CAD, ask for more details, or reject.
          </div>
        </div>
      </div>
    </div>
  `;
}

function getInternalAlertRecipient() {
  const direct = process.env.QUOTE_INTERNAL_NOTIFY_EMAIL?.trim();
  if (direct) return direct;

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

  return adminEmails[0] ?? null;
}

export async function sendQuoteNotifications(details: QuoteNotificationDetails) {
  const internalEmail = getInternalAlertRecipient();

  const tasks = [
    sendResendEmail({
      to: details.email,
      replyTo: process.env.RESEND_REPLY_TO_EMAIL || process.env.RESEND_FROM_EMAIL,
      subject: "We received your custom part request",
      text: customerQuoteEmailText(details),
      html: customerQuoteEmailHtml(details),
    }),
  ];

  if (internalEmail) {
    tasks.push(
      sendResendEmail({
        to: internalEmail,
        subject: "New part request",
        text: internalQuoteEmailText(details),
        html: internalQuoteEmailHtml(details),
      })
    );
  }

  const results = await Promise.allSettled(tasks);

  return {
    customer: results[0],
    internal: results[1] ?? null,
  };
}

export async function sendChecklistEmail(details: ChecklistEmailDetails) {
  const quoteLine = `Quote reference: ${details.quoteId}`;
  const hasApiKey = Boolean(process.env.RESEND_API_KEY?.trim());
  const hasFromEmail = Boolean(process.env.RESEND_FROM_EMAIL?.trim());
  const missingItems = details.missingItems?.filter(Boolean) ?? [];
  const needsPhotoSpecificFollowUp = details.photoReadiness && details.photoReadiness !== "ready_from_photos";

  console.log(
    `Checklist email config check: RESEND_API_KEY present=${hasApiKey ? "yes" : "no"} RESEND_FROM_EMAIL present=${hasFromEmail ? "yes" : "no"}`
  );

  const text = [
    "Hi,",
    "",
    "Thanks for confirming — we can move this forward 👍",
    "",
    needsPhotoSpecificFollowUp
      ? "To assess the part properly from photos, we still need a couple of extra details before we can prepare the CAD brief for review:"
      : "To make sure the part is quoted correctly and built correctly, we just need a couple of quick details:",
    "",
    ...(needsPhotoSpecificFollowUp && missingItems.length
      ? ["Please send:", ...missingItems.map((item) => `- ${item}`), ""]
      : []),
    "1) Size / dimensions",
    "- Any key measurements (mm is best)",
    "(e.g. width, height, hole spacing)",
    "",
    "2) What it connects to",
    "- What does the part fit into or attach to?",
    "",
    "3) Material",
    "- Plastic / metal / not sure is fine",
    "",
    "4) Quantity",
    "- Just 1, or multiple?",
    "",
    "5) Anything important",
    "- Does it need to be strong, flexible, or a precise fit?",
    "",
    needsPhotoSpecificFollowUp
      ? "If the scale is unclear, please include a ruler, coin, or another reference object in at least one photo."
      : "If you have more photos or a photo with a ruler next to it, that helps a lot.",
    "",
    "You can just reply to this email with the details 👍",
    "If you already have a CAD file or 3D model, feel free to reply with it — it can help speed things up and reduce cost.",
    "",
    "Once we have this, we’ll confirm the final quote and get things moving.",
    "",
    "You can reply directly to this email with the details 👍",
    "",
    "Thanks,",
    "Flangie",
    "",
    quoteLine,
  ]
    .filter(Boolean)
    .join("\n");

  const htmlMissingItems = needsPhotoSpecificFollowUp && missingItems.length
    ? `<div style="margin:0 0 16px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px"><div style="margin:0 0 8px;color:#64748b;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">Please send</div><ul style="margin:0 0 0 18px;padding:0;color:#334155">${missingItems.map((item) => `<li style="margin-top:6px">${escapeHtml(item)}</li>`).join("")}</ul></div>`
    : "";

  const html = `
    <div style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;line-height:1.6">
      <div style="max-width:640px;margin:0 auto;padding:24px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px">
        <h2 style="margin:0 0 12px;font-size:28px">A few final details before we quote</h2>
        <p style="margin:0 0 12px">Hi,</p>
        <p style="margin:0 0 12px">Thanks for confirming — we can move this forward 👍</p>
        <p style="margin:0 0 12px">${escapeHtml(
          needsPhotoSpecificFollowUp
            ? "To assess the part properly from photos, we still need a couple of extra details before we can prepare the CAD brief for review:"
            : "To make sure the part is quoted correctly and built correctly, we just need a couple of quick details:"
        )}</p>
        ${htmlMissingItems}
        <ul style="margin:0 0 16px 20px;padding:0;color:#334155">
          <li><strong>Size / dimensions</strong><br />Any key measurements (mm is best)<br />(e.g. width, height, hole spacing)</li>
          <li style="margin-top:8px"><strong>What it connects to</strong><br />What does the part fit into or attach to?</li>
          <li style="margin-top:8px"><strong>Material</strong><br />Plastic / metal / not sure is fine</li>
          <li style="margin-top:8px"><strong>Quantity</strong><br />Just 1, or multiple?</li>
          <li style="margin-top:8px"><strong>Anything important</strong><br />Does it need to be strong, flexible, or a precise fit?</li>
        </ul>
        <p style="margin:0 0 12px">${escapeHtml(
          needsPhotoSpecificFollowUp
            ? "If the scale is unclear, please include a ruler, coin, or another reference object in at least one photo."
            : "If you have more photos or a photo with a ruler next to it, that helps a lot."
        )}</p>
        <p style="margin:0 0 12px">You can just reply to this email with the details 👍</p>
        <p style="margin:0 0 12px">If you already have a CAD file or 3D model, feel free to reply with it — it can help speed things up and reduce cost.</p>
        <p style="margin:0 0 12px">Once we have this, we’ll confirm the final quote and get things moving.</p>
        <p style="margin:0 0 12px;color:#475569">You can reply directly to this email with the details 👍</p>
        <div style="padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;color:#475569">${escapeHtml(quoteLine)}</div>
        <p style="margin:16px 0 0;color:#64748b">Thanks,<br />Flangie</p>
      </div>
    </div>
  `;

  return sendResendEmail({
    to: details.to,
    replyTo: process.env.RESEND_REPLY_TO_EMAIL || process.env.RESEND_FROM_EMAIL,
    subject: "Quick details to finalise your part 👍",
    text,
    html,
  });
}

export async function sendFinalDetailsChecklistEmail(details: { email: string; quoteId?: string }) {
  return sendChecklistEmail({
    to: details.email,
    quoteId: details.quoteId ?? "your request",
  });
}

export async function sendIntroductionEmail(details: IntroductionEmailDetails) {
  const internalEmail = process.env.QUOTE_INTERNAL_NOTIFY_EMAIL?.trim();
  const subject = `New CNC enquiry – ${details.quote_ref}`;
  const cc = [details.email, internalEmail].filter(Boolean) as string[];
  const createdAt = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(details.created_at));

  const fileLink = details.fileUrl
    ? `<a href="${escapeHtml(details.fileUrl)}" style="color:#1d4ed8">Open file</a>`
    : "Not available";

  const acceptUrl = details.accept_url;
  const partnerAcceptToken = details.partner_accept_token;

  const text = [
    `Quote ref: ${details.quote_ref}`,
    `Customer: ${details.customer_name} <${details.email}>`,
    `Partner: ${details.partner_name} <${details.partner_email}>`,
    `Material: ${details.material}`,
    `Quantity: ${details.quantity}`,
    `Created: ${createdAt}`,
    `File link: ${details.fileUrl ?? "Not available"}`,
    `Accept lead: ${acceptUrl}`,
    `Token: ${partnerAcceptToken}`,
    "",
    "This is a lead from Flangie.",
    "The partner is being introduced to the customer.",
    "",
    "Please reply-all so everyone stays in the loop.",
    "",
    "By accepting this lead, you confirm you will follow up with the customer.",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;max-width:640px;margin:0 auto">
      <h2 style="margin:0 0 12px">New CNC enquiry – ${escapeHtml(details.quote_ref)}</h2>
      <p style="margin:0 0 12px;font-size:16px">
        This is a lead from Flangie. The partner is being introduced to the customer.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 16px">
        <tr><td style="padding:6px 0;color:#6b7280">Quote ref</td><td style="padding:6px 0;font-weight:600">${escapeHtml(details.quote_ref)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Customer</td><td style="padding:6px 0;font-weight:600">${escapeHtml(details.customer_name)} &lt;${escapeHtml(details.email)}&gt;</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Partner</td><td style="padding:6px 0;font-weight:600">${escapeHtml(details.partner_name)} &lt;${escapeHtml(details.partner_email)}&gt;</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Material</td><td style="padding:6px 0;font-weight:600">${escapeHtml(details.material)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Quantity</td><td style="padding:6px 0;font-weight:600">${details.quantity}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Created</td><td style="padding:6px 0;font-weight:600">${escapeHtml(createdAt)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;vertical-align:top">File</td><td style="padding:6px 0;font-weight:600">${fileLink}</td></tr>
      </table>
      <div style="margin:24px 0;text-align:center">
        <a href="${escapeHtml(acceptUrl)}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">Accept this lead</a>
      </div>
      <p style="margin:0 0 12px">Please reply-all so everyone stays in the loop.</p>
      <p style="margin:0;color:#6b7280">By accepting this lead, you confirm you will follow up with the customer.</p>
    </div>
  `;

  try {
    await sendResendEmail({
      to: details.partner_email,
      cc,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error("INTRO EMAIL ERROR:", error);
  }
}

export async function sendPreleadSummaryEmail(preleads: PreleadSummaryItem[]) {
  const to = process.env.QUOTE_INTERNAL_NOTIFY_EMAIL?.trim();

  if (!to) {
    return false;
  }

  const top = preleads.slice(0, 10);
  const subject = `Flangie pre-leads: ${top.length} high-signal leads found`;

  const text = [
    "Manual review only — do not auto-contact anyone.",
    "",
    ...top.flatMap((lead, index) => [
      `${index + 1}. [${lead.lead_score}] ${lead.title}`,
      `Source: ${lead.source}`,
      `URL: ${lead.source_url}`,
      `Snippet: ${lead.snippet}`,
      `Suggested reply: ${lead.suggested_reply}`,
      `Keywords: ${lead.detected_keywords.join(", ") || "—"}`,
      `Materials: ${lead.detected_materials.join(", ") || "—"}`,
      "",
    ]),
  ].join("\n");

  const htmlRows = top
    .map(
      (lead) => `
        <tr>
          <td style="padding:12px;border-top:1px solid #e5e7eb;vertical-align:top">
            <div style="font-weight:700">[${lead.lead_score}] ${escapeHtml(lead.title)}</div>
            <div style="margin:4px 0;color:#6b7280">${escapeHtml(lead.source)}</div>
            <div style="margin:4px 0"><a href="${escapeHtml(lead.source_url)}">${escapeHtml(lead.source_url)}</a></div>
            <div style="margin:8px 0">${escapeHtml(lead.snippet)}</div>
            <div style="margin:8px 0;color:#374151"><strong>Suggested reply:</strong> ${escapeHtml(lead.suggested_reply)}</div>
            <div style="color:#6b7280;font-size:13px">Keywords: ${escapeHtml(lead.detected_keywords.join(", ") || "—")}</div>
            <div style="color:#6b7280;font-size:13px">Materials: ${escapeHtml(lead.detected_materials.join(", ") || "—")}</div>
          </td>
        </tr>
      `
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;max-width:720px;margin:0 auto">
      <h2 style="margin:0 0 12px">Flangie pre-leads: ${top.length} high-signal leads found</h2>
      <p style="margin:0 0 16px;color:#6b7280">Manual review only — do not auto-contact anyone.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        ${htmlRows}
      </table>
    </div>
  `;

  await sendResendEmail({ to, subject, text, html });
  return true;
}

export async function sendCronPreleadSummaryEmail(details: {
  inserted: number;
  accepted: number;
  topAcceptedTitles: string[];
  adminLink: string;
}) {
  const to = process.env.QUOTE_INTERNAL_NOTIFY_EMAIL?.trim();
  if (!to) return false;

  const subject = `Flangie found ${details.inserted} new preleads`;
  const titles = details.topAcceptedTitles.slice(0, 5);
  const text = [
    `Inserted: ${details.inserted}`,
    `Accepted: ${details.accepted}`,
    "",
    "Top accepted titles:",
    ...titles.map((title, index) => `${index + 1}. ${title}`),
    "",
    `Admin: ${details.adminLink}`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;max-width:720px;margin:0 auto">
      <h2 style="margin:0 0 12px">Flangie found ${details.inserted} new preleads</h2>
      <p style="margin:0 0 8px">Inserted: <strong>${details.inserted}</strong></p>
      <p style="margin:0 0 16px">Accepted: <strong>${details.accepted}</strong></p>
      <div style="margin:0 0 16px">
        <div style="font-weight:700;margin-bottom:8px">Top accepted titles</div>
        <ol style="margin:0;padding-left:20px">
          ${titles.map((title) => `<li>${escapeHtml(title)}</li>`).join("")}
        </ol>
      </div>
      <p style="margin:0"><a href="${escapeHtml(details.adminLink)}">Open admin preleads</a></p>
    </div>
  `;

  await sendResendEmail({ to, subject, text, html });
  return true;
}

export async function sendInboundPartSubmissionEmail(details: InboundPartSubmissionEmailDetails) {
  const to = getInternalAlertRecipient();

  if (!to) {
    return { sent: false, skipped: true, providerId: null, error: 'Missing admin email recipient.' }
  }

  const subject = `New inbound part request – ${details.valueTier.toUpperCase()} priority`
  const text = [
    'New inbound part submission',
    '',
    `Contact email: ${details.contactEmail}`,
    `Value score: ${details.valueScore}`,
    `Value tier: ${details.valueTier}`,
    `Description: ${details.description}`,
    details.imageUrl ? `Image URL: ${details.imageUrl}` : null,
    details.adminLink ? `Admin link: ${details.adminLink}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;max-width:640px;margin:0 auto">
      <h2 style="margin:0 0 12px">New inbound part submission</h2>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 16px">
        <tr><td style="padding:6px 0;color:#6b7280">Contact email</td><td style="padding:6px 0;font-weight:600">${escapeHtml(details.contactEmail)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Value score</td><td style="padding:6px 0;font-weight:600">${details.valueScore}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Value tier</td><td style="padding:6px 0;font-weight:600">${escapeHtml(details.valueTier)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;vertical-align:top">Description</td><td style="padding:6px 0;font-weight:600">${escapeHtml(details.description)}</td></tr>
        ${details.imageUrl ? `<tr><td style="padding:6px 0;color:#6b7280;vertical-align:top">Image URL</td><td style="padding:6px 0;font-weight:600"><a href="${escapeHtml(details.imageUrl)}">${escapeHtml(details.imageUrl)}</a></td></tr>` : ''}
        ${details.adminLink ? `<tr><td style="padding:6px 0;color:#6b7280;vertical-align:top">Admin</td><td style="padding:6px 0;font-weight:600"><a href="${escapeHtml(details.adminLink)}">Open in admin</a></td></tr>` : ''}
      </table>
    </div>
  `

  try {
    return await sendResendEmail({
      to,
      subject,
      text,
      html,
    })
  } catch (error) {
    console.error('INBOUND PART EMAIL ERROR:', error)
    return { sent: false, skipped: false, providerId: null, error: error instanceof Error ? error.message : String(error) }
  }
}
