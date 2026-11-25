# HackTony Backend

FastAPI foundation. Gmail integration is not configured yet.

## Run locally
Create a virtual environment, install dependencies, and run:

```bash
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Health check: http://localhost:8000/health | API docs: http://localhost:8000/docs
