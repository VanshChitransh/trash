#!/usr/bin/env python3
"""
PDF Annotation and Highlight Extractor

This module extracts highlighted text and annotations/comments from PDF files
using PyMuPDF (fitz). It's designed to work with inspection reports where
inspectors may highlight critical issues or add comments.

Features:
- Extract highlighted text with color information
- Extract annotations/comments with their associated text
- Format extracted data for use in Gemini prompts
- Provide summary statistics

Usage:
    from pdf_annotation_extractor import PDFAnnotationExtractor
    
    with PDFAnnotationExtractor("report.pdf") as extractor:
        data = extractor.extract_all_annotations()
        prompt_context = extractor.format_for_gemini_prompt()
"""

import logging
from pathlib import Path
from typing import Dict, List, Any, Optional
import json

try:
    import fitz  # PyMuPDF
    PYMUPDF_AVAILABLE = True
except ImportError:
    PYMUPDF_AVAILABLE = False
    logging.warning(
        "PyMuPDF not available. Install with 'pip install PyMuPDF' to enable "
        "PDF annotation extraction."
    )


class PDFAnnotationExtractor:
    """Extract annotations and highlights from PDF files."""
    
    def __init__(self, pdf_path: str):
        """
        Initialize the extractor.
        
        Args:
            pdf_path: Path to the PDF file
            
        Raises:
            ImportError: If PyMuPDF is not installed
            FileNotFoundError: If PDF file doesn't exist
        """
        if not PYMUPDF_AVAILABLE:
            raise ImportError(
                "PyMuPDF is required for annotation extraction. "
                "Install it with: pip install PyMuPDF"
            )
        
        self.pdf_path = Path(pdf_path)
        if not self.pdf_path.exists():
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")
        
        self.doc = None
        self.annotations_data = None
    
    def __enter__(self):
        """Context manager entry."""
        self.doc = fitz.open(str(self.pdf_path))
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        if self.doc:
            self.doc.close()
    
    def _get_color_name(self, color: tuple) -> str:
        """
        Convert RGB color tuple to human-readable name.
        
        Args:
            color: RGB tuple (r, g, b) with values 0-1
            
        Returns:
            Color name string
        """
        if not color or len(color) < 3:
            return "unknown"
        
        r, g, b = color[0], color[1], color[2]
        
        # Common highlight colors
        if r > 0.9 and g > 0.9 and b < 0.3:
            return "yellow"
        elif r > 0.9 and g < 0.3 and b < 0.3:
            return "red"
        elif r < 0.3 and g > 0.9 and b < 0.3:
            return "green"
        elif r < 0.3 and g < 0.3 and b > 0.9:
            return "blue"
        elif r > 0.9 and g > 0.5 and b < 0.3:
            return "orange"
        elif r > 0.7 and g < 0.5 and b > 0.7:
            return "purple"
        else:
            return f"rgb({int(r*255)},{int(g*255)},{int(b*255)})"
    
    def extract_page_annotations(self, page_num: int) -> Dict[str, List[Dict[str, Any]]]:
        """
        Extract annotations from a specific page.
        
        Args:
            page_num: Page number (0-based)
            
        Returns:
            Dictionary with 'highlights' and 'annotations' lists
        """
        if not self.doc:
            raise RuntimeError("Document not opened. Use context manager.")
        
        page = self.doc[page_num]
        highlights = []
        annotations = []
        
        for annot in page.annots():
            annot_type = annot.type[0] if annot.type else -1
            
            # Highlight annotation (type 8)
            if annot_type == 8:
                try:
                    # Get highlighted text
                    quad_points = annot.vertices
                    if quad_points:
                        # Extract text from highlighted area
                        rect = annot.rect
                        text = page.get_text("text", clip=rect).strip()
                        
                        if text:
                            color = annot.colors.get("stroke", None) if hasattr(annot, "colors") else None
                            color_name = self._get_color_name(color) if color else "unknown"
                            
                            highlights.append({
                                "page": page_num + 1,  # 1-based for user display
                                "text": text,
                                "color": color_name,
                                "rect": list(rect)
                            })
                except Exception as e:
                    logging.debug(f"Failed to extract highlight on page {page_num + 1}: {e}")
            
            # Text annotation/comment (type 0) or other comment types
            elif annot_type in [0, 1, 2]:
                try:
                    info = annot.info
                    content = info.get("content", "").strip() if info else ""

                    if content:
                        # Try to get associated text near the annotation
                        rect = annot.rect
                        # Expand rect slightly to capture nearby text
                        expanded_rect = fitz.Rect(
                            rect.x0 - 50, rect.y0 - 10,
                            rect.x1 + 50, rect.y1 + 10
                        )
                        nearby_text = page.get_text("text", clip=expanded_rect).strip()

                        annotations.append({
                            "page": page_num + 1,
                            "comment": content,
                            "nearby_text": nearby_text[:200] if nearby_text else "",
                            "author": info.get("title", "Unknown") if info else "Unknown"
                        })
                except Exception as e:
                    logging.debug(f"Failed to extract annotation on page {page_num + 1}: {e}")

        return {
            "highlights": highlights,
            "annotations": annotations
        }

    def extract_all_annotations(self) -> Dict[str, Any]:
        """
        Extract all annotations from the PDF.

        Returns:
            Dictionary containing:
            - highlights: List of all highlights
            - annotations: List of all annotations
            - summary: Statistics about extracted data
            - by_page: Page-by-page breakdown
        """
        if not self.doc:
            raise RuntimeError("Document not opened. Use context manager.")

        all_highlights = []
        all_annotations = []
        by_page = {}

        for page_num in range(len(self.doc)):
            page_data = self.extract_page_annotations(page_num)

            if page_data["highlights"] or page_data["annotations"]:
                by_page[page_num + 1] = page_data

            all_highlights.extend(page_data["highlights"])
            all_annotations.extend(page_data["annotations"])

        self.annotations_data = {
            "pdf_name": self.pdf_path.name,
            "total_pages": len(self.doc),
            "highlights": all_highlights,
            "annotations": all_annotations,
            "summary": {
                "total_highlights": len(all_highlights),
                "total_annotations": len(all_annotations),
                "pages_with_markup": len(by_page),
                "highlight_colors": self._count_colors(all_highlights)
            },
            "by_page": by_page
        }

        return self.annotations_data

    def _count_colors(self, highlights: List[Dict[str, Any]]) -> Dict[str, int]:
        """Count highlights by color."""
        color_counts = {}
        for h in highlights:
            color = h.get("color", "unknown")
            color_counts[color] = color_counts.get(color, 0) + 1
        return color_counts

    def format_for_gemini_prompt(self) -> str:
        """
        Format extracted annotations for inclusion in Gemini prompt.

        Returns:
            Formatted string to append to Gemini prompt
        """
        if not self.annotations_data:
            self.extract_all_annotations()

        if not self.annotations_data:
            return ""

        summary = self.annotations_data.get("summary", {})
        highlights = self.annotations_data.get("highlights", [])
        annotations = self.annotations_data.get("annotations", [])

        # If no annotations or highlights, return empty
        if not highlights and not annotations:
            return ""

        lines = [
            "\n\n=== ADDITIONAL CONTEXT FROM PDF ANNOTATIONS ===\n",
            f"The inspector has marked {summary.get('total_highlights', 0)} items with highlights "
            f"and added {summary.get('total_annotations', 0)} comments in this PDF.\n"
        ]

        # Add highlights section
        if highlights:
            lines.append("\n--- HIGHLIGHTED TEXT (Inspector emphasized these items) ---\n")
            for i, h in enumerate(highlights, 1):
                color = h.get("color", "unknown")
                page = h.get("page", "?")
                text = h.get("text", "")[:300]  # Limit length
                lines.append(f"\n{i}. [Page {page}] [{color.upper()} highlight]")
                lines.append(f"   Text: {text}\n")

        # Add annotations section
        if annotations:
            lines.append("\n--- INSPECTOR COMMENTS/ANNOTATIONS ---\n")
            for i, a in enumerate(annotations, 1):
                page = a.get("page", "?")
                comment = a.get("comment", "")
                nearby = a.get("nearby_text", "")[:200]
                lines.append(f"\n{i}. [Page {page}] Comment: {comment}")
                if nearby:
                    lines.append(f"   Context: {nearby}\n")

        lines.append("\n=== END OF ANNOTATION CONTEXT ===\n")
        lines.append("\nIMPORTANT: Items that are highlighted or have inspector comments should be ")
        lines.append("given HIGHER priority in your extraction. Mark these issues with:")
        lines.append('- "from_highlight": true (if from highlighted text)')
        lines.append('- "from_annotation": true (if from annotation/comment)')
        lines.append('- "highlight_color": "<color>" (if applicable)')
        lines.append('- "annotation_text": "<comment text>" (if applicable)\n')

        return "".join(lines)

    def save_to_json(self, output_path: str) -> None:
        """
        Save extracted annotations to JSON file.

        Args:
            output_path: Path to save JSON file
        """
        if not self.annotations_data:
            self.extract_all_annotations()

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(self.annotations_data, f, indent=2, ensure_ascii=False)

        logging.info(f"Saved annotation data to {output_path}")


