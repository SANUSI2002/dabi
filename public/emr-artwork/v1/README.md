# Sabi EMR artwork library

Open `index.html` to browse the generated illustrations and filter by EMR module.
Click an illustration to open its optimised full-size WebP.

`manifest.json` maps every image to an existing EMR route and records its scene,
generation prompt and completion status. Only `ready` entries are completed assets.
Full-size images use `<route-id>-v1.webp`; lightweight previews use
`<route-id>-thumb-v1.webp`. Keep these filenames when moving the gallery.

These are original, fictional decorative healthcare illustrations generated with
the built-in ImageGen tool. They are not clinical instructions or patient records.
When placing them beside a meaningful HTML heading, use an empty image alt
attribute if the illustration adds no information beyond that heading.

This delivery is an image library only. It does not install banners, alter EMR
workflows or change authentication. No generated video is included because video
generation was unavailable in this session.

Original PNGs remain in the workspace under
`output/emr-artwork-v1/originals/`. Project documentation and the exact initial
dashboard prompt are in `docs/emr-artwork-v1.md`.
