#!/usr/bin/env python3
"""
Batch PDF Extraction Script.

This script processes all PDF reports from the repair/reports folder,
extracts inspection data using the Gemini API with a single API key,
and saves the results to Final/Extraction/New folder.

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
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Extraction'))

# Import inspection extractor
try:
    from inspection_extractor import main as run_extraction
    EXTRACTOR_AVAILABLE = True
except ImportError:
    EXTRACTOR_AVAILABLE = False
    print("ERROR: inspection_extractor not available. Cannot proceed.")
    sys.exit(1)


class BatchExtractor:
    """Batch PDF extraction with logging."""
    
    def __init__(self, input_dir: str, output_dir: str, log_file: Optional[str] = None):
        """
        Initialize batch extractor.
        
        Args:
            input_dir: Directory containing PDF files to process
            output_dir: Directory to save extracted JSON files
            log_file: Optional log file path (default: auto-generated)
        """
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        
        # Create output directory if it doesn't exist
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Setup logging
        if log_file is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            log_file = f"batch_extraction_{timestamp}.log"
        
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
        self.logger = logging.getLogger('BatchExtractor')
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
        self.logger.info("BATCH PDF EXTRACTION - STARTED")
        self.logger.info("="*80)
        self.logger.info(f"Input Directory: {self.input_dir}")
        self.logger.info(f"Output Directory: {self.output_dir}")
        self.logger.info(f"Log File: {self.log_file}")
    
    def _get_api_key(self) -> str:
        """Get API key from environment."""
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            self.logger.error("No GEMINI_API_KEY found in environment!")
            raise ValueError("GEMINI_API_KEY environment variable is required")
        
        self.logger.info("Using GEMINI_API_KEY from environment")
        return api_key

    def _get_pdf_files(self) -> List[Path]:
        """Get all PDF files from input directory."""
        pdf_files = sorted(self.input_dir.glob("*.pdf"))
        self.logger.info(f"Found {len(pdf_files)} PDF file(s) in {self.input_dir}")
        return pdf_files

    def _get_output_path(self, pdf_path: Path) -> Path:
        """Get output JSON path for a PDF file."""
        # Use same name but with .json extension
        json_name = pdf_path.stem + ".json"
        return self.output_dir / json_name

    def _should_skip(self, pdf_path: Path, output_path: Path) -> bool:
        """Check if PDF should be skipped (already processed)."""
        if output_path.exists():
            self.logger.info(f"Output already exists: {output_path.name} - SKIPPING")
            return True
        return False

    def _extract_pdf(self, pdf_path: Path, output_path: Path) -> Dict[str, Any]:
        """
        Extract a single PDF file.

        Returns:
            Dictionary with extraction result info
        """
        result = {
            'pdf': pdf_path.name,
            'output': output_path.name,
            'status': 'unknown',
            'error': None,
            'start_time': time.time(),
            'end_time': None,
            'duration': None,
            'issues_count': None
        }

        try:
            self.logger.info("─" * 80)
            self.logger.info(f"Processing: {pdf_path.name}")
            self.logger.info(f"Output: {output_path.name}")
            self.logger.info("─" * 80)

            # Build command line arguments for inspection_extractor
            args = [
                str(pdf_path),
                '--output', str(output_path),
                '--log-level', 'INFO'
            ]

            # Save original sys.argv
            original_argv = sys.argv

            try:
                # Set sys.argv for the extractor
                sys.argv = ['inspection_extractor.py'] + args

                # Run extraction
                exit_code = run_extraction()

                if exit_code == 0:
                    result['status'] = 'success'

                    # Try to read the output to get issue count
                    try:
                        with open(output_path, 'r') as f:
                            data = json.load(f)
                            result['issues_count'] = data.get('summary', {}).get('total_issues', 0)
                            self.logger.info(f"✓ Extracted {result['issues_count']} issues")
                    except Exception as e:
                        self.logger.warning(f"Could not read output file: {e}")
                else:
                    result['status'] = 'failed'
                    result['error'] = f"Extraction returned exit code {exit_code}"
                    self.logger.error(f"✗ Extraction failed with exit code {exit_code}")

            finally:
                # Restore original sys.argv
                sys.argv = original_argv

        except Exception as e:
            result['status'] = 'failed'
            result['error'] = str(e)
            self.logger.error(f"✗ Extraction failed: {e}", exc_info=True)

        finally:
            result['end_time'] = time.time()
            result['duration'] = result['end_time'] - result['start_time']
            self.logger.info(f"Duration: {result['duration']:.1f}s")

        return result

    def process_all(self, skip_existing: bool = True):
        """
        Process all PDF files in the input directory.

        Args:
            skip_existing: If True, skip PDFs that already have output files
        """
        self.stats['start_time'] = time.time()

        # Get all PDF files
        pdf_files = self._get_pdf_files()
        self.stats['total'] = len(pdf_files)

        if not pdf_files:
            self.logger.warning("No PDF files found to process!")
            return

        self.logger.info("")
        self.logger.info("="*80)
        self.logger.info(f"STARTING BATCH EXTRACTION - {len(pdf_files)} FILES")
        self.logger.info("="*80)
        self.logger.info("")

        # Process each PDF
        for idx, pdf_path in enumerate(pdf_files, 1):
            self.logger.info("")
            self.logger.info(f"[{idx}/{len(pdf_files)}] {pdf_path.name}")

            output_path = self._get_output_path(pdf_path)

            # Check if should skip
            if skip_existing and self._should_skip(pdf_path, output_path):
                self.stats['skipped'] += 1
                continue

            # Extract PDF
            result = self._extract_pdf(pdf_path, output_path)
            self.stats['results'].append(result)

            # Update statistics
            if result['status'] == 'success':
                self.stats['successful'] += 1
            else:
                self.stats['failed'] += 1

            if idx < len(pdf_files):  # Don't delay after last file
                time.sleep(1)  # Small delay between extractions

        self.stats['end_time'] = time.time()
        self._print_summary()

    def _print_summary(self):
        """Print extraction summary."""
        duration = self.stats['end_time'] - self.stats['start_time']

        self.logger.info("")
        self.logger.info("="*80)
        self.logger.info("BATCH EXTRACTION COMPLETE")
        self.logger.info("="*80)
        self.logger.info(f"Total Files: {self.stats['total']}")
        self.logger.info(f"Successful: {self.stats['successful']}")
        self.logger.info(f"Failed: {self.stats['failed']}")
        self.logger.info(f"Skipped: {self.stats['skipped']}")
        self.logger.info(f"Total Duration: {duration:.1f}s ({duration/60:.1f} minutes)")

        if self.stats['successful'] > 0:
            avg_duration = sum(r['duration'] for r in self.stats['results'] if r['status'] == 'success') / self.stats['successful']
            total_issues = sum(r['issues_count'] for r in self.stats['results'] if r['issues_count'] is not None)
            self.logger.info(f"Average Duration: {avg_duration:.1f}s per file")
            self.logger.info(f"Total Issues Extracted: {total_issues}")

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
                    self.logger.info(f"  - {result['pdf']}: {result['error']}")

    def save_summary_json(self, summary_path: Optional[Path] = None):
        """Save extraction summary to JSON file."""
        if summary_path is None:
            summary_path = self.output_dir / "extraction_summary.json"

        summary_data = {
            'timestamp': datetime.now().isoformat(),
            'input_directory': str(self.input_dir),
            'output_directory': str(self.output_dir),
            'statistics': {
                'total_files': self.stats['total'],
                'successful': self.stats['successful'],
                'failed': self.stats['failed'],
                'skipped': self.stats['skipped'],
                'duration_seconds': self.stats['end_time'] - self.stats['start_time'] if self.stats['end_time'] else 0
            },
            'results': self.stats['results']
        }

        with open(summary_path, 'w') as f:
            json.dump(summary_data, f, indent=2)

        self.logger.info(f"Summary saved to: {summary_path}")


def main():
    """Main entry point for batch extraction."""
    import argparse

    parser = argparse.ArgumentParser(
        description='Batch extract inspection reports from PDFs',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Extract all reports from repair/reports to Final/Extraction/New
  python batch_extract_reports.py

  # Custom input/output directories
  python batch_extract_reports.py --input PDFs --output Final/Raw-Json

  # Force re-extraction of existing files
  python batch_extract_reports.py --no-skip

  # Custom log file
  python batch_extract_reports.py --log-file my_extraction.log
        """
    )

    parser.add_argument(
        '--input',
        default='repair/reports',
        help='Input directory containing PDF files (default: repair/reports)'
    )

    parser.add_argument(
        '--output',
        default='Final/Extraction/New',
        help='Output directory for JSON files (default: Final/Extraction/New)'
    )

    parser.add_argument(
        '--log-file',
        help='Log file path (default: auto-generated with timestamp)'
    )

    parser.add_argument(
        '--no-skip',
        action='store_true',
        help='Re-extract files even if output already exists'
    )

    parser.add_argument(
        '--save-summary',
        action='store_true',
        help='Save extraction summary to JSON file'
    )

    args = parser.parse_args()

    # Check if input directory exists
    input_dir = Path(args.input)
    if not input_dir.exists():
        print(f"ERROR: Input directory does not exist: {input_dir}")
        return 1

    # Create and run batch extractor
    try:
        extractor = BatchExtractor(
            input_dir=args.input,
            output_dir=args.output,
            log_file=args.log_file
        )

        # Process all PDFs
        extractor.process_all(skip_existing=not args.no_skip)

        # Save summary if requested
        if args.save_summary:
            extractor.save_summary_json()

        # Return exit code based on results
        if extractor.stats['failed'] > 0:
            return 1  # Some failures
        elif extractor.stats['successful'] == 0 and extractor.stats['skipped'] == 0:
            return 1  # Nothing processed
        else:
            return 0  # Success

    except KeyboardInterrupt:
        print("\n\nBatch extraction interrupted by user")
        return 130

    except Exception as e:
        print(f"\n\nFATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
