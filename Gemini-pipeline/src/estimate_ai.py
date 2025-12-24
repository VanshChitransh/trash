#!/usr/bin/env python3
"""
AI-driven estimate scaffolding for Consultabid.

This module will eventually route normalized inspection issues to an LLM-based
pricing engine. Phase-1 establishes schema validation, caching utilities, and
basic logging so downstream phases can layer real model calls and retries.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from jsonschema import Draft7Validator, ValidationError


LOGGER = logging.getLogger("estimate_ai")


def configure_logging(level: str = "INFO") -> None:
    """Configure module-level logging to mirror other CLI tools."""
    if not LOGGER.handlers:
        logging.basicConfig(
            level=getattr(logging, level.upper(), logging.INFO),
            format="%(levelname)s: %(message)s",
        )


AI_ESTIMATE_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "issues": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "category": {"type": "string"},
                    "severity": {"type": "string"},
                    "scope": {"type": "string"},
                    "unit_price": {"type": "number"},
                    "rationale": {"type": "string"},
                    "disclaimer": {"type": ["string", "null"]},  # Allow null, will normalize later
                    "cost": {
                        "type": "object",
                        "properties": {
                            "min_cost": {"type": "number"},
                            "max_cost": {"type": "number"},
                            "notes": {"type": "string"},
                        },
                        "required": ["min_cost", "max_cost"],
                    },
                },
                "required": [
                    "id",
                ],
                "anyOf": [
                    {"required": ["category", "severity", "scope", "unit_price"]},
                    {"required": ["cost"]},
                ],
            },
        },
        "summary": {
            "type": "object",
            "properties": {
                "total_estimate": {"type": "number"},
                "currency": {"type": "string", "enum": ["USD"]},
                "state": {"type": "string", "enum": ["Texas"]},
            },
            "required": ["total_estimate", "currency", "state"],
        },
    },
    "required": ["issues", "summary"],
}

_AI_VALIDATOR = Draft7Validator(AI_ESTIMATE_SCHEMA)

CACHE_ROOT = Path(".cache") / "ai_estimates"


def _ensure_model_prefix(model: str) -> str:
    return model if "/" in model else f"models/{model}"


def _extract_output_text(response: Any) -> str:
    text = getattr(response, "output_text", None) or getattr(response, "text", None)
    if text:
        return text
    candidates = getattr(response, "candidates", None) or []
    for candidate in candidates:
        content = getattr(candidate, "content", None)
        parts: List[Any] = getattr(content, "parts", []) if content else []
        for part in parts:
            part_text = getattr(part, "text", None)
            if part_text:
                return part_text
    raise ValueError("AI model returned empty response.")


def _call_gemini_json(client: Any, model: str, contents: List[Dict[str, Any]]) -> str:
    request_kwargs = {
        "model": _ensure_model_prefix(model),
        "contents": contents,
        "config": {"response_mime_type": "application/json"},
    }
    if hasattr(client, "models"):
        response = client.models.generate_content(**request_kwargs)
    elif hasattr(client, "responses"):
        response = client.responses.generate(**request_kwargs)
    else:
        raise RuntimeError("Gemini client does not expose models or responses API.")
    return _extract_output_text(response)


def hash_payload(payload: Dict[str, Any], model: str) -> str:
    """
    Generate a deterministic hash for the payload + model, used as cache key.
    """
    encoded = json.dumps({"model": model, "payload": payload}, sort_keys=True).encode(
        "utf-8"
    )
    return hashlib.sha256(encoded).hexdigest()


def load_from_cache(hash_id: str) -> Optional[Dict[str, Any]]:
    """
    Read cached AI estimate if present.
    """
    cache_path = CACHE_ROOT / f"{hash_id}.json"
    if not cache_path.is_file():
        LOGGER.debug("Cache miss for %s", hash_id)
        return None

    try:
        with cache_path.open("r", encoding="utf-8") as handle:
            LOGGER.debug("Cache hit for %s", hash_id)
            return json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        LOGGER.warning("Failed to load cache %s: %s", cache_path, exc)
        return None


def save_to_cache(hash_id: str, data: Dict[str, Any]) -> None:
    """
    Persist AI estimate to cache directory.
    """
    CACHE_ROOT.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE_ROOT / f"{hash_id}.json"
    try:
        with cache_path.open("w", encoding="utf-8") as handle:
            json.dump(data, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
        LOGGER.debug("Saved AI estimate cache at %s", cache_path)
    except OSError as exc:
        LOGGER.warning("Unable to write cache %s: %s", cache_path, exc)


def _validate_ai_output_with_error(data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    Validate AI output against the expected schema.
    """
    try:
        _AI_VALIDATOR.validate(data)
    except ValidationError as exc:
        message = str(exc)
        LOGGER.error("AI output failed schema validation: %s", message)
        return False, message
    return True, None


