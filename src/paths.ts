import {
  normalizeBase,
  withinBase,
  withoutBase,
  tableLocation,
} from "./base.ts";
export const basePath = normalizeBase(import.meta.env?.BASE_URL || "/");
export const appPath = (path = "") => withinBase(path, basePath);
export const routePath = () => withoutBase(location.pathname, basePath);
export const tablePath = (code: string, tabletop = false) =>
  tableLocation(code, tabletop, basePath);
