"""
FireGuard AI — Fire Intelligence Service

Asynchronous rules-based analysis of fire/smoke detection events.
Calculates severity, identifies context-based causes, establishes
observed behaviour patterns, and builds explanations and recommended actions.
"""

import logging
from datetime import timedelta
from typing import Any
from sqlalchemy.orm import Session
from sqlalchemy import select, desc

from app.core.utils import utc_now
from app.incident.models import Incident
from app.incident.repository import IncidentRepository

logger = logging.getLogger(__name__)


class FireIntelligenceService:
    """
    Analyzes incidents automatically after creation using rule-based metrics.
    """

    def __init__(self, session: Session):
        self._session = session
        self._repo = IncidentRepository(session)

    async def analyze_incident(self, incident_id: int, event_data: dict[str, Any]) -> Incident | None:
        """
        Run the rule-based decision support logic for a given incident.
        
        Args:
            incident_id: The ID of the newly created Incident.
            event_data: The detection event data from the Event Bus.
        """
        incident = self._repo.get_by_id(incident_id)
        if not incident:
            logger.error("Incident #%d not found during intelligence analysis", incident_id)
            return None

        try:
            detections = event_data.get("detections", [])
            confidence = event_data.get("confidence", 0.0)
            detection_type = event_data.get("detection_type", "unknown")
            camera_id = incident.camera_id or "CAM_01"
            zone_id = incident.zone_id or "ZONE_01"

            # 1. Check history for persistence (within last 5 minutes, same camera)
            five_minutes_ago = utc_now() - timedelta(minutes=5)
            stmt = (
                select(Incident)
                .where(Incident.camera_id == camera_id)
                .where(Incident.id != incident.id)
                .where(Incident.detected_at >= five_minutes_ago)
                .order_by(desc(Incident.detected_at))
            )
            result = self._session.execute(stmt)
            prior_incidents = list(result.scalars().all())
            has_persistence = len(prior_incidents) > 0

            # 2. Rule-Based Severity Scoring (1 to 10 points)
            severity_points = 0
            
            # Detection Type
            if detection_type == "fire_and_smoke":
                severity_points += 3
            elif detection_type == "fire":
                severity_points += 2
            elif detection_type == "smoke":
                severity_points += 1

            # Confidence
            if confidence >= 0.85:
                severity_points += 3
            elif confidence >= 0.70:
                severity_points += 2
            elif confidence >= 0.50:
                severity_points += 1

            # Number of Detections (Bounding Boxes in the frame)
            num_detections = len(detections)
            if num_detections >= 3:
                severity_points += 2
            elif num_detections >= 1:
                severity_points += 1

            # Persistence over time
            if has_persistence:
                severity_points += 2

            # Map Points to Severity
            if severity_points >= 8:
                severity = "CRITICAL"
            elif severity_points >= 5:
                severity = "HIGH"
            elif severity_points >= 3:
                severity = "MEDIUM"
            else:
                severity = "LOW"

            # 3. Predefined Context / Cause Estimation
            zone_lower = zone_id.lower()
            camera_lower = camera_id.lower()
            if any(k in zone_lower or k in camera_lower for k in ["kitchen", "canteen", "breakroom", "pantry"]):
                estimated_cause = "Estimated Kitchen Context"
            elif any(k in zone_lower or k in camera_lower for k in ["server", "electrical", "ups", "switch", "power"]):
                estimated_cause = "Estimated Electrical Context"
            elif detection_type == "fire" and confidence >= 0.80 and len([d for d in detections if d.get("class_name") == "smoke"]) == 0:
                estimated_cause = "Estimated Open Flame"
            else:
                estimated_cause = "Estimated General Context"

            # 4. Observed Behaviour (Measurable)
            if has_persistence:
                if len(prior_incidents) >= 2:
                    observed_behaviour = "Growing Threat Area"
                else:
                    observed_behaviour = "Persistent Detection"
            elif num_detections >= 3:
                observed_behaviour = "Multiple Fire Regions"
            elif detection_type == "fire_and_smoke":
                observed_behaviour = "Active Fire & Smoke"
            elif detection_type == "fire":
                observed_behaviour = "Established Flame" if confidence >= 0.80 else "Active Combustion"
            elif detection_type == "smoke":
                observed_behaviour = "Dense Smoke" if confidence >= 0.80 else "Localized Smoke"
            else:
                observed_behaviour = "Active Signal"

            # 5. Explainability Bullet Points (Newline separated)
            explanations = []
            if any(d.get("class_name") == "fire" for d in detections):
                explanations.append("Fire pattern detected")
            if any(d.get("class_name") == "smoke" for d in detections):
                explanations.append("Smoke detected")
            explanations.append(f"Confidence exceeded configured threshold ({confidence * 100:.1f}%)")
            if has_persistence:
                explanations.append("Detection persisted across consecutive frames")
            if num_detections > 1:
                explanations.append(f"Multiple threat regions identified in frame (count: {num_detections})")
            
            explanation_str = "\n".join(explanations)

            # 6. Recommended Emergency Actions (Newline separated)
            actions = ["Evacuate nearby personnel immediately."]
            if "Electrical" in estimated_cause:
                actions.append("Disconnect electrical mains if safe.")
            elif "Kitchen" in estimated_cause:
                actions.append("Disconnect gas lines and switch off kitchen appliances if safe.")
            actions.append("Silence local alarms if false alarm, otherwise sound evacuation signal.")
            actions.append("Use appropriate class fire extinguisher.")
            if severity in ["HIGH", "CRITICAL"]:
                actions.append("Contact emergency services.")
            actions.append("Do not use elevators.")

            recommended_actions_str = "\n".join(actions)

            # 7. AI Incident Summary
            cause_detail = "an electrical room origin" if "Electrical" in estimated_cause else (
                "a kitchen/breakroom origin" if "Kitchen" in estimated_cause else (
                    "an open flame" if "Open Flame" in estimated_cause else "a general context source"
                )
            )
            persistence_text = "over consecutive frames" if has_persistence else "in the current frame"
            
            summary = (
                f"The system detected {detection_type.replace('_', ' ')} with "
                f"{confidence * 100:.1f}% confidence {persistence_text}. Based on the observed "
                f"visual evidence, this incident has been classified as {severity} severity. "
                f"Predefined context rules suggest {cause_detail}. "
                f"Immediate inspection and appropriate emergency response procedures are recommended."
            )

            # Update Incident
            incident.severity = severity
            incident.estimated_cause = estimated_cause
            incident.observed_behaviour = observed_behaviour
            incident.explanation = explanation_str
            incident.recommended_actions = recommended_actions_str
            incident.ai_summary = summary
            
            self._repo.update(incident)
            self._repo.commit()
            
            logger.info("Generated intelligence for incident #%d: severity=%s, cause=%s, behaviour=%s",
                        incident.id, severity, estimated_cause, observed_behaviour)
            return incident
        except Exception:
            logger.exception("Failed to analyze incident #%d with intelligence engine", incident_id)
            return None
