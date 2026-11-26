const isPrivateHost = (host) => {
  const h = host.toLowerCase();
  return h === "localhost" || h.endsWith(".localhost") || h === "127.0.0.1" || h.startsWith("127.") || h === "0.0.0.0" || h.startsWith("10.") || h.startsWith("192.168.") || h.startsWith("169.254.") || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h === "::1" || h.startsWith("fc") || h.startsWith("fd");
};
const strip = (s = "") => String(s).replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
function meta(html, wanted) {
  const tags = [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => m[0]);
  for (const tag of tags) {
    const key = tag.match(/(?:property|name)=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const value = tag.match(/content=["']([^"']*)["']/i)?.[1];
    if (key === wanted.toLowerCase() && value) return value;
  }
  return "";
}
function findJsonLd(html) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of blocks) {
    try {
      const parsed = JSON.parse(match[1]);
      const list = Array.isArray(parsed) ? parsed : parsed["@graph"] || [parsed];
      const event = list.find((item) => /event|hackathon/i.test(item["@type"] || ""));
      if (event) return event;
    } catch {}
  }
  return null;
}
const asDate = (v) => {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};
export default async (request) => {
  if (request.method !== "POST") return new Response(JSON.stringify({error:"POST required"}), {status:405,headers:{"content-type":"application/json"}});
  try {
    const {url} = await request.json();
    if (!url || typeof url !== "string") return new Response(JSON.stringify({error:"Paste a valid event URL"}), {status:400,headers:{"content-type":"application/json"}});
    const parsed = new URL(url);
    if (!["http:","https:"].includes(parsed.protocol) || isPrivateHost(parsed.hostname)) return new Response(JSON.stringify({error:"Only public HTTP/HTTPS event pages are supported"}), {status:400,headers:{"content-type":"application/json"}});
    let current = parsed;\n    let res;\n    for (let hop = 0; hop < 4; hop++) {\n      if (isPrivateHost(current.hostname)) return new Response(JSON.stringify({error:"Redirect to a private host blocked"}), {status:400,headers:{"content-type":"application/json"}});\n      res = await fetch(current.href, {headers:{"User-Agent":"HackTony Event Importer/1.0","Accept":"text/html,application/xhtml+xml"},redirect:"manual"});\n      if (![301,302,303,307,308].includes(res.status)) break;\n      const location = res.headers.get("location");\n      if (!location) break;\n      current = new URL(location,current);\n      if (hop === 3) return new Response(JSON.stringify({error:"Too many redirects"}), {status:422,headers:{"content-type":"application/json"}});\n    }
    if (!res.ok) return new Response(JSON.stringify({error:"Event page returned HTTP "+res.status+"; try another public URL"}), {status:422,headers:{"content-type":"application/json"}});
    const html = (await res.text()).slice(0,1_500_000);
    const ld = findJsonLd(html) || {};
    const title = strip(ld.name || meta(html,"og:title") || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
    const description = strip(ld.description || meta(html,"og:description") || meta(html,"description")).slice(0,1800);
    const startDate = asDate(ld.startDate || "");
    const endDate = asDate(ld.endDate || "");
    const platform = parsed.hostname.replace(/^www\./,"");
    const prize = strip(ld.offers?.price || ld.reward || "");
    const eventUrl = ld.url || meta(html,"og:url") || parsed.href;
    const event = {name:title,description,startDate,endDate,platform,eventUrl,sourceUrl:parsed.href,prize,location:strip(ld.location?.name || ld.location?.address?.addressLocality || "")};
    if (!title) return new Response(JSON.stringify({error:"Could not identify the event title from this page. Try a direct public event page or enter it manually."}), {status:422,headers:{"content-type":"application/json"}});
    return new Response(JSON.stringify({event}), {status:200,headers:{"content-type":"application/json","cache-control":"no-store"}});
  } catch (err) {
    return new Response(JSON.stringify({error:err instanceof Error?err.message:"Import failed"}), {status:400,headers:{"content-type":"application/json"}});
  }
};
