"use client";

import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildWebSocketUrl } from "@/lib/api";

import type {
  RealtimeMessage,
  RealtimeNotification,
  RealtimeRouteUpdate,
  RealtimeSimulationUpdate,
  RealtimeStatus,
  RealtimeTransactionUpdate,
} from "@/lib/realtime";

type RealtimeContextValue = {
  status: RealtimeStatus;
  isPollingFallback: boolean;
  pollTick: number;
  latestNotification: RealtimeNotification | null;
  latestSimulationUpdate: RealtimeSimulationUpdate | null;
  latestRouteUpdate: RealtimeRouteUpdate | null;
  latestTransactionUpdate: RealtimeTransactionUpdate | null;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export default function RealtimeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const fallbackIntervalRef = useRef<number | null>(null);
  const shouldReconnectRef = useRef(true);

  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const [pollTick, setPollTick] = useState(0);
  const [latestNotification, setLatestNotification] =
    useState<RealtimeNotification | null>(null);
  const [latestSimulationUpdate, setLatestSimulationUpdate] =
    useState<RealtimeSimulationUpdate | null>(null);
  const [latestRouteUpdate, setLatestRouteUpdate] =
    useState<RealtimeRouteUpdate | null>(null);
  const [latestTransactionUpdate, setLatestTransactionUpdate] =
    useState<RealtimeTransactionUpdate | null>(null);

  const stopPollingFallback = useEffectEvent(() => {
    if (fallbackIntervalRef.current !== null) {
      window.clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }
  });

  const startPollingFallback = useEffectEvent(() => {
    if (fallbackIntervalRef.current !== null) {
      return;
    }

    setStatus("polling");
    fallbackIntervalRef.current = window.setInterval(() => {
      setPollTick((currentTick) => currentTick + 1);
    }, 10_000);
  });

  const handleRealtimeMessage = useEffectEvent((message: RealtimeMessage) => {
    if (message.type === "notification") {
      setLatestNotification(message.data);
      return;
    }

    if (message.type === "simulation_update") {
      setLatestSimulationUpdate(message.data);
      return;
    }

    if (message.type === "route_update") {
      setLatestRouteUpdate(message.data);
      return;
    }

    if (message.type === "transaction_update") {
      setLatestTransactionUpdate(message.data);
    }
  });

  useEffect(() => {
    shouldReconnectRef.current = true;

    function scheduleReconnect() {
      if (!shouldReconnectRef.current || reconnectTimeoutRef.current !== null) {
        return;
      }

      setStatus("reconnecting");
      reconnectTimeoutRef.current = window.setTimeout(() => {
        reconnectTimeoutRef.current = null;
        connect();
      }, 3_000);
    }

    function connect() {
      stopPollingFallback();
      setStatus("connecting");

      try {
        const socket = new WebSocket(buildWebSocketUrl());
        socketRef.current = socket;

        socket.onopen = () => {
          stopPollingFallback();
          setStatus("connected");
        };

        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as RealtimeMessage;
            handleRealtimeMessage(message);
          } catch (error) {
            console.error("Failed to parse realtime message", error);
          }
        };

        socket.onclose = () => {
          if (socketRef.current === socket) {
            socketRef.current = null;
          }
          startPollingFallback();
          scheduleReconnect();
        };

        socket.onerror = () => {
          startPollingFallback();
          socket.close();
        };
      } catch (error) {
        console.error("Failed to connect to realtime websocket", error);
        startPollingFallback();
        scheduleReconnect();
      }
    }

    connect();

    return () => {
      shouldReconnectRef.current = false;
      stopPollingFallback();

      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }

      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []);

  const value = useMemo<RealtimeContextValue>(
    () => ({
      status,
      isPollingFallback: status === "polling",
      pollTick,
      latestNotification,
      latestSimulationUpdate,
      latestRouteUpdate,
      latestTransactionUpdate,
    }),
    [
      latestNotification,
      latestRouteUpdate,
      latestSimulationUpdate,
      latestTransactionUpdate,
      pollTick,
      status,
    ],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context = useContext(RealtimeContext);

  if (!context) {
    throw new Error("useRealtime must be used within RealtimeProvider");
  }

  return context;
}
