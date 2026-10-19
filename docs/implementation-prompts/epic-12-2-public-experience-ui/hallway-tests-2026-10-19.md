# Hallway Tests — EPIC 12.2

Status: **not run yet.** These five sessions need real first-time visitors on the deployed scenario;
they cannot be simulated. Fill one row per visitor. Record no names or personal data.

## Protocol

1. Open the deployed player on a fresh browser profile (phone for tests 1–3, desktop for 4–5).
2. Say only: "Try this." Do not explain the product or the flow.
3. Open the browser console beforehand; the player logs
   `[gami] time to first exchange: <n> ms` once, from the first landing screen to the first sent
   message.
4. Note where the visitor hesitated, wording they misread, and any voice problem.
5. Pass: at least four of five reach the first exchange in under 30 s without help.

## Results

| #   | Device  | Time to first exchange | Hesitations | Wording confusion | Voice issues | Follow-up |
| --- | ------- | ---------------------- | ----------- | ----------------- | ------------ | --------- |
| 1   | Phone   |                        |             |                   |              |           |
| 2   | Phone   |                        |             |                   |              |           |
| 3   | Phone   |                        |             |                   |              |           |
| 4   | Desktop |                        |             |                   |              |           |
| 5   | Desktop |                        |             |                   |              |           |

## Scripted walkthrough (not a hallway test)

On 2026-10-19 the agent drove the flow keyboard-only at 375 px width against the local E2E stack
(French UI, one active scenario with an entry question and one character): landing → intro →
entry answer → starter question. The logged time was 9.6 s, including tool latency between steps;
it only shows the instrumentation works and the path has no dead ends. Observations fixed in the
same change: focus now moves to each screen's title, and raw server error text is no longer shown
to visitors.
