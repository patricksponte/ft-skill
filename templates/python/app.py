from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import uvicorn

app = FastAPI()

# ── Add your routes here ───────────────────────────────────────────────────
#
# Call these from index.html with:
#   const data = await fetch('/api/my-route').then(r => r.json());
#
# Install packages:  pip install <package-name>
# Then import them:  import my_lib

@app.get('/api/hello')
def hello():
    return {'message': 'Hello from Python!'}

# ──────────────────────────────────────────────────────────────────────────

# Serve index.html — must be last
app.mount('/', StaticFiles(directory='.', html=True), name='static')

if __name__ == '__main__':
    uvicorn.run("app:app", host='0.0.0.0', port=3000, reload=True)
