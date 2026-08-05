# Contributing a Live Activity template

This guide is written so it can be handed directly to a coding agent. A template contribution adds
a genuinely new Hark Live Activity layout that users select through the public `style` field. It is
not a color preset or an alias for one of the existing layouts. Classify it before editing:

- A **task-progress style** is used by `harkctl activity start/update` and falls back to the
  `standard` presentation for any surface it does not customize.
- An **interactive approval style** is used by `harkctl notify ask --live-activity` and must route
  its buttons through the existing interaction machinery.

Layouts are compiled SwiftUI inside the widget extension. The contracts, CLI, and docs changes are
testable with `pnpm` alone; the Swift layout itself compiles and renders only through Xcode, so a
Hark maintainer performs the build and the on-device visual check before release.

## Before editing

Read these files:

- `packages/contracts/src/index.ts` — public style IDs and Live Activity payload limits.
- `apps/ios/HarkWidgets/HarkWidgets.swift` — every layout: `HarkActivityPresentation` (derived
  display values), `HarkLockScreenView` (per-style Lock Screen banners), `HarkExpandedLeading` /
  `HarkExpandedBottom` (per-style Dynamic Island regions), `HarkInteractionButtons` and
  `InteractiveTheme` (interactive button styling and routing).
- `apps/ios/Shared/HarkModels.swift` — `LiveActivityProps`, the decoded push payload.
- `apps/ios/Shared/LiveActivityAttributes.swift` — the ActivityKit attributes and content state.
- `packages/harkctl/src/cli.mjs` — CLI style validation and help text.
- `apps/website/src/shared/docs/content.ts` — API documentation and style metadata.
- `apps/website/src/client/pages/docs/primitives.tsx` — small documentation previews.

Choose a short, permanent, lower-case style ID such as `orbit` or `scoreboard`. A merged ID becomes
part of Hark's public API and must not be renamed later. State whether it is task-progress or
interactive approval in the PR description.

## Critical widget constraints

- Read display values from `HarkActivityPresentation` (`title`, `status`, `detail`, `percentage`,
  `symbol`, `accent`, `a11ySummary`), never from `props` directly — the presentation applies
  `private` privacy masking once, for every layout.
- An unknown or missing `style` must keep rendering `standard`: new branches extend the existing
  `switch` statements and never replace their `default` cases.
- Interactive styles must render their actions with `HarkInteractionButtons` (add an
  `InteractiveTheme` case for the visual treatment). The buttons only appear while the interaction
  is pending and the activity attributes carry the device-bound credentials; never hardcode an
  approval target or bypass `HarkLiveActivityResponseIntent`.
- No remote images, custom fonts, user-provided URLs, timers, or network calls in the widget.
- A new template does not require a new Apple target, entitlement, or ActivityKit schema version.
  Do not bump `LIVE_ACTIVITY_SCHEMA_VERSION` when the payload fields are unchanged.

## 1. Register the public style ID

Add the ID to `LIVE_ACTIVITY_STYLES` in `packages/contracts/src/index.ts`. For an interactive
approval style, also add it to `INTERACTIVE_LIVE_ACTIVITY_STYLES`; the contracts deliberately
reject interactive styles from the standalone Activity API and require an interaction payload.
Task-progress styles must not be added to that second list.

Older app builds receive the new ID and render `standard`; updated builds render the new template.
The agent and webhook routes already validate and propagate `style` with no template-specific
branches.

## 2. Build the layout

In `apps/ios/HarkWidgets/HarkWidgets.swift`:

- Add a branch to `HarkLockScreenView.body` for the Lock Screen banner, plus a private view or
  computed property holding the layout. If the style needs its own background, extend
  `HarkActivityPresentation.background`.
- Customize only the Dynamic Island regions that are genuinely different: `HarkExpandedLeading`,
  `HarkExpandedBottom.progressBody`, and the compact/trailing expressions in
  `HarkAgentActivityWidget`. Everything not customized inherits the standard treatment.
