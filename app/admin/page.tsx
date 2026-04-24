import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  defaultQuoteStatus,
  quoteStatusLabels,
  quoteStatusOptions,
  type QuoteStatus,
} from "@/lib/quote-statuses";
import { introduceQuoteToPartner, updateQuoteStatus } from "./actions";

export const dynamic = "force-dynamic";

type QuoteRecord = {
  id: string;
  quote_ref: string | null;
  name: string | null;
  email: string | null;
  introduced: boolean | null;
  introduced_at: string | null;
  partner_email: string | null;
  partner_name: string | null;
  partner_accepted: boolean | null;
  accepted_at: string | null;
  material: string | null;
  complexity: string | null;
  volume_cm3: number | null;
  quantity: number | null;
  quote_low: number | null;
  quote_high: number | null;
  created_at: string;
  file_path: string | null;
  status: string | null;
};

type QuoteRecordWithFile = QuoteRecord & {
  fileUrl: string | null;
  fileName: string | null;
};

const openStatuses: QuoteStatus[] = [
  "new",
  "introduced",
  "pending_review",
  "in_review",
  "quoted",
];
const closedStatuses: QuoteStatus[] = ["accepted", "won", "lost"];

function statusTone(status: string | null | undefined) {
  switch (status) {
    case "new":
    case "pending_review":
      return "bg-slate-100 text-slate-800 ring-1 ring-slate-200";
    case "introduced":
      return "bg-blue-100 text-blue-900 ring-1 ring-blue-200";
    case "accepted":
    case "won":
      return "bg-green-100 text-green-900 ring-1 ring-green-200";
    case "quoted":
      return "bg-violet-100 text-violet-900 ring-1 ring-violet-200";
    case "lost":
      return "bg-red-100 text-red-900 ring-1 ring-red-200";
    default:
      return "bg-gray-200 text-gray-800 ring-1 ring-gray-300";
  }
}

function sectionTone(title: string) {
  return title === "Active leads"
    ? "border-slate-200 bg-slate-50/60"
    : "border-slate-200 bg-white";
}

function formatQuoteRef(quote: QuoteRecord) {
  return quote.quote_ref || `CNC-${quote.id.slice(0, 8).toUpperCase()}`;
}

