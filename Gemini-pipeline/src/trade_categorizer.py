"""Trade-based categorization for repair estimates."""

import re
from typing import Dict, List, Tuple

# Define keyword mappings for each trade
TRADE_KEYWORDS = {
    "PLUMBING": {
        "primary": [
            "plumb", "water heater", "toilet", "sink", "faucet", "shower", "tub",
            "drain", "pipe", "p-trap", "ptrap", "angle stop", "shut-off valve",
            "gas line", "gas connector", "sediment trap", "drip leg", "tpr valve",
            "temperature pressure relief", "water supply", "sewer", "hydro"
        ],
        "secondary": [
            "leak", "drip", "flow", "pressure", "galvanized", "copper pipe",
            "pvc", "cpvc", "pex"
        ],
        "exclude": ["electrical"]
    },
    
    "ELECTRICAL": {
        "primary": [
            "electrical", "electric", "wire", "wiring", "circuit", "breaker",
            "panel", "outlet", "receptacle", "gfci", "afci", "ground", "neutral",
            "voltage", "amp", "ampere", "switch", "dimmer", "junction box"
        ],
        "secondary": [
            "smoke detector", "carbon monoxide", "co detector", "doorbell",
            "chime", "transformer"
        ],
        "exclude": ["gas", "water"]
    },
    
    "HVAC": {
        "primary": [
            "hvac", "heating", "cooling", "air condition", "ac unit", "furnace",
            "heat pump", "condenser", "evaporator", "coil", "refrigerant",
            "thermostat", "ductwork", "duct", "vent", "register", "return air"
        ],
        "secondary": [
            "filter", "condensate", "blower", "fan", "compressor"
        ],
        "exclude": ["water heater", "dryer vent", "range hood"]
    },
    
    "ROOF": {
        "primary": [
            "roof", "shingle", "tile", "flashing", "decking", "underlayment",
            "ridge", "valley", "eave", "fascia", "soffit", "gutter", "downspout"
        ],
        "secondary": [
            "chimney", "skylight", "turbine", "ridge vent", "boot", "cricket"
        ],
        "exclude": ["attic"]
    },
    
    "FOUNDATION": {
        "primary": [
            "foundation", "slab", "pier", "beam", "footing", "concrete crack",
            "settlement", "movement", "deflection", "honeycomb", "spalling"
        ],
        "secondary": [
            "grading", "drainage", "slope", "swale", "french drain", "moisture",
            "water intrusion", "brick ledge"
        ],
        "exclude": []
    },
    
    "WINDOWS/DOORS": {
        "primary": [
            "window", "door", "sliding", "french door", "patio door", "entry",
            "screen", "glass", "glazing", "weather strip", "threshold", "jamb"
        ],
        "secondary": [
            "hardware", "lock", "deadbolt", "handle", "hinge", "closer",
            "door stop", "strike plate", "sill"
        ],
        "exclude": ["garage door opener"]
    },
    
    "ATTIC": {
        "primary": [
            "attic", "insulation", "r-value", "blown-in", "batt", "radiant barrier",
            "attic ladder", "pull-down stair", "attic access", "purlin"
        ],
        "secondary": [
            "ventilation", "soffit vent", "ridge vent", "gable vent"
        ],
        "exclude": ["roof"]
    },
    
    "MISCELLANEOUS": {
        "primary": [
            "appliance", "dishwasher", "disposal", "garbage disposal", "range",
            "oven", "cooktop", "microwave", "refrigerator", "garage door"
        ],
        "secondary": [
            "deck", "patio", "fence", "driveway", "sidewalk", "landscaping"
        ],
        "exclude": []
    }
}


def categorize_by_trade(description: str, notes: str = "", section: str = "") -> str:
    """
    Categorize an issue based on trade keywords.
    
    Args:
        description: Issue description text
        notes: Additional notes
        section: Original section from inspection
    
    Returns:
        Trade category string
    """
    combined_text = f"{description} {notes} {section}".lower()
    
    # Score each category
    category_scores = {}
    
    for category, keywords in TRADE_KEYWORDS.items():
        score = 0
        
        # Check primary keywords (weight: 3)
        for keyword in keywords["primary"]:
            if keyword in combined_text:
                score += 3
        
        # Check secondary keywords (weight: 1)
        for keyword in keywords.get("secondary", []):
            if keyword in combined_text:
                score += 1
        
        # Check exclusions (weight: -5)
        for keyword in keywords.get("exclude", []):
            if keyword in combined_text:
                score -= 5
        
        category_scores[category] = max(0, score)
    
    # Find category with highest score
    if max(category_scores.values()) > 0:
        return max(category_scores, key=category_scores.get)
    
    # Default fallback based on section
    section_lower = section.lower()
    if "plumb" in section_lower or "water" in section_lower:
        return "PLUMBING"
    elif "electric" in section_lower:
        return "ELECTRICAL"
    elif "hvac" in section_lower or "heat" in section_lower or "cool" in section_lower:
        return "HVAC"
    elif "roof" in section_lower:
        return "ROOF"
    elif "foundation" in section_lower or "slab" in section_lower:
        return "FOUNDATION"
    elif "window" in section_lower or "door" in section_lower:
        return "WINDOWS/DOORS"
    elif "attic" in section_lower:
        return "ATTIC"
    
    return "MISCELLANEOUS"


def normalize_category(category: str, description: str = "", notes: str = "") -> str:
    """
    Normalize and validate category assignment.
    Maps INTERIOR/EXTERIOR to specific trades.
    """
    VALID_CATEGORIES = [
        "PLUMBING", "ELECTRICAL", "HVAC", "ROOF", 
        "FOUNDATION", "WINDOWS/DOORS", "ATTIC", "MISCELLANEOUS"
    ]
    
    # If already valid, return as-is
    if category.upper() in VALID_CATEGORIES:
        return category.upper()
    
    # If INTERIOR/EXTERIOR, recategorize by trade
    if category.upper() in ["INTERIOR", "EXTERIOR", "GENERAL", "EVALUATE"]:
        return categorize_by_trade(description, notes, category)
    
    # Otherwise, categorize based on description
    return categorize_by_trade(description, notes, category)

