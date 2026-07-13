import os
import json
import logging
from datetime import datetime
from typing import Dict, Any

from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
from docling.datamodel.document import DoclingDocument

from app.services.collection_engine.document_registry import (
    get_document_by_id,
    update_document_processing_info,
    DocumentStatus,
    update_document_status
)

logger = logging.getLogger("arca.docling_parser")

# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────

# Create a CPU-optimized pipeline option (disabling heavy OCR/Vision models)
pipeline_options = PdfPipelineOptions(
    do_ocr=False,
    do_table_structure=True,  # Enabled to accurately extract tabular data from RBI circulars
    generate_page_images=False
)

# ─────────────────────────────────────────────
# Core Engine
# ─────────────────────────────────────────────

def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


async def process_document(document_id: str) -> Dict[str, Any]:
    """
    ARCA-005: Docling Document Processing Engine.
    
    Transforms a downloaded PDF into canonical structured formats:
    - document.json (Canonical)
    - document.md (Markdown)
    - tables.json
    - images/ (if any)
    - metadata.json
    """
    logger.info(f"[Docling] Processing started for document_id: {document_id}")
    
    try:
        # 1. Fetch Document from Registry
        doc_record = await get_document_by_id(document_id)
        if not doc_record:
            raise ValueError(f"Document {document_id} not found in registry.")
            
        pdf_path = doc_record.get("pdf_path")
        if not pdf_path or not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF file not found at {pdf_path}")

        # Update status to PROCESSING
        await update_document_status(document_id, DocumentStatus.PROCESSING.value)
        
        # 2. Setup Output Directories
        circular_number = doc_record["circular_number"].replace("/", "_").replace("\\", "_").replace(" ", "_")
        base_storage_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "storage", "processed", f"RBI_{circular_number}")
        
        _ensure_dir(base_storage_dir)
        images_dir = os.path.join(base_storage_dir, "images")
        
        # Artifact paths
        json_path = os.path.join(base_storage_dir, "document.json")
        md_path = os.path.join(base_storage_dir, "document.md")
        tables_path = os.path.join(base_storage_dir, "tables.json")
        metadata_path = os.path.join(base_storage_dir, "metadata.json")

        # 3. Load Docling
        logger.info(f"[Docling] Loading PDF: {pdf_path}")
        start_time = datetime.now()
        
        from docling.document_converter import PdfFormatOption
        converter = DocumentConverter(
            allowed_formats=[InputFormat.PDF],
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
            }
        )
        
        # 4. Process Document
        result = converter.convert(pdf_path)
        doc: DoclingDocument = result.document
        
        # 5. Export JSON (Canonical)
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(doc.export_to_dict(), f, indent=2)
        logger.info("[Docling] JSON exported")
            
        # 6. Export Markdown
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(doc.export_to_markdown())
        logger.info("[Docling] Markdown exported")

        # 7. Export Tables
        tables_data = []
        for idx, table in enumerate(doc.tables):
            # docling tables can be exported to pandas or markdown
            tables_data.append({
                "table_index": idx,
                "markdown": table.export_to_markdown()
            })
            
        if tables_data:
            with open(tables_path, "w", encoding="utf-8") as f:
                json.dump(tables_data, f, indent=2)
        logger.info(f"[Docling] Tables = {len(tables_data)}")

        # 8. Export Images (if any are extracted by standard pipeline)
        images_count = 0
        if doc.pictures:
            _ensure_dir(images_dir)
            for idx, pic in enumerate(doc.pictures):
                # Note: CPU-light pipeline might not extract images, but we support the capability
                img_path = os.path.join(images_dir, f"image_{idx}.png")
                # Docling stores PIL images in pic.image (if extracted)
                if hasattr(pic, "image") and pic.image:
                    pic.image.save(img_path)
                    images_count += 1
                    
        logger.info(f"[Docling] Images = {images_count}")
        
        # 9. Generate Processing Metadata
        end_time = datetime.now()
        processing_time_ms = int((end_time - start_time).total_seconds() * 1000)
        
        # Docling doesn't have a direct doc.num_pages property globally accessible in all versions,
        # but we can count unique pages in the texts/elements. We'll try to find it safely.
        page_count = len(result.input.pages) if hasattr(result.input, "pages") else 0
        
        metadata = {
            "page_count": page_count,
            "ocr_used": False,
            "processing_time_ms": processing_time_ms,
            "tables_detected": len(tables_data),
            "images_detected": images_count,
            "parser": "Docling",
            "parser_version": "2.x",
            "status": "SUCCESS"
        }
        
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

        # 10. Update Registry
        await update_document_processing_info(
            doc_id=document_id,
            processed_path=json_path,
            markdown_path=md_path,
            metadata_path=metadata_path,
            tables_path=tables_path if tables_data else "",
            images_path=images_dir if images_count > 0 else "",
            parser_version="Docling 2.x"
        )
        
        logger.info("[Docling] Registry updated")
        logger.info(f"[Docling] Processing completed in {processing_time_ms}ms")
        
        return {
            "document_id": document_id,
            "status": "SUCCESS",
            "artifacts": {
                "json": json_path,
                "markdown": md_path,
                "tables": tables_path if tables_data else None,
                "metadata": metadata_path
            }
        }

    except Exception as e:
        logger.error(f"[Docling] Processing failed for {document_id}: {str(e)}")
        
        # Fail gracefully
        try:
            await update_document_status(document_id, DocumentStatus.FAILED.value)
        except Exception as db_err:
            logger.error(f"[Docling] Could not update status to FAILED: {db_err}")
            
        return {
            "document_id": document_id,
            "status": "FAILED",
            "reason": str(e)
        }
