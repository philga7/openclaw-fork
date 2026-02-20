# Slack: Make status reflect what the gateway is doing

This doc outlines what’s needed so the Slack thread status (the “is typing…” / loading line) shows the current phase (e.g. “Thinking…”, “Running: web_search…”, “Responding…”).

**Implemented** (branch `feature/slack-dynamic-status`): Phase callbacks are wired in `dispatch.ts` with a 600ms throttle; status shows "{bot} is thinking…", "Thinking…", "Running: {tool}…", "Responding…", then clears on idle.

## Current behavior

- **Slack** calls `assistant.threads.setStatus` once when the reply starts (`onReplyStart`) with status `"is thinking..."` (Slack prepends the app name below the input, so we omit it to avoid repetition) and clears it when the run is idle (`onIdle`). No updates in between.
- **Discord** already shows phase via status reactions: it passes `onReasoningStream` and `onToolStart` into `replyOptions` and updates a reaction (🧠 thinking, 🛠️ tool, etc.) in those callbacks.

The reply pipeline already emits the right events; Slack just doesn’t use them for status text.

## What already exists

- **GetReplyOptions** (e.g. in `src/auto-reply/types.ts`) already has:
  - `onToolStart?: (payload: { name?: string; phase?: string }) => Promise<void> | void`
  - `onReasoningStream?: (payload: ReplyPayload) => Promise<void> | void`
  - `onAssistantMessageStart?: () => Promise<void> | void`
- **Agent runner** (`src/auto-reply/reply/agent-runner-execution.ts`) already calls these when tools start, reasoning streams, and assistant message starts.
- **Slack** has `ctx.setSlackThreadStatus({ channelId, threadTs, status })` and already uses it in the typing callbacks (start/stop).

## Implementation steps

### 1. Add phase → status text mapping (Slack)

In `src/slack/monitor/message-handler/dispatch.ts`, define a small helper that maps phase to a short status string, e.g.:

- Run start (current): `"is thinking..."` (Slack prepends the app name; we omit it to avoid repetition)
- Reasoning: `"Thinking..."`
- Tool start: `"Running: {toolName}..."` (e.g. `"Running: web_search..."`), with a short fallback if `name` is missing (e.g. `"Running tool..."`).
- Assistant message start (optional): `"Responding..."` to distinguish from thinking/tool.

Use the same `statusThreadTs` / `message.channel` as the existing typing callbacks so the status updates the same thread.

### 2. Pass phase callbacks in Slack replyOptions

In `dispatchPreparedSlackMessage`, when building the object passed as `replyOptions` to `dispatchInboundMessage`, add:

- **onReasoningStream**: call `ctx.setSlackThreadStatus({ channelId, threadTs: statusThreadTs, status: "Thinking..." })`. Use the same `statusThreadTs` and `message.channel` as the typing callbacks.
- **onToolStart**: call `ctx.setSlackThreadStatus({ ..., status: "Running: " + (payload.name || "tool") + "..." })` (or use the mapping helper).
- **onAssistantMessageStart** (optional): call `ctx.setSlackThreadStatus({ ..., status: "Responding..." })`.

Ensure these only run when we actually set typing (e.g. same `didSetStatus` / thread target as the existing typing logic) so we don’t call `setStatus` for threads we never started typing on.

### 3. Debouncing (recommended)

Discord debounces status reactions (e.g. 700 ms) to avoid flicker. For Slack, consider debouncing or throttling `setSlackThreadStatus` so rapid tool/reasoning events don’t hammer the API or flash status text. Options:

- **Debounce**: only send the latest status after N ms of no new phase events.
- **Throttle**: send at most one status update per N ms (e.g. 500–1000 ms).

Implementation can live in the Slack dispatch layer (e.g. a small helper that wraps `setSlackThreadStatus` and keeps a timer).

### 4. Clearing status

Keep using the existing `onIdle` callback to clear the status (empty string). No change needed there.

### 5. Optional config

If desired, add a config flag (e.g. under `channels.slack` or per-account) to enable/disable dynamic status updates (default: true). When false, keep current behavior (single “{bot name} is thinking…” until idle).

### 6. Tests

- Unit test: when `onToolStart` / `onReasoningStream` are invoked, `setSlackThreadStatus` is called with the expected `status` (and same channel/thread).
- Optionally: test debouncing (e.g. two quick `onToolStart` calls only result in one or two `setSlackThreadStatus` calls depending on throttle/debounce design).

## Files to touch

- **`src/slack/monitor/message-handler/dispatch.ts`**
  - Add phase → status mapping (or inline short strings).
  - Add `onReasoningStream`, `onToolStart`, and optionally `onAssistantMessageStart` to `replyOptions` that call `ctx.setSlackThreadStatus` with the right text.
  - Optionally add a debounce/throttle around `setSlackThreadStatus` for phase updates.
- **`src/slack/monitor/context.ts`**
  - No change required; `setSlackThreadStatus` already accepts any `status` string.
- **Config/schema** (only if adding a feature flag)
  - e.g. `channels.slack.statusUpdates` or per-account equivalent.

## Summary

Use the existing reply pipeline hooks (`onToolStart`, `onReasoningStream`, `onAssistantMessageStart`) in the Slack dispatch and map them to `ctx.setSlackThreadStatus(..., status: "<phase text>")`. Add debouncing/throttling for phase updates and optionally a config flag. No changes to the agent runner or to `GetReplyOptions` are required; only Slack’s use of those options.
