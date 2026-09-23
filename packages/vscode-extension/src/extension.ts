import * as vscode from 'vscode';
import { initAssets, assetUri, exists } from './util/assets';
import { log, reportError } from './util/log';
import { token } from './util/config';
import { newIntegration } from './scaffold/wizard';
import { TARGETS, writeAgentFiles, detectTargets } from './knowledge/agentFiles';
import { registerMcp, writeWorkspaceMcpConfig } from './mcp/provider';
import { registerTools } from './chat/tools';
import { registerParticipant } from './chat/participant';
import { openSimulator, stopPreview } from './preview/simulator';

export function activate(context: vscode.ExtensionContext): void {
  initAssets(context);
  context.subscriptions.push(log);
  log.info(`FieldTwin Integration Kit ${context.extension.packageJSON.version} activated.`);

  const command = (id: string, run: (...args: unknown[]) => unknown) =>
    context.subscriptions.push(
      vscode.commands.registerCommand(id, async (...args: unknown[]) => {
        try {
          await run(...args);
        } catch (err) {
          reportError(id, err);
        }
      }),
    );

  command('fieldtwin.newIntegration', () => newIntegration());
  command('fieldtwin.addAgentFiles', () => addAgentFiles(false));
  command('fieldtwin.updateAgentFiles', () => addAgentFiles(true));
  command('fieldtwin.preview', () => openSimulator(context));
  command('fieldtwin.stopPreview', () => stopPreview());
  command('fieldtwin.writeMcpConfig', () => writeWorkspaceMcpConfig(context));
  command('fieldtwin.setApiToken', async () => {
    if (await token.prompt(context)) {
      void vscode.window.showInformationMessage('FieldTwin API token saved to the editor secret store.');
    }
  });
  command('fieldtwin.clearApiToken', async () => {
    await token.clear(context);
    void vscode.window.showInformationMessage('FieldTwin API token cleared.');
  });
  command('fieldtwin.openReference', async () => {
    await vscode.commands.executeCommand(
      'markdown.showPreview',
      assetUri('knowledge', 'api-quick-reference.md'),
    );
  });

  registerMcp(context);
  registerTools(context);
  registerParticipant(context);

  void updateContextKey();
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => void updateContextKey()),
  );
}

/** Drives the `when` clause of the preview button in the editor title bar. */
async function updateContextKey(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  const isIntegration =
    folder !== undefined &&
    (await exists(vscode.Uri.joinPath(folder.uri, 'fieldtwin.config.json')));
  await vscode.commands.executeCommand('setContext', 'fieldtwin.isIntegration', isIntegration);
}

async function addAgentFiles(overwrite: boolean): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    void vscode.window.showWarningMessage('Open a folder first.');
    return;
  }

  const existing = await detectTargets(folder.uri);
  const picks = await vscode.window.showQuickPick(
    TARGETS.map((t) => ({
      label: t.label,
      detail: t.detail,
      id: t.id,
      // On update, pre-select exactly what is already there.
      picked: overwrite ? existing.includes(t.id) : existing.includes(t.id) || t.id === 'agents',
    })),
    {
      title: overwrite ? 'Update AI Agent Files' : 'Add AI Agent Files',
      placeHolder: 'Which AI assistants should know how to build FieldTwin integrations?',
      canPickMany: true,
      ignoreFocusOut: true,
    },
  );
  if (!picks?.length) return;

  const result = await writeAgentFiles(folder.uri, picks.map((p) => p.id), overwrite);

  const summary = `${result.written.length} file${result.written.length === 1 ? '' : 's'} written`;
  const detail =
    (result.skipped.length ? `, ${result.skipped.length} left untouched` : '') +
    (result.removed.length ? `, replaced ${result.removed.join(', ')}` : '');
  log.info(`Agent files: ${result.written.join(', ')}`);
  if (result.removed.length) log.info(`Removed superseded files: ${result.removed.join(', ')}`);

  const answer = await vscode.window.showInformationMessage(
    `FieldTwin agent files: ${summary}${detail}.`,
    'Show Log',
  );
  if (answer === 'Show Log') log.show();
}

export function deactivate(): void {
  stopPreview();
}
