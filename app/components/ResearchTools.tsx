import { buildResearchLinks } from "@/lib/research-context";

export default function ResearchTools({ searchContext }: { searchContext: string | null | undefined }) {
  const context = searchContext?.trim() || "replacement trim clip missing";
  const links = buildResearchLinks(context);

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-slate-900">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Research tools</p>
        <p className="text-sm leading-6 text-slate-700">
          Search context: <span className="font-mono text-slate-900">{context}</span>
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-amber-100"
          >
            {link.label}
          </a>
        ))}
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        These links are for internal research only. Verify files, dimensions, and part numbers manually.
      </p>
    </section>
  );
}
