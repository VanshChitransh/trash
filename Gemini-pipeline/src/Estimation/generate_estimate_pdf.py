#!/usr/bin/env python3
"""
Generate Estimate PDFs from JSON Files

This script converts all JSON estimate files from ../Final/Estimate-Json/
into formatted PDF reports saved to ../PDFs/
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.pdfgen import canvas

# Import trade categorizer
try:
    from trade_categorizer import normalize_category as trade_normalize
except ImportError:
    # Fallback if trade_categorizer not available
    def trade_normalize(category: str, description: str = "", notes: str = "") -> str:
        return category.upper()


def truncate_text(text, max_length=200):
    """Truncate text to max_length characters, adding ellipsis if needed."""
    if not text:
        return ""
    text = str(text)
    if len(text) > max_length:
        return text[:max_length - 3] + "..."
    return text


def format_currency(amount):
    """Format a number as USD currency."""
    return f"${amount:,.2f}"


def normalize_category(category, description, notes=""):
    """Use trade-based categorization."""
    return trade_normalize(category, description, notes)


def create_professional_pdf(json_data, output_path):
    """Create professional estimate PDF matching template format."""
    
    # Extract data
    items = json_data.get('items', [])
    metadata = json_data.get('estimate_meta', {})
    property_info = json_data.get('property', {})
    
    # Get property address for header
    property_address = property_info.get('address', metadata.get('prepared_for', {}).get('address', 'N/A'))
    
    # Create document
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=letter,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=1.25*inch,
        bottomMargin=1*inch
    )
    
    # Set up page templates with headers/footers
    def on_first_page(canvas_obj, doc_obj):
        """Draw header on first page."""
        canvas_obj.saveState()
        canvas_obj.setFont("Helvetica-Bold", 10)
        canvas_obj.drawString(inch, 10.5 * inch, "REPAIR ESTIMATE")
        canvas_obj.setFont("Helvetica", 9)
        if property_address:
            address_text = property_address[:50] if len(property_address) > 50 else property_address
            canvas_obj.drawString(inch, 10.3 * inch, address_text)
        canvas_obj.drawRightString(7.5 * inch, 10.3 * inch, "Page 1")
        
        # Footer
        canvas_obj.setFont("Helvetica", 8)
        canvas_obj.drawString(inch, 0.5 * inch, "This estimate is valid for 30 days")
        canvas_obj.drawRightString(7.5 * inch, 0.5 * inch, datetime.now().strftime("%B %d, %Y"))
        canvas_obj.restoreState()
    
    def on_later_pages(canvas_obj, doc_obj):
        """Draw header on subsequent pages."""
        page_num = canvas_obj.getPageNumber()
        canvas_obj.saveState()
        canvas_obj.setFont("Helvetica-Bold", 10)
        canvas_obj.drawString(inch, 10.5 * inch, "REPAIR ESTIMATE")
        canvas_obj.setFont("Helvetica", 9)
        if property_address:
            address_text = property_address[:50] if len(property_address) > 50 else property_address
            canvas_obj.drawString(inch, 10.3 * inch, address_text)
        canvas_obj.drawRightString(7.5 * inch, 10.3 * inch, f"Page {page_num}")
        
        # Footer
        canvas_obj.setFont("Helvetica", 8)
        canvas_obj.drawString(inch, 0.5 * inch, "This estimate is valid for 30 days")
        canvas_obj.drawRightString(7.5 * inch, 0.5 * inch, datetime.now().strftime("%B %d, %Y"))
        canvas_obj.restoreState()
    
    # Create styles
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=20,
        textColor=colors.HexColor('#003366'),
        spaceAfter=20,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    header_style = ParagraphStyle(
        'Header',
        parent=styles['Normal'],
        fontSize=14,
        textColor=colors.HexColor('#003366'),
        spaceAfter=10,
        fontName='Helvetica-Bold'
    )
    
    category_style = ParagraphStyle(
        'Category',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.white,
        backColor=colors.HexColor('#003366'),
        leftIndent=10,
        spaceAfter=5,
        fontName='Helvetica-Bold'
    )
    
    # Build document elements
    story = []
    
    # Add company header (if logo available)
    # story.append(Image('logo.png', width=2*inch, height=1*inch))
    
    # Title
    story.append(Paragraph("PROPERTY REPAIR ESTIMATE", title_style))
    story.append(Spacer(1, 0.25*inch))
    
    # Property Information Table
    prepared_for = metadata.get('prepared_for', {})
    property_data = [
        ['PROPERTY INFORMATION', ''],
        ['Address:', property_info.get('address', prepared_for.get('address', 'N/A'))],
        ['City/State/Zip:', f"{property_info.get('city', prepared_for.get('city', ''))}, {property_info.get('state', prepared_for.get('state', 'TX'))} {property_info.get('zip', prepared_for.get('zip', ''))}"],
        ['Inspection Date:', metadata.get('inspection_date', 'N/A')],
        ['Estimate Date:', datetime.now().strftime('%B %d, %Y')],
        ['Estimate Valid Until:', (datetime.now() + timedelta(days=30)).strftime('%B %d, %Y')]
    ]
    
    property_table = Table(property_data, colWidths=[2*inch, 4.5*inch])
    property_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#003366')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('SPAN', (0, 0), (-1, 0)),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f0f0f0')),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('ALIGN', (0, 1), (0, -1), 'RIGHT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    
    story.append(property_table)
    story.append(Spacer(1, 0.5*inch))
    
    # Group items by category
    items_by_category = {}
    for item in items:
        cat = normalize_category(
            item.get('category', 'MISCELLANEOUS'),
            item.get('description', ''),
            item.get('notes', '')
        )
        if cat not in items_by_category:
            items_by_category[cat] = []
        items_by_category[cat].append(item)
    
    # Category order
    category_order = [
        "FOUNDATION", "ROOF", "PLUMBING", "ELECTRICAL", 
        "HVAC", "WINDOWS/DOORS", "ATTIC", "MISCELLANEOUS"
    ]
    
    # Create estimate table for each category
    grand_total = 0
    
    for category in category_order:
        if category not in items_by_category:
            continue
            
        cat_items = items_by_category[category]
        
        # Category header
        cat_header = [[category]]
        cat_header_table = Table(cat_header, colWidths=[6.5*inch])
        cat_header_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#003366')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(cat_header_table)
        
        # Items table
        data = [['#', 'Description', 'Qty', 'Unit Price', 'Total']]
        note_rows = []  # Track which rows are notes for special styling

        category_total = 0
        for idx, item in enumerate(cat_items, 1):
            qty = item.get('qty', 1)
            unit_price = item.get('unit_price_usd', 0)
            total = qty * unit_price
            category_total += total

            # Use Paragraph for description to allow proper text wrapping
            description = item.get('description', '')
            desc_style = ParagraphStyle(
                'DescriptionStyle',
                parent=getSampleStyleSheet()['Normal'],
                fontSize=9,
                textColor=colors.black,
                leftIndent=0,
                rightIndent=0,
                spaceAfter=2,
                spaceBefore=2,
                leading=11,
                wordWrap='CJK'
            )
            desc_para = Paragraph(description, desc_style)

            data.append([
                str(idx),
                desc_para,
                str(qty),
                f"${unit_price:,.2f}",
                f"${total:,.2f}"
            ])

            # Add notes row if present
            if item.get('notes'):
                notes_text = item.get('notes', '')

                # Check if notes contain line breaks (detailed multi-item notes)
                if '\n' in notes_text:
                    # Multi-line detailed notes - format as a list with better spacing
                    note_style = ParagraphStyle(
                        'DetailedNoteStyle',
                        parent=getSampleStyleSheet()['Normal'],
                        fontSize=8.5,
                        textColor=colors.HexColor('#333333'),
                        leftIndent=5,
                        rightIndent=5,
                        spaceAfter=3,
                        spaceBefore=3,
                        leading=13,  # Increased line height to prevent cutoff
                        bulletIndent=5,
                        wordWrap='CJK'
                    )
                    # Replace line breaks with HTML breaks for proper rendering
                    formatted_notes = notes_text.replace('\n', '<br/>')
                    note_para = Paragraph(f"<b>Includes:</b><br/>{formatted_notes}", note_style)
                else:
                    # Single-line note - use compact style
                    note_style = ParagraphStyle(
                        'NoteStyle',
                        parent=getSampleStyleSheet()['Normal'],
                        fontSize=8.5,
                        textColor=colors.HexColor('#333333'),
                        leftIndent=5,
                        rightIndent=5,
                        spaceAfter=3,
                        spaceBefore=3,
                        leading=12,  # Increased line height
                        wordWrap='CJK'
                    )
                    note_para = Paragraph(f"<b>Details:</b> {notes_text}", note_style)

                data.append(['', note_para, '', '', ''])
                note_rows.append(len(data) - 1)  # Track this row index
        
        # Add category subtotal
        data.append(['', '', '', 'Subtotal:', f"${category_total:,.2f}"])
        grand_total += category_total
        
        # Create table
        col_widths = [0.4*inch, 3.8*inch, 0.6*inch, 1*inch, 1*inch]
        items_table = Table(data, colWidths=col_widths)
        
        # Style the table with better padding to prevent text cutoff
        table_style = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e0e0e0')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),
            ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            # Increased padding for all cells to prevent text cutoff
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ]

        # Add extra padding for note rows to make them more readable
        for note_row in note_rows:
            table_style.append(('TOPPADDING', (0, note_row), (-1, note_row), 14))
            table_style.append(('BOTTOMPADDING', (0, note_row), (-1, note_row), 14))
            table_style.append(('LEFTPADDING', (1, note_row), (1, note_row), 18))
            table_style.append(('RIGHTPADDING', (1, note_row), (1, note_row), 18))
            table_style.append(('BACKGROUND', (0, note_row), (-1, note_row), colors.HexColor('#f9f9f9')))
            table_style.append(('VALIGN', (0, note_row), (-1, note_row), 'TOP'))

        # Highlight subtotal row
        table_style.append(('BACKGROUND', (0, len(data)-1), (-1, len(data)-1), colors.HexColor('#ffff99')))
        table_style.append(('FONTNAME', (3, len(data)-1), (-1, len(data)-1), 'Helvetica-Bold'))
        
        items_table.setStyle(TableStyle(table_style))
        story.append(items_table)
        story.append(Spacer(1, 0.4*inch))

    # Grand Total Section - Highly visible with prominent styling
    # Add extra spacing before grand total
    story.append(Spacer(1, 0.3*inch))

    # Create a simple 2-column table for Grand Total with proper spacing
    total_data = [
        ['GRAND TOTAL:', f"${grand_total:,.2f}"]
    ]

    # Use wider columns to prevent text squishing
    total_table = Table(total_data, colWidths=[2.5*inch, 2.0*inch])
    total_table.setStyle(TableStyle([
        # Background and text color
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#003366')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 16),
        # Alignment
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),  # Label aligned left
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),  # Amount aligned right
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        # Generous padding to prevent text cutoff
        ('TOPPADDING', (0, 0), (-1, -1), 20),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 20),
        ('LEFTPADDING', (0, 0), (0, 0), 20),
        ('RIGHTPADDING', (1, 0), (1, 0), 20),
        # Border
        ('BOX', (0, 0), (-1, -1), 2, colors.HexColor('#003366')),
    ]))

    story.append(total_table)
    story.append(Spacer(1, 1.0*inch))  # Increased spacing after total
    
    # Build PDF with page templates
    doc.build(story, onFirstPage=on_first_page, onLaterPages=on_later_pages)
    
    return True


def create_pdf_from_json(json_path, output_path):
    """Main entry point for PDF generation."""
    try:
        # Load JSON data
        json_path_str = str(json_path)
        with open(json_path_str, 'r', encoding='utf-8') as f:
            json_data = json.load(f)
        
        # Ensure property information is present
        if 'property' not in json_data:
            metadata = json_data.get('estimate_meta', {})
            prepared_for = metadata.get('prepared_for', {})
            json_data['property'] = {
                'address': prepared_for.get('address', metadata.get('address', 'N/A')),
                'city': prepared_for.get('city', metadata.get('city', 'N/A')),
                'state': prepared_for.get('state', metadata.get('state', 'TX')),
                'zip': prepared_for.get('zip', metadata.get('zip', 'N/A'))
            }
        
        # Ensure items exist
        items = json_data.get('items', [])
        if not items:
            print(f"⚠️  Warning: No items found in {json_path_str}")
            return False
        
        # Create professional PDF
        return create_professional_pdf(json_data, output_path)
        
    except json.JSONDecodeError as e:
        print(f"❌ Error: Invalid JSON in {json_path_str}: {e}")
        return False
    except Exception as e:
        print(f"❌ Error creating PDF: {e}")
        import traceback
        traceback.print_exc()
        return False


def process_single_file(json_file_path, output_dir):
    """Process a single JSON file and generate its PDF."""
    json_file = Path(json_file_path).resolve()
    
    # Check if file exists
    if not json_file.exists():
        print(f"❌ Error: File not found: {json_file}")
        return False
    
    # Check if it's a JSON file
    if not json_file.suffix.lower() == '.json':
        print(f"❌ Error: File must be a JSON file: {json_file}")
        return False
    
    # Generate output filename
    pdf_filename = json_file.stem + '.pdf'
    pdf_path = output_dir / pdf_filename
    
    # Read JSON to get item count for logging
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        item_count = len(data.get('items', []))
    except Exception as e:
        print(f"⚠️  Warning: Could not read item count: {e}")
        item_count = 0
    
    # Generate PDF
    if create_pdf_from_json(json_file, pdf_path):
        print(f"✅ Loaded {json_file.name} ({item_count} items)")
        print(f"✅ Generated PDF: {pdf_path}")
        return True
    else:
        print(f"❌ Failed to process {json_file.name}")
        return False


def process_all_files(input_dir, output_dir):
    """Process all JSON files in the input directory."""
    # Check if input directory exists
    if not input_dir.exists():
        print(f"❌ Error: Input directory not found: {input_dir}")
        return
    
    # Find all JSON files
    json_files = list(input_dir.glob('*.json'))
    
    if not json_files:
        print(f"⚠️  No JSON files found in {input_dir}")
        return
    
    print(f"Found {len(json_files)} JSON file(s) to process...\n")
    
    # Process each JSON file
    success_count = 0
    for json_file in sorted(json_files):
        # Generate output filename
        pdf_filename = json_file.stem + '.pdf'
        pdf_path = output_dir / pdf_filename
        
        # Read JSON to get item count for logging
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            item_count = len(data.get('items', []))
        except:
            item_count = 0
        
        # Generate PDF
        if create_pdf_from_json(json_file, pdf_path):
            print(f"✅ Loaded {json_file.name} ({item_count} items)")
            print(f"✅ Generated PDF: {pdf_path}")
            success_count += 1
        else:
            print(f"❌ Failed to process {json_file.name}")
        print()
    
    # Summary
    if success_count == len(json_files):
        print("All PDFs saved successfully!")
    else:
        print(f"Completed: {success_count}/{len(json_files)} PDFs generated successfully.")


def main():
    """Main function with command-line argument parsing."""
    parser = argparse.ArgumentParser(
        description='Generate Estimate PDFs from JSON Files',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process a specific file:
  python3 generate_estimate_pdf.py ../Final/Estimate-Json/6-estimate.json
  
  # Process all files in the default directory:
  python3 generate_estimate_pdf.py --all
        """
    )
    
    parser.add_argument(
        'json_file',
        nargs='?',
        help='Path to the JSON estimate file to process (relative or absolute)'
    )
    
    parser.add_argument(
        '--all',
        action='store_true',
        help='Process all JSON files in ../Final/Estimate-Json/'
    )
    
    parser.add_argument(
        '--output-dir',
        type=str,
        help='Output directory for PDFs (default: ../PDFs/)'
    )
    
    parser.add_argument(
        '-o', '--output',
        type=str,
        help='Output PDF file path (overrides --output-dir for single file processing)'
    )
    
    args = parser.parse_args()
    
    # Get script directory
    script_dir = Path(__file__).parent.absolute()
    
    # Define default output directory
    if args.output_dir:
        output_dir = Path(args.output_dir).resolve()
    else:
        output_dir = (script_dir / '..' / 'PDFs').resolve()
    
    # Create output directory if it doesn't exist
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Process based on arguments
    if args.all:
        # Process all files
        input_dir = (script_dir / '..' / 'Final' / 'Estimate-Json').resolve()
        process_all_files(input_dir, output_dir)
    elif args.json_file:
        # Process single file
        json_file_path = args.json_file
        
        # If relative path, try to resolve from current directory first
        json_path = Path(json_file_path)
        if not json_path.is_absolute():
            # Try current directory first
            if not json_path.exists():
                # Try relative to default input directory
                input_dir = (script_dir / '..' / 'Final' / 'Estimate-Json').resolve()
                json_path = input_dir / json_file_path
        
        # If -o/--output is specified, use that as the output path
        if args.output:
            output_pdf_path = Path(args.output).resolve()
            # Create output directory if it doesn't exist
            output_pdf_path.parent.mkdir(parents=True, exist_ok=True)
            # Generate PDF with specified output path
            if create_pdf_from_json(json_path, output_pdf_path):
                try:
                    with open(json_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    item_count = len(data.get('items', []))
                except:
                    item_count = 0
                print(f"✅ Generated PDF: {output_pdf_path} ({item_count} items)")
            else:
                print(f"❌ Failed to generate PDF: {output_pdf_path}")
        else:
            process_single_file(json_path, output_dir)
    else:
        # No arguments provided, show usage
        parser.print_help()
        sys.exit(1)


if __name__ == '__main__':
    main()

