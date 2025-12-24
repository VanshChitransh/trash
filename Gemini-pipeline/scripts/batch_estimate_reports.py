#!/usr/bin/env python3
"""
Batch Estimation Script.

This script processes all extracted JSON files from Final/Extraction/New,
generates cost estimates using the Gemini API with a single API key,
and saves the results to Final/Estimate-Json/new folder.

Features:
- Detailed logging to console and file
- Progress tracking
- Error handling and recovery
- Summary statistics
"""

import os
import sys
import json
import logging
import time
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Estimation'))

# Import estimate builder
try:
    from estimate_builder import main as run_estimation
    ESTIMATOR_AVAILABLE = True
except ImportError:
    ESTIMATOR_AVAILABLE = False
    print("ERROR: estimate_builder not available. Cannot proceed.")
    sys.exit(1)


class BatchEstimator:
    """Batch estimation with logging."""
    
    def __init__(self, input_dir: str, output_dir: str, region: str = "Houston", 
                 state: str = "TX", log_file: Optional[str] = None):
        """
        Initialize batch estimator.
        
        Args:
            input_dir: Directory containing extracted JSON files
            output_dir: Directory to save estimate JSON files
            region: Region for pricing (default: Houston)
            state: State for pricing (default: TX)
            log_file: Optional log file path (default: auto-generated)
        """
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        self.region = region
        self.state = state
        
        # Create output directory if it doesn't exist
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Setup logging
        if log_file is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            log_file = f"batch_estimation_{timestamp}.log"
        
        self.log_file = Path(log_file)
        self._setup_logging()
        
        # Validate API key
        self.api_key = self._get_api_key()
        
        # Statistics
        self.stats = {
            'total': 0,
            'successful': 0,
            'failed': 0,
            'skipped': 0,
            'start_time': None,
            'end_time': None,
            'results': []
        }
    
    def _setup_logging(self):
        """Setup logging to both console and file."""
        # Create logger
        self.logger = logging.getLogger('BatchEstimator')
        self.logger.setLevel(logging.DEBUG)
        
        # Remove existing handlers
        self.logger.handlers = []
        
        # Console handler (INFO level)
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        console_format = logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(message)s',
            datefmt='%H:%M:%S'
        )
        console_handler.setFormatter(console_format)
        
        # File handler (DEBUG level)
        file_handler = logging.FileHandler(self.log_file, mode='w')
        file_handler.setLevel(logging.DEBUG)
        file_format = logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(file_format)
        
        # Add handlers
        self.logger.addHandler(console_handler)
        self.logger.addHandler(file_handler)
        
        self.logger.info("="*80)
        self.logger.info("BATCH ESTIMATION - STARTED")
        self.logger.info("="*80)
        self.logger.info(f"Input Directory: {self.input_dir}")
        self.logger.info(f"Output Directory: {self.output_dir}")
        self.logger.info(f"Region: {self.region}")
        self.logger.info(f"State: {self.state}")
        self.logger.info(f"Log File: {self.log_file}")
    
    def _get_api_key(self) -> str:
        """Get API key from environment."""
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            self.logger.error("No GEMINI_API_KEY found in environment!")
            raise ValueError("GEMINI_API_KEY environment variable is required")
        
        self.logger.info("Using GEMINI_API_KEY from environment")
        return api_key

    def _get_json_files(self) -> List[Path]:
        """Get all JSON files from input directory."""
        json_files = sorted(self.input_dir.glob("*.json"))
        # Filter out summary files
        json_files = [f for f in json_files if 'summary' not in f.name.lower()]
        self.logger.info(f"Found {len(json_files)} JSON file(s) in {self.input_dir}")
        return json_files

    def _get_output_path(self, json_path: Path) -> Path:
        """Get output estimate path for a JSON file."""
        # Replace '-report.json' or '.json' with '-estimate.json'
        if json_path.stem.endswith('-report'):
            estimate_name = json_path.stem.replace('-report', '-estimate') + ".json"
        else:
            estimate_name = json_path.stem + "-estimate.json"
        return self.output_dir / estimate_name

    def _should_skip(self, json_path: Path, output_path: Path) -> bool:
        """Check if JSON should be skipped (already estimated)."""
        if output_path.exists():
            self.logger.info(f"Estimate already exists: {output_path.name} - SKIPPING")
            return True
        return False

    def _get_issue_count(self, json_path: Path) -> int:
        """Get number of issues in the extraction file."""
        try:
            with open(json_path, 'r') as f:
                data = json.load(f)
            return len(data.get('issues', []))
        except Exception:
            return 0

    def _estimate_json(self, json_path: Path, output_path: Path) -> Dict[str, Any]:
        """
        Estimate a single JSON file.

        Returns:
            Dictionary with estimation result info
        """
        result = {
            'json': json_path.name,
            'output': output_path.name,
            'status': 'unknown',
            'error': None,
            'start_time': time.time(),
            'end_time': None,
            'duration': None,
            'issues_count': None,
            'estimate_total': None,
            'line_items': None
        }

        try:
            # Get issue count
            result['issues_count'] = self._get_issue_count(json_path)

            self.logger.info("─" * 80)
            self.logger.info(f"Processing: {json_path.name}")
            self.logger.info(f"Output: {output_path.name}")
            self.logger.info(f"Issues: {result['issues_count']}")
            self.logger.info("─" * 80)

            # Build command line arguments for estimate_builder
            args = [
                str(json_path),
                '-o', str(output_path),  # Use -o not --output
                '--region', self.region,
                '--state', self.state,
                '--log-level', 'WARNING'  # Suppress estimate_builder logs
            ]

            # Save original sys.argv
            original_argv = sys.argv

            try:
                # Set sys.argv for the estimator
                sys.argv = ['estimate_builder.py'] + args

                # Run estimation
                exit_code = run_estimation()

                if exit_code == 0:
                    result['status'] = 'success'

                    # Try to read the output to get estimate details
                    try:
                        with open(output_path, 'r') as f:
                            data = json.load(f)
                            result['estimate_total'] = data.get('summary', {}).get('total_usd', 0)
                            result['line_items'] = len(data.get('items', []))
                            self.logger.info(f"✓ Estimate: ${result['estimate_total']:,.2f} ({result['line_items']} line items)")
                    except Exception as e:
                        self.logger.warning(f"Could not read estimate file: {e}")
                else:
                    result['status'] = 'failed'
                    result['error'] = f"Estimation returned exit code {exit_code}"
                    self.logger.error(f"✗ Estimation failed with exit code {exit_code}")

            finally:
                # Restore original sys.argv
                sys.argv = original_argv

        except Exception as e:
            result['status'] = 'failed'
            result['error'] = str(e)
            self.logger.error(f"✗ Estimation failed: {e}", exc_info=True)

        finally:
            result['end_time'] = time.time()
            result['duration'] = result['end_time'] - result['start_time']
            self.logger.info(f"Duration: {result['duration']:.1f}s")

        return result

    def process_all(self, skip_existing: bool = True):
        """
        Process all JSON files in the input directory.

        Args:
            skip_existing: If True, skip files that already have estimates
        """
        self.stats['start_time'] = time.time()

        # Get all JSON files
        json_files = self._get_json_files()
        self.stats['total'] = len(json_files)

        if not json_files:
            self.logger.warning("No JSON files found to process!")
            return

        self.logger.info("")
        self.logger.info("="*80)
        self.logger.info(f"STARTING BATCH ESTIMATION - {len(json_files)} FILES")
        self.logger.info("="*80)
        self.logger.info("")

        # Process each JSON
        for idx, json_path in enumerate(json_files, 1):
            self.logger.info("")
            self.logger.info(f"[{idx}/{len(json_files)}] {json_path.name}")

            output_path = self._get_output_path(json_path)

            # Check if should skip
            if skip_existing and self._should_skip(json_path, output_path):
                self.stats['skipped'] += 1
                continue

            # Estimate JSON
            result = self._estimate_json(json_path, output_path)
            self.stats['results'].append(result)

            # Update statistics
            if result['status'] == 'success':
                self.stats['successful'] += 1
            else:
                self.stats['failed'] += 1

            if idx < len(json_files):  # Don't delay after last file
                time.sleep(1)  # Small delay between estimations

        self.stats['end_time'] = time.time()
        self._print_summary()

    def _print_summary(self):
        """Print estimation summary."""
        duration = self.stats['end_time'] - self.stats['start_time']

        self.logger.info("")
        self.logger.info("="*80)
        self.logger.info("BATCH ESTIMATION COMPLETE")
        self.logger.info("="*80)
        self.logger.info(f"Total Files: {self.stats['total']}")
        self.logger.info(f"Successful: {self.stats['successful']}")
        self.logger.info(f"Failed: {self.stats['failed']}")
        self.logger.info(f"Skipped: {self.stats['skipped']}")
        self.logger.info(f"Total Duration: {duration:.1f}s ({duration/60:.1f} minutes)")

        if self.stats['successful'] > 0:
            avg_duration = sum(r['duration'] for r in self.stats['results'] if r['status'] == 'success') / self.stats['successful']
            total_estimate = sum(r['estimate_total'] for r in self.stats['results'] if r['estimate_total'] is not None)
            total_line_items = sum(r['line_items'] for r in self.stats['results'] if r['line_items'] is not None)
            self.logger.info(f"Average Duration: {avg_duration:.1f}s per file")
            self.logger.info(f"Total Estimate Value: ${total_estimate:,.2f}")
            self.logger.info(f"Total Line Items: {total_line_items}")

        self.logger.info("")
        self.logger.info("Results saved to:")
        self.logger.info(f"  Output Directory: {self.output_dir}")
        self.logger.info(f"  Log File: {self.log_file}")
        self.logger.info("="*80)

        # Print failed files if any
        if self.stats['failed'] > 0:
            self.logger.info("")
            self.logger.info("Failed Files:")
            for result in self.stats['results']:
                if result['status'] == 'failed':
                    self.logger.info(f"  - {result['json']}: {result['error']}")

    def save_summary_json(self, summary_path: Optional[Path] = None):
        """Save estimation summary to JSON file."""
        if summary_path is None:
            summary_path = self.output_dir / "estimation_summary.json"

        summary_data = {
            'timestamp': datetime.now().isoformat(),
            'input_directory': str(self.input_dir),
            'output_directory': str(self.output_dir),
            'region': self.region,
            'state': self.state,
            'statistics': {
                'total_files': self.stats['total'],
                'successful': self.stats['successful'],
                'failed': self.stats['failed'],
                'skipped': self.stats['skipped'],
                'duration_seconds': self.stats['end_time'] - self.stats['start_time'] if self.stats['end_time'] else 0,
                'total_estimate_value': sum(r['estimate_total'] for r in self.stats['results'] if r['estimate_total'] is not None),
                'total_line_items': sum(r['line_items'] for r in self.stats['results'] if r['line_items'] is not None)
            },
            'results': self.stats['results']
        }

        with open(summary_path, 'w') as f:
            json.dump(summary_data, f, indent=2)

        self.logger.info(f"Summary saved to: {summary_path}")


