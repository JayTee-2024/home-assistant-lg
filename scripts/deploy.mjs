// Installs the packaged app on a rooted TV and launches it. For development only:
// it needs root SSH access, which ordinary users of the app will not have.
// Run with: npm run deploy   (after npm run package)
//
// Steps: read settings, copy the .ipk to the TV, ask the TV's install service to
// install it, then launch the app.

import { spawn } from 'node:child_process';
import { createReadStream, existsSync, readdirSync } from 'node:fs';
import { APP_ID, readDeployConfig } from './lib/deploy-config.mjs';
import { readInstallProgress } from './lib/install-output.mjs';

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
 * Runs one command on the TV. Resolves with the exit code and everything it printed.
 * `onOutput` is called with the output so far each time more arrives; returning true
 * from it ends the command early.
 */
function runOnTv(command, { input = null, onOutput = () => false, timeoutMs = 30000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn('ssh', [...sshArguments, command], {
      stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    const collect = (chunk) => {
      output += chunk.toString();
      if (onOutput(output)) child.kill();
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    if (input) input.pipe(child.stdin);

    // "error" means ssh itself could not be started, most often because it is not installed.
    child.on('error', (error) => {
      clearTimeout(timer);
      if (error.code === 'ENOENT') {
        fail('The ssh command was not found on this computer. Install OpenSSH and try again.');
      }
      resolve({ code: -1, output: output + error.message, timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, output, timedOut });
    });
  });
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
const installRequest = JSON.stringify({
  id: 'com.ares.defaultName',
  ipkUrl: REMOTE_PACKAGE,
  subscribe: true,
});
const installed = await runOnTv(
  "luna-send -i -f luna://com.webos.appInstallService/dev/install '" + installRequest + "'",
  {
    onOutput: (output) => readInstallProgress(output) !== 'waiting',
    timeoutMs: INSTALL_TIMEOUT_MS,
  },
);
if (readInstallProgress(installed.output) !== 'installed') {
  console.error(installed.output.trim());
  fail(
    installed.timedOut
      ? 'The TV did not finish installing in time.'
      : 'The TV refused the install.',
  );
}

// 6. Launch
const launchRequest = JSON.stringify({ id: APP_ID });
const launched = await runOnTv(
  "luna-send -n 1 -f luna://com.webos.service.applicationManager/launch '" + launchRequest + "'",
);
if (!launched.output.replace(/\s+/g, '').includes('"returnValue":true')) {
  console.error(launched.output.trim());
  fail('Installed, but the TV would not launch the app.');
}
console.log('Installed and launched.');
