"""
FireGuard AI — YOLOv8 Fire/Smoke Detector

Wraps the Ultralytics YOLOv8 model for fire and smoke detection.
Handles model loading, inference, and result parsing.
"""

import logging
import time
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from ultralytics import YOLO  # type: ignore

logger = logging.getLogger(__name__)

# Class name mapping — the fire detection model uses these class IDs
FIRE_CLASSES = {0: "fire", 1: "smoke"}


@dataclass(frozen=True)
class Detection:
    """A single detection result from the AI model."""

    class_name: str  # "fire" or "smoke"
    confidence: float  # 0.0 — 1.0
    bbox: tuple[int, int, int, int]  # x1, y1, x2, y2


@dataclass
class DetectionResult:
    """Complete result from processing a single frame."""

    detections: list[Detection] = field(default_factory=list)
    frame_id: int = 0
    timestamp: str = ""
    inference_time_ms: float = 0.0

    @property
    def has_fire(self) -> bool:
        return any(d.class_name == "fire" for d in self.detections)

    @property
    def has_smoke(self) -> bool:
        return any(d.class_name == "smoke" for d in self.detections)

    @property
    def has_detection(self) -> bool:
        return len(self.detections) > 0

    @property
    def max_confidence(self) -> float:
        if not self.detections:
            return 0.0
        return max(d.confidence for d in self.detections)

    @property
    def detection_type(self) -> str:
        """Determine the overall detection type."""
        if self.has_fire and self.has_smoke:
            return "fire_and_smoke"
        if self.has_fire:
            return "fire"
        if self.has_smoke:
            return "smoke"
        return "none"


class FireDetector:
    """
    YOLOv8-based fire and smoke detector.

    Loads the model on initialization and provides a detect()
    method for running inference on individual frames.

    Usage:
        detector = FireDetector("models/yolov8n_fire.pt")
        result = detector.detect(frame)
        if result.has_fire:
            print(f"Fire detected: {result.max_confidence:.0%}")
    """

    def __init__(
        self,
        model_path: str,
        confidence_threshold: float = 0.65,
        device: str | None = None,
    ):
        self._model_path = model_path
        self._confidence_threshold = confidence_threshold
        self._model = None
        self._device = device
        self._frame_counter = 0

        self._load_model()

    def _load_model(self) -> None:
        """Load the YOLOv8 model from disk."""
        model_path = Path(self._model_path)

        if not model_path.exists():
            # If the custom fire model doesn't exist, fall back to base YOLOv8n
            # The base model detects 80 COCO classes — not ideal but functional
            logger.warning(
                "Fire detection model not found at '%s'. "
                "Downloading base YOLOv8n model as fallback. "
                "For production, provide a fire-specific model.",
                self._model_path,
            )
            self._model = YOLO("yolov8n.pt")
            self._using_fallback = True
        else:
            self._model = YOLO(str(model_path))
            self._using_fallback = False

        # Auto-select device
        if self._device is None:
            import torch

            self._device = "cuda" if torch.cuda.is_available() else "cpu"

        logger.info(
            "AI model loaded: path=%s, device=%s, threshold=%.2f, fallback=%s",
            model_path.name if model_path.exists() else "yolov8n.pt",
            self._device,
            self._confidence_threshold,
            self._using_fallback,
        )

    def detect(self, frame: np.ndarray) -> DetectionResult:
        """
        Run fire/smoke detection on a single frame.

        Args:
            frame: BGR image as numpy array (from OpenCV)

        Returns:
            DetectionResult with all detections above the confidence threshold
        """
        self._frame_counter += 1
        start_time = time.monotonic()

        # Run inference
        results = self._model.predict(
            source=frame,
            conf=self._confidence_threshold,
            device=self._device,
            verbose=False,
            stream=False,
        )

        inference_time = (time.monotonic() - start_time) * 1000  # ms

        # Parse results
        detections = self._parse_results(results)

        from app.core.utils import format_timestamp, utc_now

        return DetectionResult(
            detections=detections,
            frame_id=self._frame_counter,
            timestamp=format_timestamp(utc_now()),
            inference_time_ms=round(inference_time, 1),
        )

    def _parse_results(self, results: list) -> list[Detection]:
        """Parse YOLO results into Detection objects."""
        detections: list[Detection] = []

        if not results or len(results) == 0:
            return detections

        result = results[0]  # Single image, single result

        if result.boxes is None or len(result.boxes) == 0:
            return detections

        for box in result.boxes:
            class_id = int(box.cls[0])
            confidence = float(box.conf[0])
            x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]

            # Map class ID to our fire/smoke classes
            if self._using_fallback:
                # Base YOLOv8n COCO classes — no fire/smoke classes.
                # No automatic mappings are applied to prevent false alarms from everyday objects.
                # Use the 'Developer Threat Simulator' buttons in the dashboard status panel to simulate alerts.
                coco_class_name = result.names.get(class_id, f"class_{class_id}")
                class_name = coco_class_name
            else:
                class_name = FIRE_CLASSES.get(class_id, f"class_{class_id}")

            # Only include fire and smoke detections
            if class_name in ("fire", "smoke"):
                detections.append(
                    Detection(
                        class_name=class_name,
                        confidence=round(confidence, 4),
                        bbox=(x1, y1, x2, y2),
                    )
                )

        return detections

    def update_threshold(self, new_threshold: float) -> None:
        """Update the confidence threshold at runtime (from settings)."""
        self._confidence_threshold = max(0.1, min(1.0, new_threshold))
        logger.info("Detection threshold updated to %.2f", self._confidence_threshold)

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    @property
    def using_fallback(self) -> bool:
        return getattr(self, "_using_fallback", False)

    @property
    def device(self) -> str:
        return self._device or "cpu"
