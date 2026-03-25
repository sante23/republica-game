import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import api from '../config/api';
import './EventsBanner.css';

interface WorldEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  effects: Record<string, number>;
  endsAt: string;
}

const EVENT_ICONS: Record<string, string> = {
  famine: '🥀',
  gold_rush: '💰',
  plague: '🦠',
  trade_boom: '📈',
  rebellion: '✊',
  harvest: '🌾',
  earthquake: '🌋',
  festival: '🎉'
};

const EventsBanner: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useGame();
  const [events, setEvents] = useState<WorldEvent[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (user) loadEvents();
  }, [user]);

  useEffect(() => {
    if (!socket) return;
    const handleEvent = (event: WorldEvent) => {
      setEvents(prev => [event, ...prev]);
    };
    socket.on('world-event', handleEvent);
    return () => { socket.off('world-event', handleEvent); };
  }, [socket]);

  const loadEvents = async () => {
    try {
      const res = await api.get('/events/active');
      setEvents(res.data);
    } catch (err) {
      console.error('Failed to load events:', err);
    }
  };

  const getTimeLeft = (endsAt: string) => {
    const diff = new Date(endsAt).getTime() - Date.now();
    if (diff <= 0) return 'Ending...';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m left`;
  };

  if (events.length === 0) return null;

  return (
    <div className="events-banner">
      <div className="events-banner-header" onClick={() => setExpanded(!expanded)}>
        <span className="events-banner-icon">
          {EVENT_ICONS[events[0].type] || '⚡'}
        </span>
        <span className="events-banner-title">
          {events.length === 1 ? events[0].title : `${events.length} Active World Events`}
        </span>
        <span className="events-banner-toggle">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="events-banner-list">
          {events.map(event => (
            <div key={event.id} className={`events-banner-item event-type-${event.type}`}>
              <span className="event-icon">{EVENT_ICONS[event.type] || '⚡'}</span>
              <div className="event-details">
                <strong>{event.title}</strong>
                <p>{event.description}</p>
                <span className="event-timer">{getTimeLeft(event.endsAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventsBanner;
