type ResearchContextInput = {
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: string | null;
  model_specifics?: string | null;
  description?: string | null;
  post_text?: string | null;
  title?: string | null;
  issue_type?: string | null;
  size_estimate?: string | null;
};

function cleanSegment(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/[\n\r\t]+/g, " ")
    .replace(/["'`]/g, "")
    .replace(/[^a-zA-Z0-9+&/\-., ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitWords(value: string) {
  return value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function buildSearchContext(input: ResearchContextInput) {
  const segments = [
    input.vehicle_make,
    input.vehicle_model,
    input.vehicle_year,
    input.model_specifics,
    input.title,
    input.post_text,
    input.description,
    input.issue_type,
    input.size_estimate,
  ]
    .map(cleanSegment)
    .filter(Boolean);

  const tokens: string[] = [];
  const seen = new Set<string>();

  for (const segment of segments) {
    for (const token of splitWords(segment)) {
      const normalized = token.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      tokens.push(token);
    }
  }

  if (!tokens.some((token) => token.toLowerCase() === "replacement")) {
    tokens.push("replacement");
  }

  const result = tokens.join(" ").replace(/\s+/g, " ").trim();
  return result.slice(0, 160);
}

function buildSearchUrl(base: string, query: string) {
  return `${base}${encodeURIComponent(query)}`;
}

export function buildResearchLinks(searchContext: string) {
  const query = cleanSegment(searchContext);
  const withPartNumber = cleanSegment(`${query} part number`);
  const withStl = cleanSegment(`${query} STL`);
  const withCad = cleanSegment(`${query} CAD file OR 3D model`);
  const withForum = cleanSegment(`${query} forum`);

  return [
    { label: "Google", href: buildSearchUrl("https://www.google.com/search?q=", query) },
    { label: "Images", href: buildSearchUrl("https://www.google.com/search?tbm=isch&q=", query) },
    { label: "eBay", href: buildSearchUrl("https://www.ebay.co.uk/sch/i.html?_nkw=", query) },
    { label: "Part number", href: buildSearchUrl("https://www.google.com/search?q=", withPartNumber) },
    { label: "STL", href: buildSearchUrl("https://www.google.com/search?q=", withStl) },
    { label: "CAD", href: buildSearchUrl("https://www.google.com/search?q=", withCad) },
    { label: "Forums", href: buildSearchUrl("https://www.google.com/search?q=", withForum) },
  ];
}
