"""Realtime websocket connection management and event broadcasting."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import WebSocket
from fastapi.encoders import jsonable_encoder


class RealtimeManager:
    """Track active websocket clients and broadcast JSON payloads."""

    def __init__(self) -> None:
        self._active_connections: list[WebSocket] = []
        self._loop: asyncio.AbstractEventLoop | None = None

    def set_event_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Store the app event loop so sync routes can dispatch broadcasts."""

        self._loop = loop

    async def connect(self, websocket: WebSocket) -> None:
        """Accept and track a websocket client."""

        await websocket.accept()
        self._active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a websocket client if it is still tracked."""

        if websocket in self._active_connections:
            self._active_connections.remove(websocket)

    async def broadcast(self, message: dict[str, Any]) -> None:
        """Send a JSON-safe payload to every active connection."""

        encoded_message = jsonable_encoder(message)
        disconnected_clients: list[WebSocket] = []

        for connection in list(self._active_connections):
            try:
                await connection.send_json(encoded_message)
            except Exception:
                disconnected_clients.append(connection)

        for connection in disconnected_clients:
            self.disconnect(connection)

    def broadcast_from_sync(self, message: dict[str, Any]) -> None:
        """Bridge sync service code into the async websocket broadcaster."""

        if self._loop is None or self._loop.is_closed():
            return

        asyncio.run_coroutine_threadsafe(self.broadcast(message), self._loop)


realtime_manager = RealtimeManager()


def broadcast_event(event_type: str, data: dict[str, Any]) -> None:
    """Broadcast a standard realtime event envelope."""

    realtime_manager.broadcast_from_sync(
        {
            "type": event_type,
            "data": data,
        }
    )
