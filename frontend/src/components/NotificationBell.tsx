import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useGame } from "../contexts/GameContext";
import { playSound } from "../utils/sounds";
import api from "../config/api";
import { Bell } from "lucide-react";
import "./NotificationBell.css";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

// Give each notification kind a distinct sensory signature
const SOUND_BY_TYPE: Record<string, string> = {
  BATTLE_ATTACK: "battle_lose",   // you're under attack — alarm
  BATTLE_DEFENSE: "battle_win",   // your defense report
  MARKET_SOLD: "trade",
  MARKET_BOUGHT: "trade",
  LEVEL_UP: "achievement",
  ELECTION_RESULT: "achievement",
  ELECTION_NEW: "notification",
  CITY_PRODUCTION: "notification",
  CITY_HAPPINESS: "notification",
  SYSTEM: "notification",
};

const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useGame();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [redFlash, setRedFlash] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial load + a slow poll that only acts as a reconnect-safety resync;
    // real-time delivery now comes from the socket below.
    if (user) fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Real-time push: the server emits 'notification' to this user's room the instant
  // something happens (sale, attack, level-up...). No more waiting up to 30s.
  useEffect(() => {
    if (!socket) return;
    const handle = (payload: Omit<Notification, "read">) => {
      const incoming: Notification = { ...payload, read: false };
      setNotifications(prev => [incoming, ...prev].slice(0, 20));
      setUnreadCount(c => c + 1);
      playSound(SOUND_BY_TYPE[incoming.type] || "notification");
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
      if (incoming.type === "BATTLE_ATTACK") {
        setRedFlash(true);
        setTimeout(() => setRedFlash(false), 900);
      }
    };
    socket.on("notification", handle);
    return () => { socket.off("notification", handle); };
  }, [socket]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get("/notifications?limit=20");
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unreadCount);
    } catch (err) {
      // silently fail
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {}
  };

  const markAllRead = async () => {
    try {
      await api.put("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {}
  };

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (!user) return null;

  return (
    <div className="notification-bell" ref={dropdownRef}>
      {redFlash && <div className="screen-attack-flash" />}
      <button className={`bell-btn ${pulse ? "bell-pulse" : ""}`} onClick={() => setIsOpen(!isOpen)}>
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className={`badge ${pulse ? "badge-pop" : ""}`}>{unreadCount > 99 ? "99+" : unreadCount}</span>
        )}
      </button>
      {isOpen && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <strong>Notifications</strong>
            {unreadCount > 0 && (
              <button className="mark-all" onClick={markAllRead}>Mark all read</button>
            )}
          </div>
          <div className="notif-list">
            {notifications.length === 0 ? (
              <div className="notif-empty">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`notif-item ${!n.read ? "unread" : ""}`}
                  onClick={() => !n.read && markAsRead(n.id)}
                >
                  <div className="notif-title">{n.title}</div>
                  <div className="notif-msg">{n.message}</div>
                  <div className="notif-time">{timeAgo(n.createdAt)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
