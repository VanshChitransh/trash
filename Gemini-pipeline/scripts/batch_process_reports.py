#!/usr/bin/env python3
"""
Batch process all inspection reports: extract issues and generate estimates.

This script:
1. Extracts issues from all PDF reports (skips 1 and 6)
2. Generates estimates for all extracted files
3. Uses a single API key
4. Saves outputs to organized directories
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import List, Tuple

# Get project root
PROJECT_ROOT = Path(__file__).resolve().parent
EXTRACTION_DIR = PROJECT_ROOT / "Extraction"
ESTIMATION_DIR = PROJECT_ROOT / "Estimation"
REPAIR_REPORTS_DIR = PROJECT_ROOT / "repair" / "reports"
FINAL_RAW_DIR = PROJECT_ROOT / "Final" / "Raw-Json"
FINAL_ESTIMATE_DIR = PROJECT_ROOT / "Final" / "Estimate-Json"

# Reports to skip (already processed)
SKIP_REPORTS = [1, 6]


def get_report_files() -> List[Tuple[int, Path]]:
    """Get all report PDF files, excluding skipped ones."""
    reports = []
    for pdf_file in sorted(REPAIR_REPORTS_DIR.glob("*-report.pdf")):
        # Extract report number from filename (e.g., "1-report.pdf" -> 1)
        try:
            report_num = int(pdf_file.stem.split("-")[0])
            if report_num not in SKIP_REPORTS:
                reports.append((report_num, pdf_file))
        except ValueError:
            print(f"⚠️  Warning: Could not parse report number from {pdf_file.name}")
            continue
    return sorted(reports)


def extract_report(report_num: int, pdf_path: Path) -> Tuple[bool, Path]:
    """
    Extract issues from a PDF report.

    Returns:
        (success, output_json_path)
    """
    output_file = FINAL_RAW_DIR / f"{report_num}-report-raw-extraction.json"
    
    # Create output directory if it doesn't exist
    FINAL_RAW_DIR.mkdir(parents=True, exist_ok=True)
    
    print(f"\n{'='*70}")
    print(f"EXTRACTING: Report {report_num}")
    print(f"  PDF: {pdf_path.name}")
    print(f"  Output: {output_file.name}")
    print(f"{'='*70}")
    
    try:
        # Run extraction script
        result = subprocess.run(
            [
                sys.executable,
                str(EXTRACTION_DIR / "inspection_extractor.py"),
                str(pdf_path),
                "-o",
                str(output_file),
                "--log-level",
                "INFO",
            ],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            check=True,
        )
        
        # Check if output file was created
        if output_file.exists():
            # Verify it's valid JSON
            with open(output_file) as f:
                data = json.load(f)
                issue_count = len(data.get("issues", []))
                print(f"✅ Extraction successful: {issue_count} issues found")
                return True, output_file
        else:
            print(f"❌ Extraction failed: Output file not created")
            return False, output_file
            
    except subprocess.CalledProcessError as e:
        print(f"❌ Extraction failed with error code {e.returncode}")
        if e.stdout:
            print(f"STDOUT: {e.stdout[-500:]}")  # Last 500 chars
        if e.stderr:
            print(f"STDERR: {e.stderr[-500:]}")
        return False, output_file
    except Exception as e:
        print(f"❌ Extraction failed with exception: {e}")
        return False, output_file


def estimate_report(report_num: int, extraction_json: Path) -> Tuple[bool, Path]:
    """
    Generate estimate from extracted JSON.
    
    Returns:
        (success, output_json_path)
    """
    output_file = FINAL_ESTIMATE_DIR / f"{report_num}-estimate.json"
    
    # Create output directory if it doesn't exist
    FINAL_ESTIMATE_DIR.mkdir(parents=True, exist_ok=True)
    
    print(f"\n{'='*70}")
    print(f"ESTIMATING: Report {report_num}")
    print(f"  Input: {extraction_json.name}")
    print(f"  Output: {output_file.name}")
    print(f"  Region: Default (no regional adjustment)")
    print(f"{'='*70}")
    
    try:
        # Run estimation script with default parameters (no region specified = Default)
        result = subprocess.run(
            [
                sys.executable,
                str(ESTIMATION_DIR / "estimate_builder.py"),
                str(extraction_json),
                "-o",
                str(output_file),
                "--log-level",
                "INFO",
            ],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            check=True,
        )
        
        # Check if output file was created
        if output_file.exists():
            # Verify it's valid JSON and get summary
            with open(output_file) as f:
                data = json.load(f)
                item_count = data.get("summary", {}).get("items_count", 0)
                total = data.get("summary", {}).get("total_usd", 0)
                print(f"✅ Estimation successful: {item_count} items, ${total:,.2f} total")
                
                # Validate against targets
                if item_count > 18:
                    print(f"⚠️  Warning: {item_count} items (target: ≤18)")
                if total > 18000:
                    print(f"⚠️  Warning: ${total:,.2f} exceeds cost ceiling ($18,000)")
                elif total < 12000:
                    print(f"⚠️  Warning: ${total:,.2f} below target range ($12,000-$16,000)")
                elif total > 16000:
                    print(f"⚠️  Warning: ${total:,.2f} above target range ($12,000-$16,000)")
                else:
                    print(f"✅ Total within target range ($12,000-$16,000)")
                
                return True, output_file
        else:
            print(f"❌ Estimation failed: Output file not created")
            return False, output_file
            
    except subprocess.CalledProcessError as e:
        print(f"❌ Estimation failed with error code {e.returncode}")
        if e.stdout:
            print(f"STDOUT: {e.stdout[-500:]}")
        if e.stderr:
            print(f"STDERR: {e.stderr[-500:]}")
        return False, output_file
    except Exception as e:
        print(f"❌ Estimation failed with exception: {e}")
        return False, output_file


def main():
    """Main batch processing function."""
    print("="*70)
    print("BATCH PROCESSING: Inspection Reports")
    print("="*70)
    print(f"Project root: {PROJECT_ROOT}")
    print(f"Skipping reports: {SKIP_REPORTS}")
    print(f"Output directories:")
    print(f"  Extractions: {FINAL_RAW_DIR}")
    print(f"  Estimates: {FINAL_ESTIMATE_DIR}")
    print("="*70)
    
    # Check API key configuration
    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key:
        print("✅ Found GEMINI_API_KEY in environment")
    else:
        print("⚠️  Warning: GEMINI_API_KEY not set in environment")
        print("   Set GEMINI_API_KEY before running batch processing")
    
    # Get all reports to process
    reports = get_report_files()
    if not reports:
        print("❌ No reports found to process")
        return 1
    
    print(f"\nFound {len(reports)} report(s) to process:")
    for report_num, pdf_path in reports:
        print(f"  {report_num}. {pdf_path.name}")
    
    # Statistics
    extraction_success = 0
    extraction_failed = 0
    estimation_success = 0
    estimation_failed = 0
    estimation_skipped = 0
    
    # Process each report
    for report_num, pdf_path in reports:
        print(f"\n\n{'#'*70}")
        print(f"PROCESSING REPORT {report_num}")
        print(f"{'#'*70}")
        
        # Step 1: Extract
        extraction_json = FINAL_RAW_DIR / f"{report_num}-report-raw-extraction.json"
        
        # Check if extraction already exists
        if extraction_json.exists():
            print(f"✅ Extraction already exists: {extraction_json.name}")
            print(f"   Skipping extraction (delete file to re-extract)")
        else:
            success, output_path = extract_report(report_num, pdf_path)
            if success:
                extraction_success += 1
                extraction_json = output_path
            else:
                extraction_failed += 1
                print(f"⏭️  Skipping estimation for report {report_num} (extraction failed)")
                continue
        
        # Step 2: Estimate
        estimate_json = FINAL_ESTIMATE_DIR / f"{report_num}-estimate.json"
        
        # Check if estimate already exists
        if estimate_json.exists():
            print(f"✅ Estimate already exists: {estimate_json.name}")
            print(f"   Skipping estimation (delete file to re-estimate)")
            estimation_skipped += 1
        else:
            if not extraction_json.exists():
                print(f"❌ Extraction file not found: {extraction_json}")
                estimation_skipped += 1
                continue
            
            # Add a small delay between requests to avoid rate limits
            time.sleep(2)
            
            success, output_path = estimate_report(report_num, extraction_json)
            if success:
                estimation_success += 1
            else:
                estimation_failed += 1
        
        # Brief pause between reports
        if report_num != reports[-1][0]:  # Don't pause after last report
            print(f"\n⏸️  Pausing 3 seconds before next report...")
            time.sleep(3)
    
    # Print summary
    print(f"\n\n{'='*70}")
    print("BATCH PROCESSING SUMMARY")
    print(f"{'='*70}")
    print(f"Extractions:")
    print(f"  ✅ Successful: {extraction_success}")
    print(f"  ❌ Failed: {extraction_failed}")
    print(f"Estimations:")
    print(f"  ✅ Successful: {estimation_success}")
    print(f"  ❌ Failed: {estimation_failed}")
    print(f"  ⏭️  Skipped: {estimation_skipped}")
    print(f"\nTotal reports processed: {len(reports)}")
    print(f"{'='*70}")
    
    if extraction_failed > 0 or estimation_failed > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
