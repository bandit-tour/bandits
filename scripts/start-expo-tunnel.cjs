const { spawn, execSync } = require('child_process');

const PORT = process.env.EXPO_METRO_PORT || '8081';

function freePort(port) {
  if (process.platform !== 'win32') return;
  try {
    execSync(
      `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
      { stdio: 'ignore' }
    );
  } catch {
    // ignore
  }
}

freePort(PORT);
console.log(`[start-expo-tunnel] Starting Expo on port ${PORT} with tunnel…`);
console.log('[start-expo-tunnel] If tunnel fails with "remote gone away", wait 30s and run again.');
console.log('[start-expo-tunnel] Also close other Metro/Expo terminals and disable VPN on PC + iPhone.');
console.log('[start-expo-tunnel] LAN fallback for iPhone: npm start  (then allow Node in Windows Firewall).');

const args = [
  'expo',
  'start',
  '--tunnel',
  '--clear',
  '--go',
  '--port',
  PORT,
  ...process.argv.slice(2),
];

const child = spawn('npx', args, {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});

child.on('exit', (code) => process.exit(code ?? 0));
