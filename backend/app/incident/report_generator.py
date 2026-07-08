"""
FireGuard AI — Incident PDF Report Generator

Constructs an official, security-compliant PDF audit report for any incident in the database,
embedding metadata tables, system timelines, and the camera screenshot showing bounding boxes.
"""

import io
import logging
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from app.incident.models import Incident

logger = logging.getLogger(__name__)

def generate_incident_pdf(incident: Incident) -> bytes:
    """
    Generate a dynamic PDF report for a given Incident object.
    
    Returns the raw PDF bytes.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0f172a'),  # Slate 900
        spaceAfter=4
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#64748b'),  # Slate 500
        spaceAfter=16
    )
    
    heading2_style = ParagraphStyle(
        'Heading2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#1e293b'),  # Slate 800
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )
    
    label_style = ParagraphStyle(
        'Label',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#475569')  # Slate 600
    )
    
    value_style = ParagraphStyle(
        'Value',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#0f172a')
    )
    
    notes_style = ParagraphStyle(
        'Notes',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155')  # Slate 700
    )
    
    story = []
    
    # 1. Header block
    story.append(Paragraph("FIREGUARD AI — INCIDENT AUDIT REPORT", title_style))
    created_str = incident.created_at.strftime('%Y-%m-%d %H:%M:%S UTC') if incident.created_at else 'N/A'
    story.append(Paragraph(f"Official Security Operations Log • Generated on {created_str}", subtitle_style))
    
    # Status badges / formatting colors
    status_colors = {
        "detected": "#ef4444",
        "active": "#ef4444",
        "acknowledged": "#f59e0b",
        "resolved": "#10b981",
    }
    status_label = incident.status.upper()
    status_color = status_colors.get(incident.status, "#475569")
    
    # 2. Key Details Table
    data = [
        [
            Paragraph("Incident ID:", label_style),
            Paragraph(f"#{incident.id}", value_style),
            Paragraph("System Status:", label_style),
            Paragraph(f"<font color='{status_color}'><b>{status_label}</b></font>", value_style)
        ],
        [
            Paragraph("Detection Type:", label_style),
            Paragraph(incident.detection_type.replace("_", " ").upper(), value_style),
            Paragraph("Max Confidence:", label_style),
            Paragraph(f"{incident.confidence * 100:.1f}%", value_style)
        ],
        [
            Paragraph("Camera Source ID:", label_style),
            Paragraph(incident.camera_id or "CAM_01 (Surveillance)", value_style),
            Paragraph("Assigned Sector Zone:", label_style),
            Paragraph(incident.zone_id or "North Server Room", value_style)
        ]
    ]
    
    t = Table(data, colWidths=[1.3*inch, 2.2*inch, 1.2*inch, 2.3*inch])
    t.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
    ]))
    story.append(t)
    story.append(Spacer(1, 10))
    
    # 3. Visual Evidence Section
    story.append(Paragraph("Visual Evidence (Camera Capture)", heading2_style))
    screenshot_added = False
    
    if incident.screenshot_path:
        p = Path(incident.screenshot_path)
        # Check both relative path and backend subfolder relative path
        target_path = p if p.exists() else Path("backend") / p
        
        if target_path.exists():
            try:
                # Resize image to fit nicely within standard margins (6.5 inches max width, max height 3.2 inches)
                img = Image(str(target_path), width=6.5*inch, height=3.2*inch)
                img.hAlign = 'CENTER'
                story.append(KeepTogether([img]))
                screenshot_added = True
            except Exception as e:
                logger.error(f"Failed to render screenshot {target_path} inside PDF: {e}")
                
    if not screenshot_added:
        # Grey box placeholder if screenshot missing
        placeholder_data = [[Paragraph("<font color='#94a3b8'>NO VISUAL SNAPSHOT RECORDED IN DATABASE</font>", value_style)]]
        placeholder_table = Table(placeholder_data, colWidths=[7.0*inch], rowHeights=[1.2*inch])
        placeholder_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ]))
        story.append(placeholder_table)
        
    story.append(Spacer(1, 10))
    
    # 4. Operations Timeline
    story.append(Paragraph("System Audit Timeline", heading2_style))
    
    timeline_data = [
        [Paragraph("<b>EVENT / ACTION</b>", label_style), Paragraph("<b>TIMESTAMP</b>", label_style), Paragraph("<b>DETAILS / NOTES</b>", label_style)]
    ]
    
    # Add Triggered Event
    if incident.detected_at:
        timeline_data.append([
            Paragraph("AI Alert Triggered", value_style),
            Paragraph(incident.detected_at.strftime('%Y-%m-%d %H:%M:%S UTC'), value_style),
            Paragraph(f"System entered threat alert. AI Confidence: {incident.confidence*100:.1f}%", value_style)
        ])
        
    # Check if emergency dispatch note exists
    is_dispatched = incident.resolution_note and "EMERGENCY DISPATCH INITIATED" in incident.resolution_note.upper()
    if is_dispatched:
        timeline_data.append([
            Paragraph("<font color='#ef4444'><b>Emergency Dispatched</b></font>", value_style),
            Paragraph(incident.acknowledged_at.strftime('%Y-%m-%d %H:%M:%S UTC') if incident.acknowledged_at else incident.detected_at.strftime('%Y-%m-%d %H:%M:%S UTC'), value_style),
            Paragraph("Emergency response teams dispatched by operational console operator.", value_style)
        ])
        
    # Add Acknowledged Event
    if incident.acknowledged_at:
        timeline_data.append([
            Paragraph("Operator Acknowledged", value_style),
            Paragraph(incident.acknowledged_at.strftime('%Y-%m-%d %H:%M:%S UTC'), value_style),
            Paragraph("Threat status acknowledged. Audible alarms silenced by console operator.", value_style)
        ])
        
    # Add Resolved Event
    if incident.resolved_at:
        timeline_data.append([
            Paragraph("Incident Resolved", value_style),
            Paragraph(incident.resolved_at.strftime('%Y-%m-%d %H:%M:%S UTC'), value_style),
            Paragraph("Threat successfully neutralized. System returned to secure status.", value_style)
        ])
        
    timeline_table = Table(timeline_data, colWidths=[1.8*inch, 2.0*inch, 3.2*inch])
    timeline_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#94a3b8')),
    ]))
    story.append(timeline_table)
    story.append(Spacer(1, 10))
    
    # 5. Resolution Notes
    if incident.resolution_note:
        story.append(Paragraph("Resolution Details & Operator Comments", heading2_style))
        story.append(Paragraph(incident.resolution_note, notes_style))
        story.append(Spacer(1, 15))
        
    # 6. Verification / Signatures block
    story.append(Spacer(1, 15))
    sig_data = [
        [
            Paragraph("Prepared By: ___________________________", value_style),
            Paragraph("Authorized Signature: ___________________________", value_style)
        ],
        [
            Paragraph("Console Operator (Duty Officer)", label_style),
            Paragraph("Fire Safety Coordinator / Marshal", label_style)
        ]
    ]
    sig_table = Table(sig_data, colWidths=[3.5*inch, 3.5*inch])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    
    story.append(KeepTogether([sig_table]))
    
    # Build Document
    doc.build(story)
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
