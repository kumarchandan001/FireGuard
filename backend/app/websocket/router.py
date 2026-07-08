"""
FireGuard AI — WebSocket Route

Single WebSocket endpoint for real-time communication.
Handles client connections and dispatches control commands.
"""

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.websocket.manager import ConnectionManager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket"])

# Singleton connection manager — set during app startup
_ws_manager: ConnectionManager | None = None
_alarm_service = None
_detection_service = None


def set_ws_dependencies(ws_manager, alarm_service=None, detection_service=None):
    global _ws_manager, _alarm_service, _detection_service
    _ws_manager = ws_manager
    _alarm_service = alarm_service
    _detection_service = detection_service


@router.websocket("/ws/feed")
async def websocket_feed(websocket: WebSocket):
    """
    Main WebSocket endpoint for real-time camera feed and events.

    Server → Client: frame, alarm, status, incident messages
    Client → Server: command messages (start_camera, acknowledge_alarm, etc.)
    """
    if _ws_manager is None:
        await websocket.close(code=1011, reason="Server not ready")
        return

    await _ws_manager.connect(websocket)

    try:
        # Send initial state
        if _alarm_service is not None:
            await _ws_manager.send_json(websocket, {
                "type": "alarm",
                "data": _alarm_service.state_dict,
            })

        # Listen for client commands
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                await _handle_client_command(message, websocket)
            except json.JSONDecodeError:
                logger.warning("Invalid JSON from WebSocket client: %s", data[:100])

    except WebSocketDisconnect:
        _ws_manager.disconnect(websocket)
    except Exception:
        logger.exception("WebSocket error")
        _ws_manager.disconnect(websocket)


async def _handle_client_command(message: dict, websocket: WebSocket) -> None:
    """Process a command from a WebSocket client."""
    msg_type = message.get("type")
    action = message.get("action")

    if msg_type != "command" or not action:
        return

    logger.debug("WebSocket command: %s", action)

    if action == "acknowledge_alarm" and _alarm_service:
        await _alarm_service.acknowledge()

    elif action == "dismiss_alarm" and _alarm_service:
        await _alarm_service.dismiss()

    elif action == "start_camera" and _detection_service:
        # Camera start is handled via REST — but accept it here too
        pass

    elif action == "stop_camera" and _detection_service:
        pass

    else:
        logger.warning("Unknown WebSocket command: %s", action)
