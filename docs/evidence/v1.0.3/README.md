# Jig v1.0.3 browser evidence — master-detail workspace

**Status:** Browser fidelity evidence for the v1.0.3 master-detail UX/UI correction.  
**Captured production revision:** `cf62c0b34db6c458a09ea7397e122a9c5df38664`  
**Evidence archive commit:** `678cbb43edaa991274444355a408702acd75e1c0`  
**Capture run:** GitHub Actions `Capture v1.0.3 UI evidence` run #24 (`44020558106`)  
**Environment:** Ubuntu GitHub runner, Bun 1.4.4, pinned Playwright Chromium.

The screenshots were generated from the real production Vite build and loopback service. The capture revision includes the final user-visible implementation: readable compact navigation rail, full-canvas Week grid, distinct drag grip, docked desktop-Day workspace, non-modal Week Drawer, and narrow/mobile Drawer editor. Commits after the capture are test/documentation/evidence-harness cleanup only unless this file is explicitly recertified again.

## Captured surfaces

| Screenshot | Contract certified |
| --- | --- |
| `desktop-day-workspace.jpg` | 112px Day-first icon rail, selected Task details docked on the right, no Task modal |
| `desktop-week-full.jpg` | seven fluid Week tracks using the full 1440px planning canvas |
| `desktop-week-task-drawer.jpg` | selected Week Task opens the non-modal right Drawer while the Week board remains underneath |
| `desktop-week-task-edit.jpg` | Edit replaces detail content inside the same Drawer rather than opening another modal |
| `desktop-week-wide.jpg` | Week materially expands on a 1920px viewport rather than retaining the old fixed maximum |
| `mobile-task-edit-drawer.jpg` | narrow Task editing uses the public right-side Drawer with the planning surface retained behind it |

## Measured geometry

### Desktop 1440 × 900

- primary rail: `x=20, y=20, width=112, height=860`;
- Day primary column: `x=149, width=650`;
- Day docked Task workspace: `x=829, width=490, height=680`;
- Week board: `x=149, width=1261`;
- first Week day track: `width=173.28125`;
- open Week Drawer: `x=960, width=480, height=900`;
- opening the Drawer does **not** change the Week board's `1261px` width.

### Desktop 1920 × 900

- Week board: `x=149, width=1741`;
- first Week day track: `width=241.84375`.

The board therefore consumes the additional 480px viewport width rather than leaving an empty right-side region.

### Narrow 414 × 980

- content frame: `x=12, y=12, width=390, height=956`;
- Task Drawer: `x=56, y=0, width=358, height=980`.

This is Astryx's public responsive Drawer behavior, not a Jig-authored modal frame.

## Visual review verdict

**PASS.**

The evidence confirms:

- navigation order is Day → Week → History → Settings;
- all destinations have Astryx semantic iconography and readable labels;
- the rail is materially smaller than the previous 190px implementation without truncating Settings;
- Week uses the available canvas and retains all seven visible tracks at the canonical desktop viewport;
- moving the drag grip into the leading-control column gives the title more usable width without shrinking typography or removing controls;
- Week card selection keeps Week active and uses the right-side master-detail Drawer;
- Drawer presentation overlays rather than reflows the Week grid;
- desktop Day uses one docked details/editor workspace;
- narrow editing uses the same Task workspace model through Astryx Drawer;
- permanent Delete confirmation remains the only blocking Task dialog.

## Architecture evidence

The corresponding permanent gates are in:

- `tests/architecture/ui-ownership.test.ts`;
- `tests/browser/ui-conformance.spec.ts`;
- `tests/browser/core-flow.spec.ts`;
- `tests/browser/interactions.spec.ts`.

They enforce public Astryx ownership, the absence of Task create/edit Dialogs, non-modal Drawer composition, navigation order/icons, fluid Week geometry, responsive draft continuity, explicit drag-handle behavior, and canonical move/delete semantics.

The temporary evidence capture test/workflow used to produce these files is removed after archival and is not part of the production or permanent test architecture.
