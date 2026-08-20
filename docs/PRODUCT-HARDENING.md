# Integrated product hardening closeout

This document records the first product-wide hardening pass after completion of the regular Tracks A–L.

It is deliberately **not Track M**. The purpose is to make the already-shipped HOPSCOTCH systems behave like one coherent product without adding another network-truth subsystem.

## Product contract

HOPSCOTCH keeps the same architectural invariant:

> presentation may explain, navigate, and render canonical truth; presentation never creates network truth.

This hardening pass changes product-shell metadata, navigation/accessibility, CSS ownership, and integration contracts. It does not change simulation algorithms, scenario schema, evidence provenance, packet/protocol outcomes, or performance ceilings.

## Canonical workspace catalog

`src/workspace-catalog.ts` is the product-shell source of truth for the 13 current workspaces.

Each workspace owns one canonical:

- destination ID,
- deep-link path,
- network-scale placement,
- lab/track label,
- product name,
- Explore title/description/meta copy,
- topbar status label,
- Explore group,
- optional featured action metadata.

`navigation.ts`, `App.tsx`, `ExploreLauncher.tsx`, and `HomeActionDeck.tsx` consume this catalog rather than maintaining independent tables.

Two historical naming conflicts are explicitly resolved:

- the current Capture Replay product is **Track H**; `docs/TRACKT.md` remains only the historical first captured-data slice,
- the integrated URL Journey + GOD MODE surface spans **Lab 06 + Lab 07** and is labeled `LAB 06 + 07` consistently.

## Navigation and browser identity

Deep links remain the existing stable paths. Browser history and legacy Journey-share migration are unchanged.

The active browser title is now derived from the same workspace catalog:

```text
HOPSCOTCH — <workspace name>
```

The overview remains:

```text
HOPSCOTCH — See the Internet happen
```

The persistent Explore trigger exposes `aria-expanded` and `aria-controls` against the dialog it opens, and the workspace count is derived instead of hardcoded.

## Explore accessibility boundary

Explore remains presentation/navigation only, but now behaves as a contained modal interaction:

- body scrolling is locked while open,
- focus moves into the dialog,
- Tab and Shift+Tab remain inside the dialog,
- Escape closes it,
- overlay click still closes it,
- focus returns to the element that opened it,
- title and description are connected through dialog ARIA attributes.

A shared `:focus-visible` baseline makes keyboard location visible across the product while component-specific focus treatment may remain more expressive.

## Canonical CSS ownership

The old files below began as visual-audit correction layers but had become permanent production behavior:

- `visual-audit.css`
- `tcp-audit.css`
- `dns-audit.css`
- `journey-audit.css`

Their rules are now folded into canonical owned stylesheets and the late global imports are removed. This reduces cascade-order debt without intentionally changing those visual rules.

## Permanent integration gate

`npm run test:product-integration-contract` verifies the product shell as a coherent system.

It guards:

- exactly 13 unique canonical workspace IDs and deep-link paths,
- navigation paths equal catalog paths,
- current Track H / Lab 06 + 07 nomenclature,
- complete and non-duplicated Explore grouping,
- catalog-backed App/Explore/Home metadata,
- dialog focus containment/restoration and ARIA state,
- absence of hardcoded workspace count in App/Home,
- removal of the four late `*-audit.css` patch files,
- presence of their integrated canonical CSS markers,
- presentation-only boundaries for workspace metadata and launch surfaces.

Existing navigation, Explore, and home-action contracts remain and are aligned to the catalog rather than reinforcing duplicate data.

## Explicit non-goals

This pass does not:

- add a new simulator,
- alter route/forwarding/policy/protocol decisions,
- change captured or measured evidence,
- change Builder scenario schema v9,
- add persistence to presentation state,
- widen DOM, heap, bundle, or browser compatibility budgets,
- create Track M merely to continue the alphabet.

## Validation requirement

Closeout requires the exact clean PR head to pass:

1. full `npm run check`, including the new integration contract,
2. production performance enforcement with unchanged budgets,
3. Firefox semantic compatibility,
4. Chrome default, WebGL-disabled, and SwiftShader compatibility,
5. real PCAP and PCAPNG capture replay.

Any temporary patch helper or writable CI used to apply the cross-file integration must be removed before this exact-head validation.
