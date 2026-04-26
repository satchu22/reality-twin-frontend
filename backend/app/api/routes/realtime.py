"""Realtime websocket routes."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ...services.realtime_service import realtime_manager

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """Keep a websocket connection open for realtime UI updates."""

    await realtime_manager.connect(websocket)

    try:
        while True:
            # Read client messages to keep the connection alive.
            await websocket.receive_text()
    except WebSocketDisconnect:
        realtime_manager.disconnect(websocket)
    except Exception:
        realtime_manager.disconnect(websocket)
