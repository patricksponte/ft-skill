import * as vscode from 'vscode';
import { readAsset, writeFile, exists, listAssetFiles } from '../util/assets';

/**
 * The reference material is written once, into `.fieldtwin/`, and every
 * AI tool's own config file points at it. Writing 1000+ lines of
 * instructions into eight different rule files would bloat the repo and
 * guarantee they drift apart on the next update.
 */
export const SHARED_DIR = '.fieldtwin';

export const SHARED_FILES = [
  'fieldtwin-instructions.md',
  'api-reference.json',
  'api-quick-reference.md',
] as const;

export interface AgentTarget {
  id: string;
  label: string;
  detail: string;
  /** Rule/config files this tool reads, relative to the workspace root. */
  build(): Promise<Array<{ path: string; content: string }>>;
  /** Files whose presence means the tool is set up, when build() is costly. */
  detect?: string[];
}

/** The FutureOn Agent Skills, bundled whole from ft-skill's skills/ folder. */
export const SKILLS = ['create-fieldtwin-integration', 'develop-fieldtwin-integration'] as const;

/**
 * Written by kit 0.1.0 before the official skills existed. Removed on update
 * only when it is still exactly our generated file, never a user's own skill.
 */
const LEGACY_SKILL = '.claude/skills/fieldtwin/SKILL.md';
const LEGACY_SKILL_HEAD = '---\nname: fieldtwin\ndescription: Build, debug and extend FieldTwin integrations';

const POINTER = [
  '> **Full reference.** The complete FieldTwin integration guide is in',
  `> \`${SHARED_DIR}/fieldtwin-instructions.md\`, the full endpoint list in`,
  `> \`${SHARED_DIR}/api-reference.json\`, and a compact cheat sheet in`,
  `> \`${SHARED_DIR}/api-quick-reference.md\`. Read them before writing integration code.`,
  '',
].join('\n');

async function platform(name: string): Promise<string> {
  const body = name === 'fieldtwin-instructions.md'
    ? await readAsset('knowledge', name)
    : await readAsset('knowledge', 'platforms', name);
  // The bundled platform files point at paths from the old shell installer.
  const rewritten = body
    .replace(/`fieldtwin-instructions\.md`/g, `\`${SHARED_DIR}/fieldtwin-instructions.md\``)
    .replace(/`api-reference\.json`/g, `\`${SHARED_DIR}/api-reference.json\``)
    .replace(/`api-quick-reference\.md`/g, `\`${SHARED_DIR}/api-quick-reference.md\``)
    .replace(/`skills\/create-fieldtwin-integration\/assets\/hello-world\/index\.html`/g, '`index.html`');
  return rewritten;
}

