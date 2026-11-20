#!/usr/bin/env python3
from pathlib import Path

def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}")
    p.write_text(text.replace(old, new))

# Shared semantic surface hierarchy for every theme.
replace_once(
    "ui/src/themes/product-tokens.ts",
    '  "--jig-status-healthy-text": "var(--color-text-success)",\n',
    '  "--jig-status-healthy-text": "var(--color-text-success)",\n'
    '  "--jig-lane-surface": "var(--color-background-body)",\n'
    '  "--jig-chrome-surface":\n'
    '    "color-mix(in srgb, var(--color-background-surface) 96%, var(--color-text-primary) 4%)",\n'
    '  "--jig-task-surface":\n'
    '    "color-mix(in srgb, var(--color-background-card) 92%, var(--color-text-primary) 8%)",\n'
)

# Remove per-theme Task-surface overrides: all themes consume the shared product role.
replace_once(
    "ui/src/jig-theme.source.ts",
    '''  localTokens: {
    ...jigProductLocalTokens,
    "--jig-task-surface": [
      "var(--jig-white)",
      "var(--jig-ink-800)",
    ],
  },
''',
    '''  localTokens: {
    ...jigProductLocalTokens,
  },
'''
)
for p in Path("ui/src/themes").glob("*.source.ts"):
    text = p.read_text()
    for value in (
        '"var(--color-background-surface)"',
        '"var(--color-background-card)"',
    ):
        line = f'    "--jig-task-surface": {value},\n'
        if line in text:
            text = text.replace(line, "")
    p.write_text(text)

# One owner for each structural surface.
replace_once(
    "ui/src/styles.css",
    '''  .jig-app-header {
    width: 100%;
    margin: 0;
    border-block-end: var(--border-width) solid var(--color-border);
    background: var(--color-background-body);
''',
    '''  .jig-app-header {
    width: 100%;
    margin: 0;
    border-block-end: var(--border-width) solid var(--color-border);
    background: var(--jig-chrome-surface);
'''
)
replace_once(
    "ui/src/styles.css",
    '''    border-block-start: var(--border-width) solid var(--color-border);
    background: var(--color-background-surface);
  }

  .jig-mobile-nav-item {
''',
    '''    border-block-start: var(--border-width) solid var(--color-border);
    background: var(--jig-chrome-surface);
  }

  .jig-mobile-nav-item {
'''
)
replace_once(
    "ui/src/styles.css",
    '''  .jig-week-column {
    width: auto;
    min-width: 0;
    min-height: 18rem;
    padding-inline: var(--spacing-1);
    background: transparent;
  }
''',
    '''  .jig-week-column {
    width: auto;
    min-width: 0;
    min-height: 18rem;
    padding-inline: var(--spacing-1);
    background: var(--jig-lane-surface);
  }
'''
)

# Architecture ownership: aliases are shared, and header/bottom navigation have one chrome owner.
replace_once(
    "tests/architecture/ui-ownership.test.ts",
    '  "--jig-status-healthy-text",\n',
    '  "--jig-status-healthy-text",\n'
    '  "--jig-lane-surface",\n'
    '  "--jig-chrome-surface",\n'
)
replace_once(
    "tests/architecture/ui-ownership.test.ts",
    '''    for (const token of JIG_PRODUCT_TOKENS) {
      if (token === "--jig-task-surface") {
        expect(source("ui/src/jig-theme.source.ts")).toContain(`"${token}"`);
      } else {
        expect(common).toContain(`"${token}"`);
      }
    }
''',
    '''    for (const token of JIG_PRODUCT_TOKENS) {
      expect(common).toContain(`"${token}"`);
    }

    expect(css).toMatch(
      /\\.jig-app-header\\s*\\{[^}]*background:\\s*var\\(--jig-chrome-surface\\)/s,
    );
    expect(css).toMatch(
      /\\.jig-mobile-bottom-navigation\\s*\\{[^}]*background:\\s*var\\(--jig-chrome-surface\\)/s,
    );
    expect(css).toMatch(
      /\\.jig-week-column\\s*\\{[^}]*background:\\s*var\\(--jig-lane-surface\\)/s,
    );
    expect(css).toMatch(
      /\\.jig-task-card\\s*\\{[^}]*background:\\s*var\\(--jig-task-surface/s,
    );
'''
)

