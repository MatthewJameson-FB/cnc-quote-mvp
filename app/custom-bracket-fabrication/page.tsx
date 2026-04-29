import type { Metadata } from "next";
import SeoContentPage from "@/app/components/SeoContentPage";

export const metadata: Metadata = {
  title: "Custom bracket fabrication | Flangie",
  description:
    "Need a custom bracket made? Learn how bracket fabrication works from file or photo, from CAD recreation through to manufacture.",
};

export default function Page() {
  return (
    <SeoContentPage
      title="Custom bracket fabrication"
      intro={[
        "Custom brackets are often straightforward to make when you have the mounting points, material preference, and overall dimensions. If you already have a file, the job can move quickly. If not, photos and measurements are usually enough to assess whether a bracket can be recreated in CAD first.",
        "For many bracket jobs the process is photo → CAD → manufacture. We review the bracket shape, the holes or slots it needs, how it fits against the mating surfaces, and then route it to 3D printing, CNC, or fabrication depending on the part and material.",
      ]}
      processTitle="Bracket workflow"
      processSteps={[
        "Upload the bracket file if you have it, or send photos showing the mounting face, side profile, and hole positions.",
        "We review the fit, dimensions, and material needs to decide whether CAD recreation or direct manufacture is the right route.",
        "Once the design is confirmed, the bracket is manufactured in the most suitable process for strength, finish, and cost.",
      ]}
      exampleTitle="Example use case"
      exampleBody="A customer needs a small mounting bracket to hold a light inside a van conversion. They share photos of the mounting area, the hole spacing, and the stand-off distance. That is enough to create the bracket in CAD and send it for manufacture."
    />
  );
}
