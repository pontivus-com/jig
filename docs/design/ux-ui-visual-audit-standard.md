# Jig UX/UI visual audit standard

**Status:** BINDING visual-certification authority.  
**Applies to:** every release or remediation that changes Jig presentation, interaction geometry, theme rendering, application copy or visual state.  
**Presentation scope:** desktop/expanded and narrow/mobile.  
**Runtime boundary:** Linux/browser versus Android/native remains independent from presentation class.

## 1. Purpose and governing rule

Mechanical UI acceptance is not visual acceptance.

A visual certification is valid only when:

1. the implementation reaches the intended semantic state;
2. the retained image is a settled rendering of that state;
3. the reviewer evaluates that rendering against the explicit criteria in this document;
4. every applicable criterion receives a recorded disposition.

A green browser suite, an existing screenshot, or a statement such as "no visual blocker" is insufficient by itself.

Current implementation and retained screenshots are evidence only. They never override product requirements, `ui-solution.md`, the governed v1.1 references, `brand-and-theme.md`, the v1.1.2 responsive matrix or Astryx public API authority.

## 2. Appearance certification is presentation-class certification

Jig has one application with independent dimensions:

- presentation class: `desktop` versus `narrow`, selected only by the governed 73rem / 1168px width boundary;
- runtime capability: Linux/browser versus Android/native;
- input facts: pointer, keyboard, touch and IME where relevant.

Therefore Jig page appearance is certified in Chromium using the desktop and narrow presentation classes from the same application build.

Android installation is **not** required merely to judge Planner, History, Settings, onboarding, Task workspace, feedback or resolver appearance. Android/device evidence remains required only for genuinely native host behavior such as native Back, system/status/navigation bars, lifecycle, notification capability and native-host/IME behavior that cannot be established by browser evidence.

## 3. Constrained viewport policy

The audit intentionally uses a small representative set.

### 3.1 Canonical full-audit viewports

| Presentation | Viewport | Purpose |
|---|---:|---|
| Desktop | **1440×900** | canonical desktop composition and density |
| Narrow/mobile | **390×844** | canonical phone/narrow composition and touch-oriented density |

Every required product surface is reviewed at these two sizes where both presentations support the state.

### 3.2 Targeted stress viewports

| Presentation | Viewport | Use |
|---|---:|---|
| Compact desktop | **1280×800** | designated high-risk surfaces only |
| Minimum narrow | **320×844** | designated high-risk surfaces only |

Stress viewports are limited to populated Planner, Task workspace, Settings/Diagnostics, sync resolver and one long-content fixture unless a specific defect requires more evidence.

### 3.3 Breakpoint proof

`1168px` must mechanically select desktop presentation and `1167px` must mechanically select narrow presentation. This is a structural assertion, not another full screenshot matrix.

Do not create a full 320/360/375/390/412/414/etc. visual matrix. Additional widths may be exercised by cheap geometry tests without multiplying the visual-review workload.

## 4. Evidence-settlement gate

A screenshot may not be retained merely because its main locator is visible.

Before capture, the evidence harness must establish, where applicable:

- the requested semantic state is active;
- the correct presentation tree is mounted;
- fonts are ready;
- finite CSS/Web Animations have completed;
- outgoing Drawer/BottomSheet/dialog/destination presentation is no longer moving or visibly retained;
- application geometry is stable across consecutive animation frames;
- target scroll alignment has completed;
- the viewport and appearance mode are correct;
- there is no unintended document-level horizontal overflow;
- no stale preceding workspace overlays the requested state;
- the capture does not contain a text caret unless caret appearance is the audit target.

Certification capture may fast-forward finite animations to their settled endpoint. Motion behavior remains separately tested at runtime speed.

Fixed sleeps are not the primary settlement proof.

A transition-contaminated or stale-state screenshot is **invalid evidence** and is a BLOCKER for the evidence item, even when the underlying implementation is otherwise correct.

## 5. Universal audit criteria

Every retained state is judged against all applicable criteria.

### VA-01 — structural fidelity

Verify the correct regions, hierarchy and ownership:

- no missing required region;
- no duplicate or obsolete region;
- correct ordering;
- correct navigation owner;
- correct workspace primitive;
- correct state rendered in the correct surface.

### VA-02 — cross-presentation fidelity

Verify desktop and narrow are appropriate projections of the same semantic application state:

