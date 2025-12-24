#!/usr/bin/env python3
"""
Estimate builder CLI.

Converts structured inspection findings into a BOSSCAT-style estimate using an
internal Texas state (2024-2025) price book, optionally refined by Gemini.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import logging
import math
import os
import random
import re
import sys
import textwrap
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from jsonschema import Draft7Validator, ValidationError

try:
    import google.genai as genai
except ImportError as exc:
    raise RuntimeError(
        "google-genai is required. Install it with 'pip install google-genai'."
    ) from exc


PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Import config module for deterministic settings
try:
    import config
except ImportError:
    config = None

# Import trade categorizer
try:
    from trade_categorizer import normalize_category, categorize_by_trade
except ImportError:
    # Fallback if trade_categorizer not available
    def normalize_category(category: str, description: str = "", notes: str = "") -> str:
        return category.upper()
    def categorize_by_trade(description: str, notes: str = "", section: str = "") -> str:
        return "MISCELLANEOUS"

LOGGER = logging.getLogger("estimate_builder")

DEFAULT_MODEL = "models/gemini-2.5-pro"
AI_LOG_PATH = Path("ai_estimate_log.csv")

CATEGORIES = [
    "PLUMBING",
    "ELECTRICAL",
    "HVAC",
    "ROOF",
    "FOUNDATION",
    "WINDOWS/DOORS",
    "ATTIC",
    "MISCELLANEOUS",
]

# DEPRECATED: Old generic severity pricing (replaced by CATEGORY_SEVERITY_PRICE_MATRIX)
# Kept for reference only
# SEVERITY_PRICE_MAP = {
#     "minor": 100.0,
#     "moderate": 200.0,
#     "major": 400.0,
#     "critical": 600.0,
# }

CATEGORY_SEVERITY_PRICE_MATRIX = {
    "PLUMBING": {
        "minor": 150.0,      # Small leak, fixture adjustment
        "moderate": 400.0,   # Pipe repair, valve replacement
        "major": 800.0,      # Repipe section, water heater
        "critical": 1500.0,  # Main line failure, extensive damage
    },
    "ELECTRICAL": {
        "minor": 200.0,      # Outlet replacement, switch repair
        "moderate": 500.0,   # Circuit addition, panel work
        "major": 1200.0,     # Panel replacement, rewiring section
        "critical": 2500.0,  # Full panel upgrade, major rewiring
    },
    "HVAC": {
        "minor": 150.0,      # Filter, thermostat, minor adjustment
        "moderate": 600.0,   # Compressor repair, duct work
        "major": 1500.0,     # Unit replacement (one system)
        "critical": 3500.0,  # Full HVAC replacement (both systems)
    },
    "ROOF": {
        "minor": 300.0,      # Shingle repair, small leak
        "moderate": 800.0,   # Section repair, flashing
        "major": 2500.0,     # Major section replacement
        "critical": 8000.0,  # Full roof replacement
    },
    "FOUNDATION": {
        "minor": 400.0,      # Small crack sealing
        "moderate": 1200.0,  # Pier repair, drainage
        "major": 3500.0,     # Multiple piers, structural work
        "critical": 8000.0,  # Major foundation repair
    },
    "WINDOWS/DOORS": {
        "minor": 150.0,      # Weather stripping, adjustment
        "moderate": 400.0,   # Window/door replacement (1-2)
        "major": 1000.0,     # Multiple replacements
        "critical": 2500.0,  # Extensive replacement + frame work
    },
    "ATTIC": {
        "minor": 200.0,      # Insulation top-up, ventilation
        "moderate": 500.0,   # Insulation replacement, vent install
        "major": 1200.0,     # Full insulation + extensive vent work
        "critical": 2500.0,  # Structural + insulation + ventilation
    },
    "MISCELLANEOUS": {
        "minor": 200.0,      # General maintenance
        "moderate": 500.0,   # Small repairs
        "major": 1200.0,     # Moderate repairs
        "critical": 2500.0,  # Significant repairs
    },
}

# Consolidation savings - reflects contractor efficiency when bundling similar work
# Real contractors give discounts for bundled jobs (one mobilization, bulk purchasing, workflow efficiency)
CONSOLIDATION_SAVINGS = {
    1: 1.0,      # Single issue, no discount
    2: 0.95,     # 2 issues bundled = 5% savings
    3: 0.90,     # 3 issues bundled = 10% savings
    4: 0.85,     # 4 issues bundled = 15% savings
    5: 0.80,     # 5+ issues bundled = 20% savings (max efficiency)
}

# Category-specific consolidation guidelines
# Different trades naturally bundle differently based on work type and contractor practices
CATEGORY_CONSOLIDATION_RULES = {
    "ROOF": {
        "target_ratio": 5.5,        # 5-6 issues → 1 item (aggressive bundling)
        "max_per_item": 8,          # Bundle up to 8 related issues
        "bundling_strategy": "aggressive",
        "reason": "Single trade, single mobilization, roof work naturally bundles into comprehensive packages"
    },
    "ELECTRICAL": {
        "target_ratio": 4.0,        # 4-5 issues → 1-2 items
        "max_per_item": 5,          # Max 5 issues per line item
        "bundling_strategy": "moderate",
        "reason": "Group by circuit/location, but keep distinct electrical work separate for clarity"
    },
    "PLUMBING": {
        "target_ratio": 3.5,        # 3-4 issues → 1 item
        "max_per_item": 4,          # Max 4 issues per line item
        "bundling_strategy": "moderate",
        "reason": "Group by system (supply/drain), but keep major fixtures/repairs separate"
    },
    "HVAC": {
        "target_ratio": 3.0,        # 3 issues → 1 item
        "max_per_item": 3,          # Max 3 issues per line item
        "bundling_strategy": "moderate",
        "reason": "Group by system (heating/cooling), but keep major repairs and replacements separate"
    },
    "FOUNDATION": {
        "target_ratio": 2.0,        # 2-3 issues → 1 item (conservative)
        "max_per_item": 3,          # Max 3 issues per line item
        "bundling_strategy": "conservative",
        "reason": "Each foundation issue often needs separate engineering assessment, minimal bundling"
    },
    "WINDOWS/DOORS": {
        "target_ratio": 3.0,        # 3 issues → 1 item
        "max_per_item": 4,          # Max 4 per line item
        "bundling_strategy": "moderate",
        "reason": "Group by type (windows vs doors) and location, but keep large jobs itemized"
    },
    "ATTIC": {
        "target_ratio": 4.0,        # 4 issues → 1 item
        "max_per_item": 5,          # Max 5 per line item
        "bundling_strategy": "moderate",
        "reason": "Single access point, insulation and ventilation work naturally bundles"
    },
    "MISCELLANEOUS": {
        "target_ratio": 3.0,        # Default moderate bundling
        "max_per_item": 4,
        "bundling_strategy": "moderate",
        "reason": "General repairs - moderate bundling by similarity"
    },
}

# Quality scoring weights (total = 100%)
# These weights determine how much each factor contributes to overall quality score
QUALITY_WEIGHTS = {
    "consolidation_quality": 0.30,      # 30% - Most important (proper bundling)
    "price_consistency": 0.25,          # 25% - No outlier pricing
    "priority_distribution": 0.20,      # 20% - Appropriate HIGH/MEDIUM/LOW split
    "data_completeness": 0.15,          # 15% - All required fields present
    "category_distribution": 0.10,      # 10% - Reasonable spread across categories
}

# Quality grade thresholds
QUALITY_THRESHOLDS = {
    "excellent": 90,      # 90-100: Excellent estimate
    "good": 80,           # 80-89: Good estimate
    "acceptable": 70,     # 70-79: Acceptable estimate
    "needs_review": 60,   # 60-69: Needs review
    "poor": 0             # 0-59: Poor estimate
}

# Expected priority distribution (target percentages)
# Based on typical home inspection findings
EXPECTED_PRIORITY_DISTRIBUTION = {
    "HIGH": 0.35,      # 35% should be high priority (safety/structural)
    "MEDIUM": 0.45,    # 45% should be medium priority (repairs needed)
    "LOW": 0.20,       # 20% should be low priority (maintenance/cosmetic)
}


def get_base_price(category: str, severity: str) -> float:
    """
    Get base price for an issue based on category and severity.

    Uses CATEGORY_SEVERITY_PRICE_MATRIX to return appropriate base pricing
    for the given category and severity combination. Falls back to MISCELLANEOUS
    if category not found, and to "moderate" if severity not found.

    Args:
        category: Issue category (PLUMBING, ELECTRICAL, HVAC, ROOF, etc.)
        severity: Issue severity (minor, moderate, major, critical)

    Returns:
        Base price in USD

    Examples:
        >>> get_base_price("ROOF", "major")
        2500.0
        >>> get_base_price("PLUMBING", "minor")
        150.0
        >>> get_base_price("UNKNOWN_CAT", "moderate")  # Falls back to MISCELLANEOUS
        250.0
    """
    # Normalize inputs
    category = category.upper().strip()
    severity = severity.lower().strip()

    # Get category pricing, default to MISCELLANEOUS if not found
    if category not in CATEGORY_SEVERITY_PRICE_MATRIX:
        LOGGER.debug(f"Category '{category}' not in price matrix, using MISCELLANEOUS")
        category = "MISCELLANEOUS"

    category_prices = CATEGORY_SEVERITY_PRICE_MATRIX[category]

    # Get severity price, default to moderate if not found
    if severity not in category_prices:
        LOGGER.debug(f"Severity '{severity}' not found for {category}, using 'moderate'")
        severity = "moderate"

    base_price = category_prices[severity]

    LOGGER.debug(f"Base price for {category}/{severity}: ${base_price:.2f}")

    return base_price


def calculate_consolidated_price(
    issues: List[Dict[str, Any]],
    category: str,
    regional_multiplier: float = 1.0
) -> float:
    """
    Calculate price for a group of consolidated issues with efficiency discount.

    Applies three pricing factors:
    1. Base price per issue (category + severity specific)
    2. Consolidation discount (reflects contractor efficiency for bundled work)
    3. Regional adjustment (Texas regional pricing differences)

    Args:
        issues: List of issue dicts being consolidated into one line item
        category: Category for all issues (should be same category)
        regional_multiplier: Regional pricing adjustment (default 1.0 for Houston)

    Returns:
        Final consolidated price in USD

    Example:
        3 minor roof issues:
        - Base: 3 × $300 = $900
        - Consolidation (3 issues): × 0.90 = $810
        - Regional (Houston): × 1.0 = $810
        - Final: $810.00
    """
    if not issues:
        return 0.0

    # Calculate base price for each issue
    base_total = 0.0
    for issue in issues:
        severity = issue.get("severity", "moderate")
        if not severity:
            severity = "moderate"

        base_price = get_base_price(category, severity)
        base_total += base_price

        LOGGER.debug(
            f"  Issue: {issue.get('title', 'Unknown')[:50]} | "
            f"Severity: {severity} | Base: ${base_price:.2f}"
        )

    # Apply consolidation discount
    issue_count = len(issues)
    discount_key = min(issue_count, 5)  # Cap at 5 for max discount
    discount_factor = CONSOLIDATION_SAVINGS.get(discount_key, CONSOLIDATION_SAVINGS[5])

    discounted_total = base_total * discount_factor

    # Apply regional adjustment
    final_price = discounted_total * regional_multiplier

    LOGGER.info(
        f"Consolidated {issue_count} {category} issues: "
        f"Base=${base_total:.2f} → "
        f"After {int((1-discount_factor)*100)}% discount=${discounted_total:.2f} → "
        f"After regional ({regional_multiplier}x)=${final_price:.2f}"
    )

    return round(final_price, 2)


def get_consolidation_guidance(category: str, issue_count: int) -> Dict[str, Any]:
    """
    Get category-specific consolidation guidance for optimal bundling.

    Args:
        category: Issue category (PLUMBING, ROOF, etc.)
        issue_count: Number of issues in this category

    Returns:
        Dict with recommended item count, bundling rules, and rationale

    Example:
        >>> get_consolidation_guidance("ROOF", 12)
        {
            "category": "ROOF",
            "issue_count": 12,
            "recommended_items": 2,
            "issues_per_item": 6,
            "target_ratio": 5.5,
            "max_per_item": 8,
            "bundling_strategy": "aggressive",
            "reason": "Single trade, single mobilization..."
        }
    """
    category = category.upper().strip()
    rules = CATEGORY_CONSOLIDATION_RULES.get(
        category,
        CATEGORY_CONSOLIDATION_RULES["MISCELLANEOUS"]
    )

    target_ratio = rules["target_ratio"]
    max_per_item = rules["max_per_item"]

    # Calculate recommended number of items for this category
    recommended_items = max(1, round(issue_count / target_ratio))

    # Calculate recommended issues per item
    issues_per_item = round(issue_count / recommended_items) if recommended_items > 0 else issue_count

    # Ensure we don't exceed max_per_item
    if issues_per_item > max_per_item:
        recommended_items = max(1, round(issue_count / max_per_item))
        issues_per_item = round(issue_count / recommended_items)

    LOGGER.debug(
        f"Consolidation guidance for {category} ({issue_count} issues): "
        f"Recommended {recommended_items} items (~{issues_per_item} issues/item, "
        f"target ratio {target_ratio}:1)"
    )

    return {
        "category": category,
        "issue_count": issue_count,
        "recommended_items": recommended_items,
        "issues_per_item": issues_per_item,
        "target_ratio": target_ratio,
        "max_per_item": max_per_item,
        "bundling_strategy": rules["bundling_strategy"],
        "reason": rules["reason"]
    }


def validate_category_consolidation(
    category: str,
    issue_count: int,
    actual_items: int
) -> Dict[str, Any]:
    """
    Validate if consolidation for a specific category meets quality standards.

    Checks if the actual consolidation ratio is within acceptable range (±30%)
    of the target ratio for that category.

    Args:
        category: Issue category
        issue_count: Number of issues in this category
        actual_items: Actual number of line items created for this category

    Returns:
        Dict with validation results and warning if out of range

    Example:
        >>> validate_category_consolidation("ROOF", 12, 2)
        {"is_acceptable": True, "actual_ratio": 6.0, ...}

        >>> validate_category_consolidation("ROOF", 12, 10)
        {"is_acceptable": False, "actual_ratio": 1.2,
         "warning": "⚠️ UNDER-CONSOLIDATED for ROOF..."}
    """
    guidance = get_consolidation_guidance(category, issue_count)
    recommended = guidance["recommended_items"]

    # Calculate actual ratio
    actual_ratio = issue_count / actual_items if actual_items > 0 else float('inf')
    target_ratio = guidance["target_ratio"]

    # Acceptable range: ±30% of target ratio
    min_acceptable = target_ratio * 0.7
    max_acceptable = target_ratio * 1.3

    is_acceptable = min_acceptable <= actual_ratio <= max_acceptable

    result = {
        "category": category,
        "is_acceptable": is_acceptable,
        "issue_count": issue_count,
        "actual_items": actual_items,
        "actual_ratio": round(actual_ratio, 2),
        "recommended_items": recommended,
        "target_ratio": target_ratio,
        "acceptable_range": f"{min_acceptable:.1f}:1 - {max_acceptable:.1f}:1"
    }

    if not is_acceptable:
        if actual_ratio < min_acceptable:
            result["warning"] = (
                f"⚠️ UNDER-CONSOLIDATED for {category}: {actual_ratio:.1f}:1 ratio "
                f"(target {target_ratio}:1) - Too granular, should bundle more"
            )
        else:
            result["warning"] = (
                f"⚠️ OVER-CONSOLIDATED for {category}: {actual_ratio:.1f}:1 ratio "
                f"(target {target_ratio}:1) - Hiding too much detail, should itemize more"
            )
        LOGGER.warning(result["warning"])
    else:
        LOGGER.debug(
            f"✅ {category} consolidation acceptable: {actual_ratio:.1f}:1 "
            f"(target {target_ratio}:1, range {min_acceptable:.1f}-{max_acceptable:.1f}:1)"
        )

    return result


def validate_all_category_consolidation(
    issues: List[Dict[str, Any]],
    items: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Validate consolidation quality for each category independently.

    Groups issues and items by category, then validates each category's
    consolidation ratio against category-specific targets.

    Args:
        issues: All issues from extraction
        items: All estimate items

    Returns:
        Dict with per-category validation results and overall assessment

    Example:
        {
            "all_acceptable": False,
            "category_validations": {
                "ROOF": {"is_acceptable": True, "actual_ratio": 5.2, ...},
                "ELECTRICAL": {"is_acceptable": False, "actual_ratio": 1.5, ...}
            },
            "total_issues": 45,
            "total_items": 12,
            "overall_ratio": 3.75
        }
    """
    # Group issues by category (using mapped pricing categories)
    issues_by_category = {}
    for issue in issues:
        # Map extracted section to pricing category
        section = issue.get("section", "")
        component = issue.get("component", "")
        title = issue.get("title", "")
        cat = map_extraction_category_to_pricing(section, component, title)
        
        if cat not in issues_by_category:
            issues_by_category[cat] = []
        issues_by_category[cat].append(issue)

    # Group items by category
    items_by_category = {}
    for item in items:
        cat = item.get("category", "MISCELLANEOUS")
        if cat:
            cat = cat.upper().strip()
        else:
            cat = "MISCELLANEOUS"

        if cat not in items_by_category:
            items_by_category[cat] = []
        items_by_category[cat].append(item)

    # Validate each category
    category_validations = {}
    all_acceptable = True

    for category in issues_by_category.keys():
        issue_count = len(issues_by_category[category])
        item_count = len(items_by_category.get(category, []))

        if item_count == 0:
            LOGGER.warning(
                f"⚠️ Category {category} has {issue_count} issues but 0 items - "
                f"issues may be miscategorized or missing from estimate"
            )
            continue

        validation = validate_category_consolidation(category, issue_count, item_count)
        category_validations[category] = validation

        if not validation["is_acceptable"]:
            all_acceptable = False

    overall_ratio = len(issues) / len(items) if items else 0

    result = {
        "all_acceptable": all_acceptable,
        "category_validations": category_validations,
        "total_issues": len(issues),
        "total_items": len(items),
        "overall_ratio": round(overall_ratio, 2)
    }

    # Summary logging
    acceptable_count = sum(1 for v in category_validations.values() if v["is_acceptable"])
    total_categories = len(category_validations)

    LOGGER.info(
        f"Category consolidation validation: {acceptable_count}/{total_categories} "
        f"categories within acceptable range"
    )

    if not all_acceptable:
        LOGGER.warning("⚠️ Some categories have consolidation issues - see warnings above")

    return result


