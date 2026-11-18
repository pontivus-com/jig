# Third-party notices

Jig v1.0.6 includes **color-palette values only** from the projects below. Jig v1.1 additionally introduces the FLOSS Android/runtime dependencies recorded below.
Jig's Astryx semantic role mapping, application-theme definitions, component
composition and product-state mappings are original Jig integration work.
No editor/plugin runtime code from these projects is bundled.

## Gruvbox

- Project: `morhetz/gruvbox`
- Reviewed palette source: `colors/gruvbox.vim`, blob `66246fba24fd49eeb50dd833094d272f0bbab640`
- Project author: Pavel Pertsev and contributors
- License: MIT/X11 (the upstream README identifies the palette under MIT/X11)

## Dracula

- Project: Dracula Theme
- Reviewed specification: `dracula/draculatheme.com/content/spec.mdx`, blob `34a22aa05be158b5524a7355c8e39f548a877e8a`
- Palette variants used: Alucard Classic and Dracula Classic
- Copyright: Dracula Theme
- License: MIT

## Solarized

- Project: `altercation/solarized`
- Reviewed palette authority: README/palette blob `d18ee9450251ea1b9a02ebd4d6fce022df9eb5e4`
- Copyright (c) 2011 Ethan Schoonover
- License: MIT

## Nord

- Project: `nordtheme/nord`
- Reviewed palette authority: official Nord Colors and Palettes documentation,
  site version v0.23.0 as reviewed 2026-11-18
- Copyright (c) 2016-present Sven Greb
- License: MIT

## Catppuccin

- Project: `catppuccin/palette`
- Reviewed palette source: `palette.json` v1.8.0, blob `2a5d25cb0b00033bb049d11ab12c8bed478bf4e8`
- Palette variants used: Latte and Mocha
- Copyright (c) 2021 Catppuccin
- License: MIT

## Tokyo Night

- Project: `folke/tokyonight.nvim`
- Reviewed palette sources:
  - `storm.lua` blob `dfba7a1b2277628e6a9b87ad4a1dad8387b4d2f6`
  - `night.lua` blob `09ea61be78bf57946bf429de17973ceff19e8195`
  - `day.lua` blob `653a12e652ea3a5756e50e071a01da528818c356`
  - generated Day/Night palette outputs reviewed on 2026-11-18
- License: Apache License 2.0
- The Apache-2.0 terms are also reproduced in Jig's root `LICENSE`.

## Hello Pangea DnD

- Package: `@hello-pangea/dnd@18.0.1`
- Project: `hello-pangea/dnd`
- Use in Jig: Planner Task-card list drag/drop mechanics, touch/mouse/keyboard sensors and auto-scroll
- License: Apache License 2.0
- Jig owns the dedicated grip, insertion indicator, Astryx semantic styling and canonical Task move semantics; the library is not a second design system or data-model owner.

---

## MIT license text

The following MIT permission text applies to the MIT/MIT-X11 palette material
identified above, together with each project's copyright notice.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


## v1.1 Android and portable-runtime dependencies

The v1.1 Android build remains source-buildable and FLOSS-only. The permanent Android dependency gate rejects Google Play Services, Firebase, Crashlytics and proprietary analytics/runtime SDKs.

- **Capacitor** — `@capacitor/core@8.6.2`, `@capacitor/android@8.6.2`, `@capacitor/cli@8.6.2`, `@capacitor/app@8.1.2`, `@capacitor/filesystem@8.1.5`, `@capacitor/local-notifications@8.3.1`; MIT license. Used only for the native host and narrow Android platform capabilities.
- **AndroidX SQLite** — `androidx.sqlite:sqlite-bundled:2.7.1`; Apache License 2.0. Used as the low-level Android SQLite driver; canonical persistence semantics remain TypeScript-owned.
- **isomorphic-git** — `isomorphic-git@1.44.16`; MIT license. Used by the Android Git transport with injected app-owned filesystem and native HTTP adapters.
- **React / React DOM** — `19.3.1`; MIT license. Shared application presentation used by Linux/browser and Android.
- **Vite** — `8.3.5`; MIT license. Source build tooling for the shared web assets embedded in the Android application.
- **TypeScript** — `7.0.2`; Apache License 2.0. Source build/type-check tooling.
- **Bun** — `1.4.4`; MIT license. Repository build/dependency tooling and Linux runtime packaging; the F-Droid candidate recipe pins and checksum-verifies its build-tool binary.

The shared GitHub App registration contains only public `app_slug`/`client_id` metadata and is not a proprietary SDK or secret-bearing build dependency.
