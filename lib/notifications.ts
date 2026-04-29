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
  estimate?: EstimateQuoteResult;
  confirmationYesUrl?: string;
  confirmationNoUrl?: string;
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
  subject,
  text,
  html,
}: {
  to: string;
  cc?: string[];
  subject: string;
  text: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from || !to) {
    return { sent: false, skipped: true, providerId: null, error: "Missing email config or recipient." };
  }

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

  return {
    sent: true,
    skipped: false,
    providerId: payload?.id ?? null,
    error: null,
  };
}

function stageLabel(stage?: string) {
  if (stage === "needs_cad" || stage === "needs_file") return "Needs CAD recreation";
  if (stage === "needs_print") return "Ready for supplier quote";
  if (stage === "needs_both") return "Needs review (file + photos)";
  return stage || "—";
}

function routingLabel(routingDecision?: string) {
  if (routingDecision === "cad_required") return "Needs CAD recreation";
  if (routingDecision === "3d_print") return "Ready for supplier quote (3D print)";
  if (routingDecision === "cnc") return "Ready for supplier quote (CNC)";
  return routingDecision || "Review";
}

function manufacturingTypeLabel(type?: string) {
  if (type === "3d_print") return "3D print";
  if (type === "cnc") return "CNC";
  if (type === "fabrication") return "Fabrication";
  return type || "—";
}

function actionHint(details: QuoteNotificationDetails) {
  if (details.routingDecision === "cad_required") {
    return "Next step: review photos and prepare CAD recreation brief.";
  }

  if (details.routingDecision === "3d_print") {
    return "Next step: review file and send for 3D print quote.";
  }

  if (details.routingDecision === "cnc") {
    return "Next step: review file and send for CNC quote.";
  }

  return "Next step: review the request and decide the best production path.";
}

function renderDetailRow(label: string, value: string) {
  return `
    <tr>
      <td style="padding:8px 0;color:#64748b;font-size:14px;width:42%;vertical-align:top">${escapeHtml(label)}</td>
      <td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:600;vertical-align:top">${escapeHtml(value || "—")}</td>
    </tr>
  `;
}

function renderLinkList(urls: string[] | undefined, emptyLabel = "None") {
  if (!urls?.length) {
    return `<span style="color:#64748b">${escapeHtml(emptyLabel)}</span>`;
  }

  return urls
    .map(
      (url, index) =>
        `<div style="margin:0 0 8px"><a href="${escapeHtml(url)}" style="display:inline-block;color:#2563eb;text-decoration:none;font-weight:600">Open upload ${index + 1}</a></div>`
    )
    .join("");
}

function renderActionButtons(yesUrl?: string, noUrl?: string) {
  if (!yesUrl && !noUrl) return "";

  return `
    <div style="margin-top:16px">
      ${yesUrl ? `<a href="${escapeHtml(yesUrl)}" style="display:inline-block;margin:0 12px 12px 0;padding:12px 18px;border-radius:10px;background:#0f766e;color:#fff;text-decoration:none;font-weight:700">Yes, proceed to exact quote</a>` : ""}
      ${noUrl ? `<a href="${escapeHtml(noUrl)}" style="display:inline-block;margin:0 12px 12px 0;padding:12px 18px;border-radius:10px;background:#fff;color:#334155;text-decoration:none;font-weight:700;border:1px solid #cbd5e1">This is higher than expected</a>` : ""}
    </div>
  `;
}

function renderEstimateSummary(details: QuoteNotificationDetails) {
  if (!details.estimate) return "—";

  const cad = details.estimate.breakdown.cad
    ? `CAD £${details.estimate.breakdown.cad[0]}–£${details.estimate.breakdown.cad[1]}`
    : null;
  const manufacturing = details.estimate.breakdown.manufacturing
    ? `Manufacturing £${details.estimate.breakdown.manufacturing[0]}–£${details.estimate.breakdown.manufacturing[1]}`
    : null;

  return [
    `£${details.estimate.min_price}–£${details.estimate.max_price} ${details.estimate.currency}`,
    cad,
    manufacturing,
  ]
    .filter(Boolean)
    .join(" · ");
}