def main():
    """Main entry point for batch estimation."""
    import argparse

    parser = argparse.ArgumentParser(
        description='Batch estimate repair costs from extracted JSON files',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Estimate all extractions from Final/Extraction/New to Final/Estimate-Json/new
  python batch_estimate_reports.py

  # Custom input/output directories
  python batch_estimate_reports.py --input Final/Raw-Json --output Final/Estimate-Json/new

  # Force re-estimation of existing files
  python batch_estimate_reports.py --no-skip

  # Custom region and state
  python batch_estimate_reports.py --region Dallas --state TX

  # Custom log file
  python batch_estimate_reports.py --log-file my_estimation.log
        """
    )

    parser.add_argument(
        '--input',
        default='Final/Extraction/New',
        help='Input directory containing extracted JSON files (default: Final/Extraction/New)'
    )

    parser.add_argument(
        '--output',
        default='Final/Estimate-Json/new',
        help='Output directory for estimate JSON files (default: Final/Estimate-Json/new)'
    )

    parser.add_argument(
        '--region',
        default='Houston',
        help='Region for pricing (default: Houston)'
    )

    parser.add_argument(
        '--state',
        default='TX',
        help='State for pricing (default: TX)'
    )

    parser.add_argument(
        '--log-file',
        help='Log file path (default: auto-generated with timestamp)'
    )

    parser.add_argument(
        '--no-skip',
        action='store_true',
        help='Re-estimate files even if output already exists'
    )

    parser.add_argument(
        '--save-summary',
        action='store_true',
        help='Save estimation summary to JSON file'
    )

    args = parser.parse_args()

    # Check if input directory exists
    input_dir = Path(args.input)
    if not input_dir.exists():
        print(f"ERROR: Input directory does not exist: {input_dir}")
        return 1

    # Create and run batch estimator
    try:
        estimator = BatchEstimator(
            input_dir=args.input,
            output_dir=args.output,
            region=args.region,
            state=args.state,
            log_file=args.log_file
        )

        # Process all JSONs
        estimator.process_all(skip_existing=not args.no_skip)

        # Save summary if requested
        if args.save_summary:
            estimator.save_summary_json()

        # Return exit code based on results
        if estimator.stats['failed'] > 0:
            return 1  # Some failures
        elif estimator.stats['successful'] == 0 and estimator.stats['skipped'] == 0:
            return 1  # Nothing processed
        else:
            return 0  # Success

    except KeyboardInterrupt:
        print("\n\nBatch estimation interrupted by user")
        return 130

    except Exception as e:
        print(f"\n\nFATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
