const ROOT = process.cwd();
import { initAssets } from '../src/util/assets';
import { writeAgentFiles, detectTargets, TARGETS, SHARED_DIR, SKILLS } from '../src/knowledge/agentFiles';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

(async () => {
  initAssets({ extensionUri: { fsPath: ROOT } } as never);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ftagent-'));
  const root = { fsPath: dir } as never;

  const checks: Array<[string, boolean, string]> = [];
  const ok = (n: string, c: boolean, note = '') => checks.push([n, c, note]);
  const read = (p: string) => fs.readFileSync(path.join(dir, p), 'utf8');
  const has = (p: string) => fs.existsSync(path.join(dir, p));

  const all = TARGETS.map(t => t.id);
  const result = await writeAgentFiles(root, all, true);

  // Shared reference, written once.
  ok('shared instructions written', has(`${SHARED_DIR}/fieldtwin-instructions.md`));
  ok('shared api reference written', has(`${SHARED_DIR}/api-reference.json`));
  ok('shared api reference is valid JSON',
     (() => { try { JSON.parse(read(`${SHARED_DIR}/api-reference.json`)); return true; } catch { return false; } })());

  // Claude Code: the official FutureOn Agent Skills, copied whole.
  for (const name of SKILLS) {
    const skillPath = `.claude/skills/${name}/SKILL.md`;
    const skill = has(skillPath) ? read(skillPath) : '';
    ok(`${name} installed at the discoverable path`, has(skillPath));
    ok(`${name} keeps its frontmatter name`, new RegExp(`^name:\\s*${name}$`, 'm').test(skill), skill.slice(0, 80));
    ok(`${name} has a description`, /^description:\s*\S/m.test(skill));
    ok(`${name} is byte-identical to the bundled skill`,
       skill === fs.readFileSync(path.join(ROOT, 'assets', 'skills', name, 'SKILL.md'), 'utf8'));
  }
  ok('develop skill references come along',
     has('.claude/skills/develop-fieldtwin-integration/references/message-catalog.md'));
  ok('develop skill catalogs and query scripts come along',
     has('.claude/skills/develop-fieldtwin-integration/references/api-attributes-v1.10.json') &&
     has('.claude/skills/develop-fieldtwin-integration/scripts/query-api-attributes.py'));
  ok('create skill Hello World comes along',
     has('.claude/skills/create-fieldtwin-integration/assets/hello-world/index.html'));
  ok('no generated fieldtwin skill any more', !has('.claude/skills/fieldtwin/SKILL.md'));
  ok('not the flat file the old installer wrote', !has('.claude/skills/fieldtwin.md'));

  // Copilot
  ok('copilot instructions written', has('.github/copilot-instructions.md'));
  ok('copilot scoped instructions written', has('.github/instructions/fieldtwin.instructions.md'));
  ok('scoped file has applyTo', read('.github/instructions/fieldtwin.instructions.md').includes('applyTo:'));

  // Others
  ok('AGENTS.md written', has('AGENTS.md'));
  ok('cursor mdc written', has('.cursor/rules/fieldtwin.mdc'));
  ok('windsurf rule written', has('.windsurf/rules/fieldtwin.md'));
  ok('cline rule written', has('.clinerules/fieldtwin.md'));
  ok('continue rule written', has('.continue/rules/fieldtwin.md'));
  ok('GEMINI.md written', has('GEMINI.md'));
  ok('CONVENTIONS.md written', has('CONVENTIONS.md'));

  // Pointers must be rewritten to the shared folder, not the installer's flat paths.
  const agents = read('AGENTS.md');
  ok('pointer references the shared folder', agents.includes(`${SHARED_DIR}/fieldtwin-instructions.md`));
  ok('no bare fieldtwin-instructions.md reference left',
     !/`fieldtwin-instructions\.md`/.test(agents));
  ok('AGENTS.md carries the single-file guide, not the legacy command',
     agents.includes('# FieldTwin Integration Guide') && !agents.includes('legacy single-file command'));
  ok('Hello World path points at the project page', !agents.includes('assets/hello-world/index.html'));
  ok('copilot file teaches the secure bridge',
     read('.github/copilot-instructions.md').includes("Never use `'*'`"));

  ok('every written file actually exists', result.written.every(p => has(p)),
     result.written.filter(p => !has(p)).join(','));
  ok('nothing skipped on a fresh write', result.skipped.length === 0, result.skipped.join(','));

  // detectTargets
  const detected = await detectTargets(root);
  ok('detectTargets finds every target', all.every(id => detected.includes(id)),
     `missing: ${all.filter(id => !detected.includes(id)).join(',')}`);

  // overwrite=false must preserve hand edits
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'MY HAND EDITS');
  const second = await writeAgentFiles(root, ['agents'], false);
  ok('existing rule file preserved when not overwriting', read('AGENTS.md') === 'MY HAND EDITS');
  ok('preserved file reported as skipped', second.skipped.includes('AGENTS.md'), second.skipped.join(','));

  const third = await writeAgentFiles(root, ['agents'], true);
  ok('overwrite replaces the file', read('AGENTS.md') !== 'MY HAND EDITS');
  ok('overwrite reports it as written', third.written.includes('AGENTS.md'));

  // Upgrading from 0.1.0: our generated skill is replaced, a user's own is kept.
  const legacy = path.join(dir, '.claude/skills/fieldtwin/SKILL.md');
  fs.mkdirSync(path.dirname(legacy), { recursive: true });
  fs.writeFileSync(legacy, '---\nname: fieldtwin\ndescription: Build, debug and extend FieldTwin integrations — old\n---\n\nbody');
  ok('detectTargets recognises a 0.1.0 Claude install',
     await (async () => { fs.rmSync(path.join(dir, '.claude/skills/develop-fieldtwin-integration'), { recursive: true });
       fs.rmSync(path.join(dir, '.claude/skills/create-fieldtwin-integration'), { recursive: true });
       return (await detectTargets(root)).includes('claude'); })());
  const upgrade = await writeAgentFiles(root, ['claude'], true);
  ok('update removes the kit-generated 0.1.0 skill', !fs.existsSync(legacy) && upgrade.removed.includes('.claude/skills/fieldtwin/SKILL.md'));

  fs.mkdirSync(path.dirname(legacy), { recursive: true });
  fs.writeFileSync(legacy, '---\nname: fieldtwin\ndescription: my own notes\n---\n');
  const mine = await writeAgentFiles(root, ['claude'], true);
  ok('a user-written fieldtwin skill is never deleted', fs.existsSync(legacy) && mine.removed.length === 0);

  let failed = 0;
  for (const [n, c, note] of checks) {
    console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${c || !note ? '' : `\n        ${note}`}`);
    if (!c) failed++;
  }
  console.log(`\n${checks.length - failed}/${checks.length} passed`);
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
})();
