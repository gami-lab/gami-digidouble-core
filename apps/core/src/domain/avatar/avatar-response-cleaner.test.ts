import { describe, expect, it } from 'vitest'

import { cleanAvatarResponse } from './avatar-response-cleaner.js'

describe('cleanAvatarResponse', () => {
  it('removes a leading speaker label while preserving the dialogue', () => {
    expect(
      cleanAvatarResponse('**Max :** Nous l’avons retrouvé ligoté dans une pièce de l’hôtel'),
    ).toBe('Nous l’avons retrouvé ligoté dans une pièce de l’hôtel')
  })

  it('removes complete single-line and multiline stage directions', () => {
    expect(
      cleanAvatarResponse(
        '**Max :** Nous l’avons retrouvé ligoté dans une pièce de l’hôtel\n\n' +
          '*Max se tait longtemps. Très longtemps.*\n\n' +
          'Je ne sais pas ce qu’il est devenu.\n\n' +
          '*Il dit ça plaintivement, comme une confession.*\n\n' +
          'Après qu’on ait jeté Lise au gouffre, on est revenus au chalet.',
      ),
    ).toBe(
      'Nous l’avons retrouvé ligoté dans une pièce de l’hôtel\n\n' +
        'Je ne sais pas ce qu’il est devenu.\n\n' +
        'Après qu’on ait jeté Lise au gouffre, on est revenus au chalet.',
    )

    expect(cleanAvatarResponse('Answer\n*Max se tait\nlongtemps.*\nNext answer')).toBe(
      'Answer\nNext answer',
    )
  })

  it('removes a marked prefix at the beginning of a line and keeps later dialogue', () => {
    expect(cleanAvatarResponse('Answer\n*Max :* The hotel was dark.')).toBe(
      'Answer\nThe hotel was dark.',
    )
  })

  it('leaves ordinary dialogue unchanged', () => {
    expect(cleanAvatarResponse('The hotel was dark.\nPeter was behind the door.')).toBe(
      'The hotel was dark.\nPeter was behind the door.',
    )
  })
})
