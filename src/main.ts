import { routePath } from "./paths.ts";
if (routePath().startsWith("/gallery")) void import("./gallery.ts");
else void import("./game/app.ts");
