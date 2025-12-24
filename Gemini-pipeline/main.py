from __future__ import annotations

from pathlib import Path
import sys
from typing import Any, Dict, Optional

from fastapi import BackgroundTasks, FastAPI
from pydantic import BaseModel


PROJECT_ROOT = Path(__file__).resolve().parent
PIPELINE_SCRIPTS_DIR = PROJECT_ROOT / "Gemini-pipeline" / "scripts"
sys.path.insert(0, str(PIPELINE_SCRIPTS_DIR))

import batch_process_reports  # noqa: E402

app = FastAPI()


class PipelineRequest(BaseModel):
    job_id: str
    configuration: Optional[Dict[str, Any]] = None


def run_pipeline_job(job_id: str, configuration: Optional[Dict[str, Any]] = None) -> None:
    # batch_process_reports.main() runs the full extraction + estimation pipeline.
    # configuration is accepted for future extensibility.
    original_argv = sys.argv[:]
    try:
        sys.argv = ["batch_process_reports.py"]
        batch_process_reports.main()
    finally:
        sys.argv = original_argv


@app.post("/run-pipeline")
def run_pipeline(payload: PipelineRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_pipeline_job, payload.job_id, payload.configuration)
    return {"message": "Task Started", "job_id": payload.job_id}
