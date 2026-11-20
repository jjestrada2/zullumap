# TODOS

## Infrastructure

### Verify full-length trailers in CI on a GPU runner

**What:** Add a CI job on a GPU-equipped runner that records each template's full-length fly-through trailer and checks it end to end.

**Why:** CI currently records only a 1-second smoke trailer at 10 fps plus the end card (eng review D8), so a glitch late in a template's camera path is only caught when an author renders the full trailer locally.

**Pros:** Every frame of every template's fly-through is verified before merge; no reliance on authors' local checks.

**Cons:** Needs a paid GPU runner (GitHub-hosted runners have no GPU) and adds CI time and cost.

**Context:** Trailers are captured frame by frame in headless Chromium (each frame waits for MapLibre's idle event and deck.gl's redraw), then encoded with ffmpeg. Without a GPU, WebGL renders in software, reported at several seconds per 3D frame, so full trailers (300-450 frames) are impractical on free runners. Start from the `zullumap check` smoke-trailer step and parameterize its duration and frame rate. Design: docs/designs/agent-first-map-templates.md.

**Effort:** M
**Priority:** P3
**Depends on:** `zullumap trailer` and `zullumap check` existing; template PRs becoming frequent enough to justify the runner cost.

## Completed