def validate_ai_output(data: Dict[str, Any]) -> bool:
    valid, _ = _validate_ai_output_with_error(data)
    return valid


def _sanitize_ai_response(raw: Any) -> Dict[str, Any]:
    """
    Pre-validation cleanup: fix common LLM schema violations.

    - Replace null disclaimers with default strings
    - Ensure all required fields exist

    Returns sanitized copy suitable for schema validation.
    """
    # Handle both dict and list responses (like _normalize_ai_response)
    if isinstance(raw, list):
        sanitized: Dict[str, Any] = {"issues": raw}
    elif isinstance(raw, dict):
        sanitized = dict(raw)
    else:
        return {"issues": []}
    
    issues = sanitized.get("issues", [])

    for idx, issue in enumerate(issues):
        if not isinstance(issue, dict):
            continue

        # Fix null disclaimer
        if issue.get("disclaimer") is None:
            issue["disclaimer"] = "Scope subject to onsite evaluation."
            LOGGER.debug(
                "Sanitized null disclaimer for issue %s (idx=%d)",
                issue.get("id", idx),
                idx
            )

        # Ensure disclaimer is string type
        if "disclaimer" in issue and not isinstance(issue["disclaimer"], str):
            issue["disclaimer"] = str(issue["disclaimer"])

    return sanitized


