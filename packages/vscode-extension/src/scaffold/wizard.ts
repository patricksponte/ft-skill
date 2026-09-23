import * as vscode from 'vscode';
import { readAsset, writeFile, exists } from '../util/assets';
import { TARGETS, writeAgentFiles } from '../knowledge/agentFiles';
import { log } from '../util/log';

export type TemplateId = 'static' | 'node' | 'python';

interface TemplateSpec {
  id: TemplateId;
  label: string;
  detail: string;
  /** assetPath -> path inside the new project. */
  files: Record<string, string>;
  /** Where the Hello World lands: the servers serve public/ only. */
  page: string;
  next: (origin: string) => string[];
}

const TEMPLATES: TemplateSpec[] = [
  {
    id: 'static',
    label: '$(file-code) Static page',
    detail: 'HTML + JS only, no server. Host free on GitHub Pages.',
    files: { 'templates/static/index.html': 'index.html' },
    page: 'index.html',
    next: () => [
      'Run **FieldTwin: Preview Integration in Simulator** to test it without leaving the editor.',
      'To go live: publish the folder to GitHub Pages, then in FieldTwin go to Admin → Integrations → Create New Tab and paste the URL.',
    ],
  },
  {
    id: 'node',
    label: '$(server) Node.js',
    detail: 'Adds an Express server so you can install npm packages.',
    files: {
      'templates/node/index.html': 'public/index.html',
      'templates/node/server.js': 'server.js',
      'templates/node/package.json': 'package.json',
    },
    page: 'public/index.html',
    next: (origin) => [
      'Install dependencies: `npm install`',
      `Start the server: \`FIELDTWIN_ORIGINS=${origin} npm start\` (sends CSP \`frame-ancestors\` for your FieldTwin)`,
      'Then run **FieldTwin: Preview Integration in Simulator**.',
      'Add your backend logic in `server.js`; the page lives in `public/index.html`.',
    ],
  },
  {
    id: 'python',
    label: '$(snake) Python',
    detail: 'Adds a FastAPI server so you can install pip packages.',
    files: {
      'templates/python/index.html': 'public/index.html',
      'templates/python/app.py': 'app.py',
      'templates/python/requirements.txt': 'requirements.txt',
    },
    page: 'public/index.html',
    next: (origin) => [
      'Create a virtual environment: `python3 -m venv .venv && source .venv/bin/activate`',
      'Install dependencies: `pip install -r requirements.txt`',
      `Start the server: \`FIELDTWIN_ORIGINS=${origin} python app.py\` (sends CSP \`frame-ancestors\` for your FieldTwin)`,
      'Then run **FieldTwin: Preview Integration in Simulator**.',
      'Add your backend logic in `app.py`; the page lives in `public/index.html`.',
    ],
  },
];

/** The placeholder the Hello World ships with in ALLOWED_FIELDTWIN_ORIGINS. */
export const PLACEHOLDER_ORIGIN = 'https://fieldtwin.example';

/**
 * Reduce what the user pasted (often a full FieldTwin URL) to an exact
 * https origin, or undefined when it is not one. Mirrors create.sh.
 */
