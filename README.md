# meterlookup

Three small browser tools for HBK water meter work. They are plain HTML pages served by GitHub Pages; open them by URL on the shop PC or the iPad:

- **Test Recorder** — https://gitgrossifiles.github.io/meterlookup/
  Pick a meter and flow rate, enter the test totals, and see accuracy against the chart.
- **Read Recorder** — https://gitgrossifiles.github.io/meterlookup/readrecorder.html
  Same lookup, but you enter the start and end register reads instead of totals.
- **Lay Lengths** — https://gitgrossifiles.github.io/meterlookup/laylengths.html
  Flanged lay lengths (flange face to flange face, inches) for 1 1/2" and larger meters by make, model and size.

## Lay Lengths page

- Tap a manufacturer chip, pick a size or type, or type in the search box to narrow the table.
- **Popular only ★** shows the meters HBK actually runs into, based on the fleet in the meter database. `?popular=1` in the URL opens that view directly, and `?mfr=Sensus` pre-selects a manufacturer.
- Check rows to build a custom set, then **Print**. Printing uses whatever is on screen: checked rows if any, otherwise the current filter. The footer names the scope and the data date. Letter size.
- Rows marked `‡` come from a distributor guide or catalog rather than a manufacturer spec sheet.
- The page works offline after the first visit (a service worker caches it), so it opens on the iPad without signal.

### Updating the data

All lay lengths live in `laylengths.json`, one row per model and size:

```json
{ "mfr": "Sensus", "model": "OMNI T2", "type": "Turbine", "size": "2",
  "lengths": [ { "in": 17, "note": "w/ strainer" }, { "in": 10, "note": "no strainer" } ],
  "confidence": "confirmed", "popular": true, "notes": "...", "source": "Sensus WDS-10018-09" }
```

Edit the file, run `node --test` from the repo root (checks the data and the page logic), commit and push. The live page updates about a minute after the push. Sources and the full research table are in `docs/superpowers/specs/2026-11-20-lay-length-data-review.md`.

## Flow rate data

`Cfappchart.json` and `Galappchart.json` hold the flow rate charts (cubic feet and gallons) used by the two recorder pages.
