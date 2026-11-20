# Water Meter Lay Length Quick Reference — Design

Date: 2026-11-20
Repo: meterlookup (published at https://gitgrossifiles.github.io/meterlookup/)

## Intent

A single sheet that answers "what flanged lay lengths does this make/model/size
of water meter come in?" so a tech sizing a replacement can tell in seconds
whether a candidate meter drops into the existing setting. Lay length is the
flange-face-to-flange-face dimension.

## Who uses it, where

- Techs in the field on the iPad, often without signal.
- Anyone at the shop PC.
- A laminated letter-size hard copy on the wall and in each truck.

## Goals

- Every make/model the fleet actually contains at 1 1/2" and up (Sensus,
  Badger, Neptune, Hersey, Master Meter, Metron-Farnier, Zenner, legacy
  Elster/Kent and Rockwell), each size, every flanged lay length offered.
- Filter by manufacturer and size on screen; print groups by manufacturer.
- A concise "popular meters" view: each row carries a `popular` flag seeded
  from the HBK meters table (model/size combos the fleet actually contains in
  volume). A "Popular only" toggle narrows both the screen and the printout.
- Hand-picked print sets: a checkbox per row builds a custom selection that
  prints on its own; the selection is remembered per device (localStorage).
- Data lives in one JSON file so a correction is a one-line edit and push.
- Works offline after the first visit.

## Non-goals

- NPT / hex-end lay lengths (adapters to flanged are standard across the shop).
- Sizes under 1 1/2".
- Integration into the HBK Water Flask app.
- Flow rates, pressure loss, or any other spec besides lay length.

## Anti-goals

- A sheet that silently guesses. A length not confirmed from a spec sheet is
  shown as unknown, not filled in.
- A print layout that spills a manufacturer across pages in a way that makes
  the laminated copy hard to read.

## Constraints

- Static HTML + JSON, no build step, no server (GitHub Pages).
- Same look and nav pattern as the two existing pages in this repo.
- Must read well on an iPad in portrait and print to US Letter.

## Approaches considered

1. PDF/Word sheet only. Prints fine, but no filtering on the iPad and every
   update means regenerating a file. Rejected.
2. Excel master generating HTML + PDF (Price List pattern). Adds a Windows
   build step for data that changes a few times a year. Rejected.
3. One HTML page with print CSS, data in JSON, published beside the flow rate
   lookup. Screen view filters; Print produces the laminated sheet; a service
   worker caches it for offline use. **Chosen.**

## Design

- `laylengths.html` in the repo root, linked from the nav of `index.html` and
  `readrecorder.html`.
- `laylengths.json`: array of rows `{mfr, model, type, size, lengths: [..],
  notes, source, confidence}`. Lengths in inches as decimal strings; the page
  also shows the fraction form. `confidence` is `confirmed` or `unverified`;
  unverified rows render with a marker. Models with no lay length found
  (SRM, 125W, Trident Turbine, MHR, MHD, Recordall II Turbo, Metron
  S260/S440/S550, Elster C4000/H3000) are omitted: user decided 2026-11-20
  they are too rare in the field to matter.
- Screen: manufacturer tabs/chips across the top, size filter, search box,
  "Popular only" toggle, and a "Print selected" button that appears once any
  row is checked; table columns [checkbox] | Model | Type | Size | Lay
  length(s) | Notes. Popular rows carry a small star.
- Print scope follows the screen: whatever is visible prints, unless rows are
  checked, in which case only the checked rows print. The footer names the
  scope ("Popular meters" / "Selected meters" / "All meters").
- Print (`@media print`): hide controls, one manufacturer per section with a
  repeated header, landscape or portrait letter, small type, grid lines, a
  footer with the "last updated" date and a "verify before ordering" line.
- `sw.js` service worker caches the page and JSON for offline reuse.

## Data sourcing

Pulled from current manufacturer spec sheets and, for legacy models, archived
spec sheets and bid documents; compiled in
`2026-11-20-lay-length-data-review.md`. User confirmed the Sensus legacy rows
(SRH, SR/SR II, OMNI C2 2") on 2026-11-20 and approved the design.

## Left to the builder

Exact fraction rendering, chip styling, print page breaks, whether 1 1/2" and
2" T-10/M120/M170-class disc meters get their own "disc" type group, and the
fleet-count threshold used to seed the `popular` flag (user can override any
row's flag in the JSON).
