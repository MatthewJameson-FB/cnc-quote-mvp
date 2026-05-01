import SubmitPartForm from "./SubmitPartForm";
import PublicSiteShell from "@/app/components/PublicSiteShell";

export const dynamic = "force-dynamic";

export default function SubmitPartPage() {
  return (
    <PublicSiteShell>
      <div className="mx-auto max-w-4xl px-4 pb-14 pt-4 sm:px-6 lg:px-8">
        <section className="space-y-5 rounded-[32px] border border-slate-200 bg-[#f8f4ee] p-7 text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.16)] sm:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#355894]">Submit a request</p>
          <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Upload your car part</h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-700">
            If you can’t find a replacement trim, clip, cover or fitting, send us a photo and a short description.
          </p>
        </section>

        <div className="mt-6">
          <SubmitPartForm />
        </div>
      </div>
    </PublicSiteShell>
  );
}
