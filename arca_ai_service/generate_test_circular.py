import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib import colors

def generate_rbi_circular(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle(
        name='RbiTitle',
        parent=styles['Heading1'],
        alignment=TA_CENTER,
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=12
    )
    
    sub_title_style = ParagraphStyle(
        name='RbiSubTitle',
        parent=styles['Normal'],
        alignment=TA_CENTER,
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#475569'),
        spaceAfter=20
    )
    
    meta_style = ParagraphStyle(
        name='RbiMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#334155'),
        spaceAfter=4
    )
    
    meta_bold_style = ParagraphStyle(
        name='RbiMetaBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=4
    )
    
    heading_style = ParagraphStyle(
        name='RbiHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#1E3A8A'),
        spaceBefore=14,
        spaceAfter=8
    )
    
    body_style = ParagraphStyle(
        name='RbiBody',
        parent=styles['Normal'],
        alignment=TA_JUSTIFY,
        fontName='Helvetica',
        fontSize=10,
        leading=15,
        textColor=colors.HexColor('#1E293B'),
        spaceAfter=10
    )
    
    provision_title_style = ParagraphStyle(
        name='ProvisionTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=4
    )
    
    story = []
    
    # 1. Header Band
    story.append(Paragraph("RESERVE BANK OF INDIA", title_style))
    story.append(Paragraph("DEPARTMENT OF CYBERSECURITY CONTROLS & COMPLIANCE<br/>CENTRAL OFFICE, MUMBAI", sub_title_style))
    story.append(Spacer(1, 10))
    
    # 2. Metadata Block (Using Table for neat alignment)
    meta_data = [
        [
            Paragraph("<b>Ref No:</b> RBI/2026-27/89", meta_style),
            Paragraph("<b>Date:</b> May 24, 2026", ParagraphStyle('RightMeta', parent=meta_style, alignment=2))
        ],
        [
            Paragraph("<b>Ref No:</b> CO.CE.CSD.No.99/04.02.012/2026-27", meta_style),
            Paragraph("<b>Classification:</b> TECHNICAL / OPERATIONAL", ParagraphStyle('RightMeta', parent=meta_style, alignment=2))
        ]
    ]
    meta_table = Table(meta_data, colWidths=[250, 250])
    meta_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(meta_table)
    
    # Divider line
    story.append(Spacer(1, 10))
    divider = Table([[""]], colWidths=[500])
    divider.setStyle(TableStyle([
        ('LINEBELOW', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(divider)
    story.append(Spacer(1, 15))
    
    # Addressed To
    story.append(Paragraph("To,<br/>The Chairmen / Chief Executive Officers<br/>All Scheduled Commercial Banks (excluding RRBs)<br/>All Payment Banks and Small Finance Banks", meta_bold_style))
    story.append(Spacer(1, 12))
    
    # Subject
    story.append(Paragraph("<b>Subject: Mandate for Cybersecurity Controls on Aadhaar Biometric Vaults, Multi-Factor Authentication (MFA) Supression Bypass Controls, and Core Database Log Retention Systems</b>", ParagraphStyle('RbiSubject', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, leading=14, spaceAfter=15)))
    
    # 3. Introductory Text
    intro_text = (
        "Madam / Dear Sir,<br/><br/>"
        "Please refer to Section 35A of the Banking Regulation Act, 1949, and the Master Direction on Information "
        "Technology Governance, Risk, Controls and Assurance. As part of our periodic review of the cybersecurity "
        "posture across commercial bank nodes, the Reserve Bank of India hereby issues specific binding directives "
        "concerning the encryption systems, access auditing, and authentication bypass behaviors. "
        "Banks must ensure complete structural compliance with these provisions in accordance with the timelines specified herein."
    )
    story.append(Paragraph(intro_text, body_style))
    story.append(Spacer(1, 10))
    
    # 4. Actionable Provisions
    story.append(Paragraph("<b>1. Directives and Technical Mandates</b>", heading_style))
    
    # Provision 1
    story.append(Paragraph("<b>1.1 Provision SEC-3.1: Cryptographic Integrity for Aadhaar Biometric API Gateways</b>", provision_title_style))
    p1_desc = (
        "<b>[MANDATORY - TECHNICAL]</b> All Scheduled Commercial Banks must enforce Transport Layer Security "
        "(TLS) version 1.3 protocol encryption on all active API endpoints interfacing with the UIDAI Aadhaar Vault "
        "and biometric databases. All request and response payloads must be cryptographically signed using SHA-256 "
        "with RSA-2048 or stronger keys. Local caching of raw, decrypted biometric identifiers (fingerprints, iris scans) "
        "or raw Aadhaar numbers in web-tier logs or application-tier transactional databases is strictly prohibited. "
        "Any temporary session caching must be fully protected inside a hardware security module (HSM).<br/>"
        "<b>Compliance Deliverable:</b> Automated API configuration files or environment check scripts confirming "
        "signature validations and mandatory TLS 1.3 handshake audits."
    )
    story.append(Paragraph(p1_desc, body_style))
    story.append(Spacer(1, 10))
    
    # Provision 2
    story.append(Paragraph("<b>1.2 Provision SEC-4.2: Audit Governance over Multi-Factor Authentication (MFA) Bypass Actions</b>", provision_title_style))
    p2_desc = (
        "<b>[CONDITIONAL - ADMINISTRATIVE]</b> Any temporary or permanent suppression, exclusion, or bypass of "
        "Multi-Factor Authentication (MFA) tokens for internal bank servers, staging platforms, or corporate admin panels "
        "must be authorized explicitly through a formal, board-approved MFA Bypass and Exclusion Policy. "
        "Such suppressions are strictly limited to secure subnet zones and must not exceed a non-extendable period "
        "of 24 hours. Banks must implement monthly automated log reconciliation sweeps to identify active, unapproved "
        "suppressions and immediately report anomalies to the Risk Management department.<br/>"
        "<b>Compliance Deliverable:</b> Signed copy of the board-approved MFA Bypass Policy and proof of monthly "
        "MFA bypass automated log audit sweeps."
    )
    story.append(Paragraph(p2_desc, body_style))
    story.append(Spacer(1, 10))
    
    # Provision 3
    story.append(Paragraph("<b>1.3 Provision SEC-5.4: Access Log Retention Period for Core Infrastructure</b>", provision_title_style))
    p3_desc = (
        "<b>[MANDATORY - TECHNICAL]</b> Transactional and system access logs for all core database servers, hardware vaults, "
        "and security controller portals must be preserved in a write-once-read-many (WORM) partition. Retention period for "
        "these audit trails is strictly mandated to be <b>not less than 6 years (72 months)</b>. Archival routines "
        "must automatically push compressed log blocks to secondary encrypted partitions on a daily basis. "
        "No database administrator or systems officer shall have manual delete permissions on the log retention partition.<br/>"
        "<b>Compliance Deliverable:</b> Server configuration file or directory snapshot verifying WORM partition mount "
        "and automatic log retention purge scripts."
    )
    story.append(Paragraph(p3_desc, body_style))
    story.append(Spacer(1, 15))
    
    # 5. Enforcement Section
    story.append(Paragraph("<b>2. Compliance Timeline and Penalty Measures</b>", heading_style))
    enforcement_text = (
        "Scheduled Commercial Banks are instructed to align their compliance monitoring pipelines within thirty (30) "
        "days of this circular's issuance. Non-compliance, failure to dispatch proof of validation, or automated validation "
        "failures detected by the banking audit frameworks shall attract statutory penalties in accordance with "
        "Section 47A(1)(c) of the Banking Regulation Act, 1949."
    )
    story.append(Paragraph(enforcement_text, body_style))
    story.append(Spacer(1, 20))
    
    # Sign-off
    story.append(Paragraph("Yours faithfully,<br/><br/><b>(Dr. Shaurya Sharma)</b><br/>Chief General Manager-in-Charge", meta_bold_style))
    
    doc.build(story)
    print(f"[PDF Gen] Successfully compiled official RBI regulatory circular to: {filename}")

if __name__ == '__main__':
    generate_rbi_circular('c:\\Users\\sharm\\Desktop\\cyber\\arca_test_circular_rbi.pdf')
