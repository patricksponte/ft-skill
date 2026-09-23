const fs = require('fs');
const path = require('path');
class Uri {
  constructor(fsPath) { this.fsPath = fsPath; this.path = fsPath; }
  static file(p) { return new Uri(p); }
  static joinPath(base, ...segs) { return new Uri(path.normalize(path.join(base.fsPath, ...segs))); }
}
module.exports = {
  Uri,
  FileType: { File: 1, Directory: 2 },
  workspace: {
    fs: {
      readFile: async (uri) => fs.readFileSync(uri.fsPath),
      writeFile: async (uri, bytes) => fs.writeFileSync(uri.fsPath, bytes),
      createDirectory: async (uri) => fs.mkdirSync(uri.fsPath, { recursive: true }),
      stat: async (uri) => { if (!fs.existsSync(uri.fsPath)) throw new Error('ENOENT'); return { type: 1 }; },
      readDirectory: async (uri) => fs.readdirSync(uri.fsPath, { withFileTypes: true })
        .map((d) => [d.name, d.isDirectory() ? 2 : 1]),
      delete: async (uri) => fs.rmSync(uri.fsPath, { recursive: true, force: true }),
    },
  },
  window: {
    createOutputChannel: () => ({ info(){}, warn(){}, error(){}, show(){}, dispose(){} }),
    showErrorMessage: async () => undefined,
  },
};
