import * as vscode from 'vscode';

const TOKEN_KEY = 'fieldtwin.apiToken';

export interface FieldTwinSettings {
  backendUrl: string;
  projectId: string;
  subProjectId: string;
  apiVersion: string;
  previewPort: number;
  autoReload: boolean;
  mcpEnabled: boolean;
  mcpAllowWrites: boolean;
}

export function settings(scope?: vscode.Uri): FieldTwinSettings {
  const c = vscode.workspace.getConfiguration('fieldtwin', scope);
  return {
    backendUrl: (c.get<string>('backendUrl') ?? '').replace(/\/+$/, ''),
    projectId: c.get<string>('projectId') ?? '',
    subProjectId: c.get<string>('subProjectId') ?? '',
    apiVersion: c.get<string>('apiVersion') ?? 'v1.10',
    previewPort: c.get<number>('preview.port') ?? 5174,
    autoReload: c.get<boolean>('preview.autoReload') ?? true,
    mcpEnabled: c.get<boolean>('mcp.enabled') ?? true,
    mcpAllowWrites: c.get<boolean>('mcp.allowWrites') ?? false,
  };
}

/**
 * The API token is an account-level credential, so it never lands in
 * settings.json or a .env file the user might commit. It lives in the
 * editor's encrypted SecretStorage and is handed to the MCP server
 * process through its environment at launch time.
 */
export const token = {
  get: (ctx: vscode.ExtensionContext) => ctx.secrets.get(TOKEN_KEY),
  set: (ctx: vscode.ExtensionContext, value: string) => ctx.secrets.store(TOKEN_KEY, value),
  clear: (ctx: vscode.ExtensionContext) => ctx.secrets.delete(TOKEN_KEY),

  async prompt(ctx: vscode.ExtensionContext): Promise<string | undefined> {
    const value = await vscode.window.showInputBox({
      title: 'FieldTwin API Token',
      prompt: 'Account-level API token — FieldTwin → Settings → API Tokens. Stored in the editor secret store, never written to disk.',
      password: true,
      ignoreFocusOut: true,
      placeHolder: 'Paste your token',
    });
    if (value?.trim()) {
      await token.set(ctx, value.trim());
      return value.trim();
    }
    return undefined;
  },
};
