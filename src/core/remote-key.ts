/**
 * The names of the remote's keys that the app uses. src/platform/keys.ts turns the TV's key
 * codes into these; screens decide what each one does.
 */

export type RemoteKey =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'ok'
  | 'back'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'channelUp'
  | 'channelDown';
