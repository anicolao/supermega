/** Turn a former SPA deep link into a real static page on the same origin. */
export function legacyTableUrl(href) {
  const source = new URL(href);
  const match = source.pathname.match(/^(.*\/)(table|tabletop)\/([A-Za-z0-9]{8})\/?$/);
  if (!match) return null;
  // Prefix with the origin explicitly: even a path starting // stays local.
  const destination = new URL(source.origin + match[1] + (match[2] === "tabletop" ? "tabletop/" : ""));
  destination.search = source.search;
  destination.searchParams.set("table", match[3].toUpperCase());
  destination.hash = source.hash;
  return destination.href;
}
