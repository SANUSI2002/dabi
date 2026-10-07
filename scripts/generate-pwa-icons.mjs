// Regenerates the installable-app icons from the brand mark (public/favicon.svg).
// Run after changing the logo: `npm run icons`. Writes the same set to the main app and to the
// folder both telemedicine portals publish from.
import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = resolve(root, "public/favicon.svg");
const background = "#0a4f32"; // darkest stop of the mark's own gradient
const targets = [resolve(root, "public"), resolve(root, "apps/telemedicine/packages/shared-portal/public")];

// Render the vector at high density, then downscale, so edges and the gradient stay clean.
const mark = (size) => sharp(source, { density: 1200 }).resize(size, size).png().toBuffer();
// Platforms that crop icons (Android adaptive, iOS) get the mark centred on a solid background,
// inside the safe zone.
const padded = async (size, scale) => sharp({ create: { width: size, height: size, channels: 4, background } })
  .composite([{ input: await mark(Math.round(size * scale)), gravity: "center" }]).png({ compressionLevel: 9 }).toBuffer();

const icons = {
  "pwa-64x64.png": await mark(64),
  "pwa-192x192.png": await mark(192),
  "pwa-512x512.png": await mark(512),
  "maskable-icon-512x512.png": await padded(512, 0.7),
  "apple-touch-icon-180x180.png": await padded(180, 0.72),
};
for (const dir of targets) {
  mkdirSync(dir, { recursive: true });
  for (const [name, data] of Object.entries(icons)) await sharp(data).toFile(resolve(dir, name));
}
copyFileSync(source, resolve(targets[1], "favicon.svg"));
console.log(`Wrote ${Object.keys(icons).length} icons to ${targets.length} folders`);
