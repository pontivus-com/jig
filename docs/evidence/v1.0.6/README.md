# Jig v1.0.6 implementation evidence

**Status:** RECERTIFICATION IN PROGRESS — the prior 14-theme candidate is superseded. Architectural review found that exposing Astryx Gothic contradicted the governing JIG-106-FR-02 catalogue and the concrete v1.0.6 theme rules in `AGENTS.md`.  
**Implementation branch:** `fix/v1.0.6-history-settings-width`  
**Implementation PR:** #25  
**Package version on implementation branch:** `1.0.5`

The implementation has been remediated back to the governed thirteen-theme catalogue:

- Jig;
- Astryx Neutral, Butter, Chocolate, Matcha, Stone and Y2K;
- Gruvbox, Dracula, Solarized, Nord, Catppuccin and Tokyo Night.

Pinned Astryx Gothic 0.7.13 is explicitly dark-only upstream and is intentionally not selectable in v1.0.6. No synthetic Light inversion is part of the governed release.

The prior permanent Verify evidence for the 14-theme candidate no longer certifies the current branch. This document must not return to PASS until the exact remediated product/test candidate passes the permanent implementation workflow.

The release boundary remains unchanged: `package.json.version` stays 1.0.5 on this implementation branch. The v1.0.6 version transition and publication occur only after this implementation is merged and a dedicated `release/v1.0.6` metadata PR satisfies `docs/releases/README.md`.
