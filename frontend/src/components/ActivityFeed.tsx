import React, { useEffect, useState } from 'react';
import api from '../config/api';
import { Zap } from 'lucide-react';
import './ActivityFeed.css';

interface Activity {
  id: string;
  type: string;
  title: string;
  description?: string;
  createdAt: string;
  actor?: { username: string };
}

const TYPE_ICONS: Record<string, string> = {
  battle: '⚔️',
  election: '🗳️',
  trade: '💰',
  alliance: '🤝',
  policy: '📜',
  event: '🌍',
  achievement: '🏆',
  city_founded: '🏗️',
  quest: '📋',
};

const ActivityFeed: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
    const interval = setInterval(fetchActivities, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchActivities = async () => {
    try {
      const response = await api.get('/activity/feed?limit=15');
      setActivities(response.data);
    } catch (error) {
      console.error('Error fetching activity feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (loading) return null;
  if (activities.length === 0) return null;

  return (
    <div className="activity-feed">
      <h3><Zap size={16} /> World Activity</h3>
      <div className="feed-list">
        {activities.map(activity => (
          <div key={activity.id} className="feed-item">
            <span className="feed-icon">{TYPE_ICONS[activity.type] || '📌'}</span>
            <div className="feed-content">
              <span className="feed-title">{activity.title}</span>
              <span className="feed-time">{timeAgo(activity.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityFeed;
