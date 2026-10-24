# Sabi EMR original artwork library

This asset-generation task creates decorative editorial illustrations for the EMR's existing navigation and detail routes. The canonical scope is `public/emr-artwork/v1/manifest.json`: 115 route entries in 10 navigation groups, read from `src/data/nav.ts` plus seven explicit detail routes. Internal tabs inherit their route's artwork; they are not separate newly invented clinical modules.

The user explicitly selected **image library only for now**. Do not insert the images into the EMR page layouts as part of this task.

## Delivery verification

All 115 route entries are ready. Final verification passed with no missing files,
invalid PNG/WebP assets or duplicate full-size image hashes. The 230 optimised
WebP files (full-size plus thumbnails) total 14,071,266 bytes. The portable ZIP is
`output/emr-artwork-v1/sabi-emr-artwork-v1.zip`; PNG originals are retained
separately rather than inflating that download. No page layouts were changed and
the library is delivered as static assets separately from the EMR workflows.

## Live publishing

The deployment includes the browseable gallery at
`https://emr.sabihealth.org/emr-artwork/v1/index.html`. It contains only generated
decorative artwork, route labels and generation provenance, not patient records.
There is no authentication bypass into EMR pages. The gallery uses lazy-loaded
thumbnails and is excluded from the installed app's navigation fallback and bulk
precache. Clinical page layouts are unchanged.

The original PNGs and contact sheets remain local and are not deployed. CI checks
the published WebP collection with `src/testing/emrArtworkLibrary.test.ts`; the
original generation verifier below additionally requires the local source PNGs.

## Outputs

- Browse the collection at `/emr-artwork/v1/index.html` on the local frontend server, or open `public/emr-artwork/v1/index.html` directly.
- Optimised full-size images: `public/emr-artwork/v1/<route-id>-v1.webp`.
- Gallery thumbnails: `public/emr-artwork/v1/<route-id>-thumb-v1.webp`.
- Generated originals: `output/emr-artwork-v1/originals/<route-id>.png`.
- QA contact sheets: `output/emr-artwork-v1/qa/`.
- The manifest records each route, category, label, scene, generation prompt and completion state. A pending entry is not a completed deliverable.

Generated with the built-in ImageGen tool, one original image request per route. No external CLI model, third-party API key or real patient reference photographs were used. Video generation is not available in this session; still images are not represented as generated videos.

## Visual direction and use

Forest green, sage, ivory, warm stone and restrained apricot preserve Sabi's existing visual language. Contemporary Nigerian healthcare scenes use a calm painterly editorial treatment, rather than stock photography or futuristic clinical interfaces. The scene sits toward the right, leaving quiet space for real, accessible HTML headings. Images contain no required text, patient identifiers or clinical instructions. They must not be used as diagrams demonstrating treatment technique.

The UI/UX skill informed WebP optimisation, separate lightweight thumbnails, reserved image dimensions, keyboard-focusable image links, labelled module filters and mobile-safe grid sizing. The library does not autoplay, depend on hover, change authentication, expose patient records or modify clinical forms. Generating these assets does not automatically insert banners into every working clinical screen or publish a production deployment.

## Rebuild and verify

```powershell
node scripts/emr-artwork-catalog.mjs gallery
node scripts/emr-artwork-catalog.mjs verify --complete
node scripts/emr-artwork-catalog.mjs sheets
```

`init` creates the planned route catalogue while retaining completed entries. `attach <route-id> <generated-PNG-path>` copies the original into the workspace and makes its optimised derivatives. Do not rerun `init` concurrently with image attachment. The original dirty user worktree and unrelated edits are preserved.

Every prompt is in the manifest. The first dashboard illustration used this initial prompt before the common route template was established:

> Use case: illustration-story. Asset type: wide editorial page banner for Sabi EMR hospital overview dashboard. Create ONE premium painterly illustration, landscape 1536x1024. Scene: a calm contemporary Nigerian hospital atrium where a Black female doctor in sage scrubs and Black male hospital administrator in cream clothes review a tablet together, with a leafy courtyard and soft architecture behind them. Refined hand-painted paper texture, warm daylight, forest green, sage, ivory, warm stone, small apricot accents. Composition: people and meaningful detail in the right half, left half quiet with pale sage/ivory atmospheric negative space for real HTML heading, designed for a wide banner crop. Confident, human, elegant, not stock photography, no neon, no robots, no exaggerated medical props. No text, lettering, interface screenshots, logos, watermarks, diagrams, blood or visible personal medical information. This is decorative artwork, not clinical instruction.
