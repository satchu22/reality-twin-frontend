"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { buildApiUrl } from "@/lib/api";
import { useRealtime } from "@/components/RealtimeProvider";

const OVERDUE_NOTIFICATION_MESSAGE = "Payment overdue — please take action";
const NOTIFICATION_REFRESH_EVENT = "notifications:refresh";

type Notification = {
  id: number;
  user_id: number;
  message: string;
  type: "info" | "warning" | "critical";
  is_read: boolean;
  created_at: string;
};

type NotificationBellProps = {
  userId: number;
};

export default function NotificationBell({
  userId,
}: NotificationBellProps) {
  const { isPollingFallback, latestNotification, latestTransactionUpdate, pollTick } =
    useRealtime();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<
    number[]
  >([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchNotifications() {
    setLoading(true);

    try {
      const response = await fetch(
        buildApiUrl(`/notifications?user_id=${userId}`),
      );

      if (!response.ok) {
        throw new Error("Failed to load notifications");
      }

      const data: Notification[] = await response.json();
      setNotifications(
        data.filter(
          (notification) => !dismissedNotificationIds.includes(notification.id),
        ),
      );
      setError(null);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load notifications",
      );
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(notificationId: number) {
    try {
      const response = await fetch(
        buildApiUrl(`/notifications/${notificationId}/read`),
        {
          method: "PATCH",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to mark notification as read");
      }

      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) =>
          notification.id === notificationId
            ? { ...notification, is_read: true }
            : notification,
        ),
      );
    } catch (markReadError) {
      setError(
        markReadError instanceof Error
          ? markReadError.message
          : "Failed to mark notification as read",
      );
    }
  }

  const refreshNotifications = useEffectEvent(() => {
    void fetchNotifications();
  });

  const dismissOverdueNotifications = useEffectEvent(() => {
    setNotifications((currentNotifications) => {
      const overdueNotificationIds = currentNotifications
        .filter(
          (notification) =>
            notification.message === OVERDUE_NOTIFICATION_MESSAGE,
        )
        .map((notification) => notification.id);

      if (overdueNotificationIds.length === 0) {
        return currentNotifications;
      }

      setDismissedNotificationIds((currentDismissedIds) => [
        ...new Set([...currentDismissedIds, ...overdueNotificationIds]),
      ]);

      return currentNotifications.filter(
        (notification) => notification.message !== OVERDUE_NOTIFICATION_MESSAGE,
      );
    });
  });

  useEffect(() => {
    refreshNotifications();
  }, [userId]);

  useEffect(() => {
    if (!isPollingFallback || pollTick === 0) {
      return;
    }

    refreshNotifications();
  }, [isPollingFallback, pollTick]);

  useEffect(() => {
    if (!latestNotification || latestNotification.user_id !== userId) {
      return;
    }

    refreshNotifications();
  }, [latestNotification, userId]);

  useEffect(() => {
    if (!latestTransactionUpdate) {
      return;
    }

    refreshNotifications();
  }, [latestTransactionUpdate]);

  useEffect(() => {
    function handleNotificationRefresh(event: Event) {
      const customEvent = event as CustomEvent<{ dismissOverdue?: boolean }>;

      if (customEvent.detail?.dismissOverdue) {
        dismissOverdueNotifications();
        return;
      }

      refreshNotifications();
    }

    window.addEventListener(
      NOTIFICATION_REFRESH_EVENT,
      handleNotificationRefresh as EventListener,
    );

    return () => {
      window.removeEventListener(
        NOTIFICATION_REFRESH_EVENT,
        handleNotificationRefresh as EventListener,
      );
    };
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications],
  );

  return (
    <div className="fixed right-6 top-6 z-50">
      <button
        type="button"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-slate-900/90 text-white shadow-xl backdrop-blur transition hover:bg-slate-800"
        aria-label="Open notifications"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
          <path d="M10 21a2.5 2.5 0 0 0 4 0" />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-emerald-400 px-1 text-xs font-bold text-slate-950">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="mt-3 w-[24rem] rounded-3xl border border-white/10 bg-slate-950/95 p-4 text-white shadow-2xl backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Notifications</h2>
              <p className="text-xs text-slate-400">
                {isPollingFallback
                  ? "Polling every 10 seconds"
                  : "Live updates enabled"}
              </p>
            </div>
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
              {notifications.length} total
            </span>
          </div>

          {error && (
            <div className="mb-3 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {loading && notifications.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-400">
              Loading notifications...
            </div>
          ) : (
            <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1">
              {notifications.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-400">
                  No notifications yet.
                </div>
              )}

              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`rounded-2xl border px-4 py-4 transition ${
                    notification.is_read
                      ? "border-white/10 bg-white/5"
                      : "border-cyan-400/30 bg-cyan-400/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {notification.message}
                      </p>
                      <p className="mt-2 text-xs text-slate-400">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                        notification.is_read
                          ? "bg-white/10 text-slate-300"
                          : "bg-emerald-400 text-slate-950"
                      }`}
                    >
                      {notification.is_read ? "Read" : "Unread"}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs capitalize text-slate-400">
                      {notification.type}
                    </span>

                    {!notification.is_read && (
                      <button
                        type="button"
                        onClick={() => markAsRead(notification.id)}
                        className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/10"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
