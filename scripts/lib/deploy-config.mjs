// Reads and checks the settings the deploy script needs, so a missing or mistyped
// setting is reported clearly before anything is sent to the TV.
//
// It only reads values. It does not connect to anything.

/** The app's ID on the TV. Must match "id" in webos/appinfo.json. */
export const APP_ID = 'net.badacid.homeassistlg';

/** Returns the trimmed value of a setting, or '' when it is missing or blank. */
function setting(env, name) {
  const value = env[name];
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * @param {Record<string, string | undefined>} env  usually process.env
 * @returns {{ ok: true, host: string, keyPath: string, user: string, port: number }
 *          | { ok: false, problems: string[] }}
 */
export function readDeployConfig(env) {
  const problems = [];

  const host = setting(env, 'TV_HOST');
  if (host === '') problems.push('TV_HOST is not set');

  const keyPath = setting(env, 'TV_SSH_KEY');
  if (keyPath === '') problems.push('TV_SSH_KEY is not set');

  // A rooted TV's SSH server (Homebrew Channel) signs in as root on port 22.
  const user = setting(env, 'TV_SSH_USER') || 'root';

  const portText = setting(env, 'TV_SSH_PORT') || '22';
  const port = Number(portText);
  if (!/^\d+$/.test(portText) || port < 1 || port > 65535) {
    problems.push('TV_SSH_PORT must be a whole number from 1 to 65535');
  }

  if (problems.length > 0) {
    return { ok: false, problems };
  }
  return { ok: true, host, keyPath, user, port };
}
