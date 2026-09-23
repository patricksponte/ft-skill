import * as vscode from 'vscode';
import { settings, token } from '../util/config';
import { writeFile } from '../util/assets';
import { log } from '../util/log';

const PROVIDER_ID = 'fieldtwin.mcp';

/** The bundled, dependency-free build produced by `npm run build:mcp`. */
function serverPath(context: vscode.ExtensionContext): vscode.Uri {
  return vscode.Uri.joinPath(context.extensionUri, 'out', 'mcp', 'index.mjs');
}

/**
 * VS Code runs on Electron, whose binary doubles as a Node runtime when
 * ELECTRON_RUN_AS_NODE is set. Launching the server through it means the
 * kit works even for users who have no Node installed on PATH — which is
 * the common case for the engineers this extension targets.
 */
function launcher(context: vscode.ExtensionContext) {
  return {
    command: process.execPath,
    args: [serverPath(context).fsPath],
    baseEnv: { ELECTRON_RUN_AS_NODE: '1' } as Record<string, string>,
  };
}

function serverEnv(apiToken: string): Record<string, string> {
  const s = settings();
  return {
    FIELDTWIN_BACKEND_URL: s.backendUrl,
    FIELDTWIN_API_TOKEN: apiToken,
    FIELDTWIN_PROJECT_ID: s.projectId,
    FIELDTWIN_SUBPROJECT_ID: s.subProjectId,
    // The server refuses POST/PATCH/DELETE unless this is exactly "true".
    FIELDTWIN_MCP_ALLOW_WRITES: String(s.mcpAllowWrites),
  };
}

export function registerMcp(context: vscode.ExtensionContext): void {
  const lm = vscode.lm as unknown as {
    registerMcpServerDefinitionProvider?: (id: string, provider: object) => vscode.Disposable;
  };

  if (typeof lm.registerMcpServerDefinitionProvider !== 'function') {
    // Cursor, Windsurf and older VS Code builds lag behind on this API.
    log.warn('MCP provider API unavailable in this editor — use "FieldTwin: Write MCP config" instead.');
    return;
  }

  const changed = new vscode.EventEmitter<void>();
  context.subscriptions.push(changed);

  // Settings feed the server's environment, so a change means the
  // definition is stale and the editor should ask for it again.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('fieldtwin')) changed.fire();
    }),
    context.secrets.onDidChange((e) => {
      if (e.key === 'fieldtwin.apiToken') changed.fire();
    }),
  );

  context.subscriptions.push(
    lm.registerMcpServerDefinitionProvider(PROVIDER_ID, {
      onDidChangeMcpServerDefinitions: changed.event,

      provideMcpServerDefinitions: async () => {
        if (!settings().mcpEnabled) return [];
        const { command, args } = launcher(context);
        return [
          // The token is deliberately absent here — it is attached in
          // resolveMcpServerDefinition, which runs only when the server is
          // actually about to start, so the user is never prompted on startup.
          new vscode.McpStdioServerDefinition(
            'FieldTwin',
            command,
            args,
            {},
            context.extension.packageJSON.version,
          ),
        ];
      },

      resolveMcpServerDefinition: async (server: vscode.McpStdioServerDefinition) => {
        let apiToken = await token.get(context);
        if (!apiToken) {
          const answer = await vscode.window.showInformationMessage(
            'The FieldTwin MCP server needs an API token to read your live project data.',
            'Set Token',
            'Cancel',
          );
          if (answer !== 'Set Token') return undefined; // cancels the launch
          apiToken = await token.prompt(context);
          if (!apiToken) return undefined;
        }

        const { baseEnv } = launcher(context);
        return new vscode.McpStdioServerDefinition(
          server.label,
          server.command,
          server.args,
          { ...baseEnv, ...serverEnv(apiToken) },
          server.version,
        );
      },
    }),
  );

  log.info('FieldTwin MCP server offered to chat clients.');
}

/**
 * Fallback for editors without the provider API: a checked-in
 * `.vscode/mcp.json`. The token is referenced as an input prompt rather
 * than inlined, so the file stays safe to commit.
 */
export async function writeWorkspaceMcpConfig(context: vscode.ExtensionContext): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    void vscode.window.showWarningMessage('Open a folder first.');
    return;
  }

  const { command, args, baseEnv } = launcher(context);
  const s = settings();
  const config = {
    inputs: [
      {
        id: 'fieldtwin-token',
        type: 'promptString',
        description: 'FieldTwin API token',
        password: true,
      },
    ],
    servers: {
      fieldtwin: {
        type: 'stdio',
        command,
        args,
        env: {
          ...baseEnv,
          FIELDTWIN_BACKEND_URL: s.backendUrl,
          FIELDTWIN_API_TOKEN: '${input:fieldtwin-token}',
          FIELDTWIN_PROJECT_ID: s.projectId,
          FIELDTWIN_SUBPROJECT_ID: s.subProjectId,
          FIELDTWIN_MCP_ALLOW_WRITES: String(s.mcpAllowWrites),
        },
      },
    },
  };

  const target = vscode.Uri.joinPath(folder.uri, '.vscode', 'mcp.json');
  await writeFile(target, JSON.stringify(config, null, 2) + '\n');
  await vscode.window.showTextDocument(target);
}
