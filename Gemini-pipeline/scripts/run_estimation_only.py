#!/usr/bin/env python3
"""
Run estimation only on existing extraction files.

This script:
1. Finds all extraction JSON files
2. Runs estimation on each one (skips if estimate already exists)
3. Uses default parameters (no region specified)
4. Handles errors gracefully
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
ESTIMATION_DIR = PROJECT_ROOT / "Estimation"
FINAL_RAW_DIR = PROJECT_ROOT / "Final" / "Raw-Json"
FINAL_ESTIMATE_DIR = PROJECT_ROOT / "Final" / "Estimate-Json"


def get_extraction_files() -> List[Tuple[int, Path]]:
    """Get all extraction JSON files (report and non-report variants)."""
    extractions = []
    for json_file in sorted(FINAL_RAW_DIR.glob("*-raw-extraction.json")):
        # Extract report number from filename (e.g., "2-report-raw-extraction.json" -> 2)
        try:
            report_num = int(json_file.stem.split("-")[0])
            extractions.append((report_num, json_file))
        except ValueError:
            print(f"⚠️  Warning: Could not parse report number from {json_file.name}")
            continue
    return sorted(extractions)


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
        # Run estimation script with default parameters
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
            # Show last 1000 chars of stdout
            stdout_lines = e.stdout.split('\n')
            print(f"STDOUT (last 20 lines):")
            for line in stdout_lines[-20:]:
                print(f"  {line}")
        if e.stderr:
            # Show last 1000 chars of stderr
            stderr_lines = e.stderr.split('\n')
            print(f"STDERR (last 20 lines):")
            for line in stderr_lines[-20:]:
                print(f"  {line}")
        
        # Check for debug files
        cache_dir = PROJECT_ROOT / "Estimation" / ".estimate_cache"
        if cache_dir.exists():
            debug_files = list(cache_dir.glob("*_debug_*"))
            if debug_files:
                print(f"\n⚠️  Debug files found in {cache_dir}:")
                for debug_file in debug_files[:5]:  # Show first 5
                    print(f"  - {debug_file.name}")
                print(f"  (Check these files for response details)")
        
        return False, output_file
    except Exception as e:
        print(f"❌ Estimation failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return False, output_file


def main():
    """Main batch estimation function."""
    print("="*70)
    print("ESTIMATION ONLY: Processing Extractions")
    print("="*70)
    print(f"Project root: {PROJECT_ROOT}")
    print(f"Extraction directory: {FINAL_RAW_DIR}")
    print(f"Estimate directory: {FINAL_ESTIMATE_DIR}")
    print("="*70)
    
    # Check API key
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("❌ GEMINI_API_KEY not set in environment")
        return 1
    
    # Get all extraction files
    extractions = get_extraction_files()
    if not extractions:
        print("❌ No extraction files found")
        return 1
    
    print(f"\nFound {len(extractions)} extraction file(s):")
    for report_num, json_file in extractions:
        print(f"  {report_num}. {json_file.name}")
    
    # Statistics
    estimation_success = 0
    estimation_failed = 0
    estimation_skipped = 0
    
    # Process each extraction
    for report_num, extraction_json in extractions:
        print(f"\n\n{'#'*70}")
        print(f"PROCESSING REPORT {report_num}")
        print(f"{'#'*70}")
        
        # Check if estimate already exists
        estimate_json = FINAL_ESTIMATE_DIR / f"{report_num}-estimate.json"
        if estimate_json.exists():
            print(f"✅ Estimate already exists: {estimate_json.name}")
            print(f"   Skipping (delete file to re-estimate)")
            estimation_skipped += 1
            continue
        
        if not extraction_json.exists():
            print(f"❌ Extraction file not found: {extraction_json}")
            estimation_skipped += 1
            continue
        
        # Add a small delay between requests
        if report_num != extractions[0][0]:  # Don't delay before first
            time.sleep(3)
        
        success, output_path = estimate_report(report_num, extraction_json)
        if success:
            estimation_success += 1
        else:
            estimation_failed += 1
            print(f"\n💡 Tip: Run debug script to see detailed response:")
            print(f"   python3 debug_estimation.py {extraction_json}")
    
    # Print summary
    print(f"\n\n{'='*70}")
    print("ESTIMATION SUMMARY")
    print(f"{'='*70}")
    print(f"  ✅ Successful: {estimation_success}")
    print(f"  ❌ Failed: {estimation_failed}")
    print(f"  ⏭️  Skipped: {estimation_skipped}")
    print(f"\nTotal extractions processed: {len(extractions)}")
    print(f"{'='*70}")
    
    if estimation_failed > 0:
        print(f"\n💡 To debug failed estimations:")
        print(f"   1. Check .estimate_cache/*_debug_* files for response details")
        print(f"   2. Run: python3 debug_estimation.py <extraction_file>")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
