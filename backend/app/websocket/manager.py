"""
FireGuard AI — WebSocket Connection Manager

Manages WebSocket connections for real-time communication.
Handles connection lifecycle, message broadcasting, and
graceful disconnection.

Used for:
- Streaming camera frames with detection overlays
- Pushing alarm state changes
- Pushing system status updates
"""

import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages active WebSocket connections.

    Thread-safe for the asyncio event loop (single-threaded).
    Supports broadcasting to all connected clients.
    """

    def __init__(self) -> None:
        self._active_connections: list[WebSocket] = []

    @property
    def client_count(self) -> int:
        """Number of currently connected WebSocket clients."""
        return len(self._active_connections)

    async def connect(self, websocket: WebSocket) -> None:
        """Accept and register a new WebSocket connection."""
        await websocket.accept()
        self._active_connections.append(websocket)
        logger.info("WebSocket client connected [total: %d]", self.client_count)

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a disconnected WebSocket client."""
        if websocket in self._active_connections:
            self._active_connections.remove(websocket)
            logger.info("WebSocket client disconnected [total: %d]", self.client_count)

    async def broadcast_json(self, message: dict[str, Any]) -> None:
        """
        Send a JSON message to all connected clients.

        Silently removes clients that have disconnected
        (stale connections are cleaned up automatically).
        """
        disconnected: list[WebSocket] = []

        for connection in self._active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)

        # Cleanup stale connections
        for conn in disconnected:
            self.disconnect(conn)

    async def broadcast_bytes(self, data: bytes) -> None:
        """Send binary data to all connected clients."""
        disconnected: list[WebSocket] = []

        for connection in self._active_connections:
            try:
                await connection.send_bytes(data)
            except Exception:
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)

    async def send_json(self, websocket: WebSocket, message: dict[str, Any]) -> None:
        """Send a JSON message to a specific client."""
        try:
            await websocket.send_json(message)
        except Exception:
            self.disconnect(websocket)

    async def close_all(self) -> None:
        """Gracefully close all connections (used during shutdown)."""
        for connection in self._active_connections.copy():
            try:
                await connection.close()
            except Exception:
                pass
        self._active_connections.clear()
        logger.info("All WebSocket connections closed")
