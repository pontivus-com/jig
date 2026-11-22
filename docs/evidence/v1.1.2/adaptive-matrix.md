# Jig v1.1.2 IMP-18 adaptive-matrix ledger

Exact executable candidate: `17db841889ee2d25dbe5801daf4334259a15d8b3`; Verify run `2194` / `45076782420`. Evidence keys are defined in [`README.md`](README.md).

## 3. Adaptive matrix §A — presentation class

| Concern | IMP-18 evidence disposition |
|---|---|
| Configured application frame | PASS — ARCH + UI + VIS; AppShell main is the sole configured scroller. |
| Application header | PASS — UI + VIS; desktop <=44px and narrow application/temporal rows exercised. |
| Identity/Home | PASS — UI + VIS; one shared Home intent with viewport-specific placement. |
| Destination title | PASS — ARCH + UI + VIS; single destination owner, correct desktop/narrow projections. |
| Primary navigation | PASS — ARCH + UI + VIS; one destination tuple, inline desktop vs persistent narrow bottom nav. |
| Global Add | PASS — UI + VIS; desktop header action vs Planner-only narrow FAB over one create command. |
| Sync status control | PASS — UI + sync-attention VIS; one status projection with viewport-specific presentation. |
| Planner temporal controls | PASS — UI; one horizon state with desktop/narrow placement. |
| Planner composition | PASS — ARCH + UI + VIS; seven desktop tracks vs seven narrow stacked sections over shared state. |
| Date heading/count/Add | PASS — UI; future-only date Add and adaptive geometry. |
| Planner empty state | PASS — UI + VIS across desktop and 320/360/390/414 narrow evidence. |
| Today/current-day behavior | PASS — UI; narrow initial alignment/one governed scroll request/reduced-motion behavior and desktop no-main-scroll contract. |
| Task sequence | PASS — ARCH + DRAG; one ordering projection. |
| Task card | PASS — ARCH + UI + DRAG + VIS; one semantic card with adaptive density. |
| Task drag visual | PASS — DRAG + VIS; one real card overlay and React-owned card-sized prospective placement. |
| Task workspace | PASS — ARCH + UI + VIS; desktop Drawer vs narrow BottomSheet over one draft. |
| Workspace close/dismiss | PASS for browser presentation — UI; native Back ownership is separately open under J112-NA-02. |
| Task editor fields | PASS — UI + VIS; one field order/form owner across desktop/narrow. |
| Save/Cancel action placement | PASS — UI + VIS across governed narrow widths. |
| Repeat weekday controls | PASS — UI + VIS; complete weekly/monthly/stop states and narrow geometry. |
| Task action menu | PASS — UI; identical semantic action set desktop/narrow. |
| Permanent delete | PASS — UI; one shared blocking AlertDialog and inherited theme surface. |
| Transient success | PASS — ARCH + UI; desktop/narrow placement and reduced-motion dismissal. |
| Durable attention | PASS — ARCH + UI + sync-attention VIS. |
| Loading/fatal | PASS — SETUP/UI retained shared state with desktop/narrow governed presentation. |
| Onboarding body | PASS — SETUP + VIS; desktop two-region vs narrow single-column flow. |
| Onboarding benefits | PASS — SETUP + VIS. |
| GitHub/repository chooser | PASS for presentation/capability separation — SETUP + VIS; Android provider-return evidence remains J112-NA-05. |
| History | PASS — UI + VIS; single adaptive max-50rem hierarchy. |
| Settings | PASS — UI + VIS; one adaptive hierarchy. |
| Diagnostics | PASS — ARCH + UI + SYNC + VIS; one sanitized projection. |
| Sync conflict resolver | PASS for browser/semantic implementation — ARCH + RESOLVER + SYNC + XPLAT + VIS; exact Android in-app interaction remains J112-NA-08. |
| Appearance controls | PASS — UI + VIS; one Theme/appearance owner. |
| Notification Settings layout | PASS for adaptive layout — ARCH + UI; Android exact-alarm runtime interaction remains J112-NA-06. |
| References/actions | PASS — UI + DRAG; shared safe reference behavior and adaptive geometry. |
| Destination transition | PASS — UI; governed motion tokens and reduced-motion behavior. |
| Theme transition | PASS — ARCH + UI; one Theme owner and governed token scale. |
| Safe-area placement | OPEN native edge proof — browser/narrow geometry is covered by UI/VIS; exact Android safe-area + IME behavior requires J112-NA-04. |
| Breakpoint with open workspace | PASS — UI; shared Task draft survives host replacement. |
| Breakpoint with open sync resolver | PASS — RESOLVER + VIS; choices/order draft preserved Drawer→BottomSheet. |

## 4. Adaptive matrix §B — runtime/platform capability

