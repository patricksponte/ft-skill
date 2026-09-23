const path    = require('path');
const express = require('express');

const app  = express();
const PORT = Number(process.env.PORT) || 3000;

// Exact FieldTwin origins allowed to embed this page, comma-separated, for example
//   FIELDTWIN_ORIGINS=https://yourcompany.fieldtwin.com
// Use the same origins as ALLOWED_FIELDTWIN_ORIGINS in public/index.html.
const FIELDTWIN_ORIGINS = (process.env.FIELDTWIN_ORIGINS || '')
  .split(',').map((origin) => origin.trim()).filter(Boolean);

app.disable('x-powered-by');
app.use(express.json());

app.use((req, res, next) => {
  // Allow FieldTwin to embed the page. Do not send X-Frame-Options, and do not send
  // Cross-Origin-Opener-Policy: same-origin, or pop-outs lose their connection to FieldTwin.
  if (FIELDTWIN_ORIGINS.length > 0) {
    res.setHeader('Content-Security-Policy', `frame-ancestors ${FIELDTWIN_ORIGINS.join(' ')}`);
  }
  next();
});

// Serve only the public/ folder, never the project root (server.js, .env, node_modules).
app.use(express.static(path.join(__dirname, 'public')));

// ── Add your routes here ───────────────────────────────────────────────────
//
// Call these from public/index.html with:
//   const data = await fetch('/api/my-route').then(r => r.json());
//
// Install packages:  npm install <package-name>
// Then require them: const myLib = require('my-lib');

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Node.js!' });
});

// ──────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Integration running at http://localhost:${PORT}`);
  if (FIELDTWIN_ORIGINS.length === 0) {
    console.log('Tip: set FIELDTWIN_ORIGINS to your FieldTwin origin to send CSP frame-ancestors.');
  }
});
