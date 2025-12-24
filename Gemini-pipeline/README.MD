# Gemini Pipeline

Gemini Pipeline is a Python-based workflow for extracting issues from inspection PDFs and generating consolidated repair estimates using the Gemini API.

## What It Does
- Extracts inspection issues from PDF reports.
- Generates cost estimates and consolidated line items.
- Supports batch processing.

## Repository Structure
- `config.py` shared configuration defaults.
- `pdf_annotation_extractor.py` PDF annotation and extraction utilities.
- `trade_categorizer.py` categorization helpers.
- `Extraction/inspection_extractor.py` extraction entry point for a single PDF.
- `Estimation/estimate_builder.py` estimation entry point for a single extraction JSON.
- `Estimation/generate_estimate_pdf.py` optional PDF generation from an estimate.
- `Estimation/regenerate_notes_and_pdf.py` regeneration helper.
- `batch_extract_reports.py` batch extraction runner.
- `batch_estimate_reports.py` batch estimation runner with logs.
- `batch_estimate_updated.py` alternative batch estimator using subprocess calls.
- `batch_estimate_unbiased.py` unbiased batch estimation variant.
- `batch_process_reports.py` end-to-end batch pipeline (extract + estimate).
- `run_estimation_only.py` estimation-only runner.
- `run_single_report.py` single-report runner (PDF → extraction → estimate).
- `requirements.txt` Python dependencies.

## Expected Inputs/Outputs
The scripts assume these directories (created at runtime if missing):
- Input PDFs: `repair/reports/*-report.pdf`
- Extraction outputs: `Final/Raw-Json/` or `Final/Extraction/New/`
- Estimation outputs: `Final/Estimate-Json/`

## Setup
- Python 3
- Install dependencies:
  - `pip install -r requirements.txt`
- Set Gemini API key:
  - `GEMINI_API_KEY`

## Typical Workflow
1) Run extraction on PDFs.
2) Run estimation on extracted JSON.
3) Use batch scripts for end-to-end processing.

## Single PDF Shortcut
Use the single-report runner to go from PDF to estimate in one command:
```
export GEMINI_API_KEY="your_key"
python3 scripts/run_single_report.py /path/to/report.pdf
```

## Notes
- The batch scripts use the single `GEMINI_API_KEY` for all requests.
- Outputs and logs are written to the runtime folders noted above.