function formatMaybeMoney(value: number | null) {
  return value == null ? "—" : `£${value}`;
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function QuoteCard({ quote }: { quote: QuoteRecordWithFile }) {
  const status = (quote.status ?? defaultQuoteStatus) as QuoteStatus;
  const introducedAt = formatDate(quote.introduced_at);
  const acceptedAt = formatDate(quote.accepted_at);
  const displayQuoteRef = formatQuoteRef(quote);
  const actionState = quote.partner_accepted
    ? "Accepted"
    : quote.introduced
      ? "Introduced"
      : "Introduce to partner";

  return (
    <article className="rounded-2xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Quote ref
            </p>
            <p className="text-lg font-bold text-gray-900">{displayQuoteRef}</p>
          </div>

          <div>
            <p className="text-lg font-semibold text-gray-900">
              {quote.name || "No customer name"}
            </p>
            <p className="text-sm text-gray-500">{quote.email || "No customer email"}</p>
          </div>
        </div>

        <div className="text-right">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTone(
              status
            )}`}
          >
            {quoteStatusLabels[status] ?? status}
          </span>
          <p className="mt-3 text-2xl font-bold text-gray-900">
            {formatMaybeMoney(quote.quote_low)} – {formatMaybeMoney(quote.quote_high)}
          </p>
          <p className="text-sm text-gray-500">{formatDate(quote.created_at)}</p>
        </div>
      </div>

      <dl className="mt-5 grid gap-3 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-gray-500">Material</dt>
          <dd className="font-medium text-gray-900">{quote.material || "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Quantity</dt>
          <dd className="font-medium text-gray-900">{quote.quantity ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Complexity</dt>
          <dd className="font-medium text-gray-900">{quote.complexity || "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Volume</dt>
          <dd className="font-medium text-gray-900">
            {quote.volume_cm3 == null ? "—" : `${quote.volume_cm3} cm³`}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Introduced</dt>
          <dd className="font-medium text-gray-900">
            {quote.introduced ? `Yes · ${introducedAt}` : "No"}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Accepted</dt>
          <dd className="font-medium text-gray-900">
            {quote.partner_accepted ? `Yes · ${acceptedAt}` : "No"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <form action={updateQuoteStatus} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="quoteId" value={quote.id} />
            <label className="grid gap-1 text-sm font-medium text-gray-700">
              Update status
              <select
                name="status"
                defaultValue={status}
                className="rounded-lg border bg-white px-3 py-2 text-sm"
              >
                {quoteStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white">
              Save
            </button>
          </form>

          <form
            action={introduceQuoteToPartner}
            className="grid gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4"
          >
            <input type="hidden" name="quoteId" value={quote.id} />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-gray-700">
                Partner name
                <input
                  name="partnerName"
                  defaultValue={quote.partner_name ?? ""}
                  className="rounded-lg border bg-white px-3 py-2 text-sm"
                  placeholder="Partner name"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium text-gray-700">
                Partner email
                <input
                  name="partnerEmail"
                  type="email"
                  defaultValue={quote.partner_email ?? ""}
                  className="rounded-lg border bg-white px-3 py-2 text-sm"
                  placeholder="partner@example.com"
                />
              </label>
            </div>
            <button
              className={`w-fit rounded-lg px-4 py-2 text-sm font-medium text-white ${
                quote.partner_accepted
                  ? "bg-green-600"
                  : quote.introduced
                    ? "bg-blue-600"
                    : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {actionState}
            </button>
          </form>
        </div>

        <div className="space-y-3 text-right text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              File
            </p>
            {quote.fileUrl ? (
              <a
                href={quote.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-blue-600 underline"
              >
                Open file
              </a>
            ) : quote.file_path ? (
              <span className="text-amber-700">File link unavailable</span>
            ) : (
              <span className="text-gray-400">No file uploaded</span>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Partner
            </p>
            <p className="font-medium text-gray-900">{quote.partner_name || "—"}</p>
            <p className="text-gray-500">{quote.partner_email || "—"}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

function QuoteSection({
  title,
  quotes,
}: {
  title: string;
  quotes: QuoteRecordWithFile[];
}) {
  return (
    <section className={`rounded-3xl border p-4 ${sectionTone(title)}`}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-600">{quotes.length} leads</p>
        </div>
      </div>

      <div className="space-y-4">
        {quotes.map((quote) => (
          <QuoteCard key={quote.id} quote={quote} />
        ))}
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

export default async function AdminPage() {
  const supabase = createSupabaseAdminClient();

  const { data: quotes, error } = await supabase
    .from("quotes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const quotesWithFileLinks = await Promise.all<QuoteRecordWithFile>(
    (quotes ?? []).map(async (quote: QuoteRecord) => {
      if (!quote.file_path) {
        return { ...quote, fileUrl: null, fileName: null };
      }

      const { data: signedUrlData } = await supabase.storage
        .from("quote-files")
        .createSignedUrl(quote.file_path, 60 * 60 * 4);

      return {
        ...quote,
        fileUrl: signedUrlData?.signedUrl ?? null,
        fileName: quote.file_path,
      };
    })
  );

  const activeLeads = quotesWithFileLinks.filter((quote) =>
    openStatuses.includes((quote.status ?? defaultQuoteStatus) as QuoteStatus)
  );
  const completedLeads = quotesWithFileLinks.filter((quote) =>
    closedStatuses.includes((quote.status ?? defaultQuoteStatus) as QuoteStatus)
  );

  const counts = {
    new: quotesWithFileLinks.filter((quote) => quote.status === "new").length,
    introduced: quotesWithFileLinks.filter((quote) => quote.status === "introduced")
      .length,
    accepted: quotesWithFileLinks.filter((quote) => quote.status === "accepted")
      .length,
    won: quotesWithFileLinks.filter((quote) => quote.status === "won").length,
    lost: quotesWithFileLinks.filter((quote) => quote.status === "lost").length,
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-gray-900">Lead Pipeline</h1>
          <p className="mt-2 text-gray-600">
            Manage CNC quote leads, introduce partners, and track accepted opportunities.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="New" value={counts.new} />
          <StatCard label="Introduced" value={counts.introduced} />
          <StatCard label="Accepted" value={counts.accepted} />
          <StatCard label="Won" value={counts.won} />
          <StatCard label="Lost" value={counts.lost} />
        </section>

        {quotesWithFileLinks.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-semibold text-gray-900">
              No leads yet. New quote requests will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            <QuoteSection title="Active leads" quotes={activeLeads} />
            <QuoteSection title="Completed leads" quotes={completedLeads} />
          </div>
        )}
      </div>
    </main>
  );
}
