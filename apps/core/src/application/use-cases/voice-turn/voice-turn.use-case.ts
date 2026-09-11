import crypto from 'node:crypto'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IObservabilityAdapter } from '../../ports/IObservabilityAdapter.js'
import {
  createSpeechUtteranceFingerprint,
  type IUtteranceIdempotencyStore,
  type SpeechUtteranceReservation,
} from '../../ports/IUtteranceIdempotencyStore.js'
import {
  isSpeechToTextError,
  normalizeFinalTranscript,
  normalizeSpeechToTextInput,
  throwIfSpeechToTextCancelled,
  type ISpeechToTextAdapter,
} from '../../ports/ISpeechToTextAdapter.js'
import type { SendMessageInput, SendMessageOutput } from '../send-message/send-message.types.js'
import type { SendMessageUseCase } from '../send-message/send-message.use-case.js'
import type { StreamingSendMessageEvent } from '../send-message/streaming-send-message.types.js'
import type { StreamingSendMessageUseCase } from '../send-message/streaming-send-message.use-case.js'
import { DomainError } from '../../../domain/errors.js'
import {
  isVoiceTurnError,
  type VoiceTurnFailureCode,
  type VoiceTurnInput,
  type VoiceTurnOptions,
  VoiceTurnError,
} from './voice-turn.types.js'

type ClaimedReservation = Extract<SpeechUtteranceReservation, { status: 'claimed' }>

type PreparedVoiceTurn = {
  input: VoiceTurnInput
  reservation: SpeechUtteranceReservation
}

type VoiceTurnTrace = {
  requestId: string
  input: VoiceTurnInput
  latencyMs: number
  outcome: 'success' | 'interrupted' | 'failure'
  transcriptLength?: number
  conversationRequestId?: string
  failureCode?: VoiceTurnFailureCode
}

/** Coordinates voice input with the existing synchronous and streaming turn owners. */
export class VoiceTurnUseCase {
  constructor(
    private readonly speechToTextAdapter: ISpeechToTextAdapter,
    private readonly conversationRepository: Pick<IConversationRepository, 'findById'>,
    private readonly idempotencyStore: IUtteranceIdempotencyStore,
    private readonly sendMessageUseCase: Pick<SendMessageUseCase, 'execute'>,
    private readonly streamingSendMessageUseCase: Pick<StreamingSendMessageUseCase, 'execute'>,
    private readonly observability: IObservabilityAdapter,
  ) {}

  async execute(input: VoiceTurnInput, options?: VoiceTurnOptions): Promise<SendMessageOutput> {
    const requestId = crypto.randomUUID()
    const startedAt = Date.now()
    let prepared: PreparedVoiceTurn | undefined
    let claimed: ClaimedReservation | undefined
    let downstreamStarted = false
    let transcriptLength: number | undefined
    let failureCode: VoiceTurnFailureCode | undefined

    try {
      prepared = await this.prepareVoiceTurn(input, options)
      claimed = this.requireClaim(prepared.reservation)
      const transcript = await this.transcribe(prepared.input, options, requestId)
      transcriptLength = Array.from(transcript).length
      downstreamStarted = true
      const output = await this.sendMessageUseCase.execute(
        toSendMessageInput(prepared.input, transcript),
      )
      return output
    } catch (error) {
      failureCode = failureCodeFor(error)
      throw error
    } finally {
      if (claimed !== undefined)
        await this.finishReservation(prepared?.input ?? input, claimed, downstreamStarted)
      if (prepared !== undefined) {
        this.trace({
          requestId,
          input: prepared.input,
          latencyMs: Date.now() - startedAt,
          outcome: failureCode !== undefined ? 'failure' : 'success',
          ...(transcriptLength === undefined ? {} : { transcriptLength }),
          ...(failureCode === undefined ? {} : { failureCode }),
        })
      }
    }
  }