| Concern | IMP-18 evidence disposition |
|---|---|
| Platform selection | PASS — ARCH; runtime mechanics never derive from LayoutMode. |
| Configured Task/status calls | PASS — ARCH + persistence/browser/native integration tests. |
| SQLite mechanics | PASS — NUNIT + API24 bundled-driver persistence/rollback/reopen instrumentation. |
| Git transport | PASS — XPLAT + API24 Git HTTP binary transport instrumentation. |
| GitHub onboarding availability | PASS for shared intent/shell separation — SETUP + GitHub install/native unit tests; native return behavior remains NA-05. |
| Existing local repository setup | PASS — SETUP; capability controls availability, width does not. |
| Repository storage | PASS architectural/adapter boundary — ARCH + XPLAT; actual app-private usability remains NA-07. |
| Repository path UX | PASS — SETUP + UI Diagnostics. |
| Secure GitHub credentials | PASS adapter boundary — NUNIT + Secret Service/native credential tests. |
| Reconnect GitHub | PASS orchestration/unit/browser; Android activation continuation remains NA-05. |
| Provider return continuation | PASS browser; OPEN Android native evidence — NA-05. |
| Sync opportunities | PASS controller/scheduler tests; OPEN activation/resume native observation — NA-01. |
| Guided semantic-conflict resolution | PASS core/controller/Linux/Android integration + browser UI; OPEN exact Android in-app interaction/process evidence — NA-08. |
| Offline Task mutation | PASS — persistence and sync-failure tests prove SQLite-first durability. |
| Browser/native activation | PASS unit architecture; OPEN exact Android activation evidence — NA-01. |
| Daily rollover on activation | PASS shared semantics/unit; OPEN exact Android activation-order evidence — NA-01. |
| Native Back | PASS unit/architecture ordering; OPEN device/emulator interaction evidence — NA-02. |
| App exit delegation | PASS unit ordering; OPEN device/emulator interaction evidence — NA-02. |
| System/status/navigation bars | PASS source ownership; OPEN rendered native effect evidence — NA-03. |
| Safe-area source | PASS ownership; OPEN native geometry evidence — NA-04. |
| Notification delivery | PASS browser/native adapter tests; exact native permission/exact-timing interaction remains NA-06. |
| Notification permission states | PASS capability model/unit; OPEN native Settings evidence — NA-06. |
| Exact timing | PASS native adapter unit; OPEN device/API policy interaction — NA-06. |
| Exact timing settings action | PASS capability-driven architecture; OPEN native Settings evidence — NA-06. |
| Reminder schedule reconciliation | PASS NUNIT; activation/resume observation remains part of NA-01. |
| Reminder-due card state | PASS — shared browser/core projection. |
| Theme/System mode | PASS — UI/VIS across all governed themes/modes. |
| Native bar appearance from Theme | OPEN rendered native proof — NA-03. |
| Install/distribution | PASS retained/no-change — Android build/FLOSS/version/F-Droid and Linux installer smoke are exact-head green. |
| Uninstall local storage semantics | PASS retained/no-change by platform/storage ownership review; no v1.1.2 implementation regression found. |

## 5. Adaptive matrix §C — input/device capability

| Concern | IMP-18 evidence disposition |
|---|---|
| Drag activation | PASS — DRAG; mouse/pen 6px and touch 250ms/8px governed activation path. |
| Drag target semantics | PASS — DRAG; same prospective date/index semantics. |
| Ordinary hit geometry | PASS — UI + narrow/coarse browser evidence. |
| Narrow Linux with mouse | PASS — default fine-pointer narrow browser tests + SETUP capability/width separation. |
| Wide native/coarse-pointer case | PASS by governed architecture substitute — width-only LayoutMode + independent input capability tests; expanded Android is explicitly not a release combination. |
| Keyboard navigation | PASS — DRAG keyboard sensor plus shared Astryx/public control ownership. |
| Software keyboard/IME | OPEN native evidence — NA-04. |
| Safe-area + keyboard coexistence | OPEN native evidence — NA-04. |

## 6. Adaptive matrix §D — architecture rules

Rules 1–10 and 12–16 are PASS through ARCH plus the exact browser/integration suites. Rule 11 has its single-owner/order constraints PASS in ARCH/NUNIT but its native Back/system-bar/activation rendered behavior remains open under NA-01..03. Rule 17 is therefore not fully satisfied until the required Android device/emulator evidence is recorded. No architecture exception or alternate owner was found.

## 7. Adaptive matrix §E — required combinations

| Required combination | Disposition |
|---|---|
| Expanded Linux/browser + fine pointer | PASS — UI/SETUP/RESOLVER/VIS. |
| Narrow Linux/browser + fine pointer | PASS — UI/SETUP/RESOLVER/VIS; browser capability remains browser. |
| Narrow browser + coarse-pointer emulation | PASS — DRAG/UI; touch geometry and activation without Android capability leakage. |
| Android/native narrow | **OPEN** — implementation/build/API-24/controller evidence is green, but J112-NA-01..08 exact-candidate native interaction evidence has not been executed/recorded. |

Expanded Android remains outside the release-gate combinations exactly as governed; ARCH proves Android identity does not force narrow LayoutMode.