def score_consolidation_quality(
    issues: List[Dict[str, Any]],
    items: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Score consolidation quality (0-100) based on category-specific validation.

    Uses validate_all_category_consolidation() to check if each category's
    consolidation ratio is within acceptable range for that trade.

    Args:
        issues: All issues from extraction
        items: All estimate items

    Returns:
        Dict with score, weight, weighted_score, and details

    Scoring:
        100: All categories within acceptable range
        Proportional: Based on % of categories within range
    """
    validation = validate_all_category_consolidation(issues, items)

    if validation["all_acceptable"]:
        score = 100
    else:
        # Calculate how many categories are acceptable
        category_vals = validation["category_validations"]
        acceptable_count = sum(1 for v in category_vals.values() if v["is_acceptable"])
        total_count = len(category_vals)

        # Score proportional to acceptable categories
        score = (acceptable_count / total_count) * 100 if total_count > 0 else 50

    return {
        "score": round(score, 1),
        "weight": QUALITY_WEIGHTS["consolidation_quality"],
        "weighted_score": round(score * QUALITY_WEIGHTS["consolidation_quality"], 2),
        "details": validation
    }


def score_price_consistency(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Score price consistency (0-100) by detecting outlier pricing.

    Calculates price-per-issue for each item and flags outliers
    (prices >3x or <0.3x median). More outliers = lower score.

    Args:
        items: All estimate items

    Returns:
        Dict with score, weight, weighted_score, and outlier details

    Scoring:
        100: No outliers
        Decreases linearly: 50% outliers = 0 score
    """
    if not items:
        return {
            "score": 0,
            "weight": QUALITY_WEIGHTS["price_consistency"],
            "weighted_score": 0,
            "median_price_per_issue": 0,
            "outlier_count": 0,
            "total_items": 0
        }

    # Calculate price per issue for each item
    prices_per_issue = []
    for item in items:
        price = item.get("unit_price_usd", 0)
        # Estimate issue count from consolidation (default to 1 if not tracked)
        issue_count = item.get("consolidated_issue_count", 1)
        if issue_count > 0:
            prices_per_issue.append(price / issue_count)

    if not prices_per_issue:
        return {
            "score": 50,
            "weight": QUALITY_WEIGHTS["price_consistency"],
            "weighted_score": round(50 * QUALITY_WEIGHTS["price_consistency"], 2),
            "median_price_per_issue": 0,
            "outlier_count": 0,
            "total_items": len(items)
        }

    # Calculate median
    prices_sorted = sorted(prices_per_issue)
    median_idx = len(prices_sorted) // 2
    median = prices_sorted[median_idx]

    # Count outliers (more than 3x or less than 0.3x median)
    outlier_count = sum(
        1 for p in prices_per_issue
        if p > median * 3 or (median > 0 and p < median * 0.3)
    )
    outlier_ratio = outlier_count / len(prices_per_issue)

    # Score: 100 if no outliers, decrease linearly with outlier ratio
    # 50% outliers = 0 score
    score = max(0, 100 - (outlier_ratio * 200))

    return {
        "score": round(score, 1),
        "weight": QUALITY_WEIGHTS["price_consistency"],
        "weighted_score": round(score * QUALITY_WEIGHTS["price_consistency"], 2),
        "median_price_per_issue": round(median, 2),
        "outlier_count": outlier_count,
        "total_items": len(items)
    }


def score_priority_distribution(issues: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Score priority distribution (0-100) against expected distribution.

    Checks if HIGH/MEDIUM/LOW priorities match typical inspection patterns:
    - 35% HIGH (safety/structural)
    - 45% MEDIUM (repairs needed)
    - 20% LOW (maintenance/cosmetic)

    Args:
        issues: All issues from extraction

    Returns:
        Dict with score, weight, weighted_score, and distribution comparison

    Scoring:
        100: Perfect match to expected distribution
        Decreases with deviation: 40% total deviation = 50 score
    """
    if not issues:
        return {
            "score": 0,
            "weight": QUALITY_WEIGHTS["priority_distribution"],
            "weighted_score": 0,
            "actual_distribution": {},
            "expected_distribution": {}
        }

    # Count priorities
    priority_counts = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for issue in issues:
        priority = issue.get("priority", "MEDIUM")
        if priority:
            priority = priority.upper().strip()
        else:
            priority = "MEDIUM"

        if priority in priority_counts:
            priority_counts[priority] += 1
        else:
            # Unknown priority, default to MEDIUM
            priority_counts["MEDIUM"] += 1

    total = len(issues)

    # Calculate actual distribution
    actual_dist = {
        p: count / total for p, count in priority_counts.items()
    }

    # Calculate deviation from expected distribution
    total_deviation = sum(
        abs(actual_dist.get(p, 0) - EXPECTED_PRIORITY_DISTRIBUTION[p])
        for p in EXPECTED_PRIORITY_DISTRIBUTION.keys()
    )

    # Score: 100 if perfect match, decrease with deviation
    # Total deviation of 0.40 (20% each way) = 50 score
    score = max(0, 100 - (total_deviation * 125))

    return {
        "score": round(score, 1),
        "weight": QUALITY_WEIGHTS["priority_distribution"],
        "weighted_score": round(score * QUALITY_WEIGHTS["priority_distribution"], 2),
        "actual_distribution": {p: round(v * 100, 1) for p, v in actual_dist.items()},
        "expected_distribution": {p: round(v * 100, 1) for p, v in EXPECTED_PRIORITY_DISTRIBUTION.items()},
        "priority_counts": priority_counts
    }


def score_data_completeness(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Score data completeness (0-100) by checking required fields.

    Ensures all estimate items have required fields populated:
    - category
    - description
    - unit_price_usd
    - notes

    Args:
        items: All estimate items

    Returns:
        Dict with score, weight, weighted_score, and completeness stats

    Scoring:
        100: All items have all required fields
        Proportional: Based on % of items with complete data
    """
    if not items:
        return {
            "score": 0,
            "weight": QUALITY_WEIGHTS["data_completeness"],
            "weighted_score": 0,
            "complete_items": 0,
            "total_items": 0
        }

    required_fields = ["category", "description", "unit_price_usd", "notes"]

    complete_items = 0
    for item in items:
        is_complete = all(
            item.get(field) is not None and str(item.get(field)).strip() != ""
            for field in required_fields
        )
        if is_complete:
            complete_items += 1

    score = (complete_items / len(items)) * 100

    return {
        "score": round(score, 1),
        "weight": QUALITY_WEIGHTS["data_completeness"],
        "weighted_score": round(score * QUALITY_WEIGHTS["data_completeness"], 2),
        "complete_items": complete_items,
        "total_items": len(items),
        "required_fields": required_fields
    }


def score_category_distribution(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Score category distribution (0-100) to detect poor categorization.

    Penalizes if too many items in one category (>60%), which suggests:
    - Poor categorization logic
    - Over-consolidation into MISCELLANEOUS
    - Missing category assignments

    Args:
        items: All estimate items

    Returns:
        Dict with score, weight, weighted_score, and category breakdown

    Scoring:
        100: Good distribution (no category >60%)
        Decreases if one category dominates: 80% in one = 50 score
    """
    if not items:
        return {
            "score": 0,
            "weight": QUALITY_WEIGHTS["category_distribution"],
            "weighted_score": 0,
            "category_counts": {},
            "max_category_ratio": 0
        }

    # Count items per category
    category_counts = {}
    for item in items:
        cat = item.get("category", "MISCELLANEOUS")
        if cat:
            cat = cat.upper().strip()
        else:
            cat = "MISCELLANEOUS"
        category_counts[cat] = category_counts.get(cat, 0) + 1

    total = len(items)
    max_count = max(category_counts.values()) if category_counts else 0
    max_ratio = max_count / total if total > 0 else 0

    # Penalize if one category dominates (>60% is problematic)
    if max_ratio > 0.60:
        # Score decreases as ratio increases
        # 80% in one category = 50 score
        score = max(0, 100 - ((max_ratio - 0.60) * 250))
    else:
        score = 100

    return {
        "score": round(score, 1),
        "weight": QUALITY_WEIGHTS["category_distribution"],
        "weighted_score": round(score * QUALITY_WEIGHTS["category_distribution"], 2),
        "category_counts": category_counts,
        "max_category_ratio": round(max_ratio * 100, 1)
    }


def calculate_quality_score(
    issues: List[Dict[str, Any]],
    items: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Calculate overall quality score (0-100) for an estimate.

    Combines 5 weighted quality factors:
    1. Consolidation quality (30%) - Category-specific bundling
    2. Price consistency (25%) - No outlier pricing
    3. Priority distribution (20%) - Appropriate HIGH/MEDIUM/LOW
    4. Data completeness (15%) - All fields present
    5. Category distribution (10%) - Good category spread

    Args:
        issues: All issues from extraction
        items: All estimate items

    Returns:
        Dict with overall score, grade, breakdown by factor, and review flag

    Example:
        {
            "overall_score": 86.5,
            "grade": "GOOD",
            "breakdown": {...},
            "needs_review": False
        }
    """
    # Calculate individual scores
    consolidation_score = score_consolidation_quality(issues, items)
    price_score = score_price_consistency(items)
    priority_score = score_priority_distribution(issues)
    completeness_score = score_data_completeness(items)
    category_score = score_category_distribution(items)

    # Calculate weighted total
    total_score = (
        consolidation_score["weighted_score"] +
        price_score["weighted_score"] +
        priority_score["weighted_score"] +
        completeness_score["weighted_score"] +
        category_score["weighted_score"]
    )

    # Determine quality grade
    if total_score >= QUALITY_THRESHOLDS["excellent"]:
        grade = "EXCELLENT"
        emoji = "🌟"
    elif total_score >= QUALITY_THRESHOLDS["good"]:
        grade = "GOOD"
        emoji = "✅"
    elif total_score >= QUALITY_THRESHOLDS["acceptable"]:
        grade = "ACCEPTABLE"
        emoji = "👍"
    elif total_score >= QUALITY_THRESHOLDS["needs_review"]:
        grade = "NEEDS REVIEW"
        emoji = "⚠️"
    else:
        grade = "POOR"
        emoji = "❌"

    needs_review = total_score < QUALITY_THRESHOLDS["acceptable"]

    return {
        "overall_score": round(total_score, 1),
        "grade": grade,
        "emoji": emoji,
        "breakdown": {
            "consolidation": consolidation_score,
            "price_consistency": price_score,
            "priority_distribution": priority_score,
            "data_completeness": completeness_score,
            "category_distribution": category_score
        },
        "needs_review": needs_review,
        "thresholds": QUALITY_THRESHOLDS
    }


DISCLAIMER_TEMPLATES = {
    "PLUMBING": "Texas state average pricing. Local codes and materials may affect final cost.",
    "ELECTRICAL": "Based on Texas electrical code requirements and state average labor rates.",
    "HVAC": "Texas climate zone pricing. Actual cost depends on system specifications.",
    "ROOF": "Texas weather considerations included. Price varies by material and accessibility.",
    "FOUNDATION": "Texas soil conditions vary. Final pricing after engineering evaluation.",
    "WINDOWS/DOORS": "Texas building code compliant installation at state average rates.",
    "ATTIC": "Texas energy code requirements. Pricing includes state rebate eligibility.",
    "MISCELLANEOUS": "Based on current Texas state contractor rates.",
    "GENERAL": "Estimate reflects Texas state market conditions as of 2024-2025.",
}

# Texas regional adjustment factors
TEXAS_REGIONAL_MULTIPLIERS = {
    "Dallas-Fort Worth": 1.05,
    "Austin": 1.10,
    "Houston": 1.00,
    "San Antonio": 0.95,
    "El Paso": 0.90,
    "Corpus Christi": 0.92,
    "Lubbock": 0.88,
    "Amarillo": 0.87,
    "Rural Texas": 0.85,
    "Default": 1.00
}


def create_individual_pricing_prompt(issue: Dict[str, Any], pricebook: Dict[str, Any]) -> str:
    """
    Create pricing prompt for a SINGLE issue.

    Version: 7.0 - Two-phase approach: Individual pricing (no consolidation)
    """

    issue_json = json.dumps(issue, indent=2)
    category = issue.get("suggested_category", "MISCELLANEOUS")

    # Get category-specific pricing guidance
    severity_prices = CATEGORY_SEVERITY_PRICE_MATRIX.get(category, CATEGORY_SEVERITY_PRICE_MATRIX["MISCELLANEOUS"])

    return f'''
You are a Texas-licensed contractor pricing a SINGLE repair item.

ISSUE TO PRICE:
{issue_json}

CATEGORY: {category}

PRICING GUIDELINES FOR {category}:
- Minor: ${severity_prices.get("minor", 100):.0f}-{severity_prices.get("minor", 100)*3:.0f}
- Moderate: ${severity_prices.get("moderate", 200):.0f}-{severity_prices.get("moderate", 200)*3:.0f}
- Major: ${severity_prices.get("major", 400):.0f}-{severity_prices.get("major", 400)*3:.0f}
- Critical: ${severity_prices.get("critical", 600):.0f}-{severity_prices.get("critical", 600)*3:.0f}

TEXAS MARKET CONTEXT (2025):
- Houston metro area pricing
- Licensed contractor rates: $75-150/hour for labor
- Material costs at current market rates
- Standard markup: 15-20% overhead + profit

INSTRUCTIONS:
1. Price this SINGLE issue accurately based on Texas market rates
2. Consider: labor time, materials, overhead, complexity
3. Use the category-specific pricing guidelines above
4. DO NOT consolidate or bundle - this is ONE issue only
5. Provide a clear, specific description of the work

RETURN VALID JSON with this EXACT structure:
{{
  "category": "{category}",
  "description": "Specific description of this repair",
  "qty": 1,
  "unit_price_usd": 450.00,
  "line_total_usd": 450.00,
  "notes": "Brief notes about the work",
  "priority": "MEDIUM",
  "bundled_issues": 1
}}

CRITICAL RULES:
1. Return ONLY valid JSON (no text before or after)
2. Use numeric values (not placeholder text)
3. Use EXACT category name: {category}
4. Price accurately based on Texas market rates
5. This is ONE issue - bundled_issues must be 1
'''


def create_enhanced_pricing_prompt(issues: List[Dict[str, Any]], pricebook: Dict[str, Any]) -> str:
        """
        Create pricing prompt focused on ACCURACY and MARKET RATES.

        Version: 4.0 - Removed artificial constraints, added pricing guardrails
        DEPRECATED: Use create_individual_pricing_prompt + code-based consolidation instead
        """

        issues_json = json.dumps(issues, indent=2)
        issue_count = len(issues)

        # Group issues by category for consolidation guidance
        category_counts = {}
        for issue in issues:
            cat = issue.get("suggested_category", "MISCELLANEOUS")
            category_counts[cat] = category_counts.get(cat, 0) + 1

        # Build category-specific consolidation guidance
        consolidation_guidance = []
        for cat, count in category_counts.items():
            rules = CATEGORY_CONSOLIDATION_RULES.get(cat, CATEGORY_CONSOLIDATION_RULES["MISCELLANEOUS"])
            target_items = max(1, round(count / rules["target_ratio"]))
            consolidation_guidance.append(
                f"   - {cat}: {count} issues → {target_items} line items (bundle ~{rules['target_ratio']:.1f} issues per item, max {rules['max_per_item']} per item)"
            )

        consolidation_text = "\n".join(consolidation_guidance)

        return f'''
You are a Texas-licensed contractor creating an ACCURATE repair estimate for {issue_count} inspection findings.

PRICING PHILOSOPHY:

1. ACCURACY IS THE PRIMARY GOAL
   - Base all prices on actual Texas market rates (2025)
   - Consider: labor costs, material costs, overhead, regional factors
   - Price what the work actually costs - NO artificial targets or constraints
   - Each issue should be priced independently based on actual scope of work

2. TEXAS MARKET CONTEXT (2025)
   - Houston metro area pricing
   - Licensed contractor rates: $75-150/hour for labor
   - Material costs at current market rates
   - Standard markup: 15-20% overhead + profit
   - Use category-specific pricing (see PRICING REFERENCE below)

3. RESPECT THE SUGGESTED CATEGORY
   - Each issue has a "suggested_category" field - USE IT
   - This maps the inspector's finding to the correct trade
   - Example: "Structural Systems" issue → "FOUNDATION" category
   - DO NOT change categories unless clearly wrong

4. CONSOLIDATION GUIDELINES (CATEGORY-SPECIFIC - MANDATORY HARD LIMITS)

   🚨 **CRITICAL: THESE ARE ABSOLUTE REQUIREMENTS, NOT SUGGESTIONS** 🚨

   **YOU MUST CREATE EXACTLY THE NUMBER OF LINE ITEMS SHOWN BELOW:**

{consolidation_text}

   **MANDATORY CONSOLIDATION LIMITS BY CATEGORY:**

   📦 **ROOF** - MAXIMUM 8 ISSUES PER LINE ITEM (NO EXCEPTIONS)
      - If you have 28 roof issues: CREATE MINIMUM 4 LINE ITEMS (28÷8=3.5, round up to 4)
      - If you have 14 roof issues: CREATE MINIMUM 2 LINE ITEMS (14÷8=1.75, round up to 2)
      - Group by: roof zone, system (shingles vs flashing), or location
      - ✅ CORRECT: "Roof Zone 1 - Shingle repairs (replace 8 damaged shingles, seal 2 vents)" [8 issues]
      - ❌ WRONG: "Comprehensive roof repairs" bundling 28 issues [REJECTED - TOO MANY]

   ⚡ **ELECTRICAL** - MAXIMUM 5 ISSUES PER LINE ITEM (NO EXCEPTIONS)
      - If you have 25 electrical issues: CREATE MINIMUM 5 LINE ITEMS (25÷5=5)
      - If you have 20 electrical issues: CREATE MINIMUM 4 LINE ITEMS (20÷5=4)
      - Group by: circuit, room, or system (panel vs outlets vs lighting)
      - ✅ CORRECT: "Panel repairs (add 5 breaker labels, seal 3 knockouts)" [5 issues]
      - ❌ WRONG: "Electrical work" bundling 20 issues [REJECTED - TOO MANY]

   🚰 **PLUMBING** - MAXIMUM 4 ISSUES PER LINE ITEM (NO EXCEPTIONS)
      - If you have 14 plumbing issues: CREATE MINIMUM 4 LINE ITEMS (14÷4=3.5, round up to 4)
      - Group by: bathroom, fixture type, or system
      - ✅ CORRECT: "Master bath plumbing (valve repair, drain clear, faucet fix)" [3 issues]
      - ❌ WRONG: "Plumbing package" bundling 14 issues [REJECTED - TOO MANY]

   🏗️ **FOUNDATION** - MAXIMUM 3 ISSUES PER LINE ITEM (NO EXCEPTIONS)
      - If you have 15 foundation issues: CREATE MINIMUM 5 LINE ITEMS (15÷3=5)
      - If you have 30 foundation issues: CREATE MINIMUM 10 LINE ITEMS (30÷3=10)
      - Group by: location (north wall, south wall) or type (cracks vs grading)
      - ✅ CORRECT: "North wall foundation (seal 2 cracks, improve grading)" [3 issues]
      - ❌ WRONG: "Foundation repairs" bundling 15 issues [REJECTED - TOO MANY]

   ❄️ **HVAC** - MAXIMUM 3 ISSUES PER LINE ITEM (NO EXCEPTIONS)
      - Group by: system or location
      - ✅ CORRECT: "HVAC repairs (install cover, secure wiring, seal duct)" [3 issues]
      - ❌ WRONG: "HVAC package" bundling 10 issues [REJECTED - TOO MANY]

   🚪 **WINDOWS/DOORS** - MAXIMUM 4 ISSUES PER LINE ITEM (NO EXCEPTIONS)
      - If you have 13 window/door issues: CREATE MINIMUM 4 LINE ITEMS (13÷4=3.25, round up to 4)
      - Group by: room or type (interior vs exterior)
      - ✅ CORRECT: "Interior doors (install 3 stops, replace hardware)" [4 issues]
      - ❌ WRONG: "Door repairs" bundling 13 issues [REJECTED - TOO MANY]

   🏠 **ATTIC** - MAXIMUM 5 ISSUES PER LINE ITEM (NO EXCEPTIONS)
      - Group by: system (insulation vs ventilation vs structure)
      - ✅ CORRECT: "Attic insulation (re-hang fallen, add to bare spots)" [4 issues]
      - ❌ WRONG: "Attic package" bundling 15 issues [REJECTED - TOO MANY]

   🔧 **MISCELLANEOUS** - MAXIMUM 4 ISSUES PER LINE ITEM (NO EXCEPTIONS)
      - If you have 13 misc issues: CREATE MINIMUM 4 LINE ITEMS (13÷4=3.25, round up to 4)
      - Group by: trade or location
      - ✅ CORRECT: "Appliance maintenance (clean vent, replace knobs)" [3 issues]
      - ❌ WRONG: "Misc repairs" bundling 13 issues [REJECTED - TOO MANY]

   🚨 **ENFORCEMENT RULES - READ CAREFULLY:**

   1. **COUNT YOUR ISSUES PER CATEGORY**
   2. **DIVIDE BY MAX PER ITEM**
   3. **ROUND UP TO GET MINIMUM LINE ITEMS REQUIRED**
   4. **CREATE THAT MANY LINE ITEMS OR MORE**

   **EXAMPLE CALCULATION:**
   - Category: ROOF
   - Total issues: 28
   - Max per item: 8
   - Calculation: 28 ÷ 8 = 3.5
   - Round up: 4
   - **YOU MUST CREATE AT LEAST 4 ROOF LINE ITEMS**

   **IF YOU VIOLATE THESE LIMITS, THE ESTIMATE WILL BE REJECTED**

5. PRICING REFERENCE (TYPICAL TEXAS RANGES)

   **PLUMBING:**
   - Minor: $150-500 (fixture repair, valve replacement, leak seal)
   - Moderate: $400-1,200 (pipe repair, faucet replacement, drain work)
   - Major: $800-2,500 (repipe section, water heater, main line)
   - Critical: $1,500-5,000 (extensive repairs, tank replacement)

   **ELECTRICAL:**
   - Minor: $200-600 (outlet/switch replacement, breaker)
   - Moderate: $500-1,500 (circuit addition, panel work)
   - Major: $1,200-3,500 (panel replacement, rewiring section)
   - Critical: $2,500-7,000 (full panel upgrade, major rewiring)

   **HVAC:**
   - Minor: $150-500 (filter, thermostat, minor repair)
   - Moderate: $600-1,800 (compressor repair, duct work)
   - Major: $1,500-4,500 (unit replacement - one system)
   - Critical: $3,500-10,000 (full HVAC replacement)

   **ROOF:**
   - Minor: $200-800 (seal shingles, repair flashing)
   - Moderate: $800-2,500 (patch section, valley repair)
   - Major: $2,500-8,000 (large section replacement)
   - Critical: $8,000-20,000 (full roof replacement)

   **FOUNDATION:**
   - Minor: $300-1,000 (cosmetic crack repair, seal)
   - Moderate: $1,000-3,500 (structural crack repair, drainage)
   - Major: $3,500-8,000 (pier installation, underpinning)
   - Critical: $8,000-25,000 (extensive foundation work)

   **WINDOWS/DOORS:**
   - Minor: $100-400 (adjustment, weatherstrip, seal)
   - Moderate: $400-1,200 (reglazing, hardware replacement)
   - Major: $1,200-3,500 (window replacement, door replacement)

   **ATTIC:**
   - Minor: $200-600 (ventilation, hatch repair)
   - Moderate: $600-1,800 (insulation addition, air sealing)
   - Major: $1,800-4,500 (major insulation overhaul)

   **MISCELLANEOUS:**
   - Use appropriate trade rates based on work type
   - Appliances: $200-1,500
   - Landscaping/grading: $500-3,000
   - Painting: $1,500-5,000 (whole house exterior)

6. DISCOUNT GUIDELINES (Apply ONLY when truly justified)

   Discounts should reflect REAL contractor efficiencies:
   - Same location: 5-10% (one mobilization instead of multiple trips)
   - Same trade: 5-10% (workflow efficiency, bulk material purchasing)
   - Maximum total discount: 15%

   **Document every discount:**
   - Set "discount_applied" to the percentage (e.g., 10 for 10%)
   - Set "discount_justification" to explain WHY (e.g., "Same location, single mobilization")

   **DO NOT apply discounts for:**
   - ❌ Arbitrary bundling without real efficiency gains
   - ❌ Trying to hit a price target
   - ❌ Making the estimate "look better"

7. WHAT NOT TO DO
   - ❌ DO NOT anchor to any price targets or ranges
   - ❌ DO NOT try to fit within a specific total amount
   - ❌ DO NOT arbitrarily reduce prices to hit a number
   - ❌ DO NOT apply blanket percentage reductions
   - ❌ DO NOT over-consolidate and hide critical details
   - ❌ DO NOT under-consolidate and create too many line items
   - ❌ DO NOT ignore the "suggested_category" field
   - ❌ DO NOT apply discounts without clear justification

ISSUES TO PRICE (with suggested categories):
{issues_json}

RETURN VALID JSON with this EXACT structure:
{{
  "items": [
    {{
      "category": "PLUMBING",
      "description": "Master Bathroom Plumbing Repairs",
      "qty": 1,
      "unit_price_usd": 850.00,
      "line_total_usd": 850.00,
      "notes": "Includes shower valve repair, faucet replacement, and drain clearing",
      "disclaimer": "Estimate for listed work only. Unforeseen conditions may require change order. Price valid for 30 days.",
      "bundled_issues": 3,
      "discount_applied": 10,
      "discount_justification": "Same location, same trade, single mobilization"
    }}
  ]
}}

CRITICAL RULES:
1. Return ONLY valid JSON (no text before or after)
2. Use numeric values (not placeholder text)
3. Use EXACT category names: PLUMBING, ELECTRICAL, HVAC, ROOF, FOUNDATION, WINDOWS/DOORS, ATTIC, MISCELLANEOUS
4. Price accurately based on Texas market rates - NO price targets or constraints
5. Respect the "suggested_category" field in each issue
6. Follow the category-specific consolidation ratios listed above
7. Each line item must clearly describe the work included
8. Apply discounts ONLY when justified with clear reasoning
9. Price each issue independently - let the total be whatever it needs to be
'''


def map_extraction_category_to_pricing(section: str, component: str = "", title: str = "") -> str:
    """
    Map extraction section/component names to pricing category names.
    
    Extraction uses TREC sections and component names
    Pricing uses trade categories (e.g., "FOUNDATION", "ROOF")
    
    Checks section, then component, then title for better categorization.
    """
    
    section_lower = section.lower().strip()
    component_lower = component.lower().strip()
    title_lower = title.lower().strip()
    
    # Mapping rules - check section first
    if 'foundation' in section_lower or 'foundation' in component_lower:
        return 'FOUNDATION'
    
    elif 'roof' in section_lower or 'roof' in component_lower or 'gutter' in section_lower or 'flashing' in section_lower:
        return 'ROOF'
    
    elif 'attic' in section_lower or 'attic' in component_lower or 'insulation' in section_lower:
        return 'ATTIC'
    
    elif 'plumbing' in section_lower or 'plumbing' in component_lower or 'water' in section_lower or 'drain' in section_lower:
        return 'PLUMBING'
    
    elif 'electrical' in section_lower or 'electrical' in component_lower or 'outlet' in section_lower or 'circuit' in section_lower or 'panel' in section_lower:
        return 'ELECTRICAL'
    
    elif 'hvac' in section_lower or 'hvac' in component_lower or 'heating' in section_lower or 'cooling' in section_lower or 'air condition' in section_lower or 'furnace' in section_lower:
        return 'HVAC'
    
    elif 'window' in section_lower or 'window' in component_lower or 'door' in section_lower or 'door' in component_lower:
        return 'WINDOWS/DOORS'
    
    elif 'appliance' in section_lower or 'appliance' in component_lower or 'dishwasher' in section_lower or 'disposal' in section_lower or 'range' in section_lower:
        return 'MISCELLANEOUS'
    
    # Check component for more specific categorization
    elif 'grading' in component_lower or 'soil' in component_lower:
        return 'FOUNDATION'  # Grading/soil issues are foundation work
    
    elif 'wood rot' in component_lower or 'wood trim' in component_lower or 'siding' in component_lower or 'decks' in component_lower or 'porches' in component_lower:
        return 'MISCELLANEOUS'  # Exterior wood work - miscellaneous repairs
    
    # Structural Systems is tricky - need to look at description
    elif 'structural' in section_lower:
        # This could be foundation, roof, or walls
        return 'FOUNDATION'  # Default for structural
    
    else:
        return 'MISCELLANEOUS'


def create_fallback_pricing(issue: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create fallback pricing when Gemini fails to price an issue.
    Uses severity-based pricing from CATEGORY_SEVERITY_PRICE_MATRIX.
    """
    category = issue.get("suggested_category", "MISCELLANEOUS")
    severity = issue.get("severity", "moderate").lower()

    # Get category-specific pricing
    severity_prices = CATEGORY_SEVERITY_PRICE_MATRIX.get(category, CATEGORY_SEVERITY_PRICE_MATRIX["MISCELLANEOUS"])
    base_price = severity_prices.get(severity, severity_prices.get("moderate", 200))

    # Add some randomness to avoid all fallbacks having same price
    price = base_price * random.uniform(0.9, 1.1)
    price = round(price / 25) * 25  # Round to nearest $25

    return {
        "category": category,
        "description": issue.get("description", "Repair work"),
        "qty": 1,
        "unit_price_usd": price,
        "line_total_usd": price,
        "notes": f"Fallback pricing based on {severity} severity",
        "priority": issue.get("priority", "MEDIUM"),
        "bundled_issues": 1,
        "discount_applied": 0,
        "discount_justification": "No discount"
    }


def code_based_consolidation(
    priced_items: List[Dict[str, Any]],
    normalized_issues: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    TWO-PHASE APPROACH - Phase 2: Code-based consolidation with hard limits.

    Takes individually priced items and consolidates them using deterministic
    logic that respects category-specific max limits.

    This is what code is good at: counting, arithmetic, enforcing hard limits.
    """
    LOGGER.info(f"🔧 PHASE 2: Consolidating {len(priced_items)} priced items...")

    # Group items by category
    by_category = {}
    for item in priced_items:
        cat = item.get("category", "MISCELLANEOUS")
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(item)

    consolidated_items = []

    for category, cat_items in by_category.items():
        # Get category-specific rules
        rules = CATEGORY_CONSOLIDATION_RULES.get(category, CATEGORY_CONSOLIDATION_RULES["MISCELLANEOUS"])
        max_issues_per_item = rules["max_per_item"]
        target_ratio = rules["target_ratio"]

        LOGGER.info(f"  {category}: {len(cat_items)} items (max {max_issues_per_item} per bundle)")

        if len(cat_items) == 1:
            # Single item - keep as-is
            consolidated_items.append(cat_items[0])
            LOGGER.info(f"    ✅ 1 item kept as-is")
        else:
            # Multiple items - consolidate with hard limits
            # Strategy: Greedily bundle items until we hit max_issues_per_item
            current_bundle = []
            current_count = 0
            bundle_num = 1

            for item in cat_items:
                # Each item represents 1 issue (from individual pricing)
                item_count = item.get("bundled_issues", 1)

                # Check if adding this item would exceed max
                if current_count + item_count > max_issues_per_item and current_bundle:
                    # Create consolidated line item from current bundle
                    consolidated_item = create_consolidated_line_item(
                        current_bundle, category, bundle_num
                    )
                    consolidated_items.append(consolidated_item)

                    # Start new bundle
                    current_bundle = [item]
                    current_count = item_count
                    bundle_num += 1
                else:
                    # Add to current bundle
                    current_bundle.append(item)
                    current_count += item_count

            # Don't forget the last bundle
            if current_bundle:
                consolidated_item = create_consolidated_line_item(
                    current_bundle, category, bundle_num
                )
                consolidated_items.append(consolidated_item)

            LOGGER.info(f"    ✅ {len(cat_items)} items → {bundle_num} bundles (max {max_issues_per_item} issues/bundle)")

    LOGGER.info(f"✅ PHASE 2 COMPLETE: {len(priced_items)} items → {len(consolidated_items)} consolidated items")

    return consolidated_items


def _create_meaningful_description(items: List[Dict[str, Any]], category: str) -> str:
    """
    Create a meaningful description based on the actual issues in the items.

    Instead of "Foundation repairs - Package 2", generate something like:
    "Siding, Caulking, and Sealing Repairs" or "Plumbing Fixture Repairs"
    """
    if len(items) == 1:
        # Single item - use its description or title
        item = items[0]
        if "original_issue" in item:
            title = item["original_issue"].get("title", "")
            if title:
                return title
        return item.get("description", f"{category.title()} Repairs")

    # Multiple items - extract key themes from issue titles
    themes = []
    seen_keywords = set()

    for item in items:
        if "original_issue" in item:
            title = item["original_issue"].get("title", "")
        else:
            title = item.get("description", "")

        if not title:
            continue

        # Extract key words from title (before colon if present)
        if ":" in title:
            key_part = title.split(":")[0].strip()
        else:
            # Take first few words
            words = title.split()[:3]
            key_part = " ".join(words)

        # Normalize and check if we've seen this theme
        key_normalized = key_part.lower()
        if key_normalized not in seen_keywords and len(key_part) > 3:
            themes.append(key_part)
            seen_keywords.add(key_normalized)

        # Limit to 3 themes for readability
        if len(themes) >= 3:
            break

    if themes:
        if len(themes) == 1:
            return f"{themes[0]} Repairs"
        elif len(themes) == 2:
            return f"{themes[0]} and {themes[1]} Repairs"
        else:
            # Join first themes with commas, last with "and"
            return f"{', '.join(themes[:-1])}, and {themes[-1]} Repairs"

    # Fallback to category-based description
    return f"{category.title()} Repairs"


def _create_detailed_notes_from_items(items: List[Dict[str, Any]]) -> str:
    """
    Create detailed notes from a list of items being consolidated.

    Extracts descriptions and notes from original items to provide transparency
    about what repairs are included in the consolidated package.

    Prioritizes original_issue data for the most accurate descriptions.
    """
    if len(items) == 1:
        # Single item - try to get the best description
        item = items[0]

        # First, check if there's an original_issue with a title and description
        if "original_issue" in item:
            original = item["original_issue"]
            title = original.get("title", "")
            desc = original.get("description", "")

            # Use title if available, otherwise use description
            if title and title != desc:
                return title
            elif desc:
                return desc

        # Fallback to item's own description or notes
        return item.get("description", item.get("notes", ""))

    # Multiple items - create a detailed numbered list
    details = []
    for i, item in enumerate(items, 1):
        detail_text = ""

        # Priority 1: Get from original_issue (most detailed and accurate)
        if "original_issue" in item:
            original = item["original_issue"]
            title = original.get("title", "")
            desc = original.get("description", "")
            location = original.get("location", "")

            # Use title as the primary detail
            if title:
                detail_text = title
                # Add location if available and not already in title
                if location and location.lower() not in title.lower():
                    detail_text = f"{title} ({location})"
            elif desc:
                # If no title, use description but keep it concise
                detail_text = desc

        # Priority 2: Use item's description if no original_issue
        if not detail_text:
            detail_text = item.get("description", "")

        # Priority 3: Use item's notes as last resort
        if not detail_text or detail_text == "Fallback pricing based on deficient severity":
            detail_text = item.get("notes", "")

        # Clean up and format
        detail_text = detail_text.strip()

        # Remove recommendation text to keep it concise
        if "Recommendation:" in detail_text:
            detail_text = detail_text.split("Recommendation:")[0].strip()

        # Truncate if too long (but allow more space for readability)
        if len(detail_text) > 200:
            detail_text = detail_text[:197] + "..."

        if detail_text and detail_text != "Fallback pricing based on deficient severity":
            details.append(f"{i}. {detail_text}")

    if not details:
        return f"Includes {len(items)} related repairs"

    # Join with line breaks for better PDF readability
    return "\n".join(details)


def create_consolidated_line_item(
    items: List[Dict[str, Any]],
    category: str,
    bundle_num: int
) -> Dict[str, Any]:
    """
    Create a consolidated line item from multiple priced items.

    Applies bundling discount and creates a clear description.
    """
    # Sum up prices
    total_price = sum(item.get("unit_price_usd", 0) for item in items)

    # Apply bundling discount (5-10% for same category, same location efficiency)
    discount_pct = 0
    if len(items) >= 3:
        discount_pct = 10  # 10% for 3+ items
    elif len(items) == 2:
        discount_pct = 5   # 5% for 2 items

    discounted_price = total_price * (1 - discount_pct / 100)
    discounted_price = round(discounted_price / 25) * 25  # Round to nearest $25

    # Create meaningful description based on actual issues
    description = _create_meaningful_description(items, category)

    # Get highest priority
    priorities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    item_priorities = [item.get("priority", "MEDIUM") for item in items]
    priority = min(item_priorities, key=lambda p: priorities.index(p) if p in priorities else 2)

    # Create detailed notes from original items
    detailed_notes = _create_detailed_notes_from_items(items)

    # Create consolidated item
    consolidated = {
        "category": category,
        "description": description,
        "qty": 1,
        "unit_price_usd": discounted_price,
        "line_total_usd": discounted_price,
        "notes": detailed_notes,
        "disclaimer": DISCLAIMER_TEMPLATES.get(category, ""),
        "priority": priority,
        "bundled_issues": len(items),
        "discount_applied": discount_pct,
        "discount_justification": f"Same category, {len(items)} items bundled for efficiency" if discount_pct > 0 else "No discount",
        "original_items": items  # Keep reference to original items for transparency
    }

    return consolidated


def enforce_consolidation_limits(items: List[Dict[str, Any]], all_issues: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    POST-PROCESSING: Enforce hard consolidation limits by splitting over-consolidated items.

    This is the ENFORCEMENT layer - Gemini's output is validated and auto-corrected.
    """
    fixed_items = []

    for item in items:
        category = item.get("category", "MISCELLANEOUS")
        bundled_issues = item.get("bundled_issues", [])

        # Handle case where bundled_issues might be an integer (count) instead of list
        if isinstance(bundled_issues, int):
            issue_count = bundled_issues
            bundled_issues = []  # Can't split if we don't have the actual issues
        elif isinstance(bundled_issues, list):
            issue_count = len(bundled_issues)
        else:
            LOGGER.warning(f"Unexpected bundled_issues type: {type(bundled_issues)}, skipping enforcement")
            fixed_items.append(item)
            continue

        # Get rules for this category
        rules = CATEGORY_CONSOLIDATION_RULES.get(category, CATEGORY_CONSOLIDATION_RULES["MISCELLANEOUS"])
        max_per_item = rules["max_per_item"]

        # Check if this item violates the max limit
        if issue_count > max_per_item and bundled_issues:  # Only split if we have the actual issues list
            LOGGER.warning(f"🔧 AUTO-FIX: {category} item has {issue_count} issues (max {max_per_item}). Splitting...")

            # Split into multiple items
            num_splits = math.ceil(issue_count / max_per_item)
            issues_per_split = math.ceil(issue_count / num_splits)

            for i in range(num_splits):
                start_idx = i * issues_per_split
                end_idx = min((i + 1) * issues_per_split, issue_count)
                split_issues = bundled_issues[start_idx:end_idx]

                if not split_issues:
                    continue

                # Create new item with split issues
                split_item = {
                    "category": category,
                    "description": f"{item.get('description', category + ' repairs')} - Part {i+1} of {num_splits}",
                    "bundled_issues": split_issues,
                    "base_price": item.get("base_price", 0) / num_splits,  # Distribute price evenly
                    "discount_applied": item.get("discount_applied", 0),
                    "discount_justification": item.get("discount_justification", ""),
                    "final_price": item.get("final_price", 0) / num_splits,
                    "line_total_usd": item.get("line_total_usd", 0) / num_splits,
                    "priority": item.get("priority", "MEDIUM"),
                    "notes": f"Auto-split from over-consolidated item ({issue_count} issues > {max_per_item} max)",
                }

                fixed_items.append(split_item)

            LOGGER.info(f"✅ Split {category} item into {num_splits} items ({issues_per_split} issues each)")
        else:
            # Item is within limits, keep as-is (or can't split because no issues list)
            if issue_count > max_per_item:
                LOGGER.warning(f"⚠️ {category} item has {issue_count} issues (max {max_per_item}) but can't auto-split (no issues list)")
            fixed_items.append(item)

    return fixed_items


def call_gemini_for_individual_pricing(
    client: genai.Client,
    model_name: str,
    normalized_issues: List[Dict[str, Any]],
    pricebook: Dict[str, Any],
) -> Tuple[List[Dict[str, Any]], Optional[int]]:
    """
    TWO-PHASE APPROACH - Phase 1: Price each issue individually.

    This function prices each issue separately using Gemini, then returns
    the priced issues for code-based consolidation in Phase 2.
    """
    if not config:
        raise RuntimeError("config module is required for deterministic pricing")

    from config import GEMINI_GENERATION_CONFIG

    # Create cache key from issues content AND prompt version
    prompt_version = "v7.0-individual-pricing"
    cache_key = hashlib.sha256(
        (json.dumps(normalized_issues, sort_keys=True) + prompt_version).encode()
    ).hexdigest()[:16]

    # Check cache first
    cache_dir = Path(".estimate_cache")
    cache_path = cache_dir / f"{cache_key}.json"

    if cache_path.exists():
        LOGGER.info(f"Using cached individual pricing for {cache_key}")
        with open(cache_path, 'r') as f:
            cached = json.load(f)
            return cached["items"], cached.get("tokens")

    LOGGER.info(f"🔧 PHASE 1: Pricing {len(normalized_issues)} issues individually...")

    priced_items = []
    total_tokens = 0

    # Price each issue individually
    for idx, issue in enumerate(normalized_issues, 1):
        LOGGER.info(f"  Pricing issue {idx}/{len(normalized_issues)}: {issue.get('description', 'N/A')[:60]}...")

        # Build individual pricing prompt
        prompt = create_individual_pricing_prompt(issue, pricebook)

        contents = [{"role": "user", "parts": [{"text": prompt}]}]

        try:
            # Build config dict with response_mime_type and generation settings
            config_dict = {
                "response_mime_type": "application/json",
                **GEMINI_GENERATION_CONFIG
            }

            response = client.models.generate_content(
                model=normalize_model_name(model_name),
                contents=contents,
                config=config_dict,
            )

            # Extract text from response
            result_text = extract_text(response)

            # Try to extract JSON from markdown code blocks if present
            json_match = re.search(r'```(?:json)?\s*(\{.*\})\s*```', result_text, re.DOTALL)
            if json_match:
                result_text = json_match.group(1)
            else:
                # Try to find JSON object in the text
                json_match = re.search(r'(\{.*\})', result_text, re.DOTALL)
                if json_match:
                    result_text = json_match.group(0)

            # Parse JSON
            try:
                item = json.loads(result_text)
            except json.JSONDecodeError as json_err:
                LOGGER.error(f"Failed to parse JSON for issue {idx}: {json_err}")
                LOGGER.error(f"Response text (first 500 chars): {result_text[:500]}")
                # Fallback: use severity-based pricing
                item = create_fallback_pricing(issue)

            # Ensure required fields
            item['bundled_issues'] = 1  # Individual pricing - always 1
            item['original_issue_id'] = idx - 1  # Track which issue this came from
            item['original_issue'] = issue  # Keep reference to original issue

            priced_items.append(item)

        except Exception as e:
            LOGGER.error(f"Error pricing issue {idx}: {e}")
            # Fallback: use severity-based pricing
            item = create_fallback_pricing(issue)
            item['original_issue_id'] = idx - 1
            item['original_issue'] = issue
            priced_items.append(item)

    LOGGER.info(f"✅ PHASE 1 COMPLETE: Priced {len(priced_items)} issues individually")

    # Save to cache
    cache_dir.mkdir(parents=True, exist_ok=True)
    with open(cache_path, 'w') as f:
        json.dump({"items": priced_items, "tokens": total_tokens}, f, indent=2)

    return priced_items, total_tokens


def call_gemini_for_pricing(
    client: genai.Client,
    model_name: str,
    normalized_issues: List[Dict[str, Any]],
    pricebook: Dict[str, Any],
) -> Tuple[List[Dict[str, Any]], Optional[int]]:
    """
    DEPRECATED: Old batch pricing approach.
    Use call_gemini_for_individual_pricing + code_based_consolidation instead.
    """
    if not config:
        raise RuntimeError("config module is required for deterministic pricing")

    from config import GEMINI_GENERATION_CONFIG

    # Create cache key from issues content AND prompt version
    # Include prompt version to invalidate cache when we change consolidation rules
    prompt_version = "v6.0-aggressive-mandatory-limits"
    cache_key = hashlib.sha256(
        (json.dumps(normalized_issues, sort_keys=True) + prompt_version).encode()
    ).hexdigest()[:16]

    # Check cache first
    cache_dir = Path(".estimate_cache")
    cache_path = cache_dir / f"{cache_key}.json"

    if cache_path.exists():
        LOGGER.info(f"Using cached estimate for {cache_key}")
        with open(cache_path, 'r') as f:
            cached = json.load(f)
            return cached["items"], cached.get("tokens")

    # Build the enhanced prompt
    prompt = create_enhanced_pricing_prompt(normalized_issues, pricebook)
    
    contents = [{"role": "user", "parts": [{"text": prompt}]}]
    
    try:
        # Build config dict with response_mime_type and generation settings
        config_dict = {
            "response_mime_type": "application/json",
            **GEMINI_GENERATION_CONFIG  # Merge generation config
        }
        
        response = client.models.generate_content(
            model=normalize_model_name(model_name),
            contents=contents,
            config=config_dict,
        )
        
        # Extract text from response
        result_text = extract_text(response)
        
        # Try to extract JSON from markdown code blocks if present
        json_match = re.search(r'```(?:json)?\s*(\{.*\})\s*```', result_text, re.DOTALL)
        if json_match:
            result_text = json_match.group(1)
        else:
            # Try to find JSON object/array in the text
            json_match = re.search(r'(\{.*\}|\[.*\])', result_text, re.DOTALL)
            if json_match:
                result_text = json_match.group(0)
        
        # Clean up common Gemini JSON errors (e.g., }e{ → },{ or }{ → },{)
        result_text = re.sub(r'\}\s*([a-z])\s*\{', r'},{', result_text, flags=re.IGNORECASE)
        result_text = re.sub(r'\}\s*\{', r'},{', result_text)
        
        # Parse JSON
        try:
            result = json.loads(result_text)
        except json.JSONDecodeError as json_err:
            # Save the raw response for debugging
            debug_file = cache_dir / f"{cache_key}_debug_response.txt"
            cache_dir.mkdir(parents=True, exist_ok=True)
            with open(debug_file, 'w', encoding='utf-8') as f:
                f.write(f"Raw response text:\n{result_text}\n\nJSON Error: {json_err}")
            LOGGER.error(f"Failed to parse JSON response. Debug info saved to {debug_file}")
            LOGGER.error(f"Response text (first 500 chars): {result_text[:500]}")
            raise ValueError(f"Invalid JSON response: {json_err}")
        
        # Check for 'items' key (handle both wrapped and unwrapped responses)
        if isinstance(result, list):
            # Model returned array directly instead of wrapped object
            LOGGER.info("LLM returned array directly, wrapping in 'items' key")
            items = result
        elif isinstance(result, dict) and "items" in result:
            items = result["items"]
        else:
            # Save the response for debugging
            debug_file = cache_dir / f"{cache_key}_debug_response.json"
            cache_dir.mkdir(parents=True, exist_ok=True)
            with open(debug_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2)
            LOGGER.error(f"Response missing 'items' key. Response saved to {debug_file}")
            if isinstance(result, dict):
                LOGGER.error(f"Response keys: {list(result.keys())}")
            LOGGER.error(f"Response structure: {json.dumps(result, indent=2)[:1000]}")
            raise ValueError(f"LLM response missing 'items' key. Response has keys: {list(result.keys()) if isinstance(result, dict) else 'array'}")

        # Ensure new fields exist for transparency and backward compatibility
        for item in items:
            # Track how many issues were consolidated into this item
            if 'bundled_issues' not in item:
                item['bundled_issues'] = item.get('bundled_issues', 1)

            # Percentage discount applied for justified bundling
            if 'discount_applied' not in item:
                item['discount_applied'] = item.get('discount_applied', 0)

            # Reason for any discount
            if 'discount_justification' not in item:
                item['discount_justification'] = item.get('discount_justification', 'No discount')

            # Log discount information for transparency
            try:
                if float(item.get('discount_applied', 0)) > 0:
                    LOGGER.info(
                        f"Discount applied: {item['discount_applied']}% on "
                        f"{item.get('description', 'item')[:50]} - "
                        f"Reason: {item.get('discount_justification', 'N/A')}"
                    )
            except Exception:
                # Defensive: ignore logging errors for malformed discount fields
                pass

        # Validate items is a list
        if not isinstance(items, list):
            LOGGER.error(f"Expected 'items' to be a list, got {type(items)}")
            raise ValueError(f"Expected 'items' to be a list, got {type(items)}")

        # 🔧 ENFORCE CONSOLIDATION LIMITS - Auto-fix over-consolidated items
        LOGGER.info(f"📊 Pre-enforcement: {len(items)} items")
        items = enforce_consolidation_limits(items, normalized_issues)
        LOGGER.info(f"📊 Post-enforcement: {len(items)} items")

        # Save to cache
        cache_dir.mkdir(parents=True, exist_ok=True)
        with open(cache_path, 'w') as f:
            json.dump({"items": items, "tokens": None}, f, indent=2)

        return items, None
        
    except Exception as e:
        LOGGER.error(f"Error calling Gemini: {e}")
        # Log more details for debugging
        import traceback
        LOGGER.debug(traceback.format_exc())
        raise


def aggressive_consolidation(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Aggressively consolidate - TARGET: 15-18 final line items.
    """
    LOGGER.info(f"Starting consolidation with {len(items)} items")
    
    # Define bundling patterns
    patterns = [
        # Plumbing
        {"category": "PLUMBING", "keywords": ["bathroom", "bath"], "name": "{location} plumbing repairs", "discount": 0.18},
        {"category": "PLUMBING", "keywords": ["water heater", "TPR"], "name": "Water heater code compliance", "discount": 0.20},
        {"category": "PLUMBING", "keywords": ["gas line", "drip leg"], "name": "Gas line code compliance", "discount": 0.15},
        
        # Electrical
        {"category": "ELECTRICAL", "keywords": ["panel", "breaker"], "name": "Electrical panel repairs", "discount": 0.18},
        {"category": "ELECTRICAL", "keywords": ["outlet", "switch"], "name": "Branch circuit repairs", "discount": 0.20},
        {"category": "ELECTRICAL", "keywords": ["GFCI", "detector"], "name": "Safety device installation package", "discount": 0.20},
        
        # HVAC
        {"category": "HVAC", "keywords": ["duct", "vent"], "name": "HVAC ductwork repairs", "discount": 0.15},
        {"category": "HVAC", "keywords": ["coil", "refrigerant"], "name": "HVAC system service", "discount": 0.15},
        
        # Roof/Foundation
        {"category": "ROOF", "keywords": ["shingle", "flashing"], "name": "Roof repair package", "discount": 0.15},
        {"category": "FOUNDATION", "keywords": ["crack", "settlement"], "name": "Foundation crack repair package", "discount": 0.15},
        
        # Windows/Doors
        {"category": "WINDOWS/DOORS", "keywords": ["door", "knob"], "name": "Door adjustments", "discount": 0.20},
        {"category": "WINDOWS/DOORS", "keywords": ["window", "screen"], "name": "Window repairs", "discount": 0.20},
    ]
    
    consolidated = []
    processed = set()
    
    # Apply each pattern
    for pattern in patterns:
        matching = []
        for i, item in enumerate(items):
            if i in processed:
                continue
            if item.get("category") != pattern["category"]:
                continue
            desc = f"{item.get('description', '')} {item.get('notes', '')}".lower()
            if any(kw in desc for kw in pattern["keywords"]):
                matching.append((i, item))
        
        # Bundle if multiple matches
        if len(matching) > 1:
            total = sum(item.get("unit_price_usd", 0) for _, item in matching)
            total *= (1 - pattern["discount"])

            # Sum up bundled_issues from all matched items
            total_bundled_issues = sum(item.get("bundled_issues", 1) for _, item in matching)

            consolidated.append({
                "category": pattern["category"],
                "description": f"{pattern['name']} ({len(matching)} items)",
                "qty": 1,
                "unit_price_usd": round(total / 25) * 25,
                "line_total_usd": round(total / 25) * 25,
                "notes": f"Bundled {len(matching)} related repairs",
                "disclaimer": DISCLAIMER_TEMPLATES.get(pattern["category"], ""),
                "bundled_issues": total_bundled_issues
            })

            for idx, _ in matching:
                processed.add(idx)
    
    # Add unprocessed items
    for i, item in enumerate(items):
        if i not in processed:
            consolidated.append(item)
    
    LOGGER.info(f"Consolidated: {len(items)} → {len(consolidated)} items")
    
    # Force more consolidation if still >18 items
    if len(consolidated) > 18:
        consolidated = force_category_consolidation(consolidated, 18)
    
    return consolidated


def force_category_consolidation(items: List[Dict[str, Any]], target: int = 18) -> List[Dict[str, Any]]:
    """
    🔧 FIXED: Bundle by category while RESPECTING category-specific max ISSUES per line item.

    This function enforces CATEGORY_CONSOLIDATION_RULES by ensuring no line item
    bundles more than max_per_item ISSUES (not line items).
    """
    by_cat = {}
    for item in items:
        cat = item.get("category", "MISCELLANEOUS")
        if cat not in by_cat:
            by_cat[cat] = []
        by_cat[cat].append(item)

    result = []
    for cat, cat_items in by_cat.items():
        # Get category-specific rules
        rules = CATEGORY_CONSOLIDATION_RULES.get(cat, CATEGORY_CONSOLIDATION_RULES["MISCELLANEOUS"])
        max_issues_per_item = rules["max_per_item"]  # Max ISSUES per final line item

        if len(cat_items) == 1:
            # Single item - keep as-is
            result.append(cat_items[0])
            LOGGER.info(f"✅ {cat}: 1 item kept as-is ({cat_items[0].get('bundled_issues', 1)} issues)")
        else:
            # Multiple items - bundle while respecting max_issues_per_item
            # Strategy: Greedily bundle items until we hit max_issues_per_item
            current_package = []
            current_issues_count = 0
            package_num = 1

            for item in cat_items:
                item_issues = item.get("bundled_issues", 1)

                # Check if adding this item would exceed max
                if current_issues_count + item_issues > max_issues_per_item and current_package:
                    # Create package from current items
                    total = sum(i.get("unit_price_usd", 0) for i in current_package) * 0.88
                    total_issues = sum(i.get("bundled_issues", 1) for i in current_package)

                    # Create meaningful description and detailed notes
                    meaningful_desc = _create_meaningful_description(current_package, cat)
                    detailed_notes = _create_detailed_notes_from_items(current_package)

                    result.append({
                        "category": cat,
                        "description": meaningful_desc,
                        "qty": 1,
                        "unit_price_usd": round(total / 25) * 25,
                        "line_total_usd": round(total / 25) * 25,
                        "notes": detailed_notes,
                        "disclaimer": DISCLAIMER_TEMPLATES.get(cat, ""),
                        "bundled_issues": total_issues,
                        "original_items": current_package  # Keep reference for transparency
                    })

                    LOGGER.info(f"  {meaningful_desc}: {len(current_package)} items, {total_issues} issues (max {max_issues_per_item})")

                    # Start new package
                    current_package = [item]
                    current_issues_count = item_issues
                    package_num += 1
                else:
                    # Add to current package
                    current_package.append(item)
                    current_issues_count += item_issues

            # Don't forget the last package
            if current_package:
                total = sum(i.get("unit_price_usd", 0) for i in current_package) * 0.88
                total_issues = sum(i.get("bundled_issues", 1) for i in current_package)

                # Create meaningful description and detailed notes
                meaningful_desc = _create_meaningful_description(current_package, cat)
                detailed_notes = _create_detailed_notes_from_items(current_package)

                result.append({
                    "category": cat,
                    "description": meaningful_desc,
                    "qty": 1,
                    "unit_price_usd": round(total / 25) * 25,
                    "line_total_usd": round(total / 25) * 25,
                    "notes": detailed_notes,
                    "disclaimer": DISCLAIMER_TEMPLATES.get(cat, ""),
                    "bundled_issues": total_issues,
                    "original_items": current_package  # Keep reference for transparency
                })

                LOGGER.info(f"  {meaningful_desc}: {len(current_package)} items, {total_issues} issues (max {max_issues_per_item})")

            LOGGER.info(f"✅ {cat}: {len(cat_items)} items → {package_num} packages (respecting max {max_issues_per_item} issues/package)")

    LOGGER.info(f"📊 Force consolidation: {len(items)} → {len(result)} items (respecting category max issue limits)")

    return result


def stabilize_prices(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Ensure prices stay within defined ranges and are consistent."""
    
    PRICE_RANGES = {
        "minor": (75, 300),
        "moderate": (300, 1000),
        "major": (1000, 2500),
        "replacement": (2500, 5000)
    }
    
    for item in items:
        current_price = item.get("unit_price_usd", 0)
        
        # Determine price tier
        if current_price <= 300:
            tier = "minor"
        elif current_price <= 1000:
            tier = "moderate"
        elif current_price <= 2500:
            tier = "major"
        else:
            tier = "replacement"
        
        min_price, max_price = PRICE_RANGES[tier]
        
        # Clamp price to range
        if current_price < min_price:
            item["unit_price_usd"] = min_price
        elif current_price > max_price:
            item["unit_price_usd"] = max_price
        
        # Round to nearest $25
        item["unit_price_usd"] = round(item["unit_price_usd"] / 25) * 25
        item["line_total_usd"] = item["unit_price_usd"] * item.get("qty", 1)
    
    return items


def apply_regional_adjustment(items: List[Dict], region: str = "Default") -> List[Dict]:
    """Apply regional cost multiplier for different Texas regions."""
    multiplier = TEXAS_REGIONAL_MULTIPLIERS.get(region, 1.00)
    
    if multiplier != 1.00:
        for item in items:
            item["unit_price_usd"] *= multiplier
            item["line_total_usd"] *= multiplier
            # Round to nearest $25
            item["unit_price_usd"] = round(item["unit_price_usd"] / 25) * 25
            item["line_total_usd"] = round(item["line_total_usd"] / 25) * 25
    
    return items


def validate_consolidation_ratio(issues_count: int, items_count: int) -> Dict[str, Any]:
    """
    PHASE 1: Validate that consolidation ratio stays within acceptable range.
    
    Target: 3:1 to 5:1 ratio (issues to line items).
    Flags: Ratios outside this range (over-consolidation or under-consolidation).
    
    Args:
        issues_count: Number of issues in inspection
        items_count: Number of items in estimate
    
    Returns:
        Dict with consolidation metrics and validation status
    """
    if items_count == 0:
        ratio = float('inf')
    else:
        ratio = issues_count / items_count
    
    min_ratio = 3.0
    max_ratio = 5.0
    
    is_valid = min_ratio <= ratio <= max_ratio
    
    consolidation_data = {
        "issues_count": issues_count,
        "items_count": items_count,
        "consolidation_ratio": round(ratio, 2),
        "is_valid": is_valid,
        "status": "✅ ACCEPTABLE" if is_valid else "⚠️ OUT OF RANGE",
        "acceptable_range": f"{min_ratio}:1 - {max_ratio}:1",
    }
    
    if not is_valid:
        if ratio < min_ratio:
            LOGGER.warning(f"⚠️ UNDER-CONSOLIDATION: {ratio:.1f}:1 (too granular, nickel-and-diming)")
        else:
            LOGGER.warning(f"⚠️ OVER-CONSOLIDATION: {ratio:.1f}:1 (hiding scope from customers)")
    
    return consolidation_data


def fix_priority_classification(issues: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    PHASE 1: Fix over-flagged priority classification.
    
    Current: 58.6% marked HIGH (should be ~35%).
    Fix: Restrict HIGH to safety/structural issues only.
    
    Safety/Structural keywords (HIGH):
    - Electrical hazards: exposed wiring, live wires, electrical fires, shock hazard
    - Water/Moisture: active leaks, water damage, mold, moisture intrusion
    - Structural: foundation cracks, wall damage, settling, compromised structure
    - Gas hazards: gas leaks, carbon monoxide, unsafe appliances
    
    Maintenance keywords (LOW/MODERATE):
    - Worn items: worn knobs, worn handles, worn hinges
    - Cosmetic: paint, staining, discoloration, worn finish
    - Filter/fluid: dirty filters, low refrigerant, low batteries
    - Minor: adjustment, tightening, caulking, weatherstripping
    
    Args:
        issues: List of issues from inspection
    
    Returns:
        List of issues with corrected priority classification
    """
    # Safety/structural keywords that justify HIGH priority
    safety_keywords = {
        # Electrical hazards
        "exposed wiring", "live wire", "electrical fire", "shock hazard",
        "short circuit", "electrical hazard", "damaged wire", "bare wire",
        "overloaded", "arcing", "sparking",
        
        # Water/Moisture hazards
        "active leak", "water damage", "mold", "moisture intrusion",
        "wet", "water intrusion", "flooding", "water pooling",
        "ice dam", "moisture problem",
        
        # Structural issues
        "foundation crack", "wall damage", "floor settling", "compromised",
        "structural damage", "foundation problem", "crack", "subsidence",
        "bowing", "leaning", "separation",
        
        # Gas/HVAC hazards
        "gas leak", "carbon monoxide", "unsafe appliance", "gas odor",
        "ventilation problem", "blocked vent", "dangerous"
    }
    
    # Maintenance keywords that should be LOW
    maintenance_keywords = {
        "worn knob", "worn handle", "worn hinge", "worn finish",
        "dirty filter", "low refrigerant", "low battery",
        "paint", "staining", "discoloration", "worn",
        "adjustment", "tightening", "caulking", "weatherstrip",
        "minor", "routine", "maintenance", "preventive",
        "replace filter", "inspection only"
    }
    
    for issue in issues:
        description = (issue.get("description", "") + " " + issue.get("notes", "")).lower()
        title = issue.get("title", "").lower()
        full_text = f"{title} {description}"
        
        # Check if it's a safety/structural issue
        is_safety = any(keyword in full_text for keyword in safety_keywords)
        
        # Check if it's maintenance
        is_maintenance = any(keyword in full_text for keyword in maintenance_keywords)
        
        # Apply corrected priority
        original_priority = issue.get("priority", "MODERATE")
        
        if is_safety:
            # Confirm HIGH for genuine safety issues
            issue["priority"] = "HIGH"
            issue["priority_reason"] = "Safety/structural hazard detected"
        elif is_maintenance:
            # Demote maintenance items
            issue["priority"] = "LOW"
            issue["priority_reason"] = "Routine maintenance, not urgent"
        else:
            # Default to MODERATE for everything else
            issue["priority"] = "MODERATE"
            issue["priority_reason"] = "Standard repair needed"
        
        # Log if priority changed
        if original_priority != issue["priority"]:
            LOGGER.debug(
                f"Priority adjusted: '{issue.get('title', '')[:50]}' "
                f"{original_priority} → {issue['priority']}"
            )
    
    return issues


def normalize_model_name(model_name: str) -> str:
    """Ensure model name has correct format."""
    return model_name if "/" in model_name else f"models/{model_name}"


def extract_text(response: Any) -> str:
    """Extract text from Gemini response."""
    # Try output_text first (common for JSON responses)
    text = getattr(response, "output_text", None)
    if text:
        return text
    
    # Try text attribute
    text = getattr(response, "text", None)
    if text:
        return text
    
    # Try candidates (for non-JSON responses)
    candidates = getattr(response, "candidates", None) or []
    for candidate in candidates:
        candidate_content = getattr(candidate, "content", None)
        parts = getattr(candidate_content, "parts", None) if candidate_content else None
        if not parts:
            continue
        for part in parts:
            # Check for text in part
            part_text = getattr(part, "text", None)
            if part_text:
                return part_text
            
            # Check if part is a dict with text (some response formats)
            if isinstance(part, dict):
                part_text = part.get("text") or part.get("content")
                if part_text:
                    return part_text
    
    # If we have candidates but no text, try to extract from response structure
    if candidates:
        # Log candidate structure for debugging
        LOGGER.debug(f"Response has {len(candidates)} candidates but no text found")
        for i, candidate in enumerate(candidates):
            LOGGER.debug(f"Candidate {i}: {type(candidate)}, attributes: {dir(candidate)}")
    
    raise ValueError("Gemini returned an empty response.")


def compute_category_totals(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Compute totals by category."""
    totals_by_category = {}
    
    for item in items:
        category = item.get("category", "MISCELLANEOUS")
        if category not in totals_by_category:
            totals_by_category[category] = 0
        totals_by_category[category] += item.get("line_total_usd", 0)
    
    return [
        {"category": cat, "total_usd": total}
        for cat, total in sorted(totals_by_category.items())
    ]


def compute_summary(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Compute summary totals."""
    total = sum(item.get("line_total_usd", 0) for item in items)
    
    return {
        "total_usd": total,
        "items_count": len(items)
    }


def assemble_estimate(
    findings: Dict[str, Any],
    items: List[Dict[str, Any]],
    city: str,
    state: str,
    consolidation_check: Optional[Dict[str, Any]] = None,
    category_consolidation: Optional[Dict[str, Any]] = None,
    quality_score: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Assemble final estimate structure."""

    # Normalize categories for all items
    for item in items:
        original_cat = item.get("category", "")
        item["category"] = normalize_category(
            original_cat,
            item.get("description", ""),
            item.get("notes", "")
        )

        # Ensure disclaimer is present
        if not item.get("disclaimer"):
            item["disclaimer"] = DISCLAIMER_TEMPLATES.get(
                item["category"],
                "Estimate reflects Texas state market conditions."
            )

    category_totals = compute_category_totals(items)
    summary = compute_summary(items)

    estimate = {
        "estimate_meta": {
            "created_on": datetime.now(timezone.utc).isoformat(),
            "city": city,
            "state": state,
            "inspection_date": findings.get("metadata", {}).get("date", ""),
        },
        "property": {
            "address": findings.get("metadata", {}).get("address", ""),
            "city": findings.get("metadata", {}).get("city", city),
            "state": findings.get("metadata", {}).get("state", state),
            "zip": findings.get("metadata", {}).get("zip", ""),
        },
        "items": items,
        "category_totals": category_totals,
        "summary": summary,
    }

    # PHASE 4: Include quality score in estimate
    if quality_score:
        estimate["quality_score"] = quality_score

    # PHASE 1 & 3: Include validation checks in estimate metadata
    if consolidation_check or category_consolidation:
        estimate["estimate_meta"]["quality_checks"] = {}
        if consolidation_check:
            estimate["estimate_meta"]["quality_checks"]["consolidation"] = consolidation_check
        if category_consolidation:
            estimate["estimate_meta"]["quality_checks"]["category_consolidation"] = category_consolidation

    return estimate


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Convert inspection findings to BOSSCAT-style estimate."
    )
    parser.add_argument(
        "findings_path",
        help="Path to JSON file containing inspection findings.",
    )
    parser.add_argument(
        "-o",
        "--out",
        default="estimate.json",
        help="Output path for estimate JSON (default: estimate.json).",
    )
    parser.add_argument(
        "--region",
        default="Default",
        choices=list(TEXAS_REGIONAL_MULTIPLIERS.keys()),
        help="Texas region for pricing adjustment (default: Default).",
    )
    parser.add_argument(
        "--state",
        default="Texas",
        help="State for pricing (default: Texas).",
    )
    parser.add_argument(
        "--ai-model",
        default=DEFAULT_MODEL,
        help=f"Gemini model to use for AI refinement (default: {DEFAULT_MODEL}).",
    )
    parser.add_argument(
        "--no-ai",
        action="store_true",
        help="Skip AI refinement and use only internal pricing.",
    )
    parser.add_argument(
        "--no-consolidate",
        action="store_true",
        help="Skip post-processing consolidation.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print estimate to stdout instead of writing to file.",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        help="Set logging level (default: INFO).",
    )
    return parser.parse_args()


def apply_cost_ceiling(items: List[Dict[str, Any]], max_total: float = 18000) -> List[Dict[str, Any]]:
    """Apply cost ceiling if total exceeds maximum."""
    current_total = sum(item.get("line_total_usd", 0) for item in items)
    
    if current_total > max_total:
        reduction_factor = max_total / current_total
        LOGGER.warning(f"Total ${current_total:,.0f} exceeds max ${max_total:,.0f}. Applying {(1-reduction_factor)*100:.1f}% reduction.")
        
        for item in items:
            item["unit_price_usd"] *= reduction_factor
            item["line_total_usd"] *= reduction_factor
            item["unit_price_usd"] = round(item["unit_price_usd"] / 25) * 25
            item["line_total_usd"] = round(item["line_total_usd"] / 25) * 25
    
    return items


def main() -> int:
    """Main entry point."""
    args = parse_args()
    
    # Configure logging
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper()),
        format="%(levelname)s: %(message)s",
    )
    
    # Load findings
    try:
        with open(args.findings_path, 'r') as f:
            findings = json.load(f)
    except Exception as e:
        LOGGER.error(f"Failed to load findings: {e}")
        return 1
    
    # Extract issues
    issues = findings.get("issues", [])
    if not issues:
        LOGGER.error("No issues found in findings file")
        return 1
    
    # PHASE 1: Fix over-flagged priority classification
    issues = fix_priority_classification(issues)
    
    # Normalize issues for pricing
    normalized_issues = []
    for issue in issues:
        # Map extraction category to pricing category
        pricing_category = map_extraction_category_to_pricing(
            issue.get("section", ""),
            issue.get("component", ""),
            issue.get("title", "")
        )
        
        normalized_issues.append({
            "section": issue.get("section", ""),
            "suggested_category": pricing_category,  # NEW: Hint to AI
            "title": issue.get("title", ""),
            "description": issue.get("description", ""),
            "severity": issue.get("severity", "moderate"),
            "estimated_fix": issue.get("estimated_fix", "Repair"),
            "location": issue.get("location", ""),
            "page_refs": issue.get("page_refs", []),
        })
    
    # Get pricing from LLM
    if not args.no_ai:
        # TWO-PHASE APPROACH: Individual pricing + code-based consolidation
        LOGGER.info("=" * 80)
        LOGGER.info("🚀 TWO-PHASE ESTIMATION APPROACH")
        LOGGER.info("=" * 80)

        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            LOGGER.error("GEMINI_API_KEY environment variable is required for AI mode")
            return 1

        def run_pricing(client):
            # PHASE 1: Individual pricing with Gemini
            priced_items, _ = call_gemini_for_individual_pricing(
                client,
                args.ai_model,
                normalized_issues,
                {}  # pricebook placeholder
            )
            return priced_items

        try:
            client = genai.Client(api_key=api_key)
            priced_items = run_pricing(client)
        except Exception as e:
            LOGGER.error(f"Failed to get AI pricing: {e}")
            return 1

        # PHASE 2: Code-based consolidation with hard limits
        items = code_based_consolidation(priced_items, normalized_issues)
    else:
        # Fallback pricing without AI
        LOGGER.info("Using fallback pricing (no AI)")
        priced_items = []
        for issue in normalized_issues:
            # Use already-mapped category from normalization
            category = issue.get("suggested_category", "MISCELLANEOUS")

            # Use category-severity pricing for fallback
            severity = issue.get("severity", "moderate")
            base_price = get_base_price(category, severity)

            priced_items.append({
                "category": category,
                "description": issue["title"][:100],
                "qty": 1,
                "unit_price_usd": base_price,
                "line_total_usd": base_price,
                "notes": issue["description"][:200],
                "disclaimer": "Estimate based on standard rates.",
                "bundled_issues": 1,
                "original_issue": issue
            })

        # Apply code-based consolidation even for fallback pricing
        if not args.no_consolidate:
            items = code_based_consolidation(priced_items, normalized_issues)
        else:
            items = priced_items

    # Stabilize prices (round to nearest $25)
    items = stabilize_prices(items)
    
    # Apply cost ceiling - REMOVED per Phase 1 (artificial cap causes price destruction)
    # items = apply_cost_ceiling(items, max_total=18000)  # REMOVED - artificial cap
    LOGGER.info("Cost ceiling removed - using actual market rates")
    
    # Apply regional adjustment
    items = apply_regional_adjustment(items, args.region)
    
    # PHASE 1: Validate consolidation ratio (3:1 to 5:1)
    consolidation_check = validate_consolidation_ratio(len(issues), len(items))
    if not consolidation_check["is_valid"]:
        LOGGER.warning(f"Consolidation check: {consolidation_check['status']} - {consolidation_check['consolidation_ratio']}:1")

    # PHASE 3: Add category-specific consolidation validation
    category_consolidation = validate_all_category_consolidation(issues, items)

    # Log category-specific results
    if not category_consolidation["all_acceptable"]:
        LOGGER.warning(
            "⚠️ Category-specific consolidation needs attention - "
            "see per-category warnings above"
        )

    # PHASE 4: Calculate comprehensive quality score
    LOGGER.info("=" * 60)
    LOGGER.info("CALCULATING QUALITY SCORE")
    LOGGER.info("=" * 60)

    quality_score = calculate_quality_score(issues, items)

    # Log quality results
    LOGGER.info(
        f"{quality_score['emoji']} Overall Quality: {quality_score['overall_score']}/100 "
        f"({quality_score['grade']})"
    )

    if quality_score["needs_review"]:
        LOGGER.warning(
            f"⚠️ ESTIMATE NEEDS REVIEW - Score below {QUALITY_THRESHOLDS['acceptable']} "
            f"(got {quality_score['overall_score']})"
        )

    # Log factor breakdown
    LOGGER.info("Quality Factor Breakdown:")
    for factor, details in quality_score["breakdown"].items():
        score = details["score"]
        weight = details["weight"] * 100
        LOGGER.info(f"  • {factor.replace('_', ' ').title()}: {score:.1f}/100 (weight: {weight:.0f}%)")

    LOGGER.info("=" * 60)

    # 🚨 QUALITY ENFORCEMENT - Reject estimates below production threshold
    PRODUCTION_QUALITY_THRESHOLD = 70.0
    if quality_score["overall_score"] < PRODUCTION_QUALITY_THRESHOLD:
        LOGGER.error("=" * 60)
        LOGGER.error(f"🚨 QUALITY GATE FAILED: {quality_score['overall_score']:.1f}/100 < {PRODUCTION_QUALITY_THRESHOLD}")
        LOGGER.error("=" * 60)
        LOGGER.error("This estimate does not meet production quality standards.")
        LOGGER.error("Primary issues:")

        # Identify the worst-performing factors
        worst_factors = sorted(
            quality_score["breakdown"].items(),
            key=lambda x: x[1]["score"]
        )[:3]

        for factor, details in worst_factors:
            LOGGER.error(f"  • {factor.replace('_', ' ').title()}: {details['score']:.1f}/100")

        LOGGER.error("")
        LOGGER.error("Recommendations:")
        breakdown = quality_score.get("breakdown", {})
        if breakdown.get("consolidation", {}).get("score", 100) < 60:
            LOGGER.error("  1. Fix consolidation ratios (too many or too few items)")
        if breakdown.get("category_distribution", {}).get("score", 100) < 60:
            LOGGER.error("  2. Review category distribution (imbalanced pricing)")
        if breakdown.get("price_consistency", {}).get("score", 100) < 60:
            LOGGER.error("  3. Check price consistency (outliers detected)")

        LOGGER.error("=" * 60)
        LOGGER.error("⚠️ ESTIMATE SAVED WITH QUALITY WARNING - MANUAL REVIEW REQUIRED")
        LOGGER.error("=" * 60)

    # Sort items by category for consistent ordering
    category_order = ["FOUNDATION", "ROOF", "PLUMBING", "ELECTRICAL", "HVAC", 
                      "WINDOWS/DOORS", "ATTIC", "MISCELLANEOUS"]
    items = sorted(items, key=lambda x: (
        category_order.index(x.get("category", "MISCELLANEOUS")) 
        if x.get("category") in category_order else 999,
        x.get("description", "")
    ))
    
    # Ensure we have reasonable number of items
    if len(items) > 30:
        LOGGER.warning(f"Too many items ({len(items)}), forcing consolidation")
        items = aggressive_consolidation(items)[:25]  # Force to 25 max
    
    # Assemble final estimate
    try:
        estimate = assemble_estimate(
            findings, items, args.region, args.state,
            consolidation_check=consolidation_check,
            category_consolidation=category_consolidation,
            quality_score=quality_score
        )
    except Exception as e:
        LOGGER.error(f"Failed to assemble estimate: {e}")
        return 1
    
    # Output estimate
    if args.dry_run:
        print(json.dumps(estimate, indent=2, ensure_ascii=False))
    else:
        with open(args.out, "w", encoding="utf-8") as output_file:
            json.dump(estimate, output_file, indent=2, ensure_ascii=False)
            output_file.write("\n")
        LOGGER.info(f"Estimate written to {args.out}")
    
    # Print summary
    total = estimate["summary"]["total_usd"]
    count = estimate["summary"]["items_count"]
    print(f"✅ Estimate complete: {count} items, Total: ${total:,.2f}")
    
    return 0


def test_pricing_matrix():
    """Test the new category-severity pricing matrix."""
    print("\n" + "="*60)
    print("Testing new pricing matrix:")
    print("="*60)

    test_cases = [
        ("ROOF", "major", 2500.0),
        ("PLUMBING", "minor", 150.0),
        ("ELECTRICAL", "critical", 2500.0),
        ("HVAC", "moderate", 600.0),
        ("UNKNOWN", "moderate", 250.0),  # Should fallback to MISCELLANEOUS
        ("FOUNDATION", "critical", 8000.0),
        ("ATTIC", "minor", 200.0),
        ("WINDOWS/DOORS", "major", 1000.0),
    ]

    all_passed = True
    for category, severity, expected in test_cases:
        result = get_base_price(category, severity)
        status = "✅" if result == expected else "❌"
        if result != expected:
            all_passed = False

        fallback_note = " (fallback to MISCELLANEOUS)" if category == "UNKNOWN" else ""
        print(f"{status} {category}/{severity}: ${result:.2f} (expect ${expected:.2f}){fallback_note}")

    print("="*60)
    if all_passed:
        print("✅ All pricing tests passed!")
    else:
        print("❌ Some pricing tests failed!")
    print("="*60 + "\n")

    return all_passed


if __name__ == "__main__":
    # Run pricing tests if --test-pricing flag is present
    if "--test-pricing" in sys.argv:
        sys.argv.remove("--test-pricing")
        test_pricing_matrix()

    sys.exit(main())
