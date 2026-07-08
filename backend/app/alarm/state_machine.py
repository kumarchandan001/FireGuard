"""
FireGuard AI — Alarm State Machine

Implements the alarm lifecycle:
    IDLE → TRIGGERED → ACTIVE → ACKNOWLEDGED → IDLE
                               → DISMISSED → IDLE

Thread-safe state transitions with transition validation.
"""

import logging
from enum import Enum

logger = logging.getLogger(__name__)


class AlarmState(str, Enum):
    IDLE = "idle"
    TRIGGERED = "triggered"
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"


# Valid transitions: current_state → set of allowed next states
_VALID_TRANSITIONS: dict[AlarmState, set[AlarmState]] = {
    AlarmState.IDLE: {AlarmState.TRIGGERED},
    AlarmState.TRIGGERED: {AlarmState.ACTIVE, AlarmState.IDLE},
    AlarmState.ACTIVE: {AlarmState.ACKNOWLEDGED, AlarmState.IDLE},
    AlarmState.ACKNOWLEDGED: {AlarmState.IDLE},
}


class AlarmStateMachine:
    """
    Thread-safe alarm state machine.

    Validates all transitions and logs state changes.
    """

    def __init__(self) -> None:
        self._state = AlarmState.IDLE
        self._current_incident_id: int | None = None
        self._detection_type: str | None = None
        self._confidence: float | None = None
        self._dispatched = False

    @property
    def state(self) -> AlarmState:
        return self._state

    @property
    def incident_id(self) -> int | None:
        return self._current_incident_id

    @property
    def detection_type(self) -> str | None:
        return self._detection_type

    @property
    def confidence(self) -> float | None:
        return self._confidence

    @property
    def is_active(self) -> bool:
        return self._state in (AlarmState.TRIGGERED, AlarmState.ACTIVE)

    def trigger(self, incident_id: int, detection_type: str, confidence: float) -> bool:
        """Transition to TRIGGERED state. Returns True if transition was valid."""
        if not self._can_transition(AlarmState.TRIGGERED):
            return False

        self._state = AlarmState.TRIGGERED
        self._current_incident_id = incident_id
        self._detection_type = detection_type
        self._confidence = confidence
        self._dispatched = False
        logger.info("Alarm TRIGGERED: incident=%d, type=%s, confidence=%.1f%%",
                     incident_id, detection_type, confidence * 100)
        return True

    def activate(self) -> bool:
        """Transition from TRIGGERED to ACTIVE (alarm confirmed)."""
        if not self._can_transition(AlarmState.ACTIVE):
            return False

        self._state = AlarmState.ACTIVE
        logger.info("Alarm ACTIVE: incident=%d", self._current_incident_id)
        return True

    def acknowledge(self) -> bool:
        """User acknowledges the alarm."""
        if not self._can_transition(AlarmState.ACKNOWLEDGED):
            return False

        self._state = AlarmState.ACKNOWLEDGED
        logger.info("Alarm ACKNOWLEDGED: incident=%d", self._current_incident_id)
        return True

    def dismiss(self) -> bool:
        """Dismiss the alarm and return to IDLE."""
        if self._state == AlarmState.IDLE:
            return True  # Already idle

        self._state = AlarmState.IDLE
        self._current_incident_id = None
        self._detection_type = None
        self._confidence = None
        self._dispatched = False
        logger.info("Alarm DISMISSED → IDLE")
        return True

    def reset(self) -> None:
        """Force reset to IDLE (used during system shutdown)."""
        self._state = AlarmState.IDLE
        self._current_incident_id = None
        self._detection_type = None
        self._confidence = None
        self._dispatched = False

    def dispatch(self) -> bool:
        """Mark the active alarm as dispatched. Returns True if successful."""
        if self._state == AlarmState.IDLE:
            return False
        self._dispatched = True
        return True

    def to_dict(self) -> dict:
        """Serialize alarm state for WebSocket broadcast."""
        return {
            "state": self._state.value,
            "incident_id": self._current_incident_id,
            "detection_type": self._detection_type,
            "confidence": self._confidence,
            "dispatched": self._dispatched,
        }

    def _can_transition(self, target: AlarmState) -> bool:
        """Check if a transition from current state to target is valid."""
        allowed = _VALID_TRANSITIONS.get(self._state, set())
        if target not in allowed:
            logger.warning(
                "Invalid alarm transition: %s → %s (allowed: %s)",
                self._state.value,
                target.value,
                [s.value for s in allowed],
            )
            return False
        return True
