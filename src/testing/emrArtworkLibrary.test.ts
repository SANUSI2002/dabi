import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const folder = resolve(process.cwd(), 'public/emr-artwork/v1');
const manifest = JSON.parse(readFileSync(`${folder}/manifest.json`, 'utf8')) as {
  entries: { id: string; route: string; status: string; image: string; thumbnail: string }[];
};

describe('published EMR artwork library', () => {
  it('ships every original module illustration and lightweight preview, without duplicates', async () => {
    expect(manifest.entries).toHaveLength(115);
    expect(new Set(manifest.entries.map(e => e.id)).size).toBe(115);
    const hashes = new Set<string>();
    let bytes = 0;
    for (const entry of manifest.entries) {
      expect(entry.status).toBe('ready');
      expect(entry.route).toMatch(/^\//);
      for (const [name, maximumWidth] of [[entry.image, 1536], [entry.thumbnail, 480]] as const) {
        expect(name).toMatch(/^[a-z0-9-]+\.webp$/i);
        const data = readFileSync(`${folder}/${name}`);
        const info = await sharp(data).metadata();
        expect(info.format).toBe('webp');
        expect(info.width).toBeGreaterThan(0);
        expect(info.width).toBeLessThanOrEqual(maximumWidth);
        expect(info.height).toBeGreaterThan(0);
        bytes += data.length;
        if (name === entry.image) hashes.add(createHash('sha256').update(data).digest('hex'));
      }
    }
    expect(hashes.size).toBe(115);
    expect(bytes).toBeLessThan(20_000_000);
  });

  it('links every image in the gallery and loads previews lazily', () => {
    const html = readFileSync(`${folder}/index.html`, 'utf8');
    const gallery = new DOMParser().parseFromString(html, 'text/html');
    expect(gallery.querySelectorAll('article')).toHaveLength(115);
    expect(gallery.querySelectorAll('img[loading="lazy"]')).toHaveLength(115);
    for (const entry of manifest.entries) {
      expect(gallery.querySelector(`a[href="${entry.image}"]`)).not.toBeNull();
      expect(gallery.querySelector(`img[src="${entry.thumbnail}"]`)).not.toBeNull();
    }
    expect(gallery.querySelector('label[for="category"]')).not.toBeNull();
  });
});
