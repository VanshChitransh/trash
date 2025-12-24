#!/usr/bin/env python3
"""
Batch estimation script for unbiased pricing.

Processes all JSON files from Final/Extraction/New and generates
unbiased estimates in Final/Estimate-Json/Unbiased using a single API key.
"""

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any

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


class UnbiasedBatchEstimator:
    """Batch estimation for unbiased pricing."""
    
    def __init__(
        self,
        input_dir: str = "Final/Extraction/New",
        output_dir: str = "Final/Estimate-Json/Unbiased",
        region: str = "Houston",
        state: str = "TX",
        log_file: str = "batch_estimate_unbiased.log"
    ):
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        self.region = region
        self.state = state
        
        # Create output directory
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
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
        """Setup logging to file and console."""
        self.logger = logging.getLogger('UnbiasedBatchEstimator')
        self.logger.setLevel(logging.INFO)
        
        # File handler
        fh = logging.FileHandler(self.log_file, mode='w')
        fh.setLevel(logging.DEBUG)
        fh.setFormatter(logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        ))
        
        # Console handler
        ch = logging.StreamHandler()
        ch.setLevel(logging.INFO)
        ch.setFormatter(logging.Formatter('%(levelname)s: %(message)s'))
        
        self.logger.addHandler(fh)
        self.logger.addHandler(ch)
    
    def _get_api_key(self) -> str:
        """Get API key from environment."""
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            self.logger.error("No GEMINI_API_KEY found in environment!")
            raise ValueError("GEMINI_API_KEY environment variable is required")
        
        self.logger.info("Using GEMINI_API_KEY from environment")
        return api_key

    def _get_json_files(self) -> List[Path]:
        """Get all JSON files from input directory (excluding summary files)."""
        json_files = sorted([
            f for f in self.input_dir.glob("*.json")
            if not f.name.endswith('_summary.json') and not f.name.startswith('extraction_')
        ])
        self.logger.info(f"Found {len(json_files)} JSON file(s) in {self.input_dir}")
        return json_files

    def _get_output_path(self, json_path: Path) -> Path:
        """Get output path for estimate JSON."""
        # Keep same filename: 1-report.json -> 1-estimate.json
        output_name = json_path.name.replace('-report.json', '-estimate.json')
        return self.output_dir / output_name

    def _should_skip(self, json_path: Path, output_path: Path) -> bool:
        """Check if file should be skipped (already exists)."""
        if not output_path.exists():
            return False

        # Check if output is newer than input
        input_mtime = json_path.stat().st_mtime
        output_mtime = output_path.stat().st_mtime

        if output_mtime > input_mtime:
            self.logger.info(f"⏭️  Skipping {json_path.name} (estimate already exists and is newer)")
            return True

        return False

    def _get_issue_count(self, json_path: Path) -> int:
        """Get issue count from JSON file."""
        try:
            with open(json_path, 'r') as f:
                data = json.load(f)
                return len(data.get('issues', []))
        except Exception as e:
            self.logger.warning(f"Failed to get issue count from {json_path.name}: {e}")
            return 0

    def _estimate_json(self, json_path: Path, output_path: Path) -> Dict[str, Any]:
        """Estimate a single JSON file."""
        result = {
            'input': str(json_path),
            'output': str(output_path),
            'status': 'failed',
            'issues_count': 0,
            'total_usd': 0,
            'items_count': 0,
            'quality_score': 0,
            'duration': 0,
            'error': None
        }

        start_time = time.time()

        try:
            # Get issue count
            result['issues_count'] = self._get_issue_count(json_path)

            self.logger.info("─" * 80)
            self.logger.info(f"📄 Processing: {json_path.name}")
            self.logger.info(f"📊 Issues: {result['issues_count']}")
            self.logger.info(f"📁 Output: {output_path.name}")
            self.logger.info("─" * 80)

            # Build command line arguments for estimate_builder
            args = [
                str(json_path),
                '-o', str(output_path),
                '--region', self.region,
                '--state', self.state,
                '--log-level', 'WARNING'  # Suppress estimate_builder logs
            ]

            # Save original sys.argv
            original_argv = sys.argv

            try:
                # Set sys.argv for estimate_builder
                sys.argv = ['estimate_builder.py'] + args

                # Run estimation
                exit_code = run_estimation()

                if exit_code != 0:
                    raise RuntimeError(f"Estimation failed with exit code {exit_code}")

                # Read result
                if output_path.exists():
                    with open(output_path, 'r') as f:
                        estimate_data = json.load(f)
                        result['total_usd'] = estimate_data.get('summary', {}).get('total_usd', 0)
                        result['items_count'] = len(estimate_data.get('items', []))
                        result['quality_score'] = estimate_data.get('estimate_meta', {}).get('quality_checks', {}).get('overall_quality_score', 0)

                    result['status'] = 'success'
                    result['duration'] = time.time() - start_time

                    self.logger.info(f"✅ Success: ${result['total_usd']:,.0f} ({result['items_count']} items, quality: {result['quality_score']:.1f}/100)")
                else:
                    raise RuntimeError("Output file not created")

            finally:
                # Restore original sys.argv
                sys.argv = original_argv

        except Exception as e:
            result['status'] = 'failed'
            result['error'] = str(e)
            result['duration'] = time.time() - start_time
            self.logger.error(f"❌ Failed: {e}")

        return result

    def _print_summary(self):
        """Print batch processing summary."""
        duration = self.stats['end_time'] - self.stats['start_time']

        self.logger.info("")
        self.logger.info("=" * 80)
        self.logger.info("📊 BATCH ESTIMATION SUMMARY")
        self.logger.info("=" * 80)
        self.logger.info(f"Total files: {self.stats['total']}")
        self.logger.info(f"✅ Successful: {self.stats['successful']}")
        self.logger.info(f"❌ Failed: {self.stats['failed']}")
        self.logger.info(f"⏭️  Skipped: {self.stats['skipped']}")
        self.logger.info(f"⏱️  Duration: {duration:.1f}s ({duration/60:.1f} minutes)")

        if self.stats['successful'] > 0:
            total_estimate = sum(r['total_usd'] for r in self.stats['results'] if r['status'] == 'success')
            avg_estimate = total_estimate / self.stats['successful']
            avg_quality = sum(r['quality_score'] for r in self.stats['results'] if r['status'] == 'success') / self.stats['successful']

            self.logger.info(f"💰 Total estimate value: ${total_estimate:,.0f}")
            self.logger.info(f"📈 Average estimate: ${avg_estimate:,.0f}")
            self.logger.info(f"⭐ Average quality score: {avg_quality:.1f}/100")

        self.logger.info("=" * 80)

        # Save summary JSON
        summary_path = self.output_dir / "estimation_summary.json"
        summary_data = {
            'batch_info': {
                'timestamp': datetime.now().isoformat(),
                'input_dir': str(self.input_dir),
                'output_dir': str(self.output_dir),
                'region': self.region,
                'state': self.state,
                'duration_seconds': duration
            },
            'statistics': {
                'total': self.stats['total'],
                'successful': self.stats['successful'],
                'failed': self.stats['failed'],
                'skipped': self.stats['skipped']
            },
            'results': self.stats['results']
        }

        with open(summary_path, 'w') as f:
            json.dump(summary_data, f, indent=2)

        self.logger.info(f"📄 Summary saved to: {summary_path}")

    def run(self, skip_existing: bool = False):
        """Run batch estimation."""
        self.logger.info("🚀 Starting Unbiased Batch Estimation")
        self.logger.info(f"📂 Input: {self.input_dir}")
        self.logger.info(f"📂 Output: {self.output_dir}")
        self.logger.info(f"🌎 Region: {self.region}, State: {self.state}")
        self.logger.info("")

        # Get JSON files
        json_files = self._get_json_files()

        if not json_files:
            self.logger.error("No JSON files found!")
            return

        self.stats['total'] = len(json_files)
        self.stats['start_time'] = time.time()

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

        self.stats['end_time'] = time.time()
        self._print_summary()


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Batch estimation with unbiased pricing'
    )
    parser.add_argument(
        '--input-dir',
        default='Final/Extraction/New',
        help='Input directory containing JSON files (default: Final/Extraction/New)'
    )
    parser.add_argument(
        '--output-dir',
        default='Final/Estimate-Json/Unbiased',
        help='Output directory for estimates (default: Final/Estimate-Json/Unbiased)'
    )
    parser.add_argument(
        '--region',
        default='Houston',
        help='Texas region for pricing (default: Houston)'
    )
    parser.add_argument(
        '--state',
        default='TX',
        help='State for pricing (default: TX)'
    )
    parser.add_argument(
        '--skip-existing',
        action='store_true',
        help='Skip files that already have estimates'
    )
    parser.add_argument(
        '--log-file',
        default='batch_estimate_unbiased.log',
        help='Log file path (default: batch_estimate_unbiased.log)'
    )

    args = parser.parse_args()

    # Create estimator
    estimator = UnbiasedBatchEstimator(
        input_dir=args.input_dir,
        output_dir=args.output_dir,
        region=args.region,
        state=args.state,
        log_file=args.log_file
    )

    # Run batch estimation
    estimator.run(skip_existing=args.skip_existing)


if __name__ == '__main__':
    main()
