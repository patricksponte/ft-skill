import * as vscode from 'vscode';

/**
 * Everything the extension ships with lives under `assets/` in the VSIX.
 * Nothing is ever fetched from the network, so the kit works offline and
 * behind a corporate proxy, and a given extension version always produces
 * the same project.
 */
let root: vscode.Uri;

export function initAssets(context: vscode.ExtensionContext): void {
  root = vscode.Uri.joinPath(context.extensionUri, 'assets');
}

export function assetUri(...segments: string[]): vscode.Uri {
  return vscode.Uri.joinPath(root, ...segments);
}

export async function readAsset(...segments: string[]): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(assetUri(...segments));
  return new TextDecoder().decode(bytes);
}

export async function readAssetJson<T>(...segments: string[]): Promise<T> {
  return JSON.parse(await readAsset(...segments)) as T;
}

export async function copyAsset(target: vscode.Uri, ...segments: string[]): Promise<void> {
  const bytes = await vscode.workspace.fs.readFile(assetUri(...segments));
  await writeFile(target, bytes);
}

export async function writeFile(target: vscode.Uri, content: string | Uint8Array): Promise<void> {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
  await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(target, '..'));
  await vscode.workspace.fs.writeFile(target, bytes);
}

export async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

/** Every file under an asset folder, as paths relative to that folder. */
export async function listAssetFiles(...segments: string[]): Promise<string[]> {
  const out: string[] = [];
  const walk = async (rel: string[]) => {
    for (const [name, type] of await vscode.workspace.fs.readDirectory(assetUri(...segments, ...rel))) {
      if (type === vscode.FileType.Directory) await walk([...rel, name]);
      else if (type === vscode.FileType.File) out.push([...rel, name].join('/'));
    }
  };
  await walk([]);
  return out.sort();
}
