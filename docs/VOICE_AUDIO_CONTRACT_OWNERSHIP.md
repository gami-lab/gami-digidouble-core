# Voice And Audio Contract Ownership

## Decision

EPIC 9.2 uses one public/shared contract module:

`packages/shared/src/voice-contract-types.ts`

It owns the provider-neutral `VoiceConfiguration`, finite `AudioOutputFormat` values,
`ClientAudioOptions`, the minimal `AudioDeliveryRequest`, and bounded `AudioDeliveryMetadata`.
The module is re-exported from `@gami/shared`. It contains no Gradium names, provider identifiers,
SDK request objects, credentials, or provider error payloads.

`voiceKey` is a product-owned logical key. Resolving it to a provider voice and applying provider
credentials belongs to the future Core Application TTS port and Infrastructure adapter.

## Existing contract owners

| Contract                                                               | Canonical owner                                                         | Boundary rule                                                                                    |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Internal Avatar, Scenario, Session, Conversation, and Message entities | `apps/core/src/domain/**`                                               | Remain internal domain models; overlapping fields do not justify collapsing them into wire DTOs. |
| Public Avatar, Scenario, Session, and Conversation summaries           | `packages/shared/src/entity-types.ts`                                   | API projections remain explicit and are mapped by Core route/application mappers.                |
| Public `Message`, `SendMessageResponse`, and history                   | `packages/shared/src/conversation-contract-types.ts`                    | Text contracts remain unchanged by voice output.                                                 |
| Public `SendMessageRequest` and admin/web route DTOs                   | `packages/shared/src/web-contract-types.ts` plus focused shared modules | Clients import or alias shared types; route-local public copies are not introduced.              |
| Public message stream events                                           | `packages/shared/src/conversation-stream-contract-types.ts`             | Existing event names and payloads remain unchanged.                                              |
| Admin inspection DTOs                                                  | `packages/shared/src/runtime-inspector-types.ts`                        | Voice output does not add provider or audio bytes to operator projections.                       |
| Provider-neutral synthesis failures                                    | Future `apps/core/src/application/ports/ITextToSpeechAdapter.ts`        | Application-owned finite failures map to public `ApiResponse` error codes at the API boundary.   |
| Provider request/response and credentials                              | Future `apps/core/src/infrastructure/**` adapter                        | Never cross into Domain, shared contracts, browser, admin, or console code.                      |

## Optionality and inheritance

`VoiceConfiguration` fields are optional only where the value has a meaningful default. An omitted
voice configuration means “inherit the Scenario default” for an Avatar, or “no configured voice”
at the Scenario boundary. `null` is accepted only by Avatar/Scenario update requests as an explicit
clear operation; create and read projections never use it. `resolveVoiceConfiguration` in the Core
domain applies Avatar-over-Scenario precedence without resolving provider details.

`ClientAudioOptions` and `AudioDeliveryRequest` are additive. Omitted options preserve text-only
behavior and let the server choose its configured default output format. Clients can request only a
shared supported format; they cannot select credentials, endpoints, logical voice configuration, or
provider-native synthesis fields.

## Text, bytes, and headers

The persisted cleaned Avatar `Message.content` is the sole source text for later synthesis. Text
turn completion, persistence, Game Master scheduling, and memory maintenance do not depend on
audio. Audio bytes are transient application/HTTP data and are never stored in `messages.metadata`,
an audio column, an asset table, or an event payload by default.

The future binary delivery route will map `AudioDeliveryMetadata` to response headers: `format` to
`Content-Type`, `byteLength` to `Content-Length`, `requestId` and `messageId` to bounded identity
headers, and optional `durationMs` to a documented duration header. The browser receives bytes plus
headers; JSON message and stream contracts remain text-only.

## Audit result

The Avatar/Scenario/Session/Conversation/Message audit found deliberate internal/public projections
and no exact duplicate public voice/audio shapes. The public Avatar/Scenario summaries and their
create/update requests now own the additive `voiceConfig` field; Core repositories map it to and
from the reserved `config.voiceConfig` JSONB key while keeping generic `config` free of that
reserved section. Admin forms expose only the provider-neutral fields. Web/console player-facing
contracts intentionally do not expose configuration, and `AvailableAvatarSummary` remains narrow.
The binary route and synthesis behavior must reuse this module.
