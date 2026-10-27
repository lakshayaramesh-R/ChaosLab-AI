import os
from pathlib import Path

from dotenv import load_dotenv
from groq import Groq


# Find .env in the main ChaosLab-AI folder.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_ROOT / ".env"

load_dotenv(dotenv_path=ENV_FILE, override=True)


def generate_incident_analysis(
    service_name: str,
    failure_type: str,
    system_status: dict,
) -> str:
    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        print(f"Groq API key not found. Checked: {ENV_FILE}")
        return "Groq API key is missing. Check the main project .env file."

    try:
        client = Groq(api_key=api_key)

        system_prompt = """
You are the incident analysis engine for ChaosLab AI,
a distributed-system failure simulator.

Analyze the reported service failure using only the supplied
incident and system-state information.

Return a complete, concise, professional Markdown report with
exactly these five sections. Finish every section and every sentence.
Do not stop mid-sentence. Prefer short, useful bullets over long paragraphs.

## Root Cause
- Identify the service where the failure originated.
- Distinguish the simulated failure from downstream effects.
- Do not invent causes that the available data cannot confirm.

## Impact Analysis
- Explain which services may be affected based on the supplied
  dependency graph and service states.
- Distinguish confirmed failures from potential risks.

## Failure Propagation
- Explain the dependency chain step by step.
- Do not claim a service has failed unless the supplied state confirms it.

## Recovery Plan
- Give 3 to 5 numbered, actionable recovery steps.
- Recommend recovering failed dependencies before dependent services
  when appropriate.
- Recommend Reset System only when a full reset is necessary.

## Prevention
- Give two or three practical ways to reduce similar risks.

Use simple, professional language. If information is missing, say so
rather than guessing. Do not claim you performed any recovery actions.
Keep the whole report compact enough to finish in one response.
"""

        user_prompt = f"""
Analyze this simulated incident and write the complete report.

Service: {service_name}
Failure type: {failure_type}
Current system status: {system_status}

Before finishing, verify that all five required Markdown sections are
present and that the final sentence is complete.
"""

        response = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": user_prompt,
                },
            ],
            temperature=0.3,
            # Use the current completion-token parameter and allow enough
            # room for all five concise report sections.
            max_completion_tokens=1400,
        )

        analysis = response.choices[0].message.content

        if not analysis or not analysis.strip():
            return "The AI returned an empty response."

        return analysis.strip()

    except Exception as exc:
        error_message = f"{type(exc).__name__}: {exc}"
        print(f"Groq AI error: {error_message}", flush=True)
        return f"AI ERROR: {error_message}"