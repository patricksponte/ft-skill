import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import { log } from '../util/log';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

export class StaticServer {
  private server?: http.Server;
  private _port = 0;

  get port(): number {
    return this._port;
  }
  get url(): string {
    return `http://localhost:${this._port}`;
  }
  get running(): boolean {
    return this.server !== undefined;
  }

  constructor(private readonly root: string) {}

  async start(preferredPort: number): Promise<string> {
    if (this.server) return this.url;

    this._port = await firstFreePort(preferredPort);
    this.server = http.createServer((req, res) => this.handle(req, res));

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(this._port, '127.0.0.1', resolve);
    });

    log.info(`Preview server on ${this.url} serving ${this.root}`);
    return this.url;
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
    const requested = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let filePath = path.join(this.root, requested);

    // Never serve outside the integration folder.
    if (!path.resolve(filePath).startsWith(path.resolve(this.root))) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end(`Not found: ${requested}`);
      return;
    }

    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      // The simulator reloads by cache-busting; make sure nothing is stale.
      'Cache-Control': 'no-store, must-revalidate',
      // The page is loaded inside a VS Code webview iframe.
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(filePath).pipe(res);
  }

  dispose(): void {
    this.server?.close();
    this.server = undefined;
    this._port = 0;
  }
}

function isFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.close(() => resolve(true)))
      .listen(port, '127.0.0.1');
  });
}

async function firstFreePort(start: number): Promise<number> {
  for (let port = start; port < start + 50; port++) {
    if (await isFree(port)) return port;
  }
  throw new Error(`No free port in ${start}–${start + 50}.`);
}

/** Cheap liveness check for a server the user started themselves. */
export function isReachable(url: string, timeoutMs = 1200): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(true);
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}
