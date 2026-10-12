/** Raisons d'échec d'un morceau en ligne, chacune avec un message compréhensible. */
export type OnlineAudioErrorKind =
  | 'invalid-url'
  | 'protected-service'
  | 'duplicate'
  | 'cors'
  | 'unreachable'
  | 'http'
  | 'not-audio'
  | 'too-large'
  | 'slow'
  | 'unsupported-format'
  | 'cancelled';

export class OnlineAudioError extends Error {
  constructor(
    readonly kind: OnlineAudioErrorKind,
    message: string,
  ) {
    super(message);
  }
}
