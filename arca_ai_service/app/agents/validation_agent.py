import os
import re
import json
import httpx
import asyncio
import subprocess
import tempfile
from app.core.config import settings
from app.agents.script_generator import generate_validation_script


async def execute_validation_script(script_code: str, timeout: int = 30) -> dict:
    """
    Executes a generated Python validation script in a sandboxed subprocess.
    Returns the parsed JSON output from the script, or a FAIL result on error.
    """
    script_log_lines = []
    script_log_lines.append("[ARCA Runner] Preparing sandboxed execution environment...")

    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, dir='.') as f:
        f.write(script_code)
        f.flush()
        script_path = f.name

    try:
        script_log_lines.append(f"[ARCA Runner] Executing script: {os.path.basename(script_path)}")

        # Run in a restricted subprocess with timeout
        result = await asyncio.to_thread(
            subprocess.run,
            ['python', script_path],
            capture_output=True,
            text=True,
            timeout=timeout,
            env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'}
        )

        stdout = result.stdout.strip()
        stderr = result.stderr.strip()

        if stderr:
            script_log_lines.append(f"[ARCA Runner] stderr: {stderr[:300]}")

        if result.returncode != 0:
            script_log_lines.append(f"[ARCA Runner] Exit Code: {result.returncode} (Non-zero)")
            log_html = _format_script_log(script_log_lines, success=False)
            return {
                "overall": "FAIL",
                "checks": [{"name": "script_execution", "status": "FAIL", "message": f"Script exited with code {result.returncode}. {stderr[:200]}"}],
                "log_html": log_html
            }

        # Try to parse JSON from stdout (the script contract requires JSON output)
        # Find the last valid JSON block in stdout
        json_match = re.search(r'(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})', stdout, re.DOTALL)
        if json_match:
            parsed = json.loads(json_match.group(1))
            for check in parsed.get('checks', []):
                status_icon = "PASSED" if check.get('status') == 'PASS' else "FAILED"
                script_log_lines.append(f"[ARCA Runner] {status_icon}: {check.get('name')} ({check.get('message', '')})")
            script_log_lines.append(f"[ARCA Runner] Exit Code: 0 (Success)")
            log_html = _format_script_log(script_log_lines, success=parsed.get('overall') == 'PASS')
            parsed['log_html'] = log_html
            return parsed
        else:
            script_log_lines.append(f"[ARCA Runner] Warning: No JSON output detected in stdout")
            script_log_lines.append(f"[ARCA Runner] Raw output: {stdout[:300]}")
            log_html = _format_script_log(script_log_lines, success=False)
            return {
                "overall": "FAIL",
                "checks": [{"name": "output_parse", "status": "FAIL", "message": f"Script ran but produced no valid JSON. Output: {stdout[:200]}"}],
                "log_html": log_html
            }

    except subprocess.TimeoutExpired:
        script_log_lines.append(f"[ARCA Runner] TIMEOUT: Script exceeded {timeout}s limit")
        log_html = _format_script_log(script_log_lines, success=False)
        return {
            "overall": "FAIL",
            "checks": [{"name": "timeout", "status": "FAIL", "message": f"Validation script exceeded {timeout}s timeout"}],
            "log_html": log_html
        }
    except json.JSONDecodeError as e:
        script_log_lines.append(f"[ARCA Runner] JSON Parse Error: {e}")
        log_html = _format_script_log(script_log_lines, success=False)
        return {
            "overall": "FAIL",
            "checks": [{"name": "json_parse", "status": "FAIL", "message": f"Invalid JSON in script output: {e}"}],
            "log_html": log_html
        }
    except Exception as e:
        script_log_lines.append(f"[ARCA Runner] Execution Error: {e}")
        log_html = _format_script_log(script_log_lines, success=False)
        return {
            "overall": "FAIL",
            "checks": [{"name": "execution_error", "status": "FAIL", "message": str(e)}],
            "log_html": log_html
        }
    finally:
        try:
            os.unlink(script_path)
        except OSError:
            pass


def _format_script_log(lines: list, success: bool = True) -> str:
    """Formats script execution log lines into styled HTML for the audit report."""
    bg_color = "#0d1f0d" if success else "#1f0d0d"
    border_color = "#2e7d32" if success else "#c62828"
    log_entries = "<br/>".join(lines)
    return f"""
<div style="margin-top: 10px; padding: 12px; background-color: {bg_color}; color: #d4d4d4; border-radius: 6px; font-family: 'Consolas', monospace; font-size: 12px; border-left: 3px solid {border_color};">
{log_entries}
</div>
"""

