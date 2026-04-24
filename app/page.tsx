"use client";

import { useState } from "react";
import { calculateQuote, Material, Complexity } from "@/lib/pricing";

export default function Home() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [material, setMaterial] = useState<Material>("aluminium_6082");
  const [complexity, setComplexity] = useState<Complexity>("medium");
  const [volumeCm3, setVolumeCm3] = useState(100);
  const [quantity, setQuantity] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [quoteRef] = useState(
    () => `CNC-${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}`
  );

  const quote = calculateQuote({
    material,
    complexity,
    volumeCm3,
    quantity,
  });

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow">
        <h1 className="text-3xl font-bold text-gray-900">
          UK CNC Quote Generator
        </h1>

        <p className="mt-2 text-gray-600">
          Get an indicative CNC machining estimate for manual engineering review.
        </p>

        <div className="mt-8 grid gap-5">
          <label className="grid gap-2">
            <span className="font-medium text-gray-800">Name</span>
            <input
              className="rounded-lg border p-3"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="grid gap-2">
            <span className="font-medium text-gray-800">Email</span>
            <input
              className="rounded-lg border p-3"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="grid gap-2">
            <span className="font-medium text-gray-800">CAD file / drawing</span>
            <input
              className="rounded-lg border p-3"
              type="file"
              accept=".step,.stp,.dxf,.dwg,.pdf,.png,.jpg,.jpeg"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>

          <label className="grid gap-2">
            <span className="font-medium text-gray-800">Material</span>
            <select
              className="rounded-lg border p-3"
              value={material}
              onChange={(e) => setMaterial(e.target.value as Material)}
            >
              <option value="aluminium_6082">Aluminium 6082</option>
              <option value="mild_steel">Mild Steel</option>
              <option value="stainless_steel">Stainless Steel</option>
              <option value="acetal_pom">Acetal / POM</option>
              <option value="brass">Brass</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="font-medium text-gray-800">Approx volume cm³</span>
            <input
              className="rounded-lg border p-3"
              type="number"
              min="1"
              value={volumeCm3}
              onChange={(e) => setVolumeCm3(Number(e.target.value))}
            />
          </label>

          <label className="grid gap-2">
            <span className="font-medium text-gray-800">Quantity</span>
            <input
              className="rounded-lg border p-3"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>

          <label className="grid gap-2">
            <span className="font-medium text-gray-800">Complexity</span>
            <select
              className="rounded-lg border p-3"
              value={complexity}
              onChange={(e) => setComplexity(e.target.value as Complexity)}
            >
              <option value="simple">Simple</option>
              <option value="medium">Medium</option>
              <option value="complex">Complex</option>
            </select>
          </label>

          <button
            className="mt-4 rounded-lg bg-black px-6 py-3 font-medium text-white"
            onClick={async () => {
              setSubmitted(true);

              const formData = new FormData();

              formData.append("name", name);
              formData.append("email", email);
              formData.append("material", material);
              formData.append("complexity", complexity);
              formData.append("volumeCm3", String(volumeCm3));
              formData.append("quantity", String(quantity));
              formData.append("quoteLow", String(quote.low));
              formData.append("quoteHigh", String(quote.high));
              formData.append("quoteTotal", String(quote.totalIncVat));

              if (file) {
                formData.append("file", file);
              }

              await fetch("/api/quote", {
                method: "POST",
                body: formData,
              });
            }}
          >
            Generate Quote
          </button>
        </div>

        {submitted && (
          <div className="mt-8 rounded-xl bg-gray-900 p-6 text-white">
            <p className="text-sm uppercase tracking-wide text-gray-300">
              Indicative quote
            </p>

            <p className="mt-2 text-4xl font-bold">
              £{quote.low}–£{quote.high} inc. VAT
            </p>

            <p className="mt-3 text-gray-300">Quote ref: {quoteRef}</p>

            <p className="mt-1 text-gray-300">
              Customer: {name || "Not provided"}
            </p>

            {file && (
              <p className="mt-1 text-gray-300">File selected: {file.name}</p>
            )}

            <p className="mt-1 text-gray-300">
              Status: Pending engineering review
            </p>

            <p className="mt-1 text-gray-300">
              Estimated lead time: 7–10 working days
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
