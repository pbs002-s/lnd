# Redesign notes — "Mouza Sheet"

What changed, and why, in the August 2026 pass over the demo.

## Direction

The visual language is taken from the artifact the subject's field actually
produces: **the mouza sheet**. Hairline plot boundaries, registration crosses in
the panel corners, a title block on every panel, a north arrow, a scale bar,
survey stations at the parcel corners.

The alternative — Bangladesh green on near-black with glowing accents — is the
second of the three looks that machine-generated design defaults to, and it was
what the previous build used.

### Tokens

Two themes authored as pairs in `frontend/src/index.css`, referenced by role.
No component contains a raw hex value.

| Role | Light — "Field Sheet" | Dark — "Negative Print" |
|---|---|---|
| ground | `#EFEFEA` drafting film | `#0B0D0C` |
| surface | `#FBFBF8` | `#121514` |
| ink | `#14181A` | `#E9EBE6` |
| indigo (primary) | `#22456E` | `#86ADDA` |
| seal (arrears, objections) | `#A8322A` | `#E07A70` |
| state (verified only) | `#116149` | `#4FBF95` |

Light mode is a cool grey-green, deliberately not the warm cream that generated
pages default to. Colour is load-bearing: seal red appears only where money is
owed or someone has objected; state green only where a record confirms something.

Radii are 2–6px. Elevation is drawn with hairlines, not blur — which also means
the dark theme did not need a separate elevation model bolted on.

### Type

**Anek Latin + Anek Bangla** — one superfamily (Ek Type), so bilingual lines
share a skeleton instead of colliding, which is what happens when a Latin face
and an unrelated Bangla face are set side by side. Display headings use the
variable width axis at `wdth 87.5`, the way a sheet title block is lettered.
**IBM Plex Mono** for identifiers, coordinates and amounts.

### Signature

`ParcelPlate` — a cadastral drawing that surveys itself in on load: boundary
strokes draw via `pathLength`, then corner stations drop in one at a time. It
appears in the landing hero, the map panel, and the printed দাখিলা, so it reads
as the product's mark rather than a hero illustration.

### Motion

Tokens: 140ms feedback, 260ms transitions, 520ms entrances, one easing curve
(`cubic-bezier(.2,.7,.2,1)`). Entrances fire once via `IntersectionObserver` and
disconnect. Everything collapses under `prefers-reduced-motion`, and the ambient
canvas pauses on `document.hidden`.

- **Text** — line-mask reveals (`Lines`), counting numerals with tabular figures
  (`Counter`), a typed Parcel ID with a caret (`TypedId`, used twice: hero and
  dashboard masthead).
- **Background** — `SurveyField`: a drifting graticule with three delta meanders
  and a sweep crossing every 14s, ticking each graticule crossing. Replaces the
  three blurred orbs and the particle constellation.

## Removed

| Removed | Reason |
|---|---|
| Emoji telemetry ticker | Emoji as status in a government interface |
| `shimmer-text` gradient headline | Looping shimmer is a generated-page tell |
| `pulse-glow` | Decoration with no state behind it |
| Three blurred atmospheric orbs | Default ambient treatment, subject-agnostic |
| Particle constellation canvas | Same |
| `Sparkles` icons | Decorative icon, no meaning |
| "99.98% Uptime", "Nova Night Mood" | Invented metric; invented brand |
| "LD Tax Gateway Ingress", "Cross-Audit Engine" | Written from the system's side |

Copy was rewritten from the reader's side throughout: "Land tax" not "LD Tax
Gateway", "What runs in the background" not "Automation Hub", "Tell you when
someone touches your record" not "Property Activity Alert Webhook".

## Structure

`App.tsx` was 1,514 lines. It is now 17 files:

```
src/
  lib/        router.tsx (60-line history router, no new deps)
              theme.ts, api.ts, types.ts, demoData.ts, format.ts
  components/ SurveyField, ParcelPlate, motion, Modal, ui
  routes/     Landing, SignIn, Dashboard
              panels/ Overview, MapPanel, TaxPanel,
                      MutationsPanel, ChecksPanel, ServicesPanel
```

## New

**Landing page** (`/`) — hero with the plate, the eight record types as a
register rather than a card grid, an old-vs-target comparison, the payment
sequence (numbered, because it genuinely is one), and honest counts describing
this build rather than national coverage.

**Demo sign-in** (`/signin`) — two steps, matching the real shape: identity, then
a code to the number on the record. Code is `123456` and printed on screen. Two
roles: citizen and land office. Backend endpoints `POST /api/auth/request-code`
and `/api/auth/verify-code` mirror it.

**Offline fallback** — every API call falls back to seeded data and marks the
header "Seeded data" instead of "Live data". The demo no longer opens on an error
banner when Postgres is not running.

**Honest health check** — `/api/health` now runs `SELECT 1` and reports
`unreachable` when it fails, rather than always claiming the database is
connected.

## Running it

```bash
docker compose up -d                      # postgres + postgis, n8n
cd backend  && npm install && npx prisma migrate dev && npx prisma db seed && npm run dev
cd frontend && npm install && npm run dev # http://localhost:5173
```

The frontend runs standalone without the backend — it falls back to seeded data.

## Known gaps

- Auth is demonstration scaffolding: no password store, no token verification,
  no session secret. Replace entirely before this touches a real record.
- `SurveyField` holds two literal hex fallbacks for the case where
  `getComputedStyle` returns empty during the first paint. They are the only raw
  colors in the source and are intentional.
- The boundary drawing is illustrative geometry, not projected from the stored
  GeoJSON. Wiring it to `geojsonBoundary` is the obvious next step.
