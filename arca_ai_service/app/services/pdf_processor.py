import os
import re
import fitz  # PyMuPDF

def clean_text(text: str) -> str:
    """
    Cleans up headers, repeated footers, encoding gaps, and excessive newlines.
    """
    if not text:
        return ""
    # Collapse 3 or more consecutive newlines into exactly two
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Remove excessive carriage returns and trailing space per line
    lines = [line.strip() for line in text.split('\n')]
    cleaned = '\n'.join(lines)
    return cleaned.strip()

def extract_text_from_pdf(file_path: str) -> str:
    """
    Extracts text content using PyMuPDF (fitz) with automatic scanned-PDF OCR fallback.
    """
    print(f"[PDF Processor] Opening PDF: {file_path} using PyMuPDF...")
    try:
        doc = fitz.open(file_path)
        text = ""
        for page in doc:
            text += page.get_text()
        
        # Deduce if PDF is scanned based on extracted character count
        if len(text.strip()) < 150:
            print("[PDF Processor] Low character count detected (<150 chars). Launching OCR fallback pipeline...")
            return extract_text_with_ocr(file_path)
        
        cleaned = clean_text(text)
        print(f"[PDF Processor] Fast digital text extraction completed. Character count: {len(cleaned)}.")
        return cleaned
    except Exception as e:
        print(f"[PDF Processor Error] PyMuPDF failed: {e}. Attempting OCR fallback...")
        return extract_text_with_ocr(file_path)

def extract_text_with_ocr(file_path: str) -> str:
    """
    Fallback OCR text extraction using pdf2image and pytesseract.
    """
    try:
        from pdf2image import convert_from_path
        import pytesseract
        
        print(f"[OCR Pipeline] Rendering PDF pages to images...")
        images = convert_from_path(file_path)
        text = ""
        
        print(f"[OCR Pipeline] Running Tesseract OCR on {len(images)} pages...")
        for i, img in enumerate(images):
            page_text = pytesseract.image_to_string(img)
            text += f"\n--- Page {i+1} OCR ---\n" + page_text
            
        cleaned = clean_text(text)
        print(f"[OCR Pipeline] Successful OCR text extraction completed. Character count: {len(cleaned)}.")
        return cleaned
    except ImportError:
        print("[OCR Warning] pdf2image or pytesseract is not installed in the python environment.")
        return "[Error: OCR libraries pdf2image/pytesseract missing on AI host during scanned document ingestion]"
    except Exception as e:
        print(f"[OCR Error] Tesseract execution failed: {e}.")
        return f"[Error: Technical scanned PDF OCR failure. Message: {e}]"
