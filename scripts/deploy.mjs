// Installs the packaged app on a rooted TV and launches it. For development only:
// it needs root SSH access, which ordinary users of the app will not have.
// Run with: npm run deploy   (which builds and packages the current code first)
//
// Steps: read settings, copy the .ipk to the TV, ask the TV's install service to
// install it, stop the install command it left running, then launch the app.

import { createReadStream, existsSync, readdirSync } from 'node:fs';
import { APP_ID, readDeployConfig } from './lib/deploy-config.mjs';
import { readInstallAnswer, readInstallPid, readInstallProgress } from './lib/install-output.mjs';
import { runCommand } from './lib/run-command.mjs';
import { installCommand, launchCommand, stopCommand } from './lib/tv-commands.mjs';

const PACKAGE_FOLDER = 'dist';
const REMOTE_PACKAGE = '/tmp/home-assist-lg.ipk';
const INSTALL_TIMEOUT_MS = 60000;

function fail(message) {
  console.error(message);
  process.exit(1);
}

// 1. Settings
if (existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}
const config = readDeployConfig(process.env);
if (!config.ok) {
  for (const problem of config.problems) console.error(problem);
  fail('Copy .env.local.example to .env.local and fill it in.');
}

// 2. The package to send
const packages = existsSync(PACKAGE_FOLDER)
  ? readdirSync(PACKAGE_FOLDER).filter((file) => file.endsWith('.ipk'))
  : [];
if (packages.length !== 1) {
  fail('Run npm run package first.');
}
const packagePath = PACKAGE_FOLDER + '/' + packages[0];

// 3. How every ssh command connects
const sshArguments = [
  '-i',
  config.keyPath,
  '-p',
  String(config.port),
  // Never stop to ask a question; this script cannot answer one.
  '-o',
  'BatchMode=yes',
  '-o',
  'StrictHostKeyChecking=accept-new',
  // The TV's SSH server is old and only offers key types modern clients disable by default.
  '-o',
  'HostKeyAlgorithms=+ssh-rsa',
  '-o',
  'PubkeyAcceptedAlgorithms=+ssh-rsa',
  '-o',
  'ConnectTimeout=8',
  config.user + '@' + config.host,
];

/**
 * Runs one command on the TV over ssh. See scripts/lib/run-command.mjs for what it
 * resolves with and for the options.
 */
async function runOnTv(command, options) {
  const result = await runCommand('ssh', [...sshArguments, command], options);
  if (result.notFound) {
    fail('The ssh command was not found on this computer. Install OpenSSH and try again.');
  }
  return result;
}

// 4. Copy the package. Piping it through "cat" avoids scp, which modern clients run over
//    SFTP, and the TV has no SFTP server.
console.log('Copying ' + packagePath + ' to ' + config.host + ' ...');
const copied = await runOnTv('cat > ' + REMOTE_PACKAGE, { input: createReadStream(packagePath) });
if (copied.code !== 0) {
  if (copied.output.trim() !== '') console.error(copied.output.trim());
  fail('Could not reach the TV at ' + config.host + '. Is it switched on?');
}

// 5. Install. The service keeps printing progress until it is stopped, so watch the
//    output and stop as soon as it reports the result.
console.log('Installing ...');
const installed = await runOnTv(installCommand(REMOTE_PACKAGE), {
  onOutput: (output) => readInstallProgress(output) !== 'waiting',
  timeoutMs: INSTALL_TIMEOUT_MS,
});
// The install command leaves its luna-send running on the TV. End it, whatever the result.
const installPid = readInstallPid(installed.output);
if (installPid !== null) {
  await runOnTv(stopCommand(installPid));
}
if (readInstallProgress(installed.output) !== 'installed') {
  const answer = readInstallAnswer(installed.output);
  if (answer === '') {
    fail('The TV gave no answer to the install request.');
  }
  console.error(answer);
  fail(
    installed.timedOut
      ? 'The TV did not finish installing in time.'
      : 'The TV refused the install.',
  );
}

// 6. Launch
const launched = await runOnTv(launchCommand(APP_ID));
if (!launched.output.replace(/\s+/g, '').includes('"returnValue":true')) {
  console.error(launched.output.trim());
  fail('Installed, but the TV would not launch the app.');
}
console.log('Installed and launched.');
