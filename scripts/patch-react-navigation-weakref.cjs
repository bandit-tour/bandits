/**
 * Android (Hermes): ReferenceError: Property 'WeakRef' doesn't exist.
 * @react-navigation/core uses `new WeakRef(route.params)` in useNavigationBuilder.
 * When global WeakRef is missing, use a tiny { deref() } shim so the same
 * `consumedParams?.ref?.deref() === route.params` check still works.
 * When WeakRef exists (iOS JSC, modern Hermes), behavior is unchanged.
 * Idempotent: safe on every postinstall.
 */
const fs = require('fs');
const path = require('path');

const MARKER = '/*__PATCH_RN_WEAKREF_SHIM__*/';

const HELPER = `
${MARKER}
/**
 * Hermes on some Android builds has no WeakRef. @react-navigation/core uses WeakRef for param consumption tracking.
 * If WeakRef exists, use it (iOS / modern runtimes). Otherwise a minimal { deref } for the same identity check.
 */
function __rnCreateWeakRefLike(target) {
  if (typeof WeakRef !== 'undefined') {
    return new WeakRef(target);
  }
  return { deref: function () { return target; } };
}
`;

function patchFile(filePath) {
  let src = fs.readFileSync(filePath, 'utf8');
  if (src.includes(MARKER)) {
    console.log('[patch-react-navigation-weakref] Already patched:', filePath);
    return;
  }

  if (!src.includes('setConsumedParamsRef(new WeakRef(route.params))')) {
    console.warn(
      '[patch-react-navigation-weakref] Expected pattern not found; skipping (package version may differ).',
    );
    return;
  }

  const anchor = 'PrivateValueStore;\n';
  if (!src.includes(anchor)) {
    console.error('[patch-react-navigation-weakref] Anchor "PrivateValueStore;" not found.');
    process.exit(1);
  }

  src = src.replace(anchor, anchor + HELPER);

  src = src.replace(
    'setConsumedParamsRef(new WeakRef(route.params));',
    'setConsumedParamsRef(__rnCreateWeakRefLike(route.params));',
  );

  fs.writeFileSync(filePath, src, 'utf8');
  console.log('[patch-react-navigation-weakref] Patched:', filePath);
}

const main = path.join(
  __dirname,
  '..',
  'node_modules',
  '@react-navigation',
  'core',
  'lib',
  'module',
  'useNavigationBuilder.js',
);

if (!fs.existsSync(main)) {
  console.warn('[patch-react-navigation-weakref] useNavigationBuilder.js not found; skip.');
  process.exit(0);
}

try {
  patchFile(main);
} catch (e) {
  console.error('[patch-react-navigation-weakref] Failed:', e);
  process.exit(1);
}