- desktop is not enlarged mobile;
- narrow is not compressed desktop;
- seven-track versus stacked Planner is correct;
- Drawer versus BottomSheet is correct;
- desktop direct navigation versus narrow bottom navigation is correct;
- desktop Add versus narrow Planner FAB is correct;
- functionality does not accidentally diverge by width.

### VA-03 — visual hierarchy and prominence

Judge actual perceived prominence:

- content dominates chrome;
- the primary action is obvious where one exists;
- secondary actions remain subordinate;
- healthy synchronization remains quiet;
- warning/error escalates appropriately;
- headings establish a clear information hierarchy;
- technical details do not compete with product language.

### VA-04 — geometry, spacing and density

Inspect alignment, margins, padding, vertical rhythm, column relationships, content measure and whitespace.

Fail unexpected:

- compression;
- dead space;
- clipping;
- collision;
- inconsistent spacing;
- double inset;
- partially off-screen settled UI;
- excessively tall empty states;
- card/dashboard visual noise where open reading/layout structure is governed.

### VA-05 — typography and text display

Inspect:

- heading/body/metadata hierarchy;
- readable type size and line height;
- line length;
- wrapping and truncation;
- clipping;
- label consistency;
- date/number readability;
- label/control association.

Primary actions/navigation must not use metadata-sized typography. Secondary text may be quiet but must remain readable.

### VA-06 — content resilience

Representative long-but-valid content must not break the surface.

Audit long Task title, context/reference presentation, repository identity, diagnostic values and multi-line attention/error copy where applicable.

Content may wrap or truncate only when the meaning and action relationship remain clear. It must not cause unintended horizontal overflow or make required actions unreachable.

### VA-07 — color scheme and surface hierarchy

Judge the semantic color/surface system, not arbitrary palette preference.

Check:

- chrome/canvas/Task/workspace/overlay layers remain distinguishable where required;
- Task surfaces do not collapse into the Planner canvas;
- selected/focus/drag/priority/status meanings remain distinct;
- Light and Dark preserve the intended hierarchy;
- borders/elevation are neither invisible nor unnecessarily heavy;
- status colors remain distinct from brand Amber and from persistent selection.

The canonical semantic ownership remains in `docs/design/brand-and-theme.md`.

### VA-08 — contrast and legibility

Contrast must satisfy the repository's governed theme/accessibility contract and remain perceptually usable in context.

At minimum check:

- primary and secondary text against their effective backgrounds;
- primary action content;
- focus/selection indicators;
- meaningful control boundaries/icons;
- warning/error/success presentation;
- disabled state remains identifiable without masquerading as active content.

A numerically acceptable combination may still fail the qualitative audit if hierarchy becomes unreadably faint.

Color may never be the sole carrier of critical state meaning.

### VA-09 — component and action language

Check consistency of:

- buttons and icon buttons;
- links/references;
- segmented/radio choices;
- menus;
- drag grip;
- completion affordance;
- destructive actions;
- disclosure controls;
- Add/Save/Cancel/Today/navigation language.

Touch hit geometry must not turn every narrow control into an equally prominent visual block.

### VA-10 — active surface, overlay and focus

For Drawer, BottomSheet, dialog, feedback and resolver states verify:

- the active surface is visually dominant;
- background context is appropriately subordinate;
- scrim usage matches authority;
- stacking is correct;
- close/dismiss is discoverable;
- fixed action areas do not hide content;
- bottom navigation/FAB/workspace do not collide;
- desktop and narrow hosts clearly represent the same semantic state.

### VA-11 — state semantics

Check all meaningful states present in the scenario:

- today;
- selected/open Task;
- priority;
- focus;
- drag;
- completed;
- healthy sync;
- pending/retrying;
- Needs attention;
- validation-disabled;
- destructive confirmation;
- resolver choice/order/final state.

Distinct meanings must not become visually indistinguishable.

### VA-12 — evidence integrity

Confirm the image itself is suitable for judgment:

- correct viewport;
- correct theme/mode;
- correct state;
- settled geometry;
- no previous screen leaking through unintentionally;
- no capture artifact;
- no unexpected loading/intermediate presentation.

VA-12 failure invalidates that evidence item.

## 6. Surface-specific analysis targets

### 6.1 Configured application shell

**Desktop target:** full-bleed frame; shallow <=44px three-zone header; Jig identity left; temporal/destination context balanced centrally; Planner-only Add plus direct Planner/History/Settings navigation right; healthy sync restrained; no mobile bottom navigation/FAB.

