#!/usr/bin/env python3
"""
Inspection report extractor powered by Google's Gemini API.

This script uploads a PDF inspection report to Google's Gemini API and requests
structured JSON describing the report metadata, issues, and summary insights.
"""

import argparse
import hashlib
import json
import logging
import os
import re
import sys
import time
from difflib import SequenceMatcher
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple
from pathlib import Path

# Add parent directory to path for config import
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    import config
except ImportError:
    # Fallback if config not found
    config = None

try:
    import google.genai as genai
except ImportError as exc:
    raise RuntimeError(
        "google-genai is required. Install it with 'pip install google-genai'."
    ) from exc

try:
    from jsonschema import Draft7Validator, ValidationError
except ImportError as exc:
    raise RuntimeError(
        "jsonschema is required. Install it with 'pip install jsonschema'."
    ) from exc

# Import annotation extractor (optional - gracefully fails if not available)
try:
    # Add parent directory to path for pdf_annotation_extractor import
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from pdf_annotation_extractor import PDFAnnotationExtractor
    ANNOTATION_EXTRACTION_AVAILABLE = True
except ImportError:
    ANNOTATION_EXTRACTION_AVAILABLE = False
    logging.warning(
        "pdf_annotation_extractor not available. "
        "Highlighted text and annotations will not be extracted. "
        "Install PyMuPDF with 'pip install PyMuPDF' to enable this feature."
    )


INSPECTION_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "metadata": {
            "type": "object",
            "properties": {
                "report_title": {"type": "string"},
                "inspector": {"type": "string"},
                "company": {"type": "string"},
                "address": {"type": "string"},
                "city": {"type": "string"},
                "state": {"type": "string"},
                "zip": {"type": "string"},
                "date": {"type": "string"},
                "pages": {"type": "integer"},
                "report_notes": {"type": "string"},
                "annotations_extracted": {"type": "boolean"},
                "highlights_count": {"type": "integer"},
                "annotations_count": {"type": "integer"},
            },
        },
        "report_summary": {
            "type": "object",
            "properties": {
                "inspection_date": {"type": "string"},
                "report_number": {"type": "string"},
                "prepared_for": {"type": "string"},
                "property_address": {"type": "string"},
                "inspector_name": {"type": "string"},
                "inspector_license": {"type": "string"},
                "inspection_company": {"type": "string"},
            },
        },
        "summary": {
            "type": "object",
            "properties": {
                "total_issues": {"type": "integer"},
                "totals_by_severity": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "severity": {"type": "string"},
                            "count": {"type": "integer"},
                        },
                        "required": ["severity", "count"],
                    },
                },
                "overall_risk_level": {"type": "string"},
            },
        },
        "issues": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "section": {"type": "string"},
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "severity": {"type": "string"},
                    "estimated_fix": {"type": "string"},
                    "component": {"type": "string"},
                    "location": {"type": "string"},
                    "context": {"type": ["string", "null"]},  # Allow null but normalize to empty string
                    "evidence": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "image_ref": {"type": "string"},
                                "ocr_snippet": {"type": "string"},
                            },
                        },
                    },
                    "page_refs": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "description": "Page references as strings (e.g., \"9\" or \"10-11\").",
                        },
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["HIGH", "MEDIUM", "LOW"],
                        "description": "Priority level based on keywords and severity indicators.",
                    },
                    "recommendation_type": {
                        "type": "string",
                        "description": "Type of recommendation (e.g., 'Obtain Cost Estimate', 'Repair', 'Replace', 'Further Investigation').",
                    },
                    "from_highlight": {
                        "type": "boolean",
                        "description": "True if this issue was derived from highlighted text in the PDF.",
                    },
                    "from_annotation": {
                        "type": "boolean",
                        "description": "True if this issue was derived from an annotation/comment in the PDF.",
                    },
                    "highlight_color": {
                        "type": ["string", "null"],
                        "description": "Color of the highlight if applicable (e.g., 'yellow', 'red').",
                    },
                    "annotation_text": {
                        "type": ["string", "null"],
                        "description": "Text of the annotation/comment if applicable.",
                    },
                },
                "required": [
                    "section",
                    "title",
                    "description",
                    "severity",
                    "estimated_fix",
                    "priority",
                ],
            },
        },
    },
    "required": ["issues"],
}

_SCHEMA_VALIDATOR = Draft7Validator(INSPECTION_SCHEMA)

_CANONICAL_SECTIONS: Tuple[str, ...] = (
    "Foundations",
    "Grading and Drainage",
    "Roof Covering Materials",
    "Roof Structures and Attics",
    "Walls (Interior and Exterior)",
    "Doors (Interior and Exterior)",
    "Windows",
    "Ceilings and Floors",
    "Fireplaces and Chimneys",
    "Porches, Balconies, Decks, and Carports",
    "Service Entrance and Panels",
    "Branch Circuits, Connected Devices, and Fixtures",
    "HVAC",
    "Duct Systems",
    "Plumbing",
    "Water Heaters",
    "Appliances",
)

_CORE_SECTION_REQUIREMENTS: Dict[str, Tuple[str, ...]] = {
    "Foundations": ("Foundations",),
    "Grading and Drainage": ("Grading and Drainage",),
    "Roof Covering Materials": ("Roof Covering Materials",),
    "Roof Structures and Attics": ("Roof Structures and Attics",),
    "Walls (Interior and Exterior)": ("Walls (Interior and Exterior)",),
    "Ceilings and Floors": ("Ceilings and Floors",),
    "Doors (Interior and Exterior)": ("Doors (Interior and Exterior)",),
    "Windows": ("Windows",),
    "HVAC": ("HVAC",),
    "Electrical Panels": ("Service Entrance and Panels",),
    "Plumbing": ("Plumbing",),
    "Water Heater": ("Water Heaters",),
}

