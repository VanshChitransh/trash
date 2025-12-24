"""Centralized configuration for deterministic LLM behavior and extraction settings."""

# Gemini API settings for maximum determinism
GEMINI_GENERATION_CONFIG = {
    "temperature": 0.0,  # No randomness
    "top_p": 0.1,       # Minimal nucleus sampling
    "top_k": 1,         # Only consider top token
    "max_output_tokens": 32768,  # Maximum for Gemini 3 Pro (handles very large reports)
    "candidate_count": 1,  # Single response
}

# Extraction behavior settings
EXTRACTION_CONFIG = {
    "retry_attempts": 3,
    "retry_on_count_variance": 5,  # Retry if issue count varies by more than 5
    "min_similarity_threshold": 0.95,  # 95% similarity required
    "enable_caching": True,
    "cache_dir": ".extraction_cache",
    "sort_by": ["section_order", "page_number", "location"],
    "dedupe_similarity_threshold": 0.85,  # Issues with 85%+ similarity are duplicates
}

# TREC section order (Texas Real Estate Commission standard)
TREC_SECTION_ORDER = [
    "Structural Systems",
    "Foundations",
    "Grading and Drainage",
    "Roof Covering Materials",
    "Roof Structures and Attics",
    "Walls (Interior and Exterior)",
    "Ceilings and Floors",
    "Doors (Interior and Exterior)",
    "Windows",
    "Stairways (Interior and Exterior)",
    "Fireplaces and Chimneys",
    "Porches, Balconies, Decks, and Carports",
    "Other",
    "Electrical Systems",
    "Service Entrance and Panels",
    "Branch Circuits, Connected Devices, and Fixtures",
    "Heating, Ventilation and Air Conditioning Systems",
    "Heating Equipment",
    "Cooling Equipment",
    "Duct Systems, Chases, and Vents",
    "Plumbing System",
    "Plumbing Supply, Distribution Systems and Fixtures",
    "Drains, Wastes, and Vents",
    "Water Heating Equipment",
    "Hydro-Massage Therapy Equipment",
    "Other",
    "Appliances",
    "Dishwashers",
    "Food Waste Disposers",
    "Range Hood and Exhaust Systems",
    "Ranges, Cooktops, and Ovens",
    "Microwave Ovens",
    "Mechanical Exhaust Vents and Bathroom Heaters",
    "Garage Door Operators",
    "Dryer Exhaust Systems",
    "Other"
]

# Section mapping for normalization
SECTION_ALIASES = {
    "foundation": "Foundations",
    "grading": "Grading and Drainage",
    "drainage": "Grading and Drainage",
    "roof cover": "Roof Covering Materials",
    "roof structure": "Roof Structures and Attics",
    "attic": "Roof Structures and Attics",
    "walls": "Walls (Interior and Exterior)",
    "ceiling": "Ceilings and Floors",
    "floor": "Ceilings and Floors",
    "doors": "Doors (Interior and Exterior)",
    "window": "Windows",
    "electrical": "Electrical Systems",
    "service panel": "Service Entrance and Panels",
    "branch circuit": "Branch Circuits, Connected Devices, and Fixtures",
    "hvac": "Heating, Ventilation and Air Conditioning Systems",
    "heating": "Heating Equipment",
    "cooling": "Cooling Equipment",
    "air conditioning": "Cooling Equipment",
    "duct": "Duct Systems, Chases, and Vents",
    "plumbing": "Plumbing System",
    "water heater": "Water Heating Equipment",
    "appliance": "Appliances"
}


def get_section_order_index(section_name):
    """Get the sort order index for a section."""
    normalized = normalize_section_name(section_name)
    try:
        return TREC_SECTION_ORDER.index(normalized)
    except ValueError:
        return 999  # Unknown sections go to end


def normalize_section_name(section):
    """Normalize section name to TREC standard."""
    if not section:
        return "Other"
    
    section_lower = section.lower().strip()
    
    # Check aliases
    for alias, standard in SECTION_ALIASES.items():
        if alias in section_lower:
            return standard
    
    # Check standard names
    for standard_name in TREC_SECTION_ORDER:
        if standard_name.lower() in section_lower or section_lower in standard_name.lower():
            return standard_name
    
    return section  # Return as-is if no match