export function normalizeOrigin(input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

/** Put the user's FieldTwin origin into the Hello World allowlist. */
export function applyOrigin(page: string, origin: string): string {
  return page.replace(`      '${PLACEHOLDER_ORIGIN}',\n`, `      '${origin}',\n`);
}

const GITIGNORE = `node_modules/
.env
.env.local
__pycache__/
*.pyc
.venv/
.DS_Store
`;

export async function newIntegration(): Promise<void> {
  // ── name ──────────────────────────────────────────────────────────────
  const rawName = await vscode.window.showInputBox({
    title: 'New FieldTwin Integration (1/5)',
    prompt: 'What is this integration called?',
    placeHolder: 'e.g. Asset Inspector',
    ignoreFocusOut: true,
    validateInput: (v) =>
      v.trim().length === 0 ? 'A name is required.' : undefined,
  });
  if (!rawName) return;

  const folderName =
    rawName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'fieldtwin-integration';

  // ── location ──────────────────────────────────────────────────────────
  const picked = await vscode.window.showOpenDialog({
    title: 'Where should the project folder be created?',
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Create here',
    defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
  });
  if (!picked?.length) return;

  const root = vscode.Uri.joinPath(picked[0], folderName);
  if (await exists(root)) {
    const answer = await vscode.window.showWarningMessage(
      `"${folderName}" already exists. Add the integration files into it?`,
      { modal: true },
      'Add files',
    );
    if (answer !== 'Add files') return;
  }

  // ── template ──────────────────────────────────────────────────────────
  const templatePick = await vscode.window.showQuickPick(
    TEMPLATES.map((t) => ({ label: t.label, detail: t.detail, id: t.id })),
    {
      title: 'New FieldTwin Integration (2/5)',
      placeHolder: 'Choose a template — the Hello World frontend is the same for all three',
      ignoreFocusOut: true,
    },
  );
  if (!templatePick) return;
  const template = TEMPLATES.find((t) => t.id === templatePick.id)!;

  // ── FieldTwin origin ──────────────────────────────────────────────────
  // The secure bridge accepts `loaded` only from an exact allowlisted origin.
  const rawOrigin = await vscode.window.showInputBox({
    title: 'New FieldTwin Integration (3/5)',
    prompt:
      'Your FieldTwin address, e.g. https://yourcompany.fieldtwin.com. The integration only accepts messages from this exact origin. Leave empty to set it later.',
    placeHolder: 'https://yourcompany.fieldtwin.com',
    ignoreFocusOut: true,
    validateInput: (v) =>
      v.trim() === '' || normalizeOrigin(v) ? undefined : 'Enter an https:// address, e.g. https://yourcompany.fieldtwin.com',
  });
  if (rawOrigin === undefined) return;
  const origin = normalizeOrigin(rawOrigin);

  // ── AI tools ──────────────────────────────────────────────────────────
  const toolPicks = await vscode.window.showQuickPick(
    TARGETS.map((t) => ({
      label: t.label,
      detail: t.detail,
      id: t.id,
      picked: t.id === 'agents' || t.id === 'copilot',
    })),
    {
      title: 'New FieldTwin Integration (4/5)',
      placeHolder: 'Which AI assistants should know how to build FieldTwin integrations?',
      canPickMany: true,
      ignoreFocusOut: true,
    },
  );
  if (!toolPicks) return;

  // ── create ────────────────────────────────────────────────────────────
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Creating ${rawName}…` },
    async (progress) => {
      progress.report({ message: 'project files' });
      for (const [asset, dest] of Object.entries(template.files)) {
        let content = await readAsset(...asset.split('/'));
        if (dest === template.page && origin) content = applyOrigin(content, origin);
        await writeFile(vscode.Uri.joinPath(root, dest), content);
      }
      if (template.id !== 'static') {
        await writeFile(
          vscode.Uri.joinPath(root, '.env.example'),
          `FIELDTWIN_ORIGINS=${origin ?? 'https://yourcompany.fieldtwin.com'}\n`,
        );
      }

      await writeFile(
        vscode.Uri.joinPath(root, 'fieldtwin.config.json'),
        JSON.stringify({ name: rawName.trim(), version: '1.0.0', template: template.id }, null, 2) + '\n',
      );
      await writeFile(vscode.Uri.joinPath(root, '.gitignore'), GITIGNORE);

      progress.report({ message: 'AI agent files' });
      const result = await writeAgentFiles(root, toolPicks.map((p) => p.id), true);
      log.info(`Scaffolded ${root.fsPath}: ${result.written.length} files`);
    },
  );

  await showNextSteps(rawName.trim(), root, template, origin);

  // ── open ──────────────────────────────────────────────────────────────
  const openIn = await vscode.window.showInformationMessage(
    `${rawName.trim()} is ready.`,
    'Open in This Window',
    'Open in New Window',
  );
  if (openIn) {
    await vscode.commands.executeCommand('vscode.openFolder', root, {
      forceNewWindow: openIn === 'Open in New Window',
    });
  }
}

async function showNextSteps(
  name: string,
  root: vscode.Uri,
  template: TemplateSpec,
  origin: string | undefined,
): Promise<void> {
  const all = [
    ...(origin
      ? []
      : [`Edit \`ALLOWED_FIELDTWIN_ORIGINS\` at the top of \`${template.page}\`: replace \`${PLACEHOLDER_ORIGIN}\` with your FieldTwin address.`]),
    ...template.next(origin ?? '<your-fieldtwin-origin>'),
  ];
  const steps = all.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const content = `# ${name}

Created with the FieldTwin Integration Kit — template: \`${template.id}\`.

## Next steps

${steps}

## Where things are

| Path | What it is |
|---|---|
| \`${template.page}\` | The Hello World on the secure bridge, with a built-in connection troubleshooter. |
| \`.fieldtwin/fieldtwin-instructions.md\` | The complete integration guide your AI assistant reads. |
| \`.fieldtwin/api-reference.json\` | Every FieldTwin v1.10 REST route. |
| \`fieldtwin.config.json\` | Name, version and template of this integration. |

## Ask your AI assistant

> Show a list of every staged asset in the current subproject, and zoom to one when I click it.

In VS Code you can also type \`@fieldtwin\` in Copilot Chat, or reference
\`#fieldtwinDocs\` and \`#fieldtwinApi\` from any chat prompt.
`;
  await writeFile(vscode.Uri.joinPath(root, 'GETTING-STARTED.md'), content);
}
