/** A static deployment lives at an origin root or a directory, never a URL. */
export function normalizeBase(value = "/"): string {
  const base = value.endsWith("/") ? value : value + "/";
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base))
    throw Error("PUBLIC_BASE_PATH must be an absolute directory path.");
  return base;
}
export function withinBase(path: string, base: string): string {
  return normalizeBase(base) + path.replace(/^\//, "");
}
export function withoutBase(pathname: string, base: string): string {
  const normalized = normalizeBase(base);
  return pathname === normalized.slice(0, -1)
    ? "/"
    : pathname.startsWith(normalized)
      ? "/" + pathname.slice(normalized.length)
      : pathname;
}
export function tableLocation(
  code: string,
  tabletop: boolean,
  base: string,
): string {
  return withinBase(
    `${tabletop ? "tabletop/" : ""}?table=${encodeURIComponent(code)}`,
    base,
  );
}