# Browser matrix proves all themes/modes retain three distinct persistent surfaces.
replace_once(
    "tests/browser/ui-conformance.spec.ts",
    '''  readonly bodyBackground: string;
  readonly bodyText: string;
  readonly taskBackground: string;
''',
    '''  readonly bodyBackground: string;
  readonly bodyText: string;
  readonly chromeBackground: string;
  readonly laneBackground: string;
  readonly taskBackground: string;
'''
)
replace_once(
    "tests/browser/ui-conformance.spec.ts",
    '''    const task = active?.querySelector<HTMLElement>(".jig-task-card") ?? null;
    const today =
''',
    '''    const header = document.querySelector<HTMLElement>(".jig-app-header");
    const lane = active?.querySelector<HTMLElement>(".jig-week-column") ?? null;
    const task = active?.querySelector<HTMLElement>(".jig-task-card") ?? null;
    const today =
'''
)
replace_once(
    "tests/browser/ui-conformance.spec.ts",
    '''      task === null ||
      today === null ||
''',
    '''      header === null ||
      lane === null ||
      task === null ||
      today === null ||
'''
)
replace_once(
    "tests/browser/ui-conformance.spec.ts",
    '''      bodyBackground: bodyStyle.backgroundColor,
      bodyText: bodyStyle.color,
      taskBackground: taskStyle.backgroundColor,
''',
    '''      bodyBackground: bodyStyle.backgroundColor,
      bodyText: bodyStyle.color,
      chromeBackground: getComputedStyle(header).backgroundColor,
      laneBackground: getComputedStyle(lane).backgroundColor,
      taskBackground: taskStyle.backgroundColor,
'''
)
replace_once(
    "tests/browser/ui-conformance.spec.ts",
    '''      expect(snapshot.taskBackground, `${preset}/${mode} task vs canvas`)
        .not.toBe(snapshot.bodyBackground);
''',
    '''      expect(snapshot.chromeBackground, `${preset}/${mode} chrome vs lane`)
        .not.toBe(snapshot.laneBackground);
      expect(snapshot.taskBackground, `${preset}/${mode} task vs lane`)
        .not.toBe(snapshot.laneBackground);
      expect(snapshot.taskBackground, `${preset}/${mode} task vs chrome`)
        .not.toBe(snapshot.chromeBackground);
'''
)
replace_once(
    "tests/browser/ui-conformance.spec.ts",
    '''      expect(
        contrastRatio(snapshot.logoPrimary, snapshot.bodyBackground),
        `${preset}/${mode} logo primary contrast`,
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrastRatio(snapshot.logoAccent, snapshot.bodyBackground),
        `${preset}/${mode} logo accent contrast`,
      ).toBeGreaterThanOrEqual(3);
''',
    '''      expect(
        contrastRatio(snapshot.bodyText, snapshot.laneBackground),
        `${preset}/${mode} lane text contrast`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(snapshot.logoPrimary, snapshot.chromeBackground),
        `${preset}/${mode} logo primary contrast on chrome`,
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrastRatio(snapshot.logoAccent, snapshot.chromeBackground),
        `${preset}/${mode} logo accent contrast on chrome`,
      ).toBeGreaterThanOrEqual(3);
'''
)
replace_once(
    "tests/browser/ui-conformance.spec.ts",
    '''    expect(systemDark.taskBackground).not.toBe(systemDark.bodyBackground);
''',
    '''    expect(systemDark.chromeBackground).not.toBe(systemDark.laneBackground);
    expect(systemDark.taskBackground).not.toBe(systemDark.laneBackground);
    expect(systemDark.taskBackground).not.toBe(systemDark.chromeBackground);
'''
)