_SEVERITY_GROUPS: Dict[str, Tuple[str, ...]] = {
    "Deficient": (
        "deficient",
        "deficiency",
        "high",
        "serious",
        "needs repair",
        "repair needed",
        "requires repair",
        "major",
        "significant",
    ),
    "Monitor": (
        "monitor",
        "watch",
        "keep an eye",
        "observe",
    ),
    "Maintenance": (
        "maintenance",
        "improvement",
        "upgrade",
    ),
    "Safety Hazard": (
        "safety hazard",
        "life safety",
        "fire hazard",
        "egress issue",
        "shock hazard",
    ),
    "Further Evaluation": (
        "further evaluation",
        "consult specialist",
        "licensed professional",
        "requires licensed technician",
        "additional evaluation",
    ),
}


def deduplicate_issues(issues: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Remove duplicate issues based on content similarity."""
    if not issues or not config:
        return issues
    
    from config import EXTRACTION_CONFIG
    
    unique_issues = []
    
    for issue in issues:
        is_duplicate = False
        
        # Create comparison key from section + location + description
        issue_key = f"{issue.get('section', '')}|{issue.get('location', '')}|{issue.get('description', '')}"
        
        for unique_issue in unique_issues:
            unique_key = f"{unique_issue.get('section', '')}|{unique_issue.get('location', '')}|{unique_issue.get('description', '')}"
            
            # Calculate similarity
            similarity = SequenceMatcher(None, issue_key, unique_key).ratio()
            
            if similarity >= EXTRACTION_CONFIG["dedupe_similarity_threshold"]:
                # Merge page references if it's a duplicate
                unique_pages = set(unique_issue.get("page_refs", []))
                unique_pages.update(issue.get("page_refs", []))
                unique_issue["page_refs"] = sorted(list(unique_pages))
                is_duplicate = True
                break
        
        if not is_duplicate:
            unique_issues.append(issue)
    
    logging.info(f"Deduplication: {len(issues)} → {len(unique_issues)} issues")
    return unique_issues


def post_process_extraction(data: dict) -> dict:
    """Enhance extraction with keyword-based priority detection."""
    
    PRIORITY_KEYWORDS = [
        "obtain cost estimate", "obtain a cost estimate",
        "further investigation", "safety hazard", "immediate attention"
    ]
    
    for issue in data.get("issues", []):
        desc = issue.get("description", "").lower()
        
        # Set priority based on keywords
        if any(kw in desc for kw in PRIORITY_KEYWORDS):
            issue["priority"] = "HIGH"
        elif "priority" not in issue:
            issue["priority"] = "MEDIUM"
        
        # Set recommendation type
        if "obtain cost estimate" in desc or "obtain a cost estimate" in desc:
            issue["recommendation_type"] = "Obtain Cost Estimate"
        elif "further investigation" in desc:
            issue["recommendation_type"] = "Further Investigation"
        elif "replacement" in desc or "replace" in desc:
            issue["recommendation_type"] = "Replace"
        else:
            issue["recommendation_type"] = "Repair"
    
    return data


def sort_issues_deterministically(issues: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Sort issues by TREC section order, then page, then location."""
    if not config:
        return issues
    
    from config import get_section_order_index
    
    def sort_key(issue):
        section_order = get_section_order_index(issue.get("section", ""))
        
        # Extract first page number for secondary sorting
        page_refs = issue.get("page_refs", ["999"])
        first_page = 999
        if page_refs and page_refs[0]:
            try:
                # Handle page ranges like "10-11"
                first_page = int(page_refs[0].split("-")[0])
            except (ValueError, IndexError):
                first_page = 999
        
        location = issue.get("location", "zzz")
        
        return (section_order, first_page, location)
    
    return sorted(issues, key=sort_key)


def _compute_issue_id(issue: Dict[str, Any]) -> str:
    """Generate deterministic ID based on issue content."""
    import hashlib
    
    # Create stable hash from key fields
    content_parts = [
        issue.get("section", ""),
        issue.get("component", ""),
        issue.get("location", ""),
        # Use first 100 chars of description for stability
        issue.get("description", "")[:100],
        # Include first page reference
        (issue.get("page_refs", [""])[0] if issue.get("page_refs") else "")
    ]
    
    content_string = "|".join(content_parts).lower().strip()
    
    # Generate 12-character hex ID
    hash_obj = hashlib.sha256(content_string.encode("utf-8"))
    return hash_obj.hexdigest()[:12]


def validate_extraction_quality(data: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Validate extraction meets quality standards."""
    issues = []
    
    # Check issue count
    if len(data.get("issues", [])) == 0:
        issues.append("No issues extracted")
    
    # Check for required sections
    extracted_sections = {issue.get("section") for issue in data.get("issues", [])}
    
    # Minimum expected sections for a complete inspection
    required_sections = {
        "Foundations", "Roof Covering Materials", 
        "Electrical Systems", "Plumbing System"
    }
    
    missing = required_sections - extracted_sections
    if missing:
        issues.append(f"Missing critical sections: {missing}")
    
    # Check all issues have page references
    issues_without_pages = [
        i for i in data.get("issues", []) 
        if not i.get("page_refs") or not i["page_refs"][0]
    ]
    
    if issues_without_pages:
        issues.append(f"{len(issues_without_pages)} issues missing page references")
    
    return len(issues) == 0, issues


def create_deterministic_extraction_prompt() -> str:
    """Create a detailed, deterministic prompt for extraction."""
    return '''
    CRITICAL EXTRACTION RULES - FOLLOW EXACTLY:
    
    1. EXTRACT ONLY DEFICIENT ITEMS:
       - Look for items marked with "D" checkbox or "D=Deficient" 
       - Items with checkmarks in the "D" column
       - Items explicitly described as "deficient", "defective", "needs repair", or "damaged"
       - IGNORE items marked as "I=Inspected" only without deficiencies
    
    2. USE EXACT TEXT FROM PDF:
       - Copy the EXACT wording from the PDF for descriptions
       - Do NOT paraphrase, summarize, or reword
       - Include all technical details and measurements mentioned
       - Preserve inspector's original terminology
    
    3. JSON STRUCTURE - RETURN EXACTLY THIS FORMAT:
    {
      "metadata": {
        "report_title": "exact title from PDF",
        "inspector": "exact name",
        "company": "exact company name",
        "address": "street address only",
        "city": "city name",
        "state": "state abbreviation",
        "zip": "zip code",
        "date": "YYYY-MM-DD format",
        "pages": total_page_count_as_integer,
        "report_notes": "complete closing comments section from PDF"
      },
      "issues": [
        {
          "section": "Use EXACT section name from PDF",
          "title": "Brief title (max 50 chars) describing the deficiency",
          "description": "EXACT text from PDF describing the issue",
          "severity": "Always use 'Deficient' for D-marked items",
          "estimated_fix": "Use 'Repair' unless replacement is explicitly stated",
          "component": "Exact component identifier from PDF (e.g., 'B. Grading and Drainage')",
          "location": "Specific location mentioned in PDF or 'Not specified'",
          "context": "Any additional context from surrounding text",
          "evidence": [],
          "page_refs": ["exact page number as string"],
          "priority": "HIGH|MEDIUM|LOW based on keywords and severity",
          "recommendation_type": "Type of recommendation from PDF (e.g., 'Obtain Cost Estimate', 'Repair', 'Replace')"
        }
      ],
      "summary": {
        "total_issues": exact_count_as_integer,
        "totals_by_severity": [
          {"severity": "Deficient", "count": exact_count}
        ]
      }
    }
    
    4. SECTION ORDER:
       Process the PDF in this EXACT order and group issues by section:
       - Foundations
       - Grading and Drainage
       - Roof Covering Materials
       - Roof Structures and Attics
       - Walls (Interior and Exterior)
       - Ceilings and Floors
       - Doors (Interior and Exterior)
       - Windows
       - Service Entrance and Panels
       - Branch Circuits, Connected Devices, and Fixtures
       - Heating Equipment
       - Cooling Equipment
       - Duct Systems, Chases, and Vents
       - Plumbing Supply, Distribution Systems and Fixtures
       - Water Heating Equipment
       - Appliances
    
    5. EXTRACTION COMPLETENESS:
       - Read EVERY page of the PDF
       - Extract ALL deficient items, even if they seem minor
       - Include page number for EVERY issue
       - If the same issue appears on multiple pages, include all page references
    
    6. CAPTURE COMPLETE COMMENTS (CRITICAL):
       - Extract the ENTIRE "Comments:" section for each deficiency
       - Include ALL paragraphs, bullet points, and sub-items
       - Do NOT truncate - copy complete text
       - Include section headers like "ROOF STRUCTURE & FRAMING:" if present
    
    7. IDENTIFY PRIORITY KEYWORDS:
       - Look for these phrases in bold/red text or comments:
         * "Obtain Cost Estimate" or "Obtain a cost estimate"
         * "Further Investigation"
         * "Contact qualified professional"
         * "Safety hazard"
       - Mark these as HIGH priority
    
    8. UPDATE JSON SCHEMA to add these fields:
       Issues array - add:
       - "priority": "HIGH|MEDIUM|LOW"
       - "recommendation_type": string (e.g., "Obtain Cost Estimate", "Repair", "Replace")
       
       Metadata - add:
       - "report_notes": string (closing comments section)
    
    9. CONSISTENCY REQUIREMENTS:
       - Count issues accurately - the total_issues MUST match the array length
       - Use consistent terminology throughout
       - Maintain the same format for all issues
       - Do not add issues that aren't explicitly marked as deficient

    10. HIGHLIGHTED TEXT AND ANNOTATIONS:
       If additional context from PDF highlights or annotations is provided below,
       give these items HIGHER priority and ensure they are extracted as issues.

       - Highlighted text often indicates critical or urgent items
       - Annotations/comments provide additional context from the inspector
       - These should be cross-referenced with the main report text
       - If a highlight or annotation references an issue, mark that issue with:
         * "from_highlight": true (if derived from highlighted text)
         * "from_annotation": true (if derived from annotation/comment)
         * "highlight_color": "<color>" (if color information available, e.g., "yellow", "red")
         * "annotation_text": "<text>" (the annotation comment text)
       - If an issue is NOT from a highlight or annotation, set these fields to:
         * "from_highlight": false
         * "from_annotation": false
         * "highlight_color": null
         * "annotation_text": null

    IMPORTANT: Return ONLY valid JSON. No markdown, no explanation, no commentary.
    '''


def extract_pdf_annotations(pdf_path: str) -> Optional[Dict[str, Any]]:
    """
    Extract annotations and highlights from PDF.

    Args:
        pdf_path: Path to PDF file

    Returns:
        Dictionary with highlights and annotations, or None if extraction fails
    """
    if not ANNOTATION_EXTRACTION_AVAILABLE:
        logging.debug("Annotation extraction not available (PyMuPDF not installed)")
        return None

    try:
        with PDFAnnotationExtractor(pdf_path) as extractor:
            annotations_data = extractor.extract_all_annotations()

            # Log summary
            summary = annotations_data.get("summary", {})
            if summary.get("total_highlights", 0) > 0 or summary.get("total_annotations", 0) > 0:
                logging.info(
                    f"Extracted {summary.get('total_highlights', 0)} highlights and "
                    f"{summary.get('total_annotations', 0)} annotations from PDF"
                )
            else:
                logging.info("No highlights or annotations found in PDF")

            return annotations_data

    except Exception as e:
        logging.warning(f"Failed to extract annotations from PDF: {e}")
        return None


def run_model(client: genai.Client, model_name: str, uploaded_file: Any, annotation_context: Optional[str] = None) -> str:
    """Run Gemini model with deterministic settings for consistent extraction."""
    if not config:
        raise RuntimeError("config module is required for deterministic extraction")
    
    from config import GEMINI_GENERATION_CONFIG
    
    normalized_name = normalize_model_name(model_name)
    
    file_uri = getattr(uploaded_file, "uri", None) or getattr(
        uploaded_file, "file_uri", None
    )
    if not file_uri:
        raise ValueError("Uploaded file is missing file URI required for referencing.")

    mime_type = getattr(uploaded_file, "mime_type", "application/pdf")
    uploaded_file_payload = {
        "file_data": {
            "mime_type": mime_type or "application/pdf",
            "file_uri": file_uri,
        }
    }
    
    # Build the extraction prompt with strict instructions
    extraction_prompt = create_deterministic_extraction_prompt()

    # Build parts list with optional annotation context
    parts = [uploaded_file_payload, {"text": extraction_prompt}]

    # Add annotation context if available
    if annotation_context:
        parts.append({"text": annotation_context})
        logging.info("Including PDF annotations in extraction prompt")

    contents = [
        {
            "role": "user",
            "parts": parts,
        },
    ]
    
    # Call with deterministic config
    try:
        # Build config dict with response_mime_type and generation settings
        config_dict = {
            "response_mime_type": "application/json",
            **GEMINI_GENERATION_CONFIG  # Merge generation config
        }
        
        logging.debug(f"Calling Gemini with model: {normalized_name}")
        logging.debug(f"Config: {config_dict}")
        
        response = client.models.generate_content(
            model=normalized_name,
            contents=contents,
            config=config_dict,
        )
        
        # Debug: Log response structure
        logging.debug(f"Response type: {type(response)}")
        if hasattr(response, "__dict__"):
            logging.debug(f"Response attributes: {list(response.__dict__.keys())}")
        
        # Check if response has any data
        if hasattr(response, "candidates") and response.candidates:
            logging.debug(f"Response has {len(response.candidates)} candidate(s)")
            for i, candidate in enumerate(response.candidates):
                logging.debug(f"Candidate {i} type: {type(candidate)}")
                if hasattr(candidate, "__dict__"):
                    logging.debug(f"Candidate {i} attributes: {list(candidate.__dict__.keys())}")
                
                # Check for finish_reason or blocking
                if hasattr(candidate, "finish_reason"):
                    finish_reason = candidate.finish_reason
                    finish_reason_str = str(finish_reason)
                    logging.info(f"Candidate {i} finish_reason: {finish_reason_str}")
                    # MAX_TOKENS means response was truncated but may still have content
                    if finish_reason_str and "MAX_TOKENS" in finish_reason_str:
                        logging.warning(f"Candidate {i} hit max tokens - response may be truncated")
                    elif finish_reason_str and "STOP" not in finish_reason_str:
                        logging.warning(f"Candidate {i} did not finish normally: {finish_reason_str}")
                
                # Check for safety ratings
                if hasattr(candidate, "safety_ratings"):
                    safety = candidate.safety_ratings
                    if safety:
                        logging.info(f"Candidate {i} safety_ratings: {safety}")
        
        # Check for prompt_feedback (might indicate blocking)
        if hasattr(response, "prompt_feedback"):
            prompt_feedback = response.prompt_feedback
            if prompt_feedback:
                logging.info(f"Prompt feedback: {prompt_feedback}")
                if hasattr(prompt_feedback, "block_reason"):
                    block_reason = prompt_feedback.block_reason
                    if block_reason:
                        raise RuntimeError(f"Prompt was blocked: {block_reason}")
        
        # Log raw response for debugging if text extraction fails
        try:
            response_str = str(response)
            if len(response_str) < 1000:  # Only log if reasonable size
                logging.debug(f"Raw response string: {response_str}")
        except:
            pass
        
    except Exception as e:
        logging.error(f"Error calling Gemini API: {e}")
        import traceback
        logging.debug(traceback.format_exc())
        raise
    
    return extract_text(response)


def normalize_model_name(model_name: str) -> str:
    """Ensure the model name includes the models/ prefix expected by the API."""
    return model_name if "/" in model_name else f"models/{model_name}"


def extract_text(response: Any) -> str:
    """Extract text from Gemini API response."""
    # Try output_text first (common for JSON responses)
    if hasattr(response, "output_text") and response.output_text:
        return response.output_text
    
    # Try text attribute
    if hasattr(response, "text") and response.text:
        return response.text
    
    # Check candidates (standard path)
    candidates = getattr(response, "candidates", None) or []
    
    for candidate in candidates:
        # Check finish_reason - MAX_TOKENS means truncated but may have content
        finish_reason_str = None
        if hasattr(candidate, "finish_reason"):
            finish_reason = candidate.finish_reason
            finish_reason_str = str(finish_reason)
            # MAX_TOKENS is okay - we can still extract partial content
            if finish_reason_str and "MAX_TOKENS" in finish_reason_str:
                logging.warning("Response hit max tokens - may be truncated, but extracting available content")
            elif finish_reason_str and "STOP" not in finish_reason_str and "MAX_TOKENS" not in finish_reason_str:
                logging.warning(f"Response finish_reason: {finish_reason_str} (may indicate blocking)")
        
        # Get content from candidate
        content = getattr(candidate, "content", None)
        if not content:
            continue
        
        # Get parts from content
        parts = getattr(content, "parts", None) or []
        for part in parts:
            # Try text attribute
            text = getattr(part, "text", None)
            if text:
                # Even if MAX_TOKENS, return what we have
                if finish_reason_str and "MAX_TOKENS" in finish_reason_str:
                    logging.info("Extracted truncated response (MAX_TOKENS) - may need to increase max_output_tokens")
                return text
            
            # Try inline_data for JSON responses
            if hasattr(part, "inline_data"):
                inline_data = part.inline_data
                if inline_data:
                    data = getattr(inline_data, "data", None)
                    mime_type = getattr(inline_data, "mime_type", None)
                    if data and mime_type == "application/json":
                        # Decode base64 if needed
                        import base64
                        try:
                            decoded = base64.b64decode(data).decode('utf-8')
                            if finish_reason_str and "MAX_TOKENS" in finish_reason_str:
                                logging.info("Extracted truncated JSON response (MAX_TOKENS)")
                            return decoded
                        except:
                            # Try direct string
                            if isinstance(data, str):
                                return data
    
    # Last resort: detailed error logging
    logging.error(f"Failed to extract text. Response type: {type(response)}")
    if hasattr(response, "__dict__"):
        attrs = {k: str(type(v)) for k, v in response.__dict__.items()}
        logging.error(f"Response attributes: {attrs}")
    
    if candidates:
        for i, cand in enumerate(candidates):
            logging.error(f"Candidate {i}: finish_reason={getattr(cand, 'finish_reason', 'N/A')}")
            if hasattr(cand, "content"):
                content = cand.content
                parts = getattr(content, "parts", None) or []
                for j, part in enumerate(parts):
                    part_attrs = {k: str(type(v)) for k, v in part.__dict__.items()} if hasattr(part, "__dict__") else {}
                    logging.error(f"  Part {j}: {part_attrs}")
    
    raise ValueError("Gemini returned an empty response. Enable DEBUG logging for details.")


def _normalize_issue(issue: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize a single issue entry."""
    # Ensure all required fields exist
    issue.setdefault("section", "")
    issue.setdefault("title", "")
    issue.setdefault("description", "")
    issue.setdefault("severity", "Deficient")
    issue.setdefault("estimated_fix", "Repair")
    issue.setdefault("component", "")
    issue.setdefault("location", "Not specified")
    # Convert None to empty string for context (schema requires string)
    if issue.get("context") is None:
        issue["context"] = ""
    else:
        issue.setdefault("context", "")
    issue.setdefault("evidence", [])
    issue.setdefault("page_refs", [])
    issue.setdefault("priority", "MEDIUM")
    issue.setdefault("recommendation_type", "")
    
    # Normalize section name
    if config:
        issue["section"] = config.normalize_section_name(issue.get("section", ""))
    
    # Ensure page_refs is a list of strings
    raw_refs = issue.get("page_refs")
    if isinstance(raw_refs, list):
        issue["page_refs"] = [str(ref).strip() for ref in raw_refs if str(ref).strip()]
    elif raw_refs is None:
        issue["page_refs"] = []
    else:
        single = str(raw_refs).strip()
        issue["page_refs"] = [single] if single else []
    
    # Deduplicate page_refs
    issue["page_refs"] = sorted(list(set(issue["page_refs"])))
    
    # Generate deterministic ID
    issue["issue_id"] = _compute_issue_id(issue)
    
    return issue


def _normalize_extraction(data: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize the extraction data."""
    issues = data.get("issues") or []
    normalized_issues = [_normalize_issue(dict(issue)) for issue in issues]
    
    # Set defaults for new fields
    for issue in normalized_issues:
        if "priority" not in issue or not issue["priority"]:
            issue["priority"] = "MEDIUM"
        if "recommendation_type" not in issue or not issue["recommendation_type"]:
            issue["recommendation_type"] = "Repair"
    
    data["issues"] = normalized_issues
    
    # Normalize metadata
    metadata = data.get("metadata", {})
    if "report_notes" not in metadata:
        metadata["report_notes"] = ""
    data["metadata"] = metadata
    
    _update_summary(data)
    return data


def _update_summary(data: Dict[str, Any]) -> None:
    """Update summary counts."""
    summary = data.setdefault("summary", {})
    issues = data.get("issues") or []
    summary["total_issues"] = len(issues)
    severity_counter: Dict[str, int] = {}
    for issue in issues:
        severity = issue.get("severity", "Deficient")
        severity_counter[severity] = severity_counter.get(severity, 0) + 1
    summary["totals_by_severity"] = [
        {"severity": severity, "count": count}
        for severity, count in sorted(severity_counter.items())
    ]


def configure_logging(level: str) -> None:
    """Configure logging."""
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(levelname)s: %(message)s",
    )


def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description=(
            "Extract findings from an inspection PDF using Google Gemini "
            "and return structured JSON."
        )
    )
    parser.add_argument(
        "pdf_path",
        help="Path to the inspection PDF to analyze.",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="-",
        help="Path to write the JSON output (default: stdout).",
    )
    parser.add_argument(
        "--model",
        default="models/gemini-3-pro-preview",
        help="Gemini model name to use (defaults to models/gemini-3-pro-preview).",
    )
    parser.add_argument(
        "--poll-interval",
        type=float,
        default=2.0,
        help="Seconds to wait between polling Gemini's file processing state.",
    )
    parser.add_argument(
        "--max-wait",
        type=float,
        default=600.0,
        help="Maximum seconds to wait for file processing before failing.",
    )
    parser.add_argument(
        "--indent",
        type=int,
        default=2,
        help="Indent level for pretty-printing JSON (default: 2).",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        help="Set the logging level (default: INFO).",
    )
    parser.add_argument(
        "--no-annotations",
        action="store_true",
        help="Skip PDF annotation and highlight extraction (default: extract annotations if PyMuPDF is available).",
    )
    return parser.parse_args(argv)


def _file_state_name(file_obj: Any) -> str:
    """Get file state name."""
    state = getattr(file_obj, "state", None)
    if hasattr(state, "name"):
        return state.name
    if isinstance(state, str):
        return state
    return ""


def wait_for_file_ready(
    client: Any,
    uploaded_file: Any,
    poll_interval: float,
    max_wait: float,
) -> Any:
    """Poll Gemini until the uploaded file is processed or fails."""
    waited = 0.0
    state_name = _file_state_name(uploaded_file)
    logging.debug("Initial file state: %s", state_name)
    processing_states = {"PROCESSING", "STATE_PROCESSING"}
    success_states = {"ACTIVE", "STATE_ACTIVE", "SUCCEEDED", "STATE_SUCCEEDED"}

    while state_name in processing_states:
        if waited >= max_wait:
            raise TimeoutError(
                f"File processing exceeded {max_wait} seconds. "
                "Consider increasing --max-wait."
            )
        time.sleep(poll_interval)
        waited += poll_interval
        file_name = getattr(uploaded_file, "name", None)
        if not file_name:
            raise RuntimeError("Uploaded file reference missing name for polling.")
        uploaded_file = client.files.get(name=file_name)
        state_name = _file_state_name(uploaded_file)
        logging.debug(
            "Polling file status. State=%s, waited=%.1fs",
            state_name,
            waited,
        )

    if state_name not in success_states:
        raise RuntimeError(
            f"File processing failed with state {state_name or 'UNKNOWN'}."
        )

    logging.info("File processed successfully (%.1fs).", waited)
    return uploaded_file


def upload_pdf(
    client: genai.Client,
    pdf_path: str,
    poll_interval: float,
    max_wait: float,
) -> Any:
    """Upload PDF to Gemini."""
    logging.info("Uploading PDF: %s", pdf_path)
    uploaded_file = client.files.upload(file=pdf_path)
    display_name = getattr(uploaded_file, "display_name", None) or os.path.basename(
        pdf_path
    )
    print(f"Uploaded {pdf_path} → {display_name}")
    logging.debug("Upload response: %s", uploaded_file)
    return wait_for_file_ready(client, uploaded_file, poll_interval, max_wait)


def load_json(response_text: str) -> Dict[str, Any]:
    """Parse JSON response, handling truncated responses."""
    try:
        return json.loads(response_text)
    except json.JSONDecodeError as e:
        # Check if error is due to unterminated string (likely truncation)
        if "Unterminated string" in str(e) or "Expecting" in str(e):
            logging.warning("JSON appears truncated - attempting to fix...")
            # Try to fix truncated JSON by closing open strings/objects
            fixed_text = _fix_truncated_json(response_text)
            try:
                return json.loads(fixed_text)
            except json.JSONDecodeError:
                logging.error("Failed to fix truncated JSON. Response may be too incomplete.")
                # Try to extract partial data if possible
                partial_data = _extract_partial_json(response_text)
                if partial_data:
                    logging.warning("Extracted partial JSON data - may be incomplete")
                    return partial_data
                raise ValueError(f"JSON response is truncated and cannot be fixed: {e}")
        raise


def _fix_truncated_json(text: str) -> str:
    """Attempt to fix truncated JSON by closing open structures."""
    text = text.rstrip()
    
    # Strategy: Find the last complete JSON object/array and truncate there
    # This is more reliable than trying to close incomplete structures
    
    # First, try to find where the truncation happened in an unterminated string
    # Look for patterns like: "description": "unterminated...
    
    # Remove trailing incomplete string value
    # Find unclosed quotes (odd number means string is open)
    quote_count = text.count('"')
    if quote_count % 2 != 0:
        # String is unclosed - find the last quote and remove everything after the key
        # Look backwards for the pattern: "key": "
        import re
        # Find last complete key-value pattern before truncation
        # Pattern: "key": "value" or "key": "unclosed
        pattern = r'"([^"]+)":\s*"([^"]*)"'
        matches = list(re.finditer(pattern, text))
        
        if matches:
            # Find the last match
            last_match = matches[-1]
            # Check if the value is complete (ends with ")
            if not text[last_match.end()-1:last_match.end()] == '"':
                # Value is incomplete - truncate before this key-value pair
                # But keep the key, just remove the incomplete value
                key_start = last_match.start()
                # Find the colon before this key
                colon_pos = text.rfind(':', 0, key_start)
                if colon_pos > 0:
                    # Find the comma or opening brace before the colon
                    before_colon = text[:colon_pos].rstrip()
                    if before_colon.endswith(','):
                        text = before_colon[:-1].rstrip()
                    elif before_colon.endswith('{'):
                        text = before_colon.rstrip()
                    else:
                        # Just remove from the colon
                        text = before_colon.rstrip().rstrip(',')
    
    # Now count what structures are still open
    open_braces = text.count('{') - text.count('}')
    open_brackets = text.count('[') - text.count(']')
    
    # Remove trailing comma if present
    text = text.rstrip().rstrip(',')
    
    # Close arrays first (innermost)
    for _ in range(open_brackets):
        text += ']'
    
    # Then close objects
    for _ in range(open_braces):
        text += '}'
    
        return text


def _extract_partial_json(text: str) -> Optional[Dict[str, Any]]:
    """Extract whatever valid JSON we can from truncated response."""
    try:
        # Strategy: Find all complete issue objects and rebuild JSON
        # Look for "issues": [ pattern
        issues_key_pos = text.find('"issues"')
        if issues_key_pos == -1:
            # Try alternative: just look for array of objects
            bracket_pos = text.find('[')
            if bracket_pos == -1:
                return None
            start_pos = bracket_pos
        else:
            # Find the opening bracket after "issues"
            bracket_pos = text.find('[', issues_key_pos)
            if bracket_pos == -1:
                return None
            # Include the opening structure before "issues"
            start_pos = text.rfind('{', 0, issues_key_pos)
            if start_pos == -1:
                start_pos = 0
        
        # Find all complete JSON objects in the array
        bracket_content = text[bracket_pos+1:]
        brace_count = 0
        object_starts = []
        object_ends = []
        in_string = False
        escape_next = False
        
        for i, char in enumerate(bracket_content):
            if escape_next:
                escape_next = False
                continue
            if char == '\\':
                escape_next = True
                continue
            if char == '"' and not escape_next:
                in_string = not in_string
                continue
            if in_string:
                continue
            
            if char == '{':
                if brace_count == 0:
                    object_starts.append(i)
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    object_ends.append(i + 1)
        
        # Extract complete objects
        if object_starts and object_ends and len(object_starts) == len(object_ends):
            # All objects are complete
            complete_objects = []
            for start, end in zip(object_starts, object_ends):
                obj_str = bracket_content[start:end]
                try:
                    obj = json.loads(obj_str)
                    complete_objects.append(obj)
                except:
                    continue
            
            if complete_objects:
                # Rebuild JSON structure
                issues_json = json.dumps(complete_objects, indent=2)
                # Try to preserve metadata if present
                if issues_key_pos > 0:
                    metadata_part = text[:issues_key_pos].rstrip()
                    # Try to extract metadata structure
                    if metadata_part.rstrip().endswith('{'):
                        metadata_part = metadata_part.rstrip()[:-1]
                    if metadata_part.rstrip().endswith(','):
                        metadata_part = metadata_part.rstrip()[:-1]
                    # Rebuild full JSON
                    full_json = '{' + metadata_part + ',\n  "issues": ' + issues_json + '\n}'
                else:
                    full_json = '{\n  "issues": ' + issues_json + '\n}'
                
                try:
                    data = json.loads(full_json)
                    logging.info(f"Extracted {len(complete_objects)} complete issues from truncated response")
                    return data
                except Exception as e:
                    logging.debug(f"Failed to rebuild JSON: {e}")
        
        # Fallback: try simpler approach - just find last complete object
        # Find the last position where we have a complete object
        last_brace_close = text.rfind('}')
        if last_brace_close > 0:
            # Count braces from start to this position
            prefix = text[:last_brace_close+1]
            if prefix.count('{') == prefix.count('}'):
                # This might be a complete structure, but we need to check for issues array
                # Just try to parse what we have
                try:
                    # Close the issues array and root object
                    test_json = prefix
                    if '"issues"' in test_json and test_json.count('[') > test_json.count(']'):
                        test_json += ']'
                    if test_json.count('{') > test_json.count('}'):
                        test_json += '}'
                    data = json.loads(test_json)
                    if 'issues' in data:
                        logging.info(f"Extracted {len(data.get('issues', []))} issues using fallback method")
                        return data
                except:
                    pass
                    
    except Exception as e:
        logging.debug(f"Failed to extract partial JSON: {e}")
    
    return None


def validate_schema(data: Dict[str, Any]) -> None:
    """Validate data against schema."""
    errors = list(_SCHEMA_VALIDATOR.iter_errors(data))
    if not errors:
        return

    messages = []
    for error in errors:
        path = ".".join(str(elem) for elem in error.absolute_path)
        if not path:
            path = "<root>"
        messages.append(f"{path}: {error.message}")
    
    joined = "\n".join(messages)
    raise ValueError(
        "Gemini response failed schema validation. "
        "Missing or invalid fields detected:\n"
        f"{joined}"
    )


def write_output(data: Dict[str, Any], path: str, indent: int) -> None:
    """Write output to file or stdout."""
    serialized = json.dumps(data, indent=indent, ensure_ascii=False)
    if path == "-" or path == "":
        sys.stdout.write(serialized)
        if not serialized.endswith("\n"):
            sys.stdout.write("\n")
        print("✅ Extraction complete – saved to stdout")
        return

    with open(path, "w", encoding="utf-8") as file:
        file.write(serialized)
        file.write("\n")
    logging.info("JSON written to %s", path)
    print(f"✅ Extraction complete – saved to {path}")


def main(argv: Optional[list[str]] = None) -> int:
    """Main entry point."""
    args = parse_args(argv)
    configure_logging(args.log_level)

    if not os.path.isfile(args.pdf_path):
        logging.error("PDF path does not exist: %s", args.pdf_path)
        return 1

    file_size = os.path.getsize(args.pdf_path)
    size_limit = 20 * 1024 * 1024  # 20 MB limit for Gemini uploads
    if file_size > size_limit:
        print("⚠️ PDF exceeds the 20 MB upload limit. Please reduce the file size.")
        logging.error(
            "PDF size %.2f MB exceeds the 20 MB limit.",
            file_size / (1024 * 1024),
        )
        return 1

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        logging.error("GEMINI_API_KEY environment variable is required.")
        return 1

    # Define extraction function (used with or without fallback)
    def run_extraction(client):
        # Extract annotations BEFORE uploading PDF
        annotation_data = None
        annotation_context = None

        # Check if annotation extraction is enabled
        if ANNOTATION_EXTRACTION_AVAILABLE and not getattr(args, 'no_annotations', False):
            logging.info("Extracting PDF annotations and highlights...")
            annotation_data = extract_pdf_annotations(args.pdf_path)

            if annotation_data:
                # Format annotations for Gemini prompt
                try:
                    with PDFAnnotationExtractor(args.pdf_path) as extractor:
                        extractor.annotations_data = annotation_data  # Reuse extracted data
                        annotation_context = extractor.format_for_gemini_prompt()
                except Exception as e:
                    logging.warning(f"Failed to format annotations: {e}")

        uploaded_file = upload_pdf(
            client,
            args.pdf_path,
            args.poll_interval,
            args.max_wait,
        )

        # Pass annotation context to run_model
        response_text = run_model(
            client,
            args.model,
            uploaded_file,
            annotation_context=annotation_context
        )
        
        # Check if response was truncated
        if len(response_text) > 30000:  # Very long response
            logging.info(f"Large response received ({len(response_text)} chars) - may have hit token limit")
        
        try:
            data = load_json(response_text)
        except (json.JSONDecodeError, ValueError) as json_error:
            logging.error(f"Failed to parse JSON response: {json_error}")
            # If it's a truncation error, log helpful message
            if "truncated" in str(json_error).lower() or "Unterminated" in str(json_error):
                logging.error(
                    "Response was truncated due to token limit. "
                    "Attempting to extract partial data..."
                )
                # Try to extract partial data one more time with better method
                partial_data = _extract_partial_json(response_text)
                if partial_data:
                    logging.warning(f"Successfully extracted {len(partial_data.get('issues', []))} issues from truncated response")
                    data = partial_data
                else:
                    # Save partial response for debugging
                    debug_file = Path("debug_truncated_response.json")
                    with open(debug_file, 'w', encoding='utf-8') as f:
                        f.write(response_text)
                    logging.error(
                        f"Could not extract partial data. Saved response to {debug_file}. "
                        "Consider: 1) Increasing max_output_tokens in config.py (currently 16384), "
                        "2) The report may be too large for single extraction"
                    )
                    raise ValueError(f"JSON response is truncated and cannot be recovered: {json_error}")
            else:
                raise
        
        # Normalize all issues first to fix None values (must happen before other processing)
        for issue in data.get("issues", []):
            # Convert None to empty string for all string fields (schema requirement)
            for field in ["section", "title", "description", "component", "location", "context", "recommendation_type"]:
                if issue.get(field) is None:
                    issue[field] = ""
            # Ensure evidence is a list
            if issue.get("evidence") is None:
                issue["evidence"] = []
            # Ensure page_refs is a list
            if issue.get("page_refs") is None:
                issue["page_refs"] = []
            # Ensure priority has a default value
            if issue.get("priority") is None:
                issue["priority"] = "MEDIUM"
            # Ensure annotation fields have default values
            if issue.get("from_highlight") is None:
                issue["from_highlight"] = False
            if issue.get("from_annotation") is None:
                issue["from_annotation"] = False
            if issue.get("highlight_color") is None:
                issue["highlight_color"] = None
            if issue.get("annotation_text") is None:
                issue["annotation_text"] = None
        
        # Normalize metadata
        if "metadata" in data and data["metadata"]:
            if data["metadata"].get("report_notes") is None:
                data["metadata"]["report_notes"] = ""
        
        # Normalize the data (this ensures all fields are properly set)
        data = _normalize_extraction(data)
        
        # Post-process extraction with keyword-based priority detection
        data = post_process_extraction(data)
        
        # Normalize sections after normalization
        if config:
            for issue in data.get("issues", []):
                issue["section"] = config.normalize_section_name(issue.get("section", ""))
        
        # Deduplicate issues
        data["issues"] = deduplicate_issues(data.get("issues", []))
        
        # Sort deterministically
        data["issues"] = sort_issues_deterministically(data.get("issues", []))
        
        # Regenerate deterministic IDs
        for issue in data["issues"]:
            issue["issue_id"] = _compute_issue_id(issue)
        
        # Update summary counts (ensure summary exists)
        if "summary" not in data:
            data["summary"] = {}
        data["summary"]["total_issues"] = len(data["issues"])

        # Add annotation metadata to the result
        if annotation_data:
            summary = annotation_data.get("summary", {})
            if "metadata" not in data:
                data["metadata"] = {}

            data["metadata"]["annotations_extracted"] = True
            data["metadata"]["highlights_count"] = summary.get("total_highlights", 0)
            data["metadata"]["annotations_count"] = summary.get("total_annotations", 0)
        else:
            if "metadata" not in data:
                data["metadata"] = {}
            data["metadata"]["annotations_extracted"] = False
            data["metadata"]["highlights_count"] = 0
            data["metadata"]["annotations_count"] = 0

        # Validate quality
        is_valid, validation_issues = validate_extraction_quality(data)
        if not is_valid:
            logging.warning("Quality issues found: %s", "; ".join(validation_issues))

        validate_schema(data)
        write_output(data, args.output, args.indent)
        return data

    try:
        client = genai.Client(api_key=api_key)
        run_extraction(client)
    except Exception as exc:
        message = str(exc) if exc else "Unknown error occurred"
        print(f"Request failed: {message}")
        logging.error("Request failed", exc_info=True)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
