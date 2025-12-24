#!/usr/bin/env python3
"""
Run extraction and estimation for a single PDF report.

Usage:
  python3 run_single_report.py /path/to/report.pdf
"""

import argparse
import os
import sys
from pathlib import Path

# Add current directory to path for imports
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(PROJECT_ROOT / "src" / "Extraction"))
sys.path.insert(0, str(PROJECT_ROOT / "src" / "Estimation"))

try:
    from inspection_extractor import main as run_extraction
except ImportError as exc:
    print(f"ERROR: Could not import inspection_extractor: {exc}")
    sys.exit(1)

try:
    from estimate_builder import main as run_estimation
except ImportError as exc:
    print(f"ERROR: Could not import estimate_builder: {exc}")
    sys.exit(1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run extraction and estimation for a single PDF report."
    )
    parser.add_argument("pdf_path", help="Path to the inspection PDF.")
    parser.add_argument(
        "--output-dir",
        default=str(PROJECT_ROOT / "Final"),
        help="Base output directory (default: Final/).",
    )
    parser.add_argument(
        "--extraction-output",
        default="",
        help="Optional explicit extraction JSON path.",
    )
    parser.add_argument(
        "--estimate-output",
        default="",
        help="Optional explicit estimate JSON path.",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        help="Log level for extraction/estimation (default: INFO).",
    )
    return parser.parse_args()


def run_with_argv(target, argv):
    original_argv = sys.argv[:]
    try:
        sys.argv = argv
        return target()
    finally:
        sys.argv = original_argv


def main() -> int:
    args = parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY not set in environment.")
        return 1

    pdf_path = Path(args.pdf_path)
    if not pdf_path.exists():
        print(f"ERROR: PDF not found: {pdf_path}")
        return 1

    output_base = Path(args.output_dir)
    extraction_dir = output_base / "Raw-Json"
    estimate_dir = output_base / "Estimate-Json"

    extraction_dir.mkdir(parents=True, exist_ok=True)
    estimate_dir.mkdir(parents=True, exist_ok=True)

    stem = pdf_path.stem
    default_extraction = extraction_dir / f"{stem}-raw-extraction.json"
    default_estimate = estimate_dir / f"{stem}-estimate.json"

    extraction_output = Path(args.extraction_output) if args.extraction_output else default_extraction
    estimate_output = Path(args.estimate_output) if args.estimate_output else default_estimate

    print("Running extraction...")
    extraction_exit = run_with_argv(
        run_extraction,
        [
            "inspection_extractor.py",
            str(pdf_path),
            "-o",
            str(extraction_output),
            "--log-level",
            args.log_level,
        ],
    )
    if extraction_exit != 0:
        print("ERROR: Extraction failed.")
        return extraction_exit

    if not extraction_output.exists():
        print(f"ERROR: Extraction output not created: {extraction_output}")
        return 1

    print("Running estimation...")
    estimate_exit = run_with_argv(
        run_estimation,
        [
            "estimate_builder.py",
            str(extraction_output),
            "-o",
            str(estimate_output),
            "--log-level",
            args.log_level,
        ],
    )
    if estimate_exit != 0:
        print("ERROR: Estimation failed.")
        return estimate_exit

    if not estimate_output.exists():
        print(f"ERROR: Estimate output not created: {estimate_output}")
        return 1

    print("✅ Done.")
    print(f"Extraction: {extraction_output}")
    print(f"Estimate: {estimate_output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
