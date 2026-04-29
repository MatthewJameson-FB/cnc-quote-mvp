import type { Metadata } from "next";
import SeoContentPage from "@/app/components/SeoContentPage";

export const metadata: Metadata = {
  title: "Lost a part? How to recreate it | Flangie",
  description:
    "What to do when you have lost a part and need it recreated, including how to use photos, measurements, and CAD review.",
};

export default function Page() {
  return (
    <SeoContentPage
      title="Lost a part? How to recreate it"
      intro={[
        "If you have lost a part, you can often still recreate it by working from the space it fits into, similar parts, old photos, or matching features such as hole spacing and clip positions. The more context you can provide, the easier it is to judge whether remote CAD recreation is realistic.",
        "In practice, the route is usually photo → CAD → manufacture. You upload photos of the area the part belongs to, add key measurements, explain what the part is meant to do, and then the geometry is recreated before the final part is made.",
      ]}
      processTitle="How recreation usually works"
      processSteps={[
        "Upload photos of the assembly, mounting points, or matching part, and include at least one known measurement.",
        "We assess whether the fit can be inferred safely from the images or whether more views or a physical sample are needed.",
        "If the information is usable, the missing part is recreated in CAD and routed to the best manufacturing method.",
      ]}
      exampleTitle="Example use case"
      exampleBody="A customer loses a plastic battery cover from a handheld device. They photograph the device opening, show the latch area from multiple angles, and provide the overall opening width. That can be enough to assess whether the cover can be recreated without the original part."
    />
  );
}
