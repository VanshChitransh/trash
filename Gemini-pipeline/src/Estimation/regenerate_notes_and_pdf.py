#!/usr/bin/env python3
"""
Regenerate notes for test estimate and create PDF to verify formatting.
"""

import json
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from estimate_builder import _create_detailed_notes_from_items
from generate_estimate_pdf import create_professional_pdf

def regenerate_notes_and_pdf():
    """Regenerate notes with improved function and create PDF."""
    
    print("=" * 80)
    print("REGENERATING NOTES AND PDF")
    print("=" * 80)
    
    # Load test estimate
    test_file = Path(__file__).parent / "test-detailed-notes.json"
    
    with open(test_file, 'r') as f:
        estimate_data = json.load(f)
    
    items = estimate_data.get('items', [])
    
    print(f"\nProcessing {len(items)} items...")
    
    # Regenerate notes for each item
    for idx, item in enumerate(items, 1):
        original_items = item.get('original_items', [])
        
        if original_items:
            # Regenerate notes using the improved function
            new_notes = _create_detailed_notes_from_items(original_items)
            item['notes'] = new_notes
            
            print(f"✅ Item {idx}: Regenerated notes ({len(new_notes)} chars)")
        else:
            print(f"⚠️  Item {idx}: No original_items, keeping existing notes")
    
    # Save updated estimate
    output_json = Path(__file__).parent / "test-detailed-notes-regenerated.json"
    with open(output_json, 'w') as f:
        json.dump(estimate_data, f, indent=2)
    
    print(f"\n✅ Saved updated estimate: {output_json.name}")
    
    # Generate PDF
    output_pdf = Path(__file__).parent / "test-detailed-notes-regenerated.pdf"
    
    print(f"\n📝 Generating PDF: {output_pdf.name}")
    
    try:
        create_professional_pdf(estimate_data, str(output_pdf))
        print(f"✅ PDF generated successfully!")
        print(f"\n📄 Review the PDF: {output_pdf}")
        print("\nThe PDF should now show:")
        print("  ✅ Detailed issue titles and locations")
        print("  ✅ Proper formatting with line breaks")
        print("  ✅ Good margins and padding in notes sections")
        print("  ✅ No generic 'Consolidated X related repairs'")
        return True
    except Exception as e:
        print(f"❌ PDF generation failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = regenerate_notes_and_pdf()
    sys.exit(0 if success else 1)

