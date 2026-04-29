import type { Metadata } from "next";
import SeoContentPage from "@/app/components/SeoContentPage";

export const metadata: Metadata = {
  title: "How to make a custom part | Flangie",
  description:
    "A straightforward guide to making a custom part from a file or from photos, including CAD recreation and manufacturing routes.",
};

export default function Page() {
  return (
    <SeoContentPage
      title="How to make a custom part"
      intro={[
        "To make a custom part, you usually need either a file that is ready for manufacture or enough photo and measurement detail for the part to be recreated in CAD. Once the geometry is clear, the part can be produced with 3D printing, CNC, or another suitable process.",
        "If you only have the physical part, the usual route is photo → CAD → manufacture. That means the part is documented from images, modelled in CAD, checked for fit-critical details, and then sent for production in the right material.",
      ]}
      processTitle="From idea to finished part"
      processSteps={[
        "Upload a CAD file, drawing, or clear photos with measurements and a short description of what the part does.",
        "We review the request, choose the likely manufacturing route, and identify whether CAD recreation is needed first.",
        "After the design is ready, the part is manufactured and quoted based on material, quantity, and complexity.",
      ]}
      exampleTitle="Example use case"
      exampleBody="Someone needs a custom adaptor to mount a sensor onto an existing frame. They upload a sketch, a few photos of the mounting point, and the bolt spacing. That information can be turned into a CAD model and then produced as a one-off prototype."
    />
  );
}