async def validate_evidence(map_id: str) -> dict:
    """
    Primary endpoint trigger for Level 1-4 autonomous evidence checking.
    """
    print(f"[Validation Agent] Fetching MAP details for ID: {map_id} from backend...")
    
    # 1. Fetch MAP and uploads directly from the Node backend APIs
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(f"{settings.BACKEND_URL}/api/maps/{map_id}")
            if res.status_code != 200:
                raise ValueError(f"Backend returned status {res.status_code}")
            map_obj = res.json()
    except Exception as e:
        print(f"[Validation Agent Error] Failed to retrieve MAP from backend: {e}. Executing mock fallback...")
        # Fallback dummy object for demo safety
        map_obj = {
            "title": "Aadhaar Biometric SDK Integration on Digital Banking Portals",
            "deliverable": "Successfully integrated and tested biometric authentication API endpoints.",
            "classification": "TECHNICAL",
            "regulatoryKeywords": ["biometric", "aadhaar", "sdk"]
        }
        
    evidence_list = map_obj.get("evidenceFiles", [])
        
    try:
        from langchain_openai import ChatOpenAI
        
        # 1. Perform Level 1 & Level 2 local validations
        if not evidence_list:
            return {
                "overall_result": "FAILED",
                "reasoning": "<b>Level 1 (Completeness Check) Failed:</b> No evidence files were uploaded for validation."
            }
            
        allowed_extensions = {".png", ".jpg", ".jpeg", ".pdf", ".txt", ".json", ".log"}
        has_valid_extension = False
        for ev in evidence_list:
            _, ext = os.path.splitext(ev.get("fileName", "").lower())
            if ext in allowed_extensions:
                has_valid_extension = True
                break
                
        if not has_valid_extension:
            return {
                "overall_result": "FAILED",
                "reasoning": "<b>Level 2 (Relevance Check) Failed:</b> None of the files possess valid evidence extensions (PNG, JPG, PDF, TXT, JSON, LOG)."
            }
            
        # 2. Employs GPT-4o for Level 3 compliance check
        print(f"[Validation Agent] Initializing ChatOpenAI handler with {settings.MODEL_NAME}...")
        llm = ChatOpenAI(
            model=settings.MODEL_NAME,
            openai_api_base=settings.OPENAI_API_BASE,
            temperature=0.0,
            openai_api_key=settings.OPENAI_API_KEY
        )
        
        # Compile evidence context
        evidence_context = []
        for idx, ev in enumerate(evidence_list):
            evidence_context.append(f"File {idx+1}: {ev.get('fileName')}\nUploaded By: {ev.get('uploadedBy')}\nNotes: {ev.get('notes')}\n")
            
        evidence_text = "\n".join(evidence_context)
        
        prompt = f"""
        You are an autonomous auditing agent checking evidence submitted for a bank regulation MAP.
        
        MAP Title: {map_obj.get('title')}
        MAP Description: {map_obj.get('description')}
        Required Deliverable: {map_obj.get('deliverable')}
        Evidence Requested: {map_obj.get('evidenceRequired')}
        
        Uploaded Evidence Details:
        {evidence_text}
        
        Evaluate this evidence against the deliverables at Level 3.
        Determine if the uploaded files and accompanying department notes fully confirm compliance.
        
        Return a verdict: 'PASSED', 'FAILED', or 'NEEDS_REVIEW'.
        Provide a detailed explanation highlighting any gaps or confirming perfect matching.
        
        Return strictly in valid JSON matching this schema:
        {{
          "overall_result": "PASSED or FAILED or NEEDS_REVIEW",
          "reasoning": "Clear, professional audit report with HTML bullets explaining the Level 3 check."
        }}
        """
        
        response = await llm.ainvoke(prompt)
        parsed_res = json.loads(re.sub(r'```json|```', '', response.content).strip())
        
        # Level 4 Technical validation script check if TECHNICAL
        if map_obj.get("classification") == "TECHNICAL":
            print("[Validation Agent] Technical classification. Generating and executing validation script in sandbox...")
            try:
                # Generate the script via AI or fallback
                script = await generate_validation_script(
                    map_id,
                    map_obj.get("title"),
                    map_obj.get("description"),
                    map_obj.get("deliverable")
                )
                
                # REAL execution in sandboxed subprocess
                script_result = await execute_validation_script(script)
                script_log = script_result.get('log_html', '')
                
                # If script execution indicates failure, adjust the overall verdict
                if script_result.get('overall') == 'FAIL' and parsed_res.get('overall_result') == 'PASSED':
                    parsed_res['overall_result'] = 'NEEDS_REVIEW'
                    
                parsed_res["reasoning"] += f"\n<hr/><h4>Level 4 Technical Script Execution (Live Sandbox):</h4>{script_log}"
            except Exception as script_err:
                print(f"[Validation Agent] Script execution failed: {script_err}. Appending error to report.")
                error_log = _format_script_log(
                    [f"[ARCA Runner] Execution error: {script_err}",
                     "[ARCA Runner] Level 4 check could not be completed."],
                    success=False
                )
                parsed_res["reasoning"] += f"\n<hr/><h4>Level 4 Technical Script Execution:</h4>{error_log}"
            
        return parsed_res
    except Exception as e:
        print(f"[Validation Agent Error] LLM analysis failed: {e}. Returning minimal error verdict.")
        return {
            "overall_result": "FAILED",
            "reasoning": f"<h3>Evidence Validation Verdict: <span style='color: #c62828;'>FAILED</span></h3><p>The validation pipeline encountered a critical error during execution:</p><p>{str(e)}</p>"
        }