function customerQuoteEmailText(details: QuoteNotificationDetails) {
  const estimateLine = details.estimate
    ? `Rough estimate: £${details.estimate.min_price}–£${details.estimate.max_price} ${details.estimate.currency}`
    : null;
  const confidenceLine = details.estimate ? `Confidence: ${details.estimate.confidence}` : null;

  return [
    "We received your custom part request",
    "",
    `Name: ${details.name}`,
    `Email: ${details.email}`,
    `Material: ${details.material}`,
    `Quantity: ${details.quantity}`,
    estimateLine,
    confidenceLine,
    details.estimate?.disclaimer ?? null,
    "",
    "If this estimate looks reasonable, confirm and we’ll try to get an exact quote from a suitable supplier.",
    details.confirmationYesUrl ? `Yes, proceed: ${details.confirmationYesUrl}` : null,
    details.confirmationNoUrl ? `Higher than expected: ${details.confirmationNoUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function customerQuoteEmailHtml(details: QuoteNotificationDetails) {
  const estimateCard = details.estimate
    ? `
      <div style="margin:16px 0;padding:20px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px">
        <h3 style="margin:0 0 10px;font-size:18px">Rough estimate</h3>
        <div style="font-size:28px;font-weight:800;color:#0f172a">£${details.estimate.min_price}–£${details.estimate.max_price}</div>
        <div style="margin-top:8px;color:#475569;font-size:14px">Confidence: ${escapeHtml(details.estimate.confidence)}</div>
        <div style="margin-top:10px;color:#64748b;font-size:14px">${escapeHtml(details.estimate.disclaimer)}</div>
        <div style="margin-top:10px;color:#334155;font-size:14px">${escapeHtml(renderEstimateSummary(details))}</div>
      </div>
    `
    : "";

  return `
    <div style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
      <div style="max-width:640px;margin:0 auto">
        <div style="padding:24px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px">
          <h2 style="margin:0 0 12px;font-size:28px">We received your custom part request</h2>
          <p style="margin:0 0 12px;color:#475569">Thanks — we’ll review this manually and get back to you.</p>
          ${estimateCard}
          <p style="margin:0 0 12px;color:#334155">If this estimate looks reasonable, confirm and we’ll try to get an exact quote from a suitable supplier.</p>
          ${renderActionButtons(details.confirmationYesUrl, details.confirmationNoUrl)}
        </div>
      </div>
    </div>
  `;
}

function internalQuoteEmailText(details: QuoteNotificationDetails) {
  return [
    "New custom part request",
    "",
    `Name: ${details.name}`,
    `Email: ${details.email}`,
    `Phone: ${details.phone || "—"}`,
    `Company: ${details.companyName || "—"}`,
    `Material: ${details.material}`,
    `Quantity: ${details.quantity}`,
    `Stage: ${stageLabel(details.stage)}`,
    `Manufacturing type: ${manufacturingTypeLabel(details.manufacturingType)}`,
    `Routing decision: ${routingLabel(details.routingDecision)}`,
    "",
    `Rough estimate: ${renderEstimateSummary(details)}`,
    `Confidence: ${details.estimate?.confidence || "—"}`,
    details.estimate?.disclaimer ?? null,
    "",
    `File uploaded: ${details.hasFile ? "yes" : "no"}`,
    `Photos uploaded: ${details.hasPhotos ? "yes" : "no"}`,
    ...(details.fileUrls?.length ? details.fileUrls.map((url, index) => `File link ${index + 1}: ${url}`) : []),
    ...(details.photoUrls?.length ? details.photoUrls.map((url, index) => `Photo link ${index + 1}: ${url}`) : []),
    ...(details.hasPhotos
      ? [
          "",
          `Measurement: ${details.measurements || "—"}`,
          `Description: ${details.description || "—"}`,
          `CAD required: ${details.cadRequired ? "yes" : "no"}`,
        ]
      : []),
    "",
    `Notes: ${details.notes || "—"}`,
    "",
    actionHint(details),
    details.confirmationYesUrl ? `Accept estimate: ${details.confirmationYesUrl}` : null,
    details.confirmationNoUrl ? `Reject estimate: ${details.confirmationNoUrl}` : null,
    details.confirmationYesUrl ? "If accepted, this moves to awaiting_final_details and a checklist email is sent." : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function internalQuoteEmailHtml(details: QuoteNotificationDetails) {
  const bg = "#f8fafc";
  const card = "#ffffff";
  const border = "#e2e8f0";

  return `
    <div style="margin:0;padding:24px;background:${bg};font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
      <div style="max-width:640px;margin:0 auto">
        <div style="margin:0 0 16px;padding:24px;background:${card};border:1px solid ${border};border-radius:16px">
          <div style="display:inline-block;margin:0 0 12px;padding:6px 10px;border-radius:999px;background:#e0f2fe;color:#0c4a6e;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Internal review</div>
          <h1 style="margin:0 0 8px;font-size:28px;line-height:1.2">New custom part request</h1>
          <p style="margin:0;color:#475569;font-size:15px">A new intake has been submitted and is ready for review.</p>
        </div>

        <div style="margin:0 0 16px;padding:24px;background:${card};border:1px solid ${border};border-radius:16px">
          <h2 style="margin:0 0 16px;font-size:18px">Customer</h2>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
            ${renderDetailRow("Name", details.name)}
            ${renderDetailRow("Email", details.email)}
            ${renderDetailRow("Phone", details.phone || "—")}
            ${renderDetailRow("Company", details.companyName || "—")}
          </table>
        </div>

        <div style="margin:0 0 16px;padding:24px;background:${card};border:1px solid ${border};border-radius:16px">
          <h2 style="margin:0 0 16px;font-size:18px">Material / quantity</h2>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
            ${renderDetailRow("Material", details.material)}
            ${renderDetailRow("Quantity", String(details.quantity))}
          </table>
        </div>

        <div style="margin:0 0 16px;padding:24px;background:${card};border:1px solid ${border};border-radius:16px">
          <h2 style="margin:0 0 16px;font-size:18px">Stage / routing</h2>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
            ${renderDetailRow("Stage", stageLabel(details.stage))}
            ${renderDetailRow("Manufacturing type", manufacturingTypeLabel(details.manufacturingType))}
            ${renderDetailRow("Routing decision", routingLabel(details.routingDecision))}
          </table>
        </div>

        <div style="margin:0 0 16px;padding:24px;background:${card};border:1px solid ${border};border-radius:16px">
          <h2 style="margin:0 0 16px;font-size:18px">Rough estimate</h2>
          <div style="font-size:28px;font-weight:800;color:#0f172a">${escapeHtml(
            details.estimate ? `£${details.estimate.min_price}–£${details.estimate.max_price}` : "—"
          )}</div>
          <div style="margin-top:8px;color:#475569;font-size:14px">Confidence: ${escapeHtml(details.estimate?.confidence || "—")}</div>
          <div style="margin-top:10px;color:#334155;font-size:14px">${escapeHtml(renderEstimateSummary(details))}</div>
          <div style="margin-top:10px;color:#64748b;font-size:14px">${escapeHtml(details.estimate?.disclaimer || "")}</div>
        </div>

        <div style="margin:0 0 16px;padding:24px;background:${card};border:1px solid ${border};border-radius:16px">
          <h2 style="margin:0 0 16px;font-size:18px">Uploads</h2>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
            ${renderDetailRow("File uploaded", details.hasFile ? "Yes" : "No")}
            ${renderDetailRow("Photos uploaded", details.hasPhotos ? "Yes" : "No")}
          </table>
          ${details.fileUrls?.length || details.photoUrls?.length ? `
            <div style="margin-top:16px;padding-top:16px;border-top:1px solid ${border}">
              ${details.fileUrls?.length ? `<div style="margin:0 0 12px"><div style="margin:0 0 8px;color:#64748b;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">File links</div>${renderLinkList(details.fileUrls)}</div>` : ""}
              ${details.photoUrls?.length ? `<div><div style="margin:0 0 8px;color:#64748b;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">Photo links</div>${renderLinkList(details.photoUrls)}</div>` : ""}
            </div>
          ` : ""}
        </div>

        ${details.hasPhotos ? `
          <div style="margin:0 0 16px;padding:24px;background:${card};border:1px solid ${border};border-radius:16px">
            <h2 style="margin:0 0 16px;font-size:18px">Photo / CAD section</h2>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
              ${renderDetailRow("Measurement", details.measurements || "—")}
              ${renderDetailRow("Description", details.description || "—")}
              ${renderDetailRow("CAD required", details.cadRequired ? "Yes" : "No")}
            </table>
          </div>
        ` : ""}

        <div style="margin:0 0 16px;padding:24px;background:${card};border:1px solid ${border};border-radius:16px">
          <h2 style="margin:0 0 12px;font-size:18px">Notes</h2>
          <div style="padding:16px;background:#f8fafc;border:1px solid ${border};border-radius:12px;white-space:pre-wrap;color:#334155;font-size:14px">${escapeHtml(details.notes || "No notes provided.")}</div>
        </div>

        <div style="margin:0 0 16px;padding:24px;background:${card};border:1px solid ${border};border-radius:16px">
          <h2 style="margin:0 0 12px;font-size:18px">Next action</h2>
          <div style="display:inline-block;padding:12px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;color:#1d4ed8;font-weight:600">${escapeHtml(actionHint(details))}</div>
          <p style="margin:12px 0 0;color:#475569;font-size:14px">If accepted, this moves to awaiting final details and triggers a checklist email.</p>
          ${renderActionButtons(details.confirmationYesUrl, details.confirmationNoUrl)}
        </div>
      </div>
    </div>
  `;
}

export async function sendQuoteNotifications(details: QuoteNotificationDetails) {
  const internalEmail = process.env.QUOTE_INTERNAL_NOTIFY_EMAIL?.trim();

  const tasks = [
    sendResendEmail({
      to: details.email,
      subject: "We received your custom part request",
      text: customerQuoteEmailText(details),
      html: customerQuoteEmailHtml(details),
    }),
  ];

  if (internalEmail) {
    tasks.push(
      sendResendEmail({
        to: internalEmail,
        subject: "New custom part request",
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

  console.log(
    `Checklist email config check: RESEND_API_KEY present=${hasApiKey ? "yes" : "no"} RESEND_FROM_EMAIL present=${hasFromEmail ? "yes" : "no"}`
  );

  const text = [
    "Hi,",
    "",
    "Thanks for confirming — we can move this forward 👍",
    "",
    "To make sure the part is quoted accurately and built correctly, we just need a couple of quick details:",
    "",
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
    "If you have more photos or a photo with a ruler next to it, that helps a lot.",
    "",
    "You can just reply to this email with the details 👍",
    "",
    "Once we have this, we’ll confirm the final quote and get things moving.",
    "",
    "Thanks,",
    "Flangie",
    "",
    quoteLine,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;line-height:1.6">
      <div style="max-width:640px;margin:0 auto;padding:24px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px">
        <h2 style="margin:0 0 12px;font-size:28px">A few final details before we quote</h2>
        <p style="margin:0 0 12px">Hi,</p>
        <p style="margin:0 0 12px">Thanks for confirming — we can move this forward 👍</p>
        <p style="margin:0 0 12px">To make sure the part is quoted accurately and built correctly, we just need a couple of quick details:</p>
        <ul style="margin:0 0 16px 20px;padding:0;color:#334155">
          <li><strong>Size / dimensions</strong><br />Any key measurements (mm is best)<br />(e.g. width, height, hole spacing)</li>
          <li style="margin-top:8px"><strong>What it connects to</strong><br />What does the part fit into or attach to?</li>
          <li style="margin-top:8px"><strong>Material</strong><br />Plastic / metal / not sure is fine</li>
          <li style="margin-top:8px"><strong>Quantity</strong><br />Just 1, or multiple?</li>
          <li style="margin-top:8px"><strong>Anything important</strong><br />Does it need to be strong, flexible, or a precise fit?</li>
        </ul>
        <p style="margin:0 0 12px">If you have more photos or a photo with a ruler next to it, that helps a lot.</p>
        <p style="margin:0 0 12px">You can just reply to this email with the details 👍</p>
        <p style="margin:0 0 12px">Once we have this, we’ll confirm the final quote and get things moving.</p>
        <div style="padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;color:#475569">${escapeHtml(quoteLine)}</div>
        <p style="margin:16px 0 0;color:#64748b">Thanks,<br />Flangie</p>
      </div>
    </div>
  `;

  return sendResendEmail({
    to: details.to,
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