def _normalize_ai_response(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, list):
        parsed: Dict[str, Any] = {"issues": raw}
    elif isinstance(raw, dict):
        parsed = dict(raw)
        if "issues" not in parsed:
            items = []
            for value in parsed.values():
                if isinstance(value, list):
                    items = value
                    break
            if items:
                parsed = {"issues": items}
    else:
        raise ValueError("AI response must be a JSON object or array.")

    raw_issues = parsed.get("issues") or []
    normalized_issues: List[Dict[str, Any]] = []
    for index, raw_issue in enumerate(raw_issues):
        if not isinstance(raw_issue, dict):
            LOGGER.debug("Skipping non-object issue at index %d: %r", index, raw_issue)
            continue

        issue = dict(raw_issue)
        issue_id = str(issue.get("id") or index)
        category = issue.get("category") or "MISCELLANEOUS"
        severity = issue.get("severity") or "moderate"
        scope = (
            issue.get("scope")
            or issue.get("description")
            or issue.get("explanation")
            or issue.get("title")
            or ""
        )
        rationale = issue.get("rationale") or ""
        unit_price = issue.get("unit_price")

        cost_info = issue.get("cost")
        normalized_cost: Optional[Dict[str, Any]] = None
        if isinstance(cost_info, dict):
            min_cost = cost_info.get("min_cost")
            max_cost = cost_info.get("max_cost")
            notes = cost_info.get("notes")
            normalized_cost = {}
            if isinstance(min_cost, (int, float)):
                normalized_cost["min_cost"] = float(min_cost)
            if isinstance(max_cost, (int, float)):
                normalized_cost["max_cost"] = float(max_cost)
            if notes:
                normalized_cost["notes"] = str(notes)
            if isinstance(min_cost, (int, float)) and isinstance(max_cost, (int, float)):
                average = (float(min_cost) + float(max_cost)) / 2.0
                if not isinstance(unit_price, (int, float)) or unit_price <= 0:
                    unit_price = average
                if not rationale and notes:
                    rationale = str(notes)
                elif not rationale:
                    rationale = (
                        f"AI-estimated cost range ${min_cost:.0f}-${max_cost:.0f}."
                    )

        if not isinstance(unit_price, (int, float)):
            unit_price = 0.0

        title_text = issue.get("title")
        if not isinstance(title_text, str):
            title_text = ""
        if not title_text:
            title_text = str(scope)
        issue["title"] = title_text
        title_lower = title_text.lower()
        scope_lower = str(scope).lower()
        description_lower = (
            str(issue.get("description")) if issue.get("description") is not None else ""
        ).lower()
        combined_lower = " ".join(
            part for part in [title_lower, scope_lower, description_lower] if part
        )
        severity_lower = str(severity).lower()
        category_lower = str(category).lower()

        is_eval = bool(issue.get("is_evaluation")) or bool(issue.get("is_monitor"))
        if "evaluate" in title_lower or "monitor" in title_lower:
            is_eval = True

        guard_applied = False
        if is_eval:
            unit_price = 0.0
            rationale = "Evaluation only – no repair cost assigned."
            normalized_cost = None
            guard_applied = True
        else:
            caps: List[float] = []
            # Check if AI provided a cost range - if so, be more lenient with caps
            has_ai_cost_range = (
                normalized_cost
                and isinstance(normalized_cost.get("min_cost"), (int, float))
                and isinstance(normalized_cost.get("max_cost"), (int, float))
            )
            
            if category_lower == "plumbing" and "pipe" in combined_lower:
                caps.append(1200.0)
            if category_lower == "foundation" and severity_lower == "monitor":
                caps.append(500.0)
            if "insulation" in combined_lower:
                measured_area = re.search(
                    r"\b\d+(\.\d+)?\s*(sq|square)\s*(ft|feet|foot)\b", combined_lower
                ) or re.search(r"\b\d+(\.\d+)?\s*(sf|sqft|square[-\s]?feet)\b", combined_lower)
                if not measured_area:
                    # If AI provided a cost range, use midpoint as minimum cap instead of $300
                    if has_ai_cost_range:
                        ai_min = float(normalized_cost["min_cost"])
                        ai_max = float(normalized_cost["max_cost"])
                        ai_midpoint = (ai_min + ai_max) / 2.0
                        # Only cap if price is significantly above the AI range
                        if unit_price > ai_max * 1.5:
                            caps.append(ai_max * 1.5)
                        # If unit_price is below midpoint but within range, trust AI
                        elif ai_min <= unit_price <= ai_max:
                            # Don't apply cap if within AI range
                            pass
                        else:
                            # Use midpoint as reasonable cap
                            caps.append(ai_midpoint)
                    else:
                        # No AI range - use conservative $300 cap
                        caps.append(300.0)
            if "roof" in combined_lower:
                caps.append(2500.0)

            if caps:
                cap_value = min(caps)
                if unit_price > cap_value:
                    unit_price = float(cap_value)
                    guard_applied = True

        unit_price = float(unit_price)
        issue["unit_price"] = unit_price
        issue["rationale"] = rationale

        if guard_applied:
            display_title = issue.get("title") or f"Issue {issue_id}"
            LOGGER.debug("Guardrail applied: %s → $%.2f", display_title, unit_price)

        normalized_issue: Dict[str, Any] = {
            "id": issue_id,
            "category": str(category),
            "severity": str(severity),
            "scope": str(scope),
            "unit_price": float(unit_price),
            "rationale": str(rationale),
        }

        # Normalize null/missing disclaimer to empty string
        disclaimer = issue.get("disclaimer")
        if disclaimer is None:
            disclaimer = ""
        elif not disclaimer or (isinstance(disclaimer, str) and disclaimer.strip() == ""):
            disclaimer = "Estimate based on Houston market averages."
        normalized_issue["disclaimer"] = str(disclaimer)

        original_disclaimer = issue.get("disclaimer")
        if original_disclaimer is None or (isinstance(original_disclaimer, str) and not original_disclaimer.strip()):
            LOGGER.debug(
                "Normalized null/empty disclaimer for issue %s: '%s'",
                issue_id,
                (issue.get("title") or normalized_issue.get("scope", "untitled"))[:40]
            )

        if normalized_cost:
            normalized_issue["cost"] = normalized_cost

        normalized_issues.append(normalized_issue)

    summary = parsed.get("summary") or {}
    total_estimate = round(
        sum(issue["unit_price"] for issue in normalized_issues),
        -1,
    )
    summary = {
        "total_estimate": float(total_estimate),
        "currency": summary.get("currency") or "USD",
        "state": summary.get("state") or "Texas",
    }

    normalized: Dict[str, Any] = {
        "issues": normalized_issues,
        "summary": summary,
    }
    token_usage = parsed.get("token_usage")
    if token_usage is not None:
        normalized["token_usage"] = token_usage
    return normalized


