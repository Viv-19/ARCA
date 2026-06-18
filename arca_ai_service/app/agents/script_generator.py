import re
from app.core.config import settings

async def generate_validation_script(map_id: str, title: str, description: str, deliverable: str) -> str:
    """
    Main entry point for AI Script Generator.
    Generates dynamic compliance validation scripts.
    """
        
    try:
        from langchain_openai import ChatOpenAI
        
        llm = ChatOpenAI(
            model=settings.MODEL_NAME,
            openai_api_base=settings.OPENAI_API_BASE,
            temperature=0.1,
            openai_api_key=settings.OPENAI_API_KEY
        )
        
        prompt = f"""
        You are an expert DevSecOps and banking system auditor.
        Generate a safe, read-only Python validation script to autonomously test the technical implementation of this compliance Measurable Action Point (MAP).
        
        MAP Title: {title}
        MAP Description: {description}
        Expected Deliverable: {deliverable}
        
        RULES:
        1. The script MUST be completely read-only and safe. It must NEVER perform destructive actions (no file writes outside current directory, no deletion, no service restarts).
        2. The script can perform read-only checks like testing a TLS port connection (e.g. check SSL/TLS configuration), checking if an API endpoint responds, checking local environment variable settings, or scanning a standard system log path.
        3. The script MUST output a single valid JSON block at the very end to stdout, with keys 'overall' ('PASS' or 'FAIL') and 'checks' (a list of objects with 'name', 'status' ('PASS' or 'FAIL'), and 'message').
        4. Provide the Python script code inside a single ```python...``` code block.
        """
        
        print(f"[Script Generator] Calling GPT-4o to generate script for MAP: {title[:30]}...")
        response = await llm.ainvoke(prompt)
        
        # Extract python code block
        match = re.search(r'```python(.*?)```', response.content, re.DOTALL)
        if match:
            return match.group(1).strip()
        else:
            cleaned = response.content.replace('```', '').strip()
            if "import " in cleaned:
                return cleaned
            raise ValueError("LLM response did not contain a valid Python script block.")
            
    except Exception as e:
        print(f"[Script Generator Error] LLM generation failed: {e}. Returning minimal failure script.")
        return f"""# Error Fallback Script
import json
if __name__ == '__main__':
    print(json.dumps({{
        "overall": "FAIL",
        "checks": [
            {{ "name": "generation_failure", "status": "FAIL", "message": "Failed to auto-generate the validation script." }}
        ]
    }}))
"""
