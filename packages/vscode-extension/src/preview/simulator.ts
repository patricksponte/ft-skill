import * as vscode from 'vscode';
import { StaticServer, isReachable } from './server';
import { settings, token, FieldTwinSettings } from '../util/config';
import { log } from '../util/log';
import { exists } from '../util/assets';

interface IntegrationConfig {
  name?: string;
  template?: 'static' | 'node' | 'python';
}

let panel: vscode.WebviewPanel | undefined;
let server: StaticServer | undefined;
let watcher: vscode.FileSystemWatcher | undefined;

export async function openSimulator(context: vscode.ExtensionContext): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    void vscode.window.showWarningMessage('Open your integration folder first.');
    return;
  }

  const local = await resolveTarget(folder);
  if (!local) return;

  // In Remote-SSH, Codespaces or a browser-hosted editor, localhost inside the
  // webview is not the machine running the server. asExternalUri sets up the
  // port forward and hands back a URL that resolves from where the UI runs.
  const target = (await vscode.env.asExternalUri(vscode.Uri.parse(local))).toString();

  if (panel) {
    panel.reveal(vscode.ViewColumn.Beside);
  } else {
    panel = vscode.window.createWebviewPanel(
      'fieldtwin.simulator',
      'FieldTwin Simulator',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
      },
    );
    panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'images', 'icon.png');
    panel.onDidDispose(() => {
      panel = undefined;
      watcher?.dispose();
      watcher = undefined;
      server?.dispose();
      server = undefined;
    });

    panel.webview.onDidReceiveMessage(async (message) => {
      if (message.type === 'log') {
        log.info(`[simulator] ${message.text}`);
      } else if (message.type === 'setToken') {
        await token.prompt(context);
        await postSession(context, target);
      } else if (message.type === 'openExternal') {
        await vscode.env.openExternal(vscode.Uri.parse(target));
      }
    });
  }

  panel.webview.html = html(panel.webview, context.extensionUri);
  await postSession(context, target);
  setupWatcher(folder);
}

async function postSession(context: vscode.ExtensionContext, target: string): Promise<void> {
  const apiToken = await token.get(context);
  panel?.webview.postMessage({
    type: 'session',
    target,
    hasToken: Boolean(apiToken),
    session: loadedPayload(settings(), apiToken),
  });
}

/**
 * The fields of `loaded`, exactly as FieldTwin sends them: subProject is
 * already qualified as subProjectId:streamId (the main stream is id:id),
 * and APIVersion is what the secure bridge builds API URLs from.
 */
export function loadedPayload(s: FieldTwinSettings, apiToken: string | undefined) {
  const subProjectId = s.subProjectId || 'simulated-subproject-id';
  return {
    token: apiToken ?? 'SIMULATED-TOKEN-no-api-token-set',
    backendUrl: s.backendUrl,
    APIVersion: s.apiVersion,
    project: s.projectId || 'simulated-project-id',
    subProject: `${subProjectId}:${subProjectId}`,
    stream: subProjectId,
    customTabId: 'simulated-custom-tab',
    canEdit: true,
    APIServerIsReady: true,
  };
}

async function resolveTarget(folder: vscode.WorkspaceFolder): Promise<string | undefined> {
  const s = settings(folder.uri);
  const config = await readConfig(folder);

  // node/python templates run their own server; static ones we host ourselves.
  if (config.template === 'node' || config.template === 'python') {
    const guess = 'http://localhost:3000';
    if (await isReachable(guess)) return guess;

    const answer = await vscode.window.showWarningMessage(
      `This is a ${config.template} integration but nothing is serving ${guess}. Start your server, or preview the static files instead.`,
      'Preview Static Files',
      'Enter URL…',
    );
    if (answer === 'Enter URL…') {
      return vscode.window.showInputBox({
        title: 'Integration URL',
        value: guess,
        prompt: 'Where is your integration being served?',
      });
    }
    if (answer !== 'Preview Static Files') return undefined;
  }

  // The Node/Python templates serve public/ only, so preview the same folder.
  const publicDir = vscode.Uri.joinPath(folder.uri, 'public');
  const root = config.template && config.template !== 'static' && (await exists(publicDir))
    ? publicDir.fsPath
    : folder.uri.fsPath;
  server ??= new StaticServer(root);
  try {
    return await server.start(s.previewPort);
  } catch (err) {
    void vscode.window.showErrorMessage(`Could not start the preview server: ${String(err)}`);
    return undefined;
  }
}

