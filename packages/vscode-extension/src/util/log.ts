import * as vscode from 'vscode';

export const log = vscode.window.createOutputChannel('FieldTwin', { log: true });

export function reportError(where: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  log.error(`${where}: ${message}`);
  void vscode.window.showErrorMessage(`FieldTwin — ${where}: ${message}`, 'Show Log').then((pick) => {
    if (pick === 'Show Log') log.show();
  });
}
