"""
FireGuard AI — Base Service

Minimal base class for service layer components.
Provides logger initialization and a consistent interface.
"""

import logging


class BaseService:
    """
    Base class for all application services.

    Provides:
    - Automatic logger scoped to the service's module
    - Consistent interface for future cross-cutting concerns
      (e.g., audit logging, metrics, tracing)
    """

    def __init__(self) -> None:
        self.logger = logging.getLogger(self.__class__.__module__)
