const { networkInterfaces } = require('os');
const { spawn } = require('child_process');

function getLanIp() {
  const nets = networkInterfaces();
  const preferred = [];
  const fallback = [];

  for (const entries of Object.values(nets)) {
    for (const net of entries || []) {
      if (!net || net.internal || net.family !== 'IPv4') continue;
      if (net.address.startsWith('192.168.') || net.address.startsWith('10.')) {
        preferred.push(net.address);
      } else if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(net.address)) {
        preferred.push(net.address);
      } else {
        fallback.push(net.address);
      }
    }
  }

  return preferred[0] || fallback[0] || null;
}

const lanIp = getLanIp();
if (!lanIp) {
  console.error('[start-expo-lan] No LAN IPv4 address found.');
  process.exit(1);
}

const env = {
  ...process.env,
  REACT_NATIVE_PACKAGER_HOSTNAME: lanIp,
};

const args = ['expo', 'start', '--clear', '--go', '--host', 'lan', '--port', '8081', ...process.argv.slice(2)];
console.log(`[start-expo-lan] Using LAN IP ${lanIp}`);

const cmd = 'npx';
const child = spawn(cmd, args, {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});

child.on('exit', (code) => process.exit(code ?? 0));
