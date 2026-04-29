import type { Metadata } from "next";
import SeoContentPage from "@/app/components/SeoContentPage";

export const metadata: Metadata = {
  title: "Can you 3D print a replacement part? | Flangie",
  description:
    "Learn when a replacement part can be 3D printed, how photo-to-CAD works, and how to upload a broken or missing part for review.",
};

export default function Page() {
  return (
    <SeoContentPage
      title="Can you 3D print a replacement part?"
      intro={[
        "Yes, in many cases a replacement part can be 3D printed, especially if the original was plastic, low-load, or hard to source. The quickest path is to upload the original file, but photos and measurements are often enough to assess whether a part can be recreated.",
        "If you do not have a file, the process is usually photo → CAD → manufacture. We review the photos, work out whether the shape can be recreated remotely, and then route the job to 3D printing or another manufacturing method if that makes more sense.",
      ]}
      processTitle="How the process works"
      processSteps={[
        "Upload photos of the broken or missing part, plus at least one real-world measurement.",
        "We assess whether the photos are good enough for CAD recreation or whether more angles or scale reference are needed.",
        "Once the geometry is clear, the part is recreated in CAD and then manufactured as a one-off or small batch.",
      ]}
      exampleTitle="Example use case"
      exampleBody="A customer loses a small dishwasher wheel clip that is no longer sold by the manufacturer. With clear front, side, and top photos plus the clip width in millimetres, the part can often be recreated in CAD and 3D printed as a functional replacement."
    />
  );
}