- Reuse the shared pieces (`HarkRingGauge`, `HarkStepsPips`, `HarkWidgetColor`) instead of
  duplicating them.

Design requirements:

- Handle `progress` being absent, `0`, partially complete, and `1`.
- Handle `detail` being absent.
- Keep title and status within their existing line limits.
- Do not reveal the original title or detail in `private` mode, including accessibility labels —
  use the presentation values and `a11ySummary`.
- Do not communicate essential state through color alone, and preserve contrast with
  caller-provided accent colors.
- Keep compact and minimal presentations glanceable; do not shrink full banner content into them.

## 3. Update `harkctl`

For a task-progress style, add the ID to `ACTIVITY_STYLES` in `packages/harkctl/src/cli.mjs` and
update both `activity start` and `activity update` help. For an interactive style, add it to
`INTERACTIVE_ACTIVITY_STYLES` and update `notify ask --live-activity` help instead.

Add or update a CLI test so `--style orbit` is accepted and an unknown value remains a usage error.
Do not publish a new npm version from a contributor PR; maintainers release `harkctl` after merge.

## 4. Document the template

Update `apps/website/src/shared/docs/content.ts` in both places:

- Add the ID to the `style` field's enum description.
- Add its name and one-sentence visual description to the style gallery.

Add a matching miniature preview branch in `apps/website/src/client/pages/docs/primitives.tsx`. The
docs preview is an explanatory fallback, not a second authoritative implementation. If no native
capture is available yet, set `nativeScreenshot: false` on the style metadata. Before release, a
maintainer adds `apps/website/public/live-activities/<style>.webp` and removes that fallback flag.

## 5. Run the pnpm verification

From the repository root:

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm --filter @hark/website exec vitest run src/shared/docs/docs.test.ts
pnpm --filter @hark/website build
git diff --check
```

These cover contracts, CLI, and docs. They do not compile the Swift layout.

## 6. Native verification (maintainer)

Build the app and widget extension in Xcode, install on a device, then drive the style through the
real pipeline:

```sh
harkctl activity start --style orbit --title "Deploy #184" --status "Building" --progress 0.4
harkctl activity update --progress 0.8
harkctl activity end
```

For an interactive style: `harkctl notify ask --live-activity --style orbit "Deploy to production?"`.

Inspect the Lock Screen plus compact, minimal, and expanded Dynamic Island presentations. Test long
text, private mode, no progress, 0%, 100%, and several accents. Capture the Lock Screen banner and
convert it to `apps/website/public/live-activities/<style>.webp` (`cwebp -q 82 -resize 900 0`),
then remove the `nativeScreenshot: false` fallback.

## Pull request checklist

Include this checklist in the PR description:

- [ ] The style ID is short, permanent, and added to contracts and `harkctl`.
- [ ] The contribution contains a genuinely new layout rather than a renamed existing style.
- [ ] Unknown or missing styles still fall back to `standard` on every surface.
- [ ] Missing detail and absent/zero/partial/complete progress are handled.
- [ ] Private mode leaks no original title, status, or detail.
- [ ] Accessibility labels and line limits are present.
- [ ] Interactive styles route through `HarkInteractionButtons` with an `InteractiveTheme` case.
- [ ] API docs, CLI help, and the docs thumbnail include the new style.
- [ ] Browser screenshots of the docs preview are attached.
- [ ] Native testing status is stated: not tested, simulator tested, or device tested.
- [ ] No credentials, provisioning changes, remote assets, or unrelated changes are included.

## Review expectations

Hark maintainers may adjust spacing, typography, naming, or slot reuse before accepting a template.
Acceptance also depends on clarity at a glance, accessibility, privacy, bundle complexity, and
whether the design adds a meaningfully different presentation. Passing the pnpm gates does not
guarantee the Swift layout compiles or that Apple renders every size as expected — the Xcode build
and device check are part of review.