function frontmatter(fields: Record<string, string>): string {
  const lines = Object.entries(fields).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join('\n')}\n---\n\n`;
}

export const TARGETS: AgentTarget[] = [
  {
    id: 'agents',
    label: 'AGENTS.md',
    detail: 'Open standard — read by Copilot, Cursor, Codex, Claude Code, Zed, Jules and others',
    async build() {
      const body = await platform('fieldtwin-instructions.md');
      return [{ path: 'AGENTS.md', content: POINTER + body }];
    },
  },
  {
    id: 'copilot',
    label: 'GitHub Copilot',
    detail: '.github/copilot-instructions.md + a scoped .instructions.md file',
    async build() {
      const body = await platform('copilot-instructions.md');
      return [
        { path: '.github/copilot-instructions.md', content: POINTER + body },
        {
          path: '.github/instructions/fieldtwin.instructions.md',
          content:
            frontmatter({ applyTo: "'**/*.{js,ts,jsx,tsx,html,py}'" }) +
            POINTER +
            body,
        },
      ];
    },
  },
  {
    id: 'claude',
    label: 'Claude Code',
    detail: `.claude/skills/ — the official FutureOn Agent Skills (${SKILLS.join(', ')})`,
    detect: [...SKILLS.map((name) => `.claude/skills/${name}/SKILL.md`), LEGACY_SKILL],
    async build() {
      // Copied whole: SKILL.md stays small and loads its references and
      // searchable catalogs only when a task needs them.
      const files: Array<{ path: string; content: string }> = [];
      for (const name of SKILLS) {
        for (const rel of await listAssetFiles('skills', name)) {
          files.push({
            path: `.claude/skills/${name}/${rel}`,
            content: await readAsset('skills', name, ...rel.split('/')),
          });
        }
      }
      return files;
    },
  },
  {
    id: 'cursor',
    label: 'Cursor / Windsurf',
    detail: '.cursor/rules/fieldtwin.mdc + .windsurf/rules/fieldtwin.md',
    async build() {
      const body = await platform('cursorrules.md');
      return [
        {
          path: '.cursor/rules/fieldtwin.mdc',
          content:
            frontmatter({
              description: 'FieldTwin integration development',
              globs: '**/*.{js,ts,jsx,tsx,html,py}',
              alwaysApply: 'false',
            }) +
            POINTER +
            body,
        },
        { path: '.windsurf/rules/fieldtwin.md', content: POINTER + body },
      ];
    },
  },
  {
    id: 'cline',
    label: 'Cline / Roo Code',
    detail: '.clinerules/fieldtwin.md',
    async build() {
      const body = await platform('fieldtwin-instructions.md');
      return [{ path: '.clinerules/fieldtwin.md', content: POINTER + body }];
    },
  },
  {
    id: 'continue',
    label: 'Continue',
    detail: '.continue/rules/fieldtwin.md',
    async build() {
      const body = await platform('fieldtwin-instructions.md');
      return [{ path: '.continue/rules/fieldtwin.md', content: POINTER + body }];
    },
  },
  {
    id: 'gemini',
    label: 'Gemini CLI / Antigravity',
    detail: 'GEMINI.md + .antigravity.md',
    async build() {
      const gemini = await platform('gemini-cli.md');
      const anti = await platform('antigravity.md');
      return [
        { path: 'GEMINI.md', content: POINTER + gemini },
        { path: '.antigravity.md', content: POINTER + anti },
      ];
    },
  },
  {
    id: 'aider',
    label: 'Aider',
    detail: 'CONVENTIONS.md',
    async build() {
      const body = await platform('fieldtwin-instructions.md');
      return [{ path: 'CONVENTIONS.md', content: POINTER + body }];
    },
  },
];

export interface WriteResult {
  written: string[];
  skipped: string[];
  /** Superseded files the kit generated itself, deleted on update. */
  removed: string[];
}

/**
 * @param overwrite when false, existing files are left untouched and reported
 *                  as skipped — so a user's hand-edited rules survive an update.
 */
export async function writeAgentFiles(
  root: vscode.Uri,
  targetIds: string[],
  overwrite: boolean,
): Promise<WriteResult> {
  const written: string[] = [];
  const skipped: string[] = [];
  const removed: string[] = [];

  for (const name of SHARED_FILES) {
    const dest = vscode.Uri.joinPath(root, SHARED_DIR, name);
    await writeFile(dest, await readAsset('knowledge', name));
    written.push(`${SHARED_DIR}/${name}`);
  }

  for (const target of TARGETS.filter((t) => targetIds.includes(t.id))) {
    for (const file of await target.build()) {
      const dest = vscode.Uri.joinPath(root, file.path);
      if (!overwrite && (await exists(dest))) {
        skipped.push(file.path);
        continue;
      }
      await writeFile(dest, file.content);
      written.push(file.path);
    }
  }

  if (overwrite && targetIds.includes('claude')) {
    const legacy = vscode.Uri.joinPath(root, LEGACY_SKILL);
    if ((await exists(legacy)) && (await readText(legacy)).startsWith(LEGACY_SKILL_HEAD)) {
      await vscode.workspace.fs.delete(legacy);
      removed.push(LEGACY_SKILL);
    }
  }

  return { written, skipped, removed };
}

/** Which tools already have their files in this workspace. */
export async function detectTargets(root: vscode.Uri): Promise<string[]> {
  const found: string[] = [];
  for (const target of TARGETS) {
    const paths = target.detect ?? (await target.build()).map((f) => f.path);
    for (const file of paths) {
      if (await exists(vscode.Uri.joinPath(root, file))) {
        found.push(target.id);
        break;
      }
    }
  }
  return found;
}

async function readText(uri: vscode.Uri): Promise<string> {
  return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
}