async function readConfig(folder: vscode.WorkspaceFolder): Promise<IntegrationConfig> {
  const uri = vscode.Uri.joinPath(folder.uri, 'fieldtwin.config.json');
  if (!(await exists(uri))) return {};
  try {
    return JSON.parse(new TextDecoder().decode(await vscode.workspace.fs.readFile(uri)));
  } catch {
    return {};
  }
}

function setupWatcher(folder: vscode.WorkspaceFolder): void {
  if (watcher || !settings(folder.uri).autoReload) return;

  watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(folder, '**/*.{html,js,mjs,css,json}'),
  );
  const reload = (uri: vscode.Uri) => {
    if (uri.path.includes('/node_modules/') || uri.path.includes('/.git/')) return;
    panel?.webview.postMessage({ type: 'reload' });
  };
  watcher.onDidChange(reload);
  watcher.onDidCreate(reload);
}

export function stopPreview(): void {
  server?.dispose();
  server = undefined;
  watcher?.dispose();
  watcher = undefined;
  panel?.dispose();
  void vscode.window.showInformationMessage('FieldTwin preview stopped.');
}

function html(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const media = (file: string) =>
    webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', file));
  const nonce = Array.from({ length: 32 }, () =>
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.charAt(
      Math.floor(Math.random() * 62),
    ),
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none';
  style-src ${webview.cspSource} 'unsafe-inline';
  script-src 'nonce-${nonce}';
  img-src ${webview.cspSource} data:;
  frame-src http://localhost:* http://127.0.0.1:* https:;">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${media('simulator.css')}">
<title>FieldTwin Simulator</title>
</head>
<body>
<header class="bar">
  <span id="status" class="status status--waiting" title="Connection status"></span>
  <span id="statusText">Waiting for the integration…</span>
  <code id="target"></code>
  <span class="spacer"></span>
  <button id="reload" class="ghost" title="Reload the integration">Reload</button>
  <button id="openExternal" class="ghost" title="Open in a browser">Browser</button>
</header>

<main>
  <section class="stage">
    <iframe id="frame" title="Integration under test" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
  </section>

  <aside class="inspector">
    <div class="panel">
      <h2>Simulate FieldTwin</h2>
      <p class="hint">Fire the events the platform would send to your integration.</p>
      <div class="actions">
        <button data-fire="loaded">loaded</button>
        <button data-fire="tokenRefresh">tokenRefresh</button>
        <button data-fire="apiPodIsReady">apiPodIsReady</button>
        <button data-fire="select">select</button>
        <button data-fire="unselect">unselect</button>
        <button data-fire="operationSearch">operationSearch</button>
        <button data-fire="visualFilterToggle">visualFilterToggle</button>
      </div>
      <details id="sessionBox">
        <summary>Session sent on <code>loaded</code></summary>
        <pre id="sessionJson"></pre>
        <button id="setToken" class="ghost small">Set a real API token…</button>
      </details>
    </div>

    <div class="panel panel--grow">
      <h2>
        Messages from your integration
        <span id="count" class="count">0</span>
        <button id="clear" class="ghost small">Clear</button>
      </h2>
      <p class="hint" id="emptyHint">
        Nothing yet. Your integration sends these to the pinned host window and
        origin it received <code>loaded</code> from.
      </p>
      <ol id="logList" class="log"></ol>
    </div>
  </aside>
</main>

<script nonce="${nonce}" src="${media('simulator.js')}"></script>
</body>
</html>`;
}