**Narrow target:** compact application row; active destination title; restrained sync state; Planner-only temporal row; persistent bottom Planner/History/Settings navigation; Planner-only FAB; content remains dominant despite fixed chrome.

Audit balance, hierarchy, chrome height/weight, destination clarity, navigation prominence, FAB clearance and absence of accidental page gutters.

### 6.2 Planner

**Desktop target:** seven simultaneously scannable equal-width date tracks using open layout; Task cards are the primary discrete surfaces; date chrome is compact; columns grow independently.

**Narrow target:** seven vertically stacked date sections; empty dates stay compact; populated dates grow naturally; full-width touch Task list; date Add remains quiet; FAB is the primary global creation action.

Audit scanability, date hierarchy, Today orientation, Task/canvas distinction, empty-state density, priority cues, metadata/action subordination and overflow.

### 6.3 Task card

Audit title dominance, completion, grip, menu, priority, reminder/reference metadata, selection, focus and drag state.

Desktop and narrow must remain recognizably the same semantic Task. The drag representation must remain the real Task-card presentation rather than a synthetic preview implementation.

### 6.4 Task workspace

**Desktop target:** end Drawer with compact desktop form density and visible underlying planning context.

**Narrow target:** BottomSheet with touch-sized controls, vertical grouping and persistent/reachable action region.

Both presentations preserve Task / Schedule / Details / Notes grouping. Audit field hierarchy, Repeat disclosure, weekday controls, Notes reachability, lifecycle/destructive separation and Save/Cancel prominence.

### 6.5 History

Target one chronological reading column: date group -> completed Task rows; Task title primary; completion/context/scheduled metadata secondary; no dashboard-grid treatment.

Desktop uses bounded centered reading measure. Narrow uses available width with the same semantic hierarchy.

### 6.6 Settings and Diagnostics

Expected hierarchy:

1. Data & sync;
2. Appearance;
3. Notifications;
4. Diagnostics / technical details subordinate and collapsed by default.

Audit reading flow, product-language-first synchronization status, diagnostics subordination, long-value wrapping, action fit, appearance controls, notification separation and calm healthy-state presentation.

### 6.7 Onboarding

Expected narrative:

1. Jig/product orientation;
2. concise reassurance/value points;
3. genuine setup choice/action;
4. automatic progress;
5. bounded recovery only when user action is genuinely needed.

Desktop preserves the governed two-region relationship. Narrow uses one clear vertical hierarchy.

Audit first-frame Jig identity, value-to-action narrative, CTA prominence, Device Flow code treatment, provider/repository choice, progress, attention and absence of technical process as user workflow.

### 6.8 Feedback / synchronization attention

Audit transient success versus durable attention, icon/message/action alignment, wrapping, desktop versus narrow placement, navigation/FAB/workspace clearance and truthful severity.

### 6.9 Synchronization conflict resolver

Audit the complete progression:

1. Local/Remote record choice;
2. Technical-details disclosure;
3. additional semantic choice where present;
4. affected-date order review;
5. resolution-ready confirmation.

Desktop uses modal end Drawer; narrow uses tall BottomSheet. Local/Remote is neutral, not green/red. Technical Git facts remain subordinate. Final mutation is visually distinct from intermediate choices. Cancel remains discoverable.

### 6.10 Drag state

Audit the real Task overlay, insertion target, source/target relationship, unchanged card anatomy, width/height stability and absence of preview-vs-active discontinuity.

## 7. Theme and appearance policy

Do not multiply every product state by every theme and viewport.

### 7.1 Deep surface review

The complete required product-surface corpus is deeply reviewed in the canonical **Jig / Light** appearance at the canonical desktop/narrow viewports. This keeps the qualitative workload bounded and makes the principal evidence deterministic.

Do **not** duplicate every product surface in Dark mode. Dark-mode and cross-theme surface semantics are covered by the constrained theme review below plus permanent automated theme/state tests. Add a surface-specific Dark capture only when the release changes that surface's dark rendering or the theme review exposes a concrete risk requiring targeted evidence.

### 7.2 Full theme-family review

All 13 Theme families × Light/Dark are visually reviewed on the canonical **desktop Planner** because this is the broadest surface hierarchy and exposes chrome/Planner/Task relationships.

### 7.3 Narrow theme sampling

Narrow/mobile theme review uses the representative families:

- Jig;
- Solarized;
- Tokyo Night;

each in Light and Dark at 390×844.

