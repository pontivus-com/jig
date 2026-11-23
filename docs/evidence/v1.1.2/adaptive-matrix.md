# Jig v1.1.2 IMP-18 adaptive-matrix ledger

Exact executable candidate: `d28bc8a7e07a460c2f1178cb6bdea27cca92b4bc`; Verify run `2200` / `45087086162`. Evidence keys are defined in [`README.md`](README.md).

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
| Workspace close/dismiss | PASS — UI + J112-NA-02 native Back evidence. |
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
| GitHub/repository chooser | PASS — SETUP + VIS + J112-NA-05 Android provider-return evidence. |
| History | PASS — UI + VIS; single adaptive max-50rem hierarchy. |
| Settings | PASS — UI + VIS; one adaptive hierarchy. |
| Diagnostics | PASS — ARCH + UI + SYNC + VIS; one sanitized projection. |
| Sync conflict resolver | PASS for browser/semantic implementation — ARCH + RESOLVER + SYNC + XPLAT + VIS; exact Android in-app interaction remains J112-NA-08. |
| Appearance controls | PASS — UI + VIS; one Theme/appearance owner. |
| Notification Settings layout | PASS — ARCH + UI + J112-NA-06 Android permission/exact-alarm evidence. |
| References/actions | PASS — UI + DRAG; shared safe reference behavior and adaptive geometry. |
| Destination transition | PASS — UI; governed motion tokens and reduced-motion behavior. |
| Theme transition | PASS — ARCH + UI; one Theme owner and governed token scale. |
| Safe-area placement | PASS — UI/VIS + J112-NA-04 exact Android safe-area/IME evidence. |
| Breakpoint with open workspace | PASS — UI; shared Task draft survives host replacement. |
| Breakpoint with open sync resolver | PASS — RESOLVER + VIS; choices/order draft preserved Drawer→BottomSheet. |

## 4. Adaptive matrix §B — runtime/platform capability

| Concern | IMP-18 evidence disposition |
|---|---|
| Platform selection | PASS — ARCH; runtime mechanics never derive from LayoutMode. |
| Configured Task/status calls | PASS — ARCH + persistence/browser/native integration tests. |
| SQLite mechanics | PASS — NUNIT + API24 bundled-driver persistence/rollback/reopen instrumentation. |
| Git transport | PASS — XPLAT + API24 Git HTTP binary transport instrumentation. |
| GitHub onboarding availability | PASS — SETUP + GitHub install/native unit tests + NA-05 provider-return evidence. |
| Existing local repository setup | PASS — SETUP; capability controls availability, width does not. |
| Repository storage | PASS — ARCH + XPLAT + NA-07 app-private usability evidence. |
| Repository path UX | PASS — SETUP + UI Diagnostics. |
| Secure GitHub credentials | PASS adapter boundary — NUNIT + Secret Service/native credential tests. |
| Reconnect GitHub | PASS — orchestration/unit/browser + NA-05 Android activation continuation. |
| Provider return continuation | PASS — browser + NA-05 Android native evidence. |
| Sync opportunities | PASS — controller/scheduler tests + NA-01 activation/resume native observation. |
| Guided semantic-conflict resolution | PASS core/controller/Linux/Android integration + browser UI; OPEN exact Android in-app interaction/process evidence — NA-08. |
| Offline Task mutation | PASS — persistence and sync-failure tests prove SQLite-first durability. |
| Browser/native activation | PASS — unit architecture + NA-01 exact Android activation evidence. |
| Daily rollover on activation | PASS — shared semantics/unit + NA-01 exact Android activation-order evidence. |
| Native Back | PASS — unit/architecture ordering + NA-02 device interaction evidence. |
| App exit delegation | PASS — unit ordering + NA-02 device interaction evidence. |
| System/status/navigation bars | PASS — source ownership + NA-03 rendered native evidence. |
| Safe-area source | PASS — ownership + NA-04 native geometry evidence. |
| Notification delivery | PASS — browser/native adapter tests + NA-06 permission/exact-timing interaction evidence. |
| Notification permission states | PASS — capability model/unit + NA-06 native Settings evidence. |
| Exact timing | PASS — native adapter unit + NA-06 device/API policy interaction evidence. |
| Exact timing settings action | PASS — capability-driven architecture + NA-06 native Settings evidence. |
| Reminder schedule reconciliation | PASS — NUNIT + NA-01 activation/resume observation. |
| Reminder-due card state | PASS — shared browser/core projection. |
| Theme/System mode | PASS — UI/VIS across all governed themes/modes. |
| Native bar appearance from Theme | PASS — NA-03 rendered native proof. |
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
| Software keyboard/IME | PASS — NA-04 native evidence. |
| Safe-area + keyboard coexistence | PASS — NA-04 native evidence. |

## 6. Adaptive matrix §D — architecture rules

Rules 1–16 are PASS through ARCH/browser/integration evidence plus the recorded NA-01..07 native observations. Rule 17 remains not fully satisfied only because J112-NA-08 final in-app semantic-conflict acceptance is open on the corrected candidate. No architecture exception or alternate owner was found.

## 7. Adaptive matrix §E — required combinations

| Required combination | Disposition |
|---|---|
| Expanded Linux/browser + fine pointer | PASS — UI/SETUP/RESOLVER/VIS. |
| Narrow Linux/browser + fine pointer | PASS — UI/SETUP/RESOLVER/VIS; browser capability remains browser. |
| Narrow browser + coarse-pointer emulation | PASS — DRAG/UI; touch geometry and activation without Android capability leakage. |
| Android/native narrow | **OPEN only for J112-NA-08** — implementation/build/API-24/controller evidence is green and J112-NA-01..07 are recorded PASS; final corrected-candidate semantic-conflict acceptance remains open. |

Expanded Android remains outside the release-gate combinations exactly as governed; ARCH proves Android identity does not force narrow LayoutMode.
