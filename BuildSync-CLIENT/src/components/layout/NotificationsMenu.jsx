import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuBell,
  LuBellRing,
  LuCheckCheck,
  LuCircle,
  LuInfo,
  LuLoader2,
  LuTrash2,
  LuX,
} from "react-icons/lu";
import {
  useDeleteNotificationMutation,
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from "../../services/api/endpoints/platformApi";
import { getErrorMessage } from "../../lib/api";

const timeAgo = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

const TYPE_STYLES = {
  Approval: "bg-warning-100 text-warning-700",
  Assignment: "bg-accent-100 text-accent-700",
  Finance: "bg-success-100 text-success-700",
  Safety: "bg-danger-100 text-danger-700",
  Inventory: "bg-info-100 text-info-700",
  System: "bg-concrete-100 text-concrete-600",
  Info: "bg-navy-100 text-navy-700",
};

const NotificationsMenu = () => {
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const { data: unread = 0 } = useGetUnreadCountQuery();
  const {
    data,
    isLoading,
    isFetching,
    refetch,
  } = useGetNotificationsQuery({ limit: 30 }, { skip: !open });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead, markAllState] = useMarkAllNotificationsReadMutation();
  const [deleteNotification] = useDeleteNotificationMutation();

  const notifications = data?.notifications ?? [];

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const openNotification = (notification) => {
    if (!notification.readAt) {
      markRead(notification._id).unwrap().catch(() => {});
    }
    setOpen(false);
    if (notification.link && String(notification.link).startsWith("/")) {
      navigate(notification.link);
    }
  };

  const dismiss = async (event, id) => {
    event.stopPropagation();
    setError("");
    try {
      await deleteNotification(id).unwrap();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "The notification could not be dismissed."));
    }
  };

  const markAll = async () => {
    setError("");
    try {
      await markAllRead().unwrap();
    } catch (markError) {
      setError(getErrorMessage(markError, "Notifications could not be updated."));
    }
  };

  return (
    <div ref={panelRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          setError("");
        }}
        aria-label={unread ? `${unread} unread notifications` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-concrete-500 transition-colors hover:bg-concrete-100 hover:text-navy-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400"
      >
        {unread ? (
          <LuBellRing className="h-5 w-5" aria-hidden="true" />
        ) : (
          <LuBell className="h-5 w-5" aria-hidden="true" />
        )}
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-danger-600 px-1 font-display text-2xs font-bold leading-4 text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-concrete-200 bg-white shadow-popover"
        >
          <div className="flex items-center justify-between gap-2 border-b border-concrete-200 px-4 py-3">
            <div>
              <p className="font-display text-sm font-semibold uppercase tracking-wide text-navy-900">
                Notifications
              </p>
              <p className="text-xs text-concrete-500">
                {unread ? `${unread} unread` : "You're all caught up"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAll}
                  disabled={markAllState.isLoading}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 font-display text-2xs font-semibold uppercase tracking-wide text-accent-700 transition-colors hover:bg-accent-50 disabled:opacity-50"
                >
                  {markAllState.isLoading ? (
                    <LuLoader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  ) : (
                    <LuCheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Mark all
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
                className="rounded p-1 text-concrete-400 hover:bg-concrete-100 hover:text-navy-800"
              >
                <LuX className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="border-b border-danger-100 bg-danger-50 px-4 py-2 text-xs text-danger-700">
              {error}
            </p>
          )}

          {isLoading ? (
            <div className="flex items-center gap-2 px-4 py-8 text-sm text-concrete-500">
              <LuLoader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading notifications…
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <LuInfo className="mx-auto h-6 w-6 text-concrete-300" aria-hidden="true" />
              <p className="mt-2 font-display text-sm font-semibold text-navy-800">
                Nothing here yet
              </p>
              <p className="mt-1 text-xs text-concrete-500">
                Approvals, assignments and payment updates will appear here.
              </p>
            </div>
          ) : (
            <ul className="max-h-96 divide-y divide-concrete-100 overflow-y-auto">
              {notifications.map((notification) => (
                <li key={notification._id} className="relative">
                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                    className={`flex w-full items-start gap-2.5 px-4 py-3 pr-11 text-left transition-colors hover:bg-concrete-50 ${
                      notification.readAt ? "bg-white" : "bg-accent-50/40"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-2xs font-semibold ${
                        TYPE_STYLES[notification.type] || TYPE_STYLES.Info
                      }`}
                    >
                      {notification.type === "Finance" ? "₹" : notification.type?.slice(0, 2).toUpperCase() || "IN"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start gap-1.5">
                        {!notification.readAt && (
                          <LuCircle className="mt-1 h-2 w-2 shrink-0 fill-accent-500 text-accent-500" aria-label="Unread" />
                        )}
                        <span className="font-display text-sm font-semibold leading-snug text-navy-900">
                          {notification.title}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-concrete-600">
                        {notification.message}
                      </span>
                      <span className="mt-1 block text-2xs uppercase tracking-wide text-concrete-400">
                        {timeAgo(notification.createdAt)}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(event) => dismiss(event, notification._id)}
                    aria-label="Dismiss notification"
                    className="absolute right-2 top-3 rounded p-1.5 text-concrete-300 transition-colors hover:bg-danger-50 hover:text-danger-600"
                  >
                    <LuTrash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {isFetching && !isLoading && (
            <div className="border-t border-concrete-100 px-4 py-2 text-right">
              <button
                type="button"
                onClick={refetch}
                className="font-display text-2xs font-semibold uppercase tracking-wide text-concrete-400 hover:text-navy-700"
              >
                Refresh
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationsMenu;