This samples the native Jig palette, a strongly distinctive light/dark community palette and a dark-oriented high-chroma family without creating a redundant 13×2×2 manual matrix.

Automated theme/token tests remain responsible for all themes across both presentation classes.

## 8. Stress audit

Only these surfaces receive 1280×800 and 320×844 screenshots unless a defect requires more:

- populated Planner;
- Task workspace;
- Settings/Diagnostics;
- synchronization resolver;
- long-content fixture.

Stress judgment is limited to composition validity, clipping/overflow, hierarchy collapse, action reachability and text intelligibility.

## 9. Required canonical evidence corpus

At 1440×900 and 390×844, using canonical **Jig / Light** unless the scenario is explicitly a theme/appearance audit, retain where applicable:

- Planner populated;
- Planner empty;
- History populated;
- History empty;
- Settings default;
- Settings Diagnostics expanded;
- synchronization Needs attention;
- transient success;
- onboarding initial;
- onboarding provider/repository-choice state;
- Task default edit/create;
- Task Weekly recurrence;
- Task lower/detail state when needed to prove reachability;
- drag active/insertion state;
- resolver choices;
- resolver Technical details;
- resolver order review;
- resolver resolution-ready state.

Additional images require a specific acceptance need; they are not added merely because another viewport or minor state exists.

## 10. Audit disposition and severity

Every scenario receives criterion-level disposition, not a prose-only "looks fine".

Minimum result columns:

| Scenario | Structure | Cross-presentation | Hierarchy | Geometry | Text/content | Color/contrast | Actions | Overlay/state | Evidence validity | Result |
|---|---|---|---|---|---|---|---|---|---|---|

Use `N/A` only where genuinely inapplicable.

### BLOCKER

Wrong hierarchy/presentation, inaccessible or clipped primary UI, material state ambiguity, broken contrast, stable overlay collision, theme destroying semantics, desktop/narrow semantic divergence, or invalid/transitional evidence.

### MAJOR

Material hierarchy, density, readability, affordance or responsive-adaptation defect that compromises the governed UX but does not make the screen wholly unusable.

### MINOR

Localized polish issue that does not violate governing structure, accessibility, state semantics or task completion.

Visual certification requires:

- zero unresolved BLOCKER findings;
- zero unresolved MAJOR findings;
- any accepted MINOR findings explicitly retained.

## 11. Cross-presentation pair judgment

Every canonical desktop/narrow pair must answer:

1. **Semantic equivalence:** same product meaning and capability?
2. **Appropriate adaptation:** hierarchy changes only where governed?
3. **No accidental divergence:** no width-driven business/runtime behavior?
4. **Appropriate density:** desktop compact/scannable and narrow touch-oriented/readable?

A pair can fail even if each screenshot appears acceptable in isolation.

## 12. Evidence package

The GitHub Actions artifact must contain:

- full-resolution screenshots;
- exact commit SHA and run identity;
- a machine-readable manifest with scenario, viewport, presentation, theme/mode and governing target;
- this audit standard or immutable reference to its exact commit;
- the final criterion-level audit disposition once reviewed.

Desktop and narrow evidence must be generated in the **same browser job from the same exact commit and application build**.

### 12.1 Execution cost boundary

The dedicated visual-audit suite is **opt-in**. Ordinary `test:browser` / `playwright test` verification must skip `tests/browser/visual-audit.spec.ts`; lightweight permanent visual regressions belong in the ordinary conformance suite instead.

The governed release/remediation audit is executed explicitly with `bun run test:visual-audit`, which sets `JIG_VISUAL_AUDIT=1`, uses one worker and excludes optional non-governing duplicate Dark-corpus tests. The constrained acceptance selection remains the authority. Optional diagnostic corpora may exist for investigation, but they are not acceptance requirements and must not be added to the governed run merely because they are available. In particular, a complete duplicate Dark corpus is not required: §7 owns the bounded appearance/theme evidence.

## 13. Release acceptance

UX/UI visual certification is complete only when:

1. the exact candidate generated the governed constrained evidence set;
2. every retained image passed the settlement/evidence-integrity gate;
3. canonical desktop/narrow pairs were explicitly reviewed;
4. designated stress images were explicitly reviewed;
5. theme evidence was reviewed under §7;
6. criterion-level dispositions were retained;
7. zero unresolved BLOCKER or MAJOR findings remain.

A browser PASS without this review is functional evidence only.

A screenshot directory without this review is evidence collection only.
