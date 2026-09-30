import hashlib
import json
import logging
import os
import time
from urllib.error import URLError
from urllib.request import Request, urlopen


logger = logging.getLogger(__name__)

# Configuration: facts are selected deterministically, then an OpenAI-compatible
# provider phrases only those facts. A persistent cache and batched requests are
# future improvements; this phase intentionally uses an in-memory per-run cache.
AI_INSIGHTS_API_KEY_ENV = "AI_INSIGHTS_API_KEY"
AI_INSIGHTS_PROVIDER = os.getenv("AI_INSIGHTS_PROVIDER", "openai_compatible")
AI_INSIGHTS_MODEL = os.getenv("AI_INSIGHTS_MODEL", "gpt-4o-mini")
AI_INSIGHTS_API_URL = os.getenv(
    "AI_INSIGHTS_API_URL", "https://api.openai.com/v1/chat/completions"
)
BUG_FIX_NOTABLE_THRESHOLD = 2
MAX_RETRIES = 2
RETRY_BACKOFF_SECONDS = 1

_EXPLANATION_CACHE = {}


def select_facts(row):
    """Select the only facts permitted to reach the explanation provider."""
    contributions = []
    for key, value in row.items():
        if key.endswith("_contribution"):
            try:
                numeric_value = float(value or 0)
            except (TypeError, ValueError):
                numeric_value = 0.0
            contributions.append((key[: -len("_contribution")], numeric_value))
    contributions.sort(key=lambda item: (-item[1], item[0]))
    if len(contributions) > 3:
        # Include every metric tied at the third-place cutoff; sort by name for
        # deterministic ordering so identical facts produce identical cache keys.
        cutoff_value = contributions[2][1]
        top_contributions = [
            item for item in contributions if item[1] >= cutoff_value
        ]
    else:
        top_contributions = contributions

    smell_breakdown = row.get("smell_breakdown") or {}
    smells = sorted(
        ((name, count) for name, count in smell_breakdown.items() if count),
        key=lambda item: item[1],
        reverse=True,
    )[:2]

    behavioral_flags = []
    bug_fix_count = row.get("bug_fix_commit_count", 0) or 0
    if bug_fix_count > BUG_FIX_NOTABLE_THRESHOLD:
        behavioral_flags.append(
            f"notable bug-fix history ({bug_fix_count} bug-fix commits)"
        )
    if row.get("has_insufficient_history"):
        behavioral_flags.append("behavioral history is limited")

    facts = [
        f"top contributing factor: {name} ({value:.2f} points)"
        for name, value in top_contributions
        if value > 0
    ]
    facts.extend(f"smell: {name} ({count})" for name, count in smells)
    facts.extend(behavioral_flags)
    if not facts:
        facts.append("minimal risk factors detected")

    return {
        "top_contributions": top_contributions,
        "smells": smells,
        "behavioral_flags": behavioral_flags,
        "facts": facts,
    }


def build_prompt(row, selected_facts):
    facts_text = "\n".join(f"- {fact}" for fact in selected_facts["facts"])
    history_instruction = ""
    if row.get("has_insufficient_history"):
        history_instruction = (
            " Explicitly note that behavioral history is limited; do not claim "
            "confidence about git-based safety."
        )
    return (
        "Using ONLY the facts provided below, write 2-3 sentences explaining "
        "this file's risk level. Do not mention, infer, or invent any metric, "
        "number, or fact not explicitly listed here. Low-risk files should get "
        "calm, brief explanations; do not manufacture concern for low scores."
        + history_instruction
        + f"\n\nFile: {row.get('filename', '')}"
        + f"\nRisk score: {row.get('risk_score', 0)}"
        + f"\nRisk category: {row.get('risk_category', 'Unknown')}"
        + f"\nSelected facts:\n{facts_text}"
    )


def fallback_explanation(row, selected_facts):
    """Create a complete deterministic explanation without an API call."""
    facts = selected_facts["facts"]
    contribution_facts = [
        fact for fact in facts if fact.startswith("top contributing factor:")
    ]
    if contribution_facts:
        factor_text = ", ".join(contribution_facts)
    elif facts:
        factor_text = ", ".join(facts[:2])
    else:
        factor_text = "minimal risk factors detected"
    explanation = (
        f"{row.get('filename', 'This file')} scored {row.get('risk_score', 0)} "
        f"({row.get('risk_category', 'Unknown')}), driven primarily by {factor_text}."
    )
    if row.get("has_insufficient_history"):
        explanation += " Behavioral history is limited, so git-based evidence is not yet conclusive."
    return explanation


def _cache_key(row, selected_facts):
    payload = {
        "filename": row.get("filename"),
        "risk_score": row.get("risk_score"),
        "risk_category": row.get("risk_category"),
        "selected_facts": selected_facts,
    }
    encoded = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _call_llm(prompt, api_key):
    request_body = json.dumps(
        {
            "model": AI_INSIGHTS_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
        }
    ).encode("utf-8")
    request = Request(
        AI_INSIGHTS_API_URL,
        data=request_body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urlopen(request, timeout=15) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return payload["choices"][0]["message"]["content"].strip()


def generate_explanation(row):
    """Return one cached, AI-generated, or fallback explanation."""
    selected_facts = select_facts(row)
    cache_key = _cache_key(row, selected_facts)
    if cache_key in _EXPLANATION_CACHE:
        logger.info("AI insight cache hit for %s", row.get("filename"))
        return _EXPLANATION_CACHE[cache_key]

    explanation = None
    api_key = os.getenv(AI_INSIGHTS_API_KEY_ENV)
    if api_key:
        prompt = build_prompt(row, selected_facts)
        for attempt in range(MAX_RETRIES + 1):
            try:
                explanation = _call_llm(prompt, api_key)
                if explanation:
                    break
            except (Exception, URLError) as error:
                logger.warning(
                    "AI insight attempt %d failed for %s: %s",
                    attempt + 1,
                    row.get("filename"),
                    error,
                )
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_BACKOFF_SECONDS * (attempt + 1))

    if not explanation:
        explanation = fallback_explanation(row, selected_facts)
    _EXPLANATION_CACHE[cache_key] = explanation
    return explanation


def add_explanations(rows):
    """Return copied rows with non-empty explanations and no other changes."""
    return [{**row, "ai_explanation": generate_explanation(row)} for row in rows]