def main():
    """CLI interface for testing the extractor."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Extract highlights and annotations from PDF inspection reports"
    )
    parser.add_argument("pdf_path", help="Path to PDF file")
    parser.add_argument(
        "-o", "--output",
        help="Save extracted data to JSON file"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose logging"
    )
    parser.add_argument(
        "--prompt",
        action="store_true",
        help="Show formatted prompt context"
    )

    args = parser.parse_args()

    # Configure logging
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s: %(message)s"
    )

    try:
        with PDFAnnotationExtractor(args.pdf_path) as extractor:
            data = extractor.extract_all_annotations()

            # Print summary
            summary = data.get("summary", {})
            print(f"\n=== EXTRACTION SUMMARY ===")
            print(f"PDF: {data.get('pdf_name')}")
            print(f"Total Pages: {data.get('total_pages')}")
            print(f"Highlights: {summary.get('total_highlights', 0)}")
            print(f"Annotations: {summary.get('total_annotations', 0)}")
            print(f"Pages with Markup: {summary.get('pages_with_markup', 0)}")

            if summary.get('highlight_colors'):
                print(f"\nHighlight Colors:")
                for color, count in summary['highlight_colors'].items():
                    print(f"  - {color}: {count}")

            # Save to file if requested
            if args.output:
                extractor.save_to_json(args.output)
                print(f"\n✅ Saved to {args.output}")

            # Show prompt context if requested
            if args.prompt:
                prompt_context = extractor.format_for_gemini_prompt()
                print(prompt_context)

    except Exception as e:
        logging.error(f"Failed to extract annotations: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        return 1

    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())

