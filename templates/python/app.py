import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
import uvicorn

app = FastAPI()
PUBLIC_DIR = Path(__file__).parent / 'public'

# Exact FieldTwin origins allowed to embed this page, comma-separated, for example
#   FIELDTWIN_ORIGINS=https://yourcompany.fieldtwin.com
# Use the same origins as ALLOWED_FIELDTWIN_ORIGINS in public/index.html.
FIELDTWIN_ORIGINS = [o.strip() for o in os.environ.get('FIELDTWIN_ORIGINS', '').split(',') if o.strip()]


@app.middleware('http')
async def allow_fieldtwin_embedding(request: Request, call_next):
    response = await call_next(request)
    # Allow FieldTwin to embed the page. Do not send X-Frame-Options, and do not send
    # Cross-Origin-Opener-Policy: same-origin, or pop-outs lose their connection to FieldTwin.
    if FIELDTWIN_ORIGINS:
        response.headers['Content-Security-Policy'] = 'frame-ancestors ' + ' '.join(FIELDTWIN_ORIGINS)
    return response


# ── Add your routes here ───────────────────────────────────────────────────
#
# Call these from public/index.html with:
#   const data = await fetch('/api/my-route').then(r => r.json());
#
# Install packages:  pip install <package-name>
# Then import them:  import my_lib

@app.get('/api/hello')
def hello():
    return {'message': 'Hello from Python!'}

# ──────────────────────────────────────────────────────────────────────────

# Serve only the public/ folder, never the project root (app.py, .env, .venv). Must be last.
app.mount('/', StaticFiles(directory=PUBLIC_DIR, html=True), name='static')

if __name__ == '__main__':
    if not FIELDTWIN_ORIGINS:
        print('Tip: set FIELDTWIN_ORIGINS to your FieldTwin origin to send CSP frame-ancestors.')
    uvicorn.run('app:app', host='127.0.0.1', port=int(os.environ.get('PORT', '3000')), reload=True)