# Canonical design authority.
replace_once(
    "docs/design/brand-and-theme.md",
    "**Status:** Canonical brand and application-theme contract v0.20, amended 2026-11-20 for v1.1 Android icon derivation.",
    "**Status:** Canonical brand and application-theme contract v0.21, amended 2026-11-20 for v1.1 structural surface hierarchy and Android icon derivation."
)
replace_once(
    "docs/design/brand-and-theme.md",
    "| **Header / Drawer / BottomSheet / card surface** | White / Ink 900 | neutral overlay where interactive | n/a | n/a | n/a | status colors as general surface |\n",
    "| **Application chrome — desktop/narrow header + narrow/Android bottom navigation** | `--jig-chrome-surface` | neutral overlay where interactive | one shared chrome surface across top and bottom owners | n/a | n/a | lane/card/status surface roles |\n"
    "| **Drawer / BottomSheet** | Astryx surface semantics | Astryx neutral overlay | n/a | Astryx focus | Astryx disabled | Jig chrome/lane/card aliases |\n"
)
replace_once(
    "docs/design/brand-and-theme.md",
    "| **Week/date label — ordinary** | surface/muted header + primary/secondary Ink | no click-selection state | n/a | n/a | n/a | accent/selected state |\n",
    "| **Week/date lane — ordinary** | `--jig-lane-surface` + primary/secondary text | no click-selection state | n/a | n/a | n/a | chrome/card/accent-selected surface roles |\n"
)
start = Path("docs/design/brand-and-theme.md").read_text()
old = '''## 6.5 Task-surface contrast and responsive parity

The Planner canvas and Task card are separate semantic surfaces. v1.0.5 makes that separation explicit because the published v1.0.4 Dark/narrow presentation allowed Task cards to visually merge into their background.

The feature-level contract remains two Jig-local semantic aliases. The default Jig preset resolves them as follows; other theme wrappers select their governed elevated surface/border roles as specified by JIG-106-SD-04:

| Alias | Light | Dark | Purpose |
|---|---|---|---|
| `--jig-task-surface` | White | Ink 800 | Base outstanding/completed Task-card surface across Planner and History |
| `--jig-task-border` | Ink 200 / emphasized neutral border | Ink 700 / emphasized neutral border | Base Task-card edge separation |

The surrounding Planner canvas remains:

- Light: Paper 100;
- Dark: Ink 950.

Therefore Dark Task cards sit two Ink stops above the canvas rather than using the v1.0.4 Ink 900 surface. This is deliberate legibility/elevation, not decorative chrome.

Rules:

1. Desktop and narrow/mobile consume the same Task-surface aliases. Responsive CSS must not substitute `--color-background-body`, transparent, or a mobile-only surface.
2. Hover may add the ordinary transient overlay, but the un-hovered card must already be visibly distinct.
3. Selected Task continues to use the governed info-blue selected surface/border; keyboard focus adds Amber; drag adds transient Amber; priority remains the narrow leading cue. These states do not redefine the base card surface contract.
4. History Task rows use the same base Task surface family unless an Astryx component public semantic surface already provides the exact same resolved role.
5. Do not introduce raw feature-local colors in `styles.css`.
'''
new = '''## 6.5 Structural surface hierarchy and responsive parity

Planner chrome, date lanes and Task cards are three different semantic layers and must remain visibly distinct in every supported theme and in Light, Dark and System appearance. The application must not read as one undifferentiated mass of chrome.

The shared Jig product-token mapping owns this hierarchy for all thirteen themes:

| Alias | Cross-theme derivation | Purpose |
|---|---|---|
| `--jig-lane-surface` | `--color-background-body` | Planner Monday–Sunday lane canvas |
| `--jig-chrome-surface` | theme surface mixed 4% toward primary text | desktop/narrow application header and narrow/Android persistent bottom navigation |
| `--jig-task-surface` | theme card mixed 8% toward primary text | ordinary outstanding/completed Task-card elevation across Planner and History |
| `--jig-task-border` | emphasized neutral border | Task-card edge separation |

The text-directed mixes are semantic, not palette overrides: they darken structural elevation in Light mode and lighten it in Dark mode while retaining the selected theme's own hue family. They also preserve separation when an upstream theme maps two background roles to equal or near-equal colors.

Rules:

1. Header chrome and persistent narrow/Android bottom navigation consume exactly the same `--jig-chrome-surface`. Responsive layout may change geometry, never this semantic owner.
2. Every ordinary Planner date lane consumes `--jig-lane-surface`; it must not inherit/duplicate application chrome.
3. Every ordinary Task card consumes `--jig-task-surface`; it must remain distinct from both its lane and application chrome before hover/selection/focus.
4. The mapping is shared in `ui/src/themes/product-tokens.ts`. Theme-specific source files must not override these three structural roles or branch on theme identity.
5. Hover may add the ordinary transient overlay, but the un-hovered card must already be visibly distinct.
6. Selected Task continues to use the governed info-blue selected surface/border; keyboard focus adds Amber; drag adds transient Amber; priority remains the narrow leading cue. These states do not redefine the base card surface contract.
7. History Task rows use the same base Task surface family unless an Astryx component public semantic surface already provides the exact same resolved role.
8. Generated theme artifacts move only through the pinned Astryx theme compiler, and the exhaustive theme matrix must prove chrome/lane/card distinction for every theme in Light, Dark and live System mode.
9. Do not introduce raw feature-local colors in `styles.css`.
'''
if old not in start:
    raise SystemExit("brand-and-theme 6.5 block not found")
Path("docs/design/brand-and-theme.md").write_text(start.replace(old, new))

print("Applied cross-theme chrome/lane/card surface hierarchy.")
