# City & Regions Autocomplete — Design Spec

**Date:** 2026-04-10
**Status:** Approved for implementation

## Context

The current city (plain text) and regions (tag input with Enter) fields are slow to fill out. The Gemini-based auto-detection from Task 16 is being removed — it returned overly broad results (e.g., "United States" as a region). This spec replaces both fields with a guided autocomplete flow backed by OpenStreetMap/Nominatim.

---

## What We're Building

1. **Remove Task 16 entirely** — revert auto-detection from `app/api/scrape/route.ts`, `lib/types.ts`, `app/page.tsx`, and `components/ContextPanel.tsx`.
2. **City autocomplete** — type-ahead search for any US city, powered by Nominatim via a server-side API route.
3. **Regions multi-select** — once a city is selected, fetch its neighborhoods/districts from Nominatim and present them as a searchable checkbox list. Custom entries still allowed.

---

## Architecture

### New API Routes

**`/api/geo/cities`**
- Method: GET
- Query param: `q` (string, min 2 chars)
- Calls: `https://nominatim.openstreetmap.org/search?q={q}&countrycodes=us&featuretype=city&format=json&addressdetails=1&limit=7`
- Returns: `{ label: "Miami, FL", city: "Miami", state: "FL" }[]`
- User-Agent header: `"SEO-Image-Renamer/1.0 (internal tool)"`

**`/api/geo/regions`**
- Method: GET
- Query params: `city`, `state`
- Calls Nominatim to fetch suburbs/neighbourhoods within the given city
- Returns: `string[]` — list of zone/neighbourhood names
- User-Agent header: same as above

Both routes are thin proxies — no business logic, just fetch + parse + return clean arrays. The `countrycodes` param is the only thing that needs to change for Argentina support in the future.

### New Components

**`components/CityAutocomplete.tsx`**
- Controlled input (`value`, `onChange`, `onCitySelect`)
- Debounce: 1000ms (respects Nominatim's 1 req/sec policy)
- Triggers search at ≥2 characters
- Shows dropdown with up to 7 suggestions in "City, State" format
- On selection: calls `onCitySelect({ city, state })` and closes dropdown
- On clear: calls `onCitySelect(null)` to reset regions in parent

**`components/RegionsSelector.tsx`**
- Props: `city`, `state`, `value: string[]`, `onChange: (v: string[]) => void`
- On mount / when `city` changes: fetches `/api/geo/regions`
- Shows a search input + scrollable checkbox list of fetched neighbourhoods
- Filter: typing in search input filters the visible options client-side
- Custom entry: if the typed value doesn't match any option, Enter adds it as a custom chip
- Selected regions shown as removable chips below the list
- Loading state: spinner while fetching
- Empty state: "No se encontraron zonas — podés escribir y agregar manualmente"
- Error state: silently falls back to manual entry (no crash)

### Modified Files

- `lib/types.ts` — revert `ScrapeResponse` to `{ text }` only
- `app/api/scrape/route.ts` — remove `detectContext()`, revert to original simple scrape
- `app/page.tsx` — remove `autoDetected` state and `ScrapeResponse` import; add `selectedCityState` state (`{ city: string; state: string } | null`) to pass to `RegionsSelector`; clear regions when city is cleared
- `components/ContextPanel.tsx` — remove `autoDetected` prop and badges; replace city `<input>` with `<CityAutocomplete>`; replace regions tag input with `<RegionsSelector>`

---

## Data Flow

```
User types in CityAutocomplete
  → 1000ms debounce
  → GET /api/geo/cities?q=miami
  → Nominatim search API
  → dropdown shows ["Miami, FL", "Miami Gardens, FL", ...]

User selects "Miami, FL"
  → onCitySelect({ city: "Miami", state: "FL" })
  → page.tsx updates city + selectedCityState
  → RegionsSelector receives new city prop
  → GET /api/geo/regions?city=Miami&state=FL
  → Nominatim regions API
  → checkbox list populates with neighbourhoods

User ticks "Coral Gables", "Brickell"
  → onChange(["Coral Gables", "Brickell"])
  → chips appear below

User types "Little Haiti" (not in list) + Enter
  → custom entry added to selection
```

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| City typed but not selected from dropdown | City stays as free text, regions not auto-loaded, manual entry available |
| Nominatim returns no regions | Empty state message, manual entry available |
| Nominatim request fails | Silent fallback to manual entry, no error shown to user |
| User clears city field | `selectedCityState` set to null, regions list cleared |
| Argentina expansion | Change `countrycodes=us` to `countrycodes=ar` in both API routes — no component changes needed |

---

## Rate Limiting

Client-side debounce of **1000ms** on `CityAutocomplete` ensures maximum 1 request/second to Nominatim per user, satisfying their usage policy. No server-side throttle needed for internal tool usage.

---

## What's NOT Changing

- The tag-input UX for manually typed regions (Enter to add) is preserved inside `RegionsSelector`
- The `niche` field stays as plain text input
- The rest of `ContextPanel` (brand, URL, language, keywords) is untouched
- No changes to `/api/analyze` or the image processing flow
