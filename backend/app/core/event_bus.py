"""
FireGuard AI — Internal Event Bus

Lightweight in-process publish/subscribe system for decoupled
module-to-module communication. Each module can publish events
without knowing which modules consume them.

Design:
- Async handlers for non-blocking event processing
- Error isolation: one handler failure doesn't block others
- Type-safe event definitions via dataclass

Future: Replace with Redis Pub/Sub or RabbitMQ when
decomposing into microservices.
"""

import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Coroutine

from app.core.utils import utc_now

logger = logging.getLogger(__name__)

# Type alias for async event handler functions
EventHandler = Callable[["Event"], Coroutine[Any, Any, None]]


@dataclass(frozen=True)
class Event:
    """
    Base event structure for all internal events.

    Attributes:
        name: Event identifier (e.g., "detection.fire_detected")
        data: Arbitrary payload dictionary
        timestamp: When the event was created (UTC)
    """

    name: str
    data: dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=utc_now)


class EventBus:
    """
    Simple async publish/subscribe event bus.

    Usage:
        bus = EventBus()

        async def on_detection(event: Event):
            print(event.data)

        bus.subscribe("detection.fire_detected", on_detection)
        await bus.publish(Event(name="detection.fire_detected", data={...}))
    """

    def __init__(self) -> None:
        self._handlers: dict[str, list[EventHandler]] = defaultdict(list)
        self._event_count: int = 0

    def subscribe(self, event_name: str, handler: EventHandler) -> None:
        """Register a handler for a specific event type."""
        if handler not in self._handlers[event_name]:
            self._handlers[event_name].append(handler)
            logger.debug("Subscribed handler '%s' to event '%s'", handler.__name__, event_name)

    def unsubscribe(self, event_name: str, handler: EventHandler) -> None:
        """Remove a handler from a specific event type."""
        handlers = self._handlers.get(event_name, [])
        if handler in handlers:
            handlers.remove(handler)
            logger.debug("Unsubscribed handler '%s' from event '%s'", handler.__name__, event_name)

    async def publish(self, event: Event) -> None:
        """
        Publish an event to all subscribed handlers.

        Handlers are executed sequentially to allow event decoration/enrichment.
        Errors in individual handlers are logged but do not block other handlers.
        """
        handlers = self._handlers.get(event.name, [])
        if not handlers:
            return

        self._event_count += 1
        logger.debug(
            "Publishing event '%s' to %d handler(s) [total events: %d]",
            event.name,
            len(handlers),
            self._event_count,
        )

        for handler in handlers:
            await self._safe_invoke(handler, event)

    @property
    def total_events_published(self) -> int:
        """Total number of events published since startup."""
        return self._event_count

    @staticmethod
    async def _safe_invoke(handler: EventHandler, event: Event) -> None:
        """Invoke a handler with error isolation."""
        try:
            await handler(event)
        except Exception:
            logger.exception(
                "Event handler '%s' failed for event '%s'",
                handler.__name__,
                event.name,
            )
