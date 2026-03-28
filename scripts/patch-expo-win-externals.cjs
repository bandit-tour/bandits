/**
 * Windows: @expo/cli tapNodeShims uses Node builtin names as path segments.
 * Names like "node:sea" are invalid on NTFS (colon). Strip "node:" for disk paths
 * and pass the bare id to tapNodeShimContents so $$require_external('node:sea') stays correct.
 * Idempotent: safe to run on every postinstall.
 */
const fs = require('fs');
const path = require('path');

const MARKER = '/*__PATCH_EXPO_WIN_EXTERNALS__*/';

function findExternalsJs() {
  let cliPkgPath = null;
  try {
    cliPkgPath = require.resolve('@expo/cli/package.json');
  } catch {
    return null;
  }
  const cliRoot = path.dirname(cliPkgPath);
  const candidates = [
    path.join(cliRoot, 'build', 'src', 'start', 'server', 'metro', 'externals.js'),
    path.join(cliRoot, 'build', 'start', 'server', 'metro', 'externals.js'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function isPatched(src) {
  if (src.includes(MARKER)) return true;
  // Patched tapNodeShims uses bare ids for disk paths (avoids node:sea on Windows).
  return (
    src.includes('tapNodeShimContents(bareModuleId)') &&
    src.includes('METRO_EXTERNALS_FOLDER, bareModuleId')
  );
}

function patchExternalsJs(filePath) {
  let src = fs.readFileSync(filePath, 'utf8');
  if (isPatched(src)) {
    console.log('[patch-expo-win-externals] Already patched.');
    return;
  }

  // getNodeExternalModuleId: join METRO_EXTERNALS_FOLDER with bare module id (no "node:" in path)
  const getNodeA = `function getNodeExternalModuleId(fromModule, moduleId) {
    return _path.default.relative(_path.default.dirname(fromModule), _path.default.join(METRO_EXTERNALS_FOLDER, moduleId, "index.js"));
}`;
  const getNodeB = `function getNodeExternalModuleId(fromModule, moduleId) {
    const bareModuleId = typeof moduleId === "string" ? moduleId.replace(/^node:/, "") : moduleId;
    return _path.default.relative(_path.default.dirname(fromModule), _path.default.join(METRO_EXTERNALS_FOLDER, bareModuleId, "index.js"));
}`;
  if (!src.includes(getNodeA)) {
    console.warn('[patch-expo-win-externals] getNodeExternalModuleId block not found; skip (paths may still work if only tapNodeShims matter).');
  } else {
    src = src.replace(getNodeA, getNodeB);
  }

  // tapNodeShims loop: use bareModuleId for paths and shim contents
  const loopOld = `for (const moduleId of NODE_STDLIB_MODULES){
        const shimDir = _path.default.join(projectRoot, METRO_EXTERNALS_FOLDER, moduleId);
        const shimPath = _path.default.join(shimDir, "index.js");
        externals[moduleId] = shimPath;
        if (!_fs.default.existsSync(shimPath)) {
            await _fs.default.promises.mkdir(shimDir, {
                recursive: true
            });
            await _fs.default.promises.writeFile(shimPath, tapNodeShimContents(moduleId));
        }
    }`;

  const loopNew = `for (const moduleId of NODE_STDLIB_MODULES){
        const bareModuleId = typeof moduleId === "string" ? moduleId.replace(/^node:/, "") : moduleId;
        const shimDir = _path.default.join(projectRoot, METRO_EXTERNALS_FOLDER, bareModuleId);
        const shimPath = _path.default.join(shimDir, "index.js");
        externals[moduleId] = shimPath;
        if (!_fs.default.existsSync(shimPath)) {
            await _fs.default.promises.mkdir(shimDir, {
                recursive: true
            });
            await _fs.default.promises.writeFile(shimPath, tapNodeShimContents(bareModuleId));
        }
    }`;

  if (!src.includes(loopOld)) {
    console.error(
      '[patch-expo-win-externals] tapNodeShims loop pattern not found. @expo/cli layout may differ.',
    );
    process.exit(1);
  }

  src = src.replace(loopOld, loopNew);
  if (!src.startsWith(MARKER)) {
    src = MARKER + '\n' + src;
  }
  fs.writeFileSync(filePath, src, 'utf8');
  console.log('[patch-expo-win-externals] Patched:', filePath);
}

const main = findExternalsJs();
if (!main) {
  console.warn('[patch-expo-win-externals] externals.js not found; skip.');
  process.exit(0);
}

try {
  patchExternalsJs(main);
} catch (e) {
  console.error('[patch-expo-win-externals] Failed:', e);
  process.exit(1);
}
