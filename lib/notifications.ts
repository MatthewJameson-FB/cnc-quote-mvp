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
    return { sent: false, skipped: true };
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
    return { sent: false, skipped: false };
  }

  return { sent: true, skipped: false };
}

function quoteSummary(details: QuoteNotificationDetails) {
  return [
    `Name: ${details.name}`,
    `Email: ${details.email}`,
    details.companyName ? `Company: ${details.companyName}` : null,
    details.phone ? `Phone: ${details.phone}` : null,
    `Material: ${details.material}`,
    `Complexity: ${details.complexity}`,
    `Approx volume: ${details.volumeCm3} cm³`,
    `Quantity: ${details.quantity}`,
    details.notes ? `Notes: ${details.notes}` : null,
    `Indicative quote: £${details.quoteLow}–£${details.quoteHigh} inc. VAT`,
    `Total inc. VAT: £${details.quoteTotal}`,
    "Status: Pending engineering review",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendQuoteNotifications(details: QuoteNotificationDetails) {
  const internalEmail = process.env.QUOTE_INTERNAL_NOTIFY_EMAIL?.trim();
  const summary = quoteSummary(details);

  const tasks = [
    sendResendEmail({
      to: details.email,
      subject: "We received your CNC quote request",
      text: `${summary}\n\nThanks — we’ll review this manually and get back to you.`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
          <h2 style="margin:0 0 12px">We received your CNC quote request</h2>
          <p style="margin:0 0 12px">Thanks — we’ll review this manually and get back to you.</p>
          <pre style="white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:8px">${escapeHtml(summary)}</pre>
        </div>
      `,
    }),
  ];

  if (internalEmail) {
    tasks.push(
      sendResendEmail({
        to: internalEmail,
        subject: `New CNC quote request from ${details.name}`,
        text: summary,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
            <h2 style="margin:0 0 12px">New CNC quote request</h2>
            <pre style="white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:8px">${escapeHtml(summary)}</pre>
          </div>
        `,
      })
    );
  }

  const results = await Promise.allSettled(tasks);

  return {
    customer: results[0],
    internal: results[1] ?? null,
  };
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
            <div style="margin:4px 0"><a href="${escapeHtml(lead.source_url)}" style="color:#2563eb">Open source</a></div>
            <div style="margin:8px 0">${escapeHtml(lead.snippet)}</div>
            <div style="margin:8px 0;padding:10px;background:#f8fafc;border-radius:8px"><strong>Suggested reply:</strong> ${escapeHtml(lead.suggested_reply)}</div>
            <div style="margin:8px 0;color:#6b7280;font-size:13px">Keywords: ${escapeHtml(lead.detected_keywords.join(", ") || "—")}</div>
            <div style="margin:4px 0;color:#6b7280;font-size:13px">Materials: ${escapeHtml(lead.detected_materials.join(", ") || "—")}</div>
          </td>
        </tr>
      `
    )
    .join("");

  await sendResendEmail({
    to,
    subject,
    text,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;max-width:760px;margin:0 auto">
        <h2 style="margin:0 0 12px">Flangie pre-leads</h2>
        <p style="margin:0 0 16px;color:#6b7280">Manual review only — do not auto-contact anyone.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
          ${htmlRows || `<tr><td style="padding:16px">No qualifying leads found.</td></tr>`}
        </table>
      </div>
    `,
  });

  return true;
}
