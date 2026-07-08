const express = require('express');

const app  = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(__dirname));  // serves index.html

// ── Add your routes here ───────────────────────────────────────────────────
//
// Call these from index.html with:
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
});
