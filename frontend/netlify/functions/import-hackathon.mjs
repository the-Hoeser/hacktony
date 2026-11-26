const ALLOWED_DOMAINS = [
  "devpost.com",
  "unstop.com",
  "hackerearth.com",
  "devfolio.co",
  "mlh.io",
  "luma.com",
  "lu.ma",
  "hackathon.com",
  "hackathons.com",
  "hackathonfinder.in",
  "techsnap.in",
  "indiahackathons.com",
  "allai.events",
];

const isAllowedHost = (hostname) => {
  const host = hostname.toLowerCase().replace(/\\.$/, "");
  return ALLOWED_DOMAINS.some((domain) => host === domain || host.endsWith("." + domain));
};

const isPrivateHost = (hostname) => {
  const host = hostname.toLowerCase();
  return host === "localhost"
    || host.endsWith(".localhost")
    || host === "0.0.0.0"
    || host.startsWith("127.")
    || host.startsWith("10.")
    || host.startsWith("192.168.")
    || host.startsWith("169.254.")
    || /^172\\.(1[6-9]|2\\d|3[01])\\./.test(host)
    || host === "::1"
    || host.startsWith("fc")
    || host.startsWith("fd")
    || /^\\d{1,3}(?:\\.\\d{1,3}){3}$/.test(host);
};

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

const strip = (value = "") => String(value)
  .replace(/<script[\\s\\S]*?<\\/script>/gi, " ")
  .replace(/<style[\\s\\S]*?<\\/style>/gi, " ")
  .replace(/<[^>]*>/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&nbsp;/g, " ")
  .replace(/&#(\\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/\\s+/g, " ")
  .trim();

function meta(html, wanted) {
  for (const match of html.matchAll(/<meta\\b[^>]*>/gi)) {
    const tag = match[0];
    const key = tag.match(/(?:property|name)=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const content = tag.match(/content=["']([^"']*)["']/i)?.[1];
    if (key === wanted.toLowerCase() && content) return content;
  }
  return "";
}

function readJsonLd(html) {
  for (const match of html.matchAll(/<script[^>]+type=["']application\\/ld\\+json["'][^>]*>([\\s\\S]*?)<\\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1]);
      const candidates = Array.isArray(parsed) ? parsed : parsed?.["@graph"] || [parsed];
      const event = candidates.find((item) => {
        const type = Array.isArray(item?.["@type"]) ? item["@type"].join(" ") : item?.["@type"] || "";
        return /event|hackathon/i.test(type);
      });
      if (event) return event;
    } catch {
      // Ignore malformed structured data and fall back to page metadata.
    }
  }
  return {};
}

function asDate(value) {
  if (!value) return "";
  const text = String(value);
  const dateOnly = text.match(/^\\d{4}-\\d{2}-\\d{2}/)?.[0];
  if (dateOnly) return dateOnly;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function platformName(hostname) {
  const host = hostname.replace(/^www\\./i, "").toLowerCase();
  const names = {
    "devpost.com": "Devpost",
    "unstop.com": "Unstop",
    "hackerearth.com": "HackerEarth",
    "devfolio.co": "Devfolio",
    "mlh.io": "Major League Hacking",
    "luma.com": "Luma",
    "lu.ma": "Luma",
    "techsnap.in": "Techsnap",
    "indiahackathons.com": "IndiaHackathons",
  };
  return Object.entries(names).find(([domain]) => host === domain || host.endsWith("." + domain))?.[1] || host;
}

function eventLocation(location) {
  if (!location) return "";
  if (typeof location === "string") return strip(location);
  const place = Array.isArray(location) ? location[0] : location;
  const address = place?.address;
  if (typeof address === "string") return strip(place?.name ? place.name + ", " + address : address);
  return strip([
    place?.name,
    address?.addressLocality,
    address?.addressRegion,
    address?.addressCountry,
  ].filter(Boolean).join(", "));
}

export default async (request) => {
  if (request.method !== "POST") return json({ error: "POST required" }, 405);

  try {
    const body = await request.json();
    if (typeof body?.url !== "string" || !body.url.trim()) {
      return json({ error: "Paste a public event page URL." }, 400);
    }

    let current;
    try {
      current = new URL(body.url.trim());
    } catch {
      return json({ error: "That URL is not valid. Paste the full event page link." }, 400);
    }

    if (!["http:", "https:"].includes(current.protocol) || current.username || current.password
      || isPrivateHost(current.hostname) || !isAllowedHost(current.hostname)) {
      return json({ error: "This platform is not supported yet. Try a public Devpost, Unstop, HackerEarth, Devfolio, MLH, or Luma event page." }, 400);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let response;
    try {
      for (let hop = 0; hop <= 3; hop++) {
        if (isPrivateHost(current.hostname) || !isAllowedHost(current.hostname)) {
          return json({ error: "The event page redirected outside the supported public platforms. The request was blocked." }, 400);
        }
        response = await fetch(current.href, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "user-agent": "HackTony Event Importer/1.0",
            "accept": "text/html,application/xhtml+xml",
          },
        });
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        const next = response.headers.get("location");
        if (!next) break;
        current = new URL(next, current);
      }
    } finally {
      clearTimeout(timeout);
    }

    if (!response) return json({ error: "The event website did not return a response." }, 502);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      return json({ error: "The event page has too many redirects. Try its direct event URL." }, 422);
    }
    if (!response.ok) return json({ error: "The event page returned HTTP " + response.status + ". It may be private or block automated previews." }, 422);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      return json({ error: "That link did not return a public HTML event page." }, 415);
    }
    const html = (await response.text()).slice(0, 2_000_000);
    const structured = readJsonLd(html);
    const name = strip(structured.name || meta(html, "og:title") || html.match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i)?.[1] || "");
    if (!name) return json({ error: "I couldn't identify the event name. This platform may need a dedicated parser; you can still add it manually." }, 422);

    const description = strip(structured.description || meta(html, "og:description") || meta(html, "description")).slice(0, 1600);
    const warnings = [];
    const startDate = asDate(structured.startDate);
    const endDate = asDate(structured.endDate);
    if (!startDate) warnings.push("Start date was not available in the page metadata. Please fill it in.");
    if (!endDate) warnings.push("End date was not available in the page metadata. Please fill it in.");
    const location = eventLocation(structured.location);
    if (!location) warnings.push("Location or event format was not available. Please check the event page.");
    return json({
      event: {
        name,
        description,
        startDate,
        endDate,
        platform: platformName(current.hostname),
        eventUrl: current.href,
        sourceUrl: current.href,
        prize: strip(structured.prize || structured.reward || structured.award || ""),
        location,
        warnings,
      },
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "The event website took too long to respond. Try again or enter the details manually."
      : error instanceof Error ? error.message : "Event import failed.";
    return json({ error: message }, 500);
  }
};
