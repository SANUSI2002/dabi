// Regenerates installable-app icons from the owner-supplied official brand artwork.
// Run after changing the logo: `npm run icons`. Writes the same set to the main app and to the
// folder both telemedicine portals publish from.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = resolve(root, "apps/telemedicine/packages/shared-portal/assets/sabi-symbol-source.png");
const background = "#ffffff";
const targets = [resolve(root, "public"), resolve(root, "apps/telemedicine/packages/shared-portal/public")];
const assetDir = resolve(root, "apps/telemedicine/packages/shared-portal/assets");
await sharp(resolve(assetDir, "sabi-wordmark-source.png")).trim().resize({ width: 720 }).webp({ quality: 92 }).toFile(resolve(assetDir, "sabi-wordmark.webp"));
await sharp(source).trim().resize(256, 256, { fit: "contain", background: "#00000000" }).webp({ quality: 92 }).toFile(resolve(assetDir, "sabi-symbol.webp"));

// Render the vector at high density, then downscale, so edges and the gradient stay clean.
const mark = (size) => sharp(source).trim().resize(size, size, { fit: "contain", background: "#00000000" }).png().toBuffer();
// Platforms that crop icons (Android adaptive, iOS) get the mark centred on a solid background,
// inside the safe zone.
const padded = async (size, scale) => sharp({ create: { width: size, height: size, channels: 4, background } })
  .composite([{ input: await mark(Math.round(size * scale)), gravity: "center" }]).png({ compressionLevel: 9 }).toBuffer();

const icons = {
  "pwa-64x64.png": await padded(64, 0.72),
  "pwa-192x192.png": await padded(192, 0.72),
  "pwa-512x512.png": await padded(512, 0.72),
  "maskable-icon-512x512.png": await padded(512, 0.58),
  "apple-touch-icon-180x180.png": await padded(180, 0.72),
};
for (const dir of targets) {
  mkdirSync(dir, { recursive: true });
  for (const [name, data] of Object.entries(icons)) await sharp(data).toFile(resolve(dir, name));
  // Retain the legacy favicon URL for bookmarks and older cached HTML, using the same artwork.
  writeFileSync(resolve(dir, "favicon.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image width="64" height="64" href="data:image/png;base64,${icons["pwa-64x64.png"].toString("base64")}"/></svg>\n`);
}
console.log(`Wrote ${Object.keys(icons).length} icons to ${targets.length} folders`);
