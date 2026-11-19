#!/usr/bin/env node
/* patch_dsh_citations.mjs — keep file names cited in answers opening in the sidebar.
 *
 * DSH's chat renders an inline-code path in an answer as a clickable link, but
 * a path declared with the `present` tool is routed to the OS default app:
 * @deepseek-ai/dsh-client-ui-deliverables' chatFileMentions resolver calls the
 * native opener instead of the chat view's own opener. The patch below routes
 * that click through the sidebar first and keeps the OS launch only as a
 * fallback, so a citation behaves the same whether the file was written or
 * declared. The delivered-file card and its chevron menu are untouched.
 *
 * The package lives in DSH's own install, not in this repository, so a
 * `dsh update` or a plugin reinstall restores the published file and silently
 * undoes the patch. Run this afterwards; it is idempotent, finds every
 * installed copy, validates the result with node:vm before replacing anything,
 * and leaves the rest of the file byte-identical.
 *
 * Adding a future patch: append one entry to PATCHES. Do not edit `from`
 * strings in place — they are matched literally and must stay unique.
 *
 * Run:
 *   node tools/patch_dsh_citations.mjs            apply (idempotent)
 *   npm run patch:dsh                             the same, via package.json
 *   node tools/patch_dsh_citations.mjs --check    report only, exit 1 if unpatched
 *   node tools/patch_dsh_citations.mjs --revert   restore the published behaviour
 *   node tools/patch_dsh_citations.mjs --root DIR install to scan instead of the default
 *
 * After the script changes anything, reload the GUI (Ctrl+R) so the browser
 * fetches the patched client bundle.
 */
import { existsSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import vm from 'node:vm';

/** The one installed file this script maintains. */
const PKG_DIR = join('@deepseek-ai', 'dsh-client-ui-deliverables');
const ENTRY = join('lib', 'client.js');

/** The patches, applied in order. `from` must occur exactly once in the file. */
const PATCHES = [
  {
    id: 'mention-sidebar',
    what: 'a cited file opens in the sidebar instead of the OS default app',
    from: 'else opener.open(sessionId, file.seq, file.index);',
    to: 'else Promise.resolve(owner.openFile(path)).catch(() => { opener.open(sessionId, file.seq, file.index); });',
  },
];

const USAGE = 'usage: node tools/patch_dsh_citations.mjs [--check | --revert] [--root <dir>]';

/* ------------------------------------------------------------------ discovery */

/** Whether a path is a directory (symlinks and junctions included). */
function isDir(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** Where DSH installs live when no --root is given: the platform's global prefix. */
function defaultRoots() {
  const roots = [];
  if (process.platform === 'win32') {
    if (process.env.LOCALAPPDATA) roots.push(join(process.env.LOCALAPPDATA, 'pnpm', 'global'));
    if (process.env.APPDATA) roots.push(join(process.env.APPDATA, 'pnpm', 'global'));
    if (process.env.PNPM_HOME_DIR) roots.push(process.env.PNPM_HOME_DIR);
  } else {
    const home = homedir();
    roots.push(join(home, '.local', 'share', 'pnpm', 'global'));
    roots.push(join(home, 'Library', 'pnpm', 'global'));
    roots.push(join(home, '.pnpm-global'));
  }
  return roots;
}

/**
 * Every `node_modules` that holds a `client.js` for the package, deduped by the
 * real file it resolves to. Both layouts a pnpm global install can produce are
 * covered, plus the flat npm/yarn layout; `.pnpm` itself is never descended.
 * @param {string} root install root to scan.
 * @returns {string[]} candidate `lib/client.js` paths.
 */
function findEntries(root) {
  const found = new Set();
  const add = (path) => {
    // The entry itself must exist: a package dir with no built client half is
    // not an install to patch, and reading it would only throw later.
    if (!existsSync(join(path, PKG_DIR, ENTRY))) return;
    found.add(join(path, PKG_DIR, ENTRY));
  };
  const inNodeModules = (nm, depth) => {
    add(nm);
    let entries;
    try {
      entries = readdirSync(nm, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const child = join(nm, entry.name);
      if (entry.name === '.pnpm') {
        // <nm>/.pnpm/<pkg>@<version>/node_modules/@deepseek-ai/... (flat store copy)
        for (const store of safeReaddir(child)) {
          add(join(child, store, 'node_modules'));
          // .../dsh-web-app/node_modules/@deepseek-ai/... (nested, the served copy)
          if (store.startsWith('@deepseek-ai+dsh-web-app@')) {
            add(join(child, store, 'node_modules', '@deepseek-ai', 'dsh-web-app', 'node_modules'));
          }
        }
        continue;
      }
      if (depth <= 5) inNodeModules(join(child, 'node_modules'), depth + 1);
    }
  };
  const walk = (dir, depth) => {
    if (depth > 5) return;
    for (const entry of safeReaddir(dir, true)) {
      if (!entry.isDirectory()) continue;
      const child = join(dir, entry.name);
      if (entry.name === 'node_modules') {
        inNodeModules(child, depth);
        continue;
      }
      if (entry.name === '.git' || entry.name === '.cache' || entry.name === 'src') continue;
      walk(child, depth + 1);
    }
  };
  if (isDir(root)) walk(root, 0);
  return [...found].map((path) => {
    try {
      return realpathSync(path);
    } catch {
      return path;
    }
  }).filter((path, index, all) => all.indexOf(path) === index);
}

/** `readdirSync` that yields [] instead of throwing. */
function safeReaddir(dir, withTypes = false) {
  try {
    return readdirSync(dir, withTypes ? { withFileTypes: true } : undefined);
  } catch {
    return [];
  }
}

/* ---------------------------------------------------------------------- patch */

/** Whether the text parses as a classic script; used as a pre-write guard. */
function parses(text) {
  try {
    new vm.Script(text);
    return true;
  } catch {
    return false;
  }
}

/** Count non-overlapping occurrences of a literal needle. */
function countOf(haystack, needle) {
  return haystack.split(needle).length - 1;
}

/** Read one install and classify it against every patch. */
function inspect(file) {
  let source;
  try {
    source = readFileSync(file, 'utf8');
  } catch (error) {
    return { file, source: '', states: PATCHES.map(() => 'unreadable'), error };
  }
  const states = PATCHES.map((patch) => {
    if (countOf(source, patch.to) > 0) return 'applied';
    const fromCount = countOf(source, patch.from);
    return fromCount === 1 ? 'pending' : fromCount === 0 ? 'drift' : 'ambiguous';
  });
  return { file, source, states };
}

/** Apply or undo every patch in memory; returns the new text or null on no change. */
function transform(source, states, revert) {
  let next = source;
  for (const [index, patch] of PATCHES.entries()) {
    const state = states[index];
    if (revert && state === 'applied') next = next.replace(patch.to, patch.from);
    else if (!revert && state === 'pending') next = next.replace(patch.from, patch.to);
  }
  return next === source ? null : next;
}

/** Replace one file by a sibling temp file, so a hardlinked store copy stays intact. */
function writeAtomic(file, text) {
  const tmp = `${file}.dsh-patch-${process.pid}.tmp`;
  writeFileSync(tmp, text, 'utf8');
  try {
    renameSync(tmp, file);
  } catch (error) {
    try {
      rmSync(tmp, { force: true });
    } catch {
      /* the temp file is best-effort cleanup */
    }
    throw error;
  }
}

/* ----------------------------------------------------------------------- main */

function main(argv) {
  let check = false;
  let revert = false;
  let root;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') check = true;
    else if (arg === '--revert') revert = true;
    else if (arg === '--root') {
      root = argv[(index += 1)];
      if (root === undefined) {
        console.error(`  x --root needs a directory\n${USAGE}`);
        return 2;
      }
    } else if (arg === '--help' || arg === '-h') {
      console.log(USAGE);
      return 0;
    } else {
      console.error(`  x unknown argument "${arg}"\n${USAGE}`);
      return 2;
    }
  }

  if (check && revert) {
    console.error(`  x --check and --revert are exclusive\n${USAGE}`);
    return 2;
  }

  const roots = root === undefined ? defaultRoots().filter(isDir) : [resolve(root)];
  if (roots.length === 0) {
    console.error('  x no DSH install found. Pass --root <dir> naming the pnpm global prefix.');
    return 1;
  }

  const files = [...new Set(roots.flatMap(findEntries))];
  if (files.length === 0) {
    console.error(`  x ${ENTRY} for ${PKG_DIR} is not installed under:\n      ${roots.join('\n      ')}`);
    console.error('    DSH may have changed the layout; pass --root or update this script.');
    return 1;
  }

  let failed = false;
  let changed = 0;
  console.log(`found ${files.length} install${files.length === 1 ? '' : 's'}`);
  for (const file of files) {
    const { source, states, error } = inspect(file);
    const label = states.map((state, index) => `${PATCHES[index].id}: ${state}`).join(', ');

    if (states.includes('unreadable')) {
      failed = true;
      console.error(`  x ${file}`);
      console.error(`    cannot read this install (${error instanceof Error ? error.message : String(error)})`);
      continue;
    }

    if (states.includes('drift') || states.includes('ambiguous')) {
      failed = true;
      const which = PATCHES.filter((_, index) => states[index] === 'drift' || states[index] === 'ambiguous');
      console.error(`  x ${file}`);
      console.error(`    ${label}`);
      console.error(`    could not locate the published line for: ${which.map((patch) => patch.id).join(', ')}`);
      console.error('    the package changed upstream — update PATCHES in this script.');
      continue;
    }

    if (check) {
      const unpatched = states.includes('pending') || (revert && states.includes('applied'));
      if (unpatched) failed = true;
      console.log(`  ${unpatched ? '!' : 'ok'} ${file}`);
      console.log(`    ${label}`);
      continue;
    }

    const next = transform(source, states, revert);
    if (next === null) {
      console.log(`  = ${file}`);
      console.log(`    ${label} (nothing to do)`);
      continue;
    }
    if (parses(source) && !parses(next)) {
      failed = true;
      console.error(`  x ${file}`);
      console.error('    the patched text does not parse; nothing was written.');
      continue;
    }

    try {
      writeAtomic(file, next);
    } catch (error) {
      failed = true;
      console.error(`  x ${file}`);
      console.error(`    ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    changed += 1;
    console.log(`  ${revert ? '-' : '+'} ${file}`);
    console.log(`    ${label}`);
  }

  if (failed) return 1;
  if (check) {
    console.log(revert ? 'all installs are unpatched' : 'all installs are patched');
    return 0;
  }
  if (changed === 0) {
    console.log('nothing to do — every install already matches the requested state');
    return 0;
  }
  console.log(`${revert ? 'reverted' : 'patched'} ${changed} install${changed === 1 ? '' : 's'}`);
  console.log('reload the GUI (Ctrl+R) so the browser fetches the new client bundle');
  return 0;
}

process.exitCode = main(process.argv.slice(2));