  // eslint-disable-next-line complexity
  async *executeStream(
    input: VoiceTurnInput,
    options?: VoiceTurnOptions,
  ): AsyncIterable<StreamingSendMessageEvent> {
    const requestId = crypto.randomUUID()
    const startedAt = Date.now()
    let prepared: PreparedVoiceTurn | undefined
    let claimed: ClaimedReservation | undefined
    let downstreamStarted = false
    let transcriptLength: number | undefined
    let conversationRequestId: string | undefined
    let completed = false
    let failureCode: VoiceTurnFailureCode | undefined

    try {
      prepared = await this.prepareVoiceTurn(input, options)
      claimed = this.requireClaim(prepared.reservation)
      const transcript = await this.transcribe(prepared.input, options, requestId)
      transcriptLength = Array.from(transcript).length
      downstreamStarted = true

      for await (const event of this.streamingSendMessageUseCase.execute(
        toSendMessageInput(prepared.input, transcript),
        options,
      )) {
        conversationRequestId ??= event.requestId
        completed = completed || event.type === 'completed'
        yield event
      }
    } catch (error) {
      failureCode = failureCodeFor(error)
      throw error
    } finally {
      if (claimed !== undefined)
        await this.finishReservation(prepared?.input ?? input, claimed, downstreamStarted)
      if (prepared !== undefined) {
        this.trace({
          requestId,
          input: prepared.input,
          latencyMs: Date.now() - startedAt,
          outcome: failureCode !== undefined ? 'failure' : completed ? 'success' : 'interrupted',
          ...(transcriptLength === undefined ? {} : { transcriptLength }),
          ...(conversationRequestId === undefined ? {} : { conversationRequestId }),
          ...(failureCode === undefined ? {} : { failureCode }),
        })
      }
    }
  }

  private async prepareVoiceTurn(
    input: VoiceTurnInput,
    options: VoiceTurnOptions | undefined,
  ): Promise<PreparedVoiceTurn> {
    const normalizedInput = normalizeSpeechToTextInput(input)
    throwIfSpeechToTextCancelled(options?.signal, 'before_transcription')
    await this.assertActiveConversation(normalizedInput.conversationId)
    const reservation = await this.idempotencyStore.reserve(
      {
        conversationId: normalizedInput.conversationId,
        utteranceId: normalizedInput.utteranceId,
      },
      createSpeechUtteranceFingerprint(normalizedInput),
    )
    return { input: normalizedInput, reservation }
  }

  private async transcribe(
    input: VoiceTurnInput,
    options: VoiceTurnOptions | undefined,
    requestId: string,
  ): Promise<string> {
    const transcription = await this.speechToTextAdapter.transcribe(input, {
      requestId,
      ...(options?.signal === undefined ? {} : { signal: options.signal }),
    })
    const transcript = normalizeFinalTranscript(transcription)
    throwIfSpeechToTextCancelled(options?.signal, 'after_transcription')
    return transcript
  }

  private async assertActiveConversation(conversationId: string): Promise<void> {
    const conversation = await this.conversationRepository.findById(conversationId)
    if (conversation === null) {
      throw new DomainError('NOT_FOUND', 'Conversation was not found.')
    }
    if (conversation.status !== 'active') {
      throw new DomainError('CONFLICT', 'Conversation is not active.')
    }
  }

  private requireClaim(reservation: SpeechUtteranceReservation): ClaimedReservation {
    if (reservation.status === 'claimed') return reservation
    throw new VoiceTurnError(reservation.status)
  }

  private async finishReservation(
    input: VoiceTurnInput,
    reservation: ClaimedReservation,
    downstreamStarted: boolean,
  ): Promise<void> {
    try {
      if (downstreamStarted) {
        await this.idempotencyStore.complete(
          { conversationId: input.conversationId, utteranceId: input.utteranceId },
          reservation.reservationId,
        )
      } else {
        await this.idempotencyStore.release(
          { conversationId: input.conversationId, utteranceId: input.utteranceId },
          reservation.reservationId,
        )
      }
    } catch {
      // Leaving the reservation in-flight fails safe until its store-defined expiry.
    }
  }

  private trace(args: VoiceTurnTrace): void {
    void this.observability
      .trace({
        requestId: args.requestId,
        event: 'voice_turn',
        input: {
          byteCount: args.input.audio.byteLength,
          ...(args.input.durationMs === undefined ? {} : { durationMs: args.input.durationMs }),
        },
        output: {
          ...(args.transcriptLength === undefined
            ? {}
            : { transcriptLength: args.transcriptLength }),
          ...(args.failureCode === undefined ? {} : { failureCode: args.failureCode }),
        },
        latencyMs: args.latencyMs,
        metadata: {
          conversationId: args.input.conversationId,
          utteranceId: args.input.utteranceId,
          outcome: args.outcome,
          ...(args.conversationRequestId === undefined
            ? {}
            : { conversationRequestId: args.conversationRequestId }),
        },
      })
      .catch(() => undefined)
  }
}

function toSendMessageInput(input: VoiceTurnInput, transcript: string): SendMessageInput {
  return { conversationId: input.conversationId, userMessage: transcript }
}

function failureCodeFor(error: unknown): VoiceTurnFailureCode {
  if (isSpeechToTextError(error)) return error.failure.code
  if (isVoiceTurnError(error)) return error.code
  return 'turn_failure'
}
