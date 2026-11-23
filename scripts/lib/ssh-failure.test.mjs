import { expect, it } from 'vitest';
import { describeSshFailure } from './ssh-failure.mjs';

const HOST = '192.168.1.65';

it('explains a key file other Windows users can read, with the commands that fix it', () => {
  const output =
    "Permissions for '.deploy/tv_deploy_key' are too open.\n" +
    'Load key ".deploy/tv_deploy_key": bad permissions\n' +
    'root@192.168.1.65: Permission denied (publickey,password).';
  const message = describeSshFailure(output, HOST, '.deploy/tv_deploy_key');
  expect(message).toContain('other users on this computer can read');
  expect(message).toContain('icacls ".deploy\\tv_deploy_key" /inheritance:r');
  expect(message).toContain('icacls ".deploy\\tv_deploy_key" /grant:r "%USERNAME%:R"');
  expect(message).not.toContain('switched on');
});

it('says the TV refused the key when the key is readable but not accepted', () => {
  const message = describeSshFailure(
    'root@192.168.1.65: Permission denied (publickey).',
    HOST,
    'k',
  );
  expect(message).toBe(
    'The TV at 192.168.1.65 refused the SSH key. Check that TV_SSH_KEY in .env.local names the key the TV accepts for root.',
  );
});

it('asks whether the TV is on when nothing answers', () => {
  for (const output of [
    'ssh: connect to host 192.168.1.65 port 22: Connection timed out',
    'ssh: connect to host 192.168.1.65 port 22: No route to host',
    'ssh: connect to host 192.168.1.65 port 22: Connection refused',
  ]) {
    expect(describeSshFailure(output, HOST, 'k')).toBe(
      'Could not reach the TV at 192.168.1.65. Is it switched on, with its SSH server running?',
    );
  }
});

it('points at the message above for anything else', () => {
  expect(describeSshFailure('something unexpected', HOST, 'k')).toBe(
    'Could not copy the package to the TV at 192.168.1.65. The message above says why.',
  );
});
