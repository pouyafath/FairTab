import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Checks that every database function the app calls exists in supabase/migrations, is callable by
// signed-in users, and gets exactly the parameter names it expects. A typo here would only show up
// as an error in the running app, so catch it in the tests instead.

const root = join(__dirname, '..', '..');
const migrationsDir = join(root, 'supabase', 'migrations');
const sql = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), 'utf8'))
  .join('\n')
  .replace(/--[^\n]*/g, ''); // comments could otherwise look like statements

/** The text between the bracket at `open` and its matching closing bracket. */
function block(text: string, open: number): string {
  const [opening, closing] = text[open] === '(' ? ['(', ')'] : ['{', '}'];
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === opening) depth++;
    if (text[i] === closing && --depth === 0) return text.slice(open + 1, i);
  }
  throw new Error(`Unbalanced ${opening} at ${open}`);
}

function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

interface SqlFunction {
  params: { name: string; optional: boolean }[];
}

/** The latest definition of each function, in migration order. */
const functions = new Map<string, SqlFunction>();
/** Functions defined with different parameter lists and never dropped: Postgres keeps both (overloads). */
const overloaded = new Set<string>();
for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)\s*\(/gi)) {
  const open = m.index! + m[0].length - 1;
  const params = splitTopLevel(block(sql, open)).map((p) => ({
    name: p.split(/\s+/)[0],
    optional: /\bdefault\b/i.test(p),
  }));
  const previous = functions.get(m[1]);
  const dropped = new RegExp(`drop\\s+function\\s+(if\\s+exists\\s+)?public\\.${m[1]}\\b`, 'i').test(sql);
  if (previous && previous.params.map((p) => p.name).join() !== params.map((p) => p.name).join() && !dropped) {
    overloaded.add(m[1]);
  }
  functions.set(m[1], { params });
}

/** Which functions signed-in users may call, following the revoke/grant statements in order. */
const callable = new Set<string>();
for (const m of sql.matchAll(/\b(revoke|grant)\s+execute\s+on\s+(all\s+functions\s+in\s+schema\s+public|function\s+[\s\S]*?)\s+(from|to)\s+([^;]+);/gi)) {
  const [, action, target, , roles] = m;
  if (!/\bauthenticated\b/i.test(roles)) continue;
  const names = /^all\s+functions/i.test(target)
    ? [...functions.keys()]
    : [...target.matchAll(/public\.(\w+)\s*\(/gi)].map((n) => n[1]);
  for (const name of names) {
    if (action.toLowerCase() === 'grant') callable.add(name);
    else callable.delete(name);
  }
}

interface AppCall {
  where: string;
  fn: string;
  keys: { name: string; optional: boolean }[];
}

function keysOf(typeBody: string) {
  return [...typeBody.matchAll(/^\s*(p_\w+)(\?)?\s*:/gm)].map((k) => ({ name: k[1], optional: !!k[2] }));
}

const calls: AppCall[] = [];
const queries = readFileSync(join(root, 'src', 'lib', 'queries.ts'), 'utf8');
const namedTypes = new Map<string, string>();
for (const m of queries.matchAll(/(?:interface\s+(\w+)\s+extends\s+Record<string,\s*unknown>|type\s+(\w+)\s*=)\s*\{/g)) {
  namedTypes.set(m[1] ?? m[2], block(queries, m.index! + m[0].length - 1));
}
/** Calls that could not be read: the test fails on them instead of silently skipping them. */
const unreadable: string[] = [];
for (const m of queries.matchAll(/useRpc<\s*(\{|\w+)/g)) {
  if (m[1] === 'A') continue; // the useRpc definition itself
  const typeBody = m[1] === '{' ? block(queries, m.index! + m[0].length - 1) : namedTypes.get(m[1]);
  // The function name is the string right after the generic: useRpc<...>('name') (maybe on its own line).
  const fn = /^useRpc<[\s\S]*?>\(\s*['"](\w+)['"]\s*,?\s*\)/.exec(queries.slice(m.index!))?.[1];
  if (!fn || typeBody === undefined) {
    unreadable.push(queries.slice(m.index!, m.index! + 80));
    continue;
  }
  // Object type literals in one line ("{ p_a: string; p_b: number }") need splitting on ';'.
  calls.push({ where: `queries.ts useRpc('${fn}')`, fn, keys: keysOf(typeBody.replace(/;/g, ';\n')) });
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sourceFiles(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
  );
}
for (const file of sourceFiles(join(root, 'src'))) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/supabase\.rpc\(/g)) {
    const call = /^supabase\.rpc\(\s*['"](\w+)['"]\s*(?:,\s*\{|\))/.exec(text.slice(m.index!));
    if (!call) {
      // useRpc's own generic call (supabase.rpc(fn, args)) is checked through the useRpc calls above.
      if (!/^supabase\.rpc\(fn, args\)/.test(text.slice(m.index!))) unreadable.push(`${file}: ${text.slice(m.index!, m.index! + 60)}`);
      continue;
    }
    const body = call[0].endsWith('{') ? block(text, m.index! + call[0].length - 1) : '';
    const keys = [...body.matchAll(/(p_\w+)\s*:/g)].map((k) => ({ name: k[1], optional: false }));
    calls.push({ where: `${file.slice(root.length + 1)} rpc('${call[1]}')`, fn: call[1], keys });
  }
}

describe('app ↔ database functions', () => {
  it('found the calls and functions to check', () => {
    expect(calls.length).toBeGreaterThan(15);
    expect(functions.size).toBeGreaterThan(15);
    expect(unreadable, 'calls this test cannot read; write them like the others').toEqual([]);
  });

  it.each(calls.map((c) => [c.where, c] as const))('%s matches the SQL function', (_where, call) => {
    const fn = functions.get(call.fn);
    expect(fn, `public.${call.fn} is not defined in supabase/migrations`).toBeDefined();
    expect(callable.has(call.fn), `public.${call.fn} is not granted to authenticated`).toBe(true);
    expect(overloaded.has(call.fn), `public.${call.fn} has two versions with different parameters; drop the old one`).toBe(false);
    const params = new Set(fn!.params.map((p) => p.name));
    for (const key of call.keys) {
      expect(params.has(key.name), `public.${call.fn} has no parameter ${key.name}`).toBe(true);
    }
    for (const p of fn!.params.filter((p) => !p.optional)) {
      const key = call.keys.find((k) => k.name === p.name);
      expect(key && !key.optional, `public.${call.fn} needs ${p.name}, which the app may leave out`).toBe(true);
    }
  });

  it('only reads tables that exist', () => {
    const tables = new Set([...sql.matchAll(/create\s+table\s+public\.(\w+)/gi)].map((m) => m[1]));
    for (const file of sourceFiles(join(root, 'src'))) {
      for (const m of readFileSync(file, 'utf8').matchAll(/\.from\(\s*'(\w+)'\s*\)/g)) {
        expect(tables.has(m[1]), `${file}: table ${m[1]} does not exist`).toBe(true);
      }
    }
  });
});
