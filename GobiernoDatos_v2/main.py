"""Cloud Run Functions (2nd Gen) & Cloud Run Serverless Entrypoint for Data Governance Hub."""

import os
import uvicorn
from backend.app import app

from a2wsgi import ASGIMiddleware

# Primary FastAPI ASGI Application Export wrapped for Cloud Functions (WSGI)
wsgi_app = ASGIMiddleware(app)

def governance_hub(environ, start_response):
    return wsgi_app(environ, start_response)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run("backend.app:app", host=host, port=port)