def estimate_with_ai(payload: Dict[str, Any], model: str, client: Any) -> Dict[str, Any]:
    """
    AI estimation entry point.

    Validates Texas state-wide pricing, checks cache,
    and returns estimated payload with LLM calls.
    """
    configure_logging()

    # Extract state from payload (backward compatible with city)
    state = (
        payload.get("metadata", {})
        .get("prepared_for", {})
        .get("state")
        or payload.get("metadata", {}).get("state")
        or "Texas"
    )
    # Backward compatibility: if city is provided and no state, assume Texas
    city = (
        payload.get("metadata", {})
        .get("prepared_for", {})
        .get("city")
        or payload.get("metadata", {}).get("city")
    )
    if city and not state:
        state = "Texas"
    
    if state != "Texas":
        raise ValueError(
            "AI pricing currently supports only Texas state estimates. "
            f"Received state={state!r}."
        )

    cache_key = hash_payload(payload, model)
    cached = load_from_cache(cache_key)
    if cached:
        valid, _ = _validate_ai_output_with_error(cached)
        if valid:
            cached_total = sum(
                issue.get("unit_price", 0.0) for issue in cached.get("issues", [])
            )
            if cached.get("issues") and cached_total <= 0:
                LOGGER.info(
                    "Cached AI estimate for key %s has zero total; re-running model.",
                    cache_key,
                )
            else:
                LOGGER.info("Using cached AI estimate for key %s", cache_key)
                return cached

    prompt_header = (
        "You are a licensed home-inspection estimator for Texas properties.\n"
        "Output only valid JSON following the given schema.\n"
        "Assume the property is in Houston, TX.\n"
        "Use realistic 2025 contractor rates (labor + materials).\n"
        "Prices in USD, rounded to nearest 5.\n"
        "Never include extra commentary.\n\n"
        "CONSOLIDATION STRATEGY (CRITICAL):\n"
        "- Combine related issues affecting the same system/component into ONE line item\n"
        "- Example: 3 toilet issues → 'Repair guest bathroom toilet (rebuild internals, replace supply line, fix leak)'\n"
        "- Example: Foundation cracks + drainage → 'Foundation repairs (seal cracks, improve drainage)'\n"
        "- Example: Multiple water heater code violations → 'Bring water heater to code (bonding, TPR routing, drain pan)'\n"
        "- Example: Multiple caulking issues → 'Re-caulk exterior (windows, siding penetrations, trim)'\n"
        "- Target 15-25 total line items for a typical home inspection (final output, not 70+)\n"
        "- Price the consolidated scope as a package deal with 15-20% efficiency discount, not sum of parts\n"
        "- Only keep separate items when issues are in different locations or require different trades\n\n"
        "Estimate the cost of repair or replacement for each issue in the array below.\n"
        "Consider severity, category, and description.\n"
        "Return the result strictly matching the schema.\n"
        "**CRITICAL: Use ONLY these categories: PLUMBING, ELECTRICAL, INTERIOR, HVAC, EXTERIOR, EVALUATE, EXCLUDED, WINDOWS/DOORS, ATTIC, MISCELLANEOUS. Do NOT use APPLIANCES, ROOF, FOUNDATION, or any other category names.**\n"
        "**CRITICAL: Keep prices realistic. Typical repair costs: Minor $100-300, Moderate $300-800, Major $800-2,500. Full replacements $2,500-5,000.**\n"
        "**CRITICAL: Price caps for inspection-level repairs (not full replacements): Roof $2,500, Foundation $2,500, Interior cosmetic $2,000, Plumbing comprehensive $3,000.**\n"
        "If is_evaluation is true or severity equals 'Monitor', set unit_price to 0 and return only a short diagnostic scope.\n"
        "**CRITICAL: If estimated_fix is 'Improvement', apply a 50% discount** (these are optional recommendations, not required repairs).\n"
        "Never upgrade monitor/evaluation items to full repairs unless the description explicitly states replacement or installation.\n"
        "Assume localized repair unless 'entire' or 'whole-house' is mentioned.\n"
        "Do not infer scope beyond what is written.\n"
        "**DO NOT mix different systems**: HVAC condensate drain is separate from water heater drain pan. HVAC ductwork is separate from range hood or dryer vents.\n\n"
        "CRITICAL: Every item MUST include a non-empty 'disclaimer' string. Examples:\n"
        "- For repairs: 'Scope may vary based on onsite conditions.'\n"
        "- For evaluations: 'Further assessment required before pricing.'\n"
        "- For monitor items: 'No repair needed at this time.'\n"
        "Never return null or omit the disclaimer field."
    )

    issues = payload.get("issues", [])
    request_payload = json.dumps({"issues": issues}, ensure_ascii=False)

    last_error: Optional[str] = None
    for attempt in range(1, 4):
        try:
            prompt_parts = [
                {"text": prompt_header},
                {
                    "text": (
                        "Use the BOSSCAT pricebook ranges as upper limits; do not exceed those caps."
                    )
                },
                {"text": "Here are the issues as JSON:"},
                {"text": request_payload},
                {
                    "text": (
                        "For each item, you must fill category, severity, scope, and "
                        "unit_price (numeric dollars). When you estimate a price range, "
                        "populate cost.min_cost, cost.max_cost, and cost.notes, AND set "
                        "unit_price to the midpoint of that range."
                    )
                },
            ]
            if last_error:
                prompt_parts.append(
                    {
                        "text": (
                            "Previous JSON invalid; follow schema exactly. "
                            f"Details: {last_error}"
                        )
                    }
                )

            if LOGGER.isEnabledFor(logging.DEBUG):
                prompt_preview = "\n".join(
                    part.get("text", "") for part in prompt_parts if "text" in part
                )
                LOGGER.debug("AI prompt attempt %d:\n%s", attempt, prompt_preview)

            contents = [{"role": "user", "parts": prompt_parts}]

            output_text = _call_gemini_json(client, model, contents)

            parsed = json.loads(output_text)
            sanitized = _sanitize_ai_response(parsed)  # Pre-validation cleanup
            normalized = _normalize_ai_response(sanitized)
            valid, error = _validate_ai_output_with_error(normalized)
            if not valid:
                last_error = error or "Schema validation failed"
                LOGGER.warning("Attempt %d: AI output failed validation.", attempt)
                continue

            for issue in normalized.get("issues", []):
                price = issue.get("unit_price", 0.0)
                issue["unit_price"] = round(price / 5.0) * 5.0

            normalized["summary"]["total_estimate"] = sum(
                issue.get("unit_price", 0.0) for issue in normalized.get("issues", [])
            )

            save_to_cache(cache_key, normalized)
            LOGGER.info("AI estimate completed successfully after %d attempt(s).", attempt)
            return normalized
        except (json.JSONDecodeError, ValueError) as exc:
            last_error = str(exc)
            LOGGER.error("Attempt %d: Failed to parse AI response: %s", attempt, exc)
        except Exception as exc:  # pylint: disable=broad-except
            last_error = str(exc)
            LOGGER.error("Attempt %d: AI request failed: %s", attempt, exc)

    raise RuntimeError("AI pricing failed after multiple attempts.")
