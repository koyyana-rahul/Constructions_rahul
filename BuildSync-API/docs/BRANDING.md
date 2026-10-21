# Builtra — what was renamed, and what deliberately was not

The product was renamed from **BuildSync** to **Builtra**. This note records
exactly what changed, so the next person does not have to reverse-engineer
it, and so nobody "helpfully" renames something that must not move.

## User-facing branding — changed

| Area | Before | After |
|---|---|---|
| Product name | BuildSync | Builtra |
| Tagline | "Run every site…" | **From plans to progress.** |
| Browser title | BuildSync — Construction Operations Platform | Builtra — Construction Management Platform |
| Meta description / Open Graph | BuildSync copy | Builtra copy |
| Favicon | none | `public/favicon.svg` (block-built "B" on brand navy) |
| App icon | none | `public/icon.svg` (512px, same geometry) |
| Sidebar wordmark | hard-hat glyph + "BuildSync" | `BrandMark` + `BrandWordmark` (Built·ra) |
| Auth panel wordmark | hard-hat glyph + "BuildSync" | `BrandMark` + `BrandWordmark` |
| Footer | "© BuildSync" | "© Builtra. From plans to progress." |
| Assistant | "Site Assistant / BuildSync support", Romanian tutorial prompt | **Benny — Builtra Assistant**, English, Builtra copy |
| README | BuildSync | Builtra |
| Audit doc heading | "BuildSync — Audit & Risk Register" | "Builtra — Audit & Risk Register" |
| Script banners | "BuildSync — local development stack" | "Builtra — local development stack" |
| Email templates | none existed | Builtra-branded, with the wordmark and tagline |

## New files introduced by the rebrand

| File | Purpose |
|---|---|
| `BuildSync-CLIENT/src/lib/brand.js` | Single source of truth for the product name, tagline, title and description on the frontend |
| `BuildSync-CLIENT/src/components/brand/Logo.jsx` | `BrandMark`, `BrandSymbol`, `BrandWordmark`, `BrandLogo` — one component set, no hardcoded brand strings in components |
| `BuildSync-CLIENT/public/favicon.svg` | Browser tab icon |
| `BuildSync-CLIENT/public/icon.svg` | App / installed icon |
| `BuildSync-API/config/brand.js` | The server-side copy of the brand constants, plus `frontendBaseUrl()` and `buildSetupLink()` |

## Colours

The brand palette was applied to the **existing** Tailwind scale rather than
introducing a second one:

- `navy-900` is now the primary brand navy **`#172554`**.
- `navy-800` is the secondary navy **`#1E3A5F`**.
- `accent-500` was already **`#F97316`** (construction orange) and is unchanged.
- The `concrete` neutral scale, and the `success` / `warning` / `danger` /
  `info` semantic scales, were left alone. They were already internally
  consistent and their contrast was verified, and the brief asked for the
  palette to be adapted to the existing design system rather than to replace
  it. Swapping them would have been a visual regression for no gain.

The elevation shadows were re-tinted from the old navy (`rgb(15 29 51)`) to
the new brand navy (`rgb(23 37 84)`) so they no longer read as grey haze
against the darker surfaces.

## Deliberately NOT renamed

These are compatibility surfaces. Renaming any of them would break an
existing installation.

| Thing | Why it stays |
|---|---|
| Folder names `BuildSync-API/`, `BuildSync-CLIENT/` | The brief says to retain the existing repository structure and folder names. Renaming them would break every path in the README, the scripts and the deployment config for no user-visible gain. |
| The **database name** in `MONGODB_URL` | This is the *database*, not the brand. Changing it points the app at a different, empty database and every user, attendance and payroll record appears to have vanished. `.env.example` uses `builtra` because it is a template for NEW installs, with a warning to leave an existing install's name alone. |
| API route paths (`/api/auth/login`, `/api/employee`, …) | Public contract. The frontend, the scripts and any third-party integration depend on them. |
| Mongoose model names and MongoDB collection names | Renaming a collection would orphan the existing documents. |
| JWT claim names (`_id`, `role`) | The `role` claim is read by the authenticate middleware. |
| Environment variable names (`MONGODB_URL`, `JWT_SECRET`, `PORT`) | Read from existing `.env` files and deployment platforms. |
| `LEGACY_TOKEN_KEY = "buildsync:token"` in `lib/api.js` | Read-only fallback so an existing browser session survives the rename instead of signing every user out. It is never written to. |
| The old `token` / `buildsync:token` localStorage keys | Same reason — they are read once, then cleared, and are never written. |
| The `dist/` build output | Not tracked. |

## Storage keys that WERE changed

`localStorage` keys are browser-local, not a compatibility surface, so they
were renamed with a safe fallback where a value was worth keeping:

| Key | Before | After |
|---|---|---|
| Session token | `buildsync:token` | **removed** — the JWT now lives in an httpOnly cookie |
| Sidebar collapsed | `buildsync:sidebar-collapsed` | `builtra:sidebar-collapsed` |
| Session expired event | `buildsync:session-expired` | `builtra:session-expired` |

## Package names

`BuildSync-API/package.json` and `BuildSync-CLIENT/package.json` carry
internal npm package names (`server`, `chatfront`). These are not published
and not user-facing, so they were left alone to keep the diff focused.

## How to check for a missed reference

```bash
grep -rIn --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git -i "buildsync" .
```

Every remaining hit should be a **folder name** (`BuildSync-API`,
`BuildSync-CLIENT`), the read-only `LEGACY_TOKEN_KEY` fallback, or a
`.gitignore` path.
