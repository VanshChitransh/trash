#!/usr/bin/env python3
"""
Batch Estimation Script.
Processes all extraction files and generates estimates using a single API key.
"""

import os
import sys
import json
import logging
import subprocess
from pathlib import Path
from typing import Dict, Any
import time

sys.path.insert(0, str(Path(__file__).parent))

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
LOGGER = logging.getLogger(__name__)

# Paths
EXTRACTION_DIR = Path("Final/Extraction/New")
OUTPUT_DIR = Path("Final/Estimate-Json/Updated")
ESTIMATE_SCRIPT = Path("Estimation/estimate_builder.py")

# Region and state defaults
DEFAULT_REGION = "Houston"
DEFAULT_STATE = "TX"


def get_api_key() -> str:
    """Load API key from environment."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        LOGGER.error("No API key found! Set GEMINI_API_KEY.")
        return ""
    LOGGER.info("Loaded API key from environment")
    return api_key


def get_extraction_files() -> List[Path]:
    """Get all extraction JSON files (excluding summary)."""
    files = sorted(EXTRACTION_DIR.glob("*-report.json"))
    LOGGER.info(f"Found {len(files)} extraction files")
    return files


def run_estimation(
    input_file: Path,
    output_file: Path,
    api_key: str,
    region: str = DEFAULT_REGION,
    state: str = DEFAULT_STATE
) -> Dict[str, Any]:
    """
    Run estimation for a single file with specified API key.
    
    Returns:
        Dict with 'success', 'output_file', 'quality_score', 'error' keys
    """
    LOGGER.info(f"Processing {input_file.name}...")
    LOGGER.info(f"  Using API key: {api_key[:20]}...")
    
    # Set API key in environment
    env = os.environ.copy()
    env["GEMINI_API_KEY"] = api_key
    
    # Build command
    cmd = [
        "python3",
        str(ESTIMATE_SCRIPT),
        str(input_file),
        "-o", str(output_file),
        "--region", region,
        "--state", state,
        "--log-level", "INFO"
    ]
    
    try:
        # Run estimation
        result = subprocess.run(
            cmd,
            env=env,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        # Check if successful
        if result.returncode == 0:
            # Extract quality score from output
            quality_score = None
            for line in result.stdout.split('\n'):
                if "Overall Quality:" in line:
                    try:
                        quality_score = float(line.split("Overall Quality:")[1].split("/")[0].strip())
                    except:
                        pass
            
            LOGGER.info(f"  ✅ SUCCESS - Quality: {quality_score}/100")
            
            return {
                "success": True,
                "output_file": str(output_file),
                "quality_score": quality_score,
                "error": None
            }
        else:
            error_msg = result.stderr[-500:] if result.stderr else "Unknown error"
            LOGGER.error(f"  ❌ FAILED - {error_msg}")
            
            return {
                "success": False,
                "output_file": None,
                "quality_score": None,
                "error": error_msg
            }
    
    except subprocess.TimeoutExpired:
        LOGGER.error(f"  ❌ TIMEOUT - Estimation took longer than 5 minutes")
        return {
            "success": False,
            "output_file": None,
            "quality_score": None,
            "error": "Timeout after 5 minutes"
        }
    
    except Exception as e:
        LOGGER.error(f"  ❌ ERROR - {str(e)}")
        return {
            "success": False,
            "output_file": None,
            "quality_score": None,
            "error": str(e)
        }


def main():
    """Main batch processing function."""
    LOGGER.info("=" * 80)
    LOGGER.info("BATCH ESTIMATION - TWO-PHASE APPROACH")
    LOGGER.info("=" * 80)

    # Load API key
    api_key = get_api_key()
    if not api_key:
        LOGGER.error("No API keys available! Cannot proceed.")
        return 1

    LOGGER.info("Using GEMINI_API_KEY from environment")

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Get extraction files
    extraction_files = get_extraction_files()

    if not extraction_files:
        LOGGER.error("No extraction files found!")
        return 1

    # Process each file
    results = []

    for idx, input_file in enumerate(extraction_files, 1):
        # Generate output filename
        output_file = OUTPUT_DIR / input_file.name.replace("-report.json", "-estimate.json")

        LOGGER.info(f"\n[{idx}/{len(extraction_files)}] Processing {input_file.name}")
        
        # Run estimation
        result = run_estimation(input_file, output_file, api_key)
        result["input_file"] = str(input_file)
        result["report_number"] = input_file.stem.split("-")[0]
        results.append(result)

        # Add delay between requests to avoid rate limiting
        if idx < len(extraction_files):
            delay = 5  # 5 seconds between files
            LOGGER.info(f"  ⏱️  Waiting {delay}s before next file...")
            time.sleep(delay)

    # Generate summary report
    LOGGER.info("\n" + "=" * 80)
    LOGGER.info("BATCH ESTIMATION COMPLETE")
    LOGGER.info("=" * 80)

    successful = [r for r in results if r["success"]]
    failed = [r for r in results if not r["success"]]

    LOGGER.info(f"\n📊 SUMMARY:")
    LOGGER.info(f"  Total files: {len(results)}")
    LOGGER.info(f"  ✅ Successful: {len(successful)}")
    LOGGER.info(f"  ❌ Failed: {len(failed)}")

    if successful:
        quality_scores = [r["quality_score"] for r in successful if r["quality_score"] is not None]
        if quality_scores:
            avg_quality = sum(quality_scores) / len(quality_scores)
            min_quality = min(quality_scores)
            max_quality = max(quality_scores)
            above_threshold = len([q for q in quality_scores if q >= 70])

            LOGGER.info(f"\n📈 QUALITY SCORES:")
            LOGGER.info(f"  Average: {avg_quality:.1f}/100")
            LOGGER.info(f"  Min: {min_quality:.1f}/100")
            LOGGER.info(f"  Max: {max_quality:.1f}/100")
            LOGGER.info(f"  Above 70/100: {above_threshold}/{len(quality_scores)} ({above_threshold/len(quality_scores)*100:.0f}%)")

    if failed:
        LOGGER.info(f"\n❌ FAILED FILES:")
        for r in failed:
            LOGGER.info(f"  - {r['report_number']}: {r['error'][:100]}")

    # Save detailed results
    results_file = OUTPUT_DIR / "batch_results.json"
    with open(results_file, 'w') as f:
        json.dump({
            "summary": {
                "total": len(results),
                "successful": len(successful),
                "failed": len(failed),
                "quality_scores": {
                    "average": avg_quality if quality_scores else None,
                    "min": min_quality if quality_scores else None,
                    "max": max_quality if quality_scores else None,
                    "above_threshold": above_threshold if quality_scores else None,
                }
            },
            "results": results
        }, f, indent=2)

    LOGGER.info(f"\n📁 Results saved to: {results_file}")

    # Return exit code
    return 0 if len(failed) == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
