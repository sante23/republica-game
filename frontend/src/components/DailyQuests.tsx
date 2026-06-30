import React, { useEffect, useState } from 'react';
import api from '../config/api';
import { useToast } from '../contexts/ToastContext';
import { Target, Gift, CheckCircle } from 'lucide-react';
import './DailyQuests.css';

interface Quest {
  id: string;
  title: string;
  description: string;
  progress: number;
  required: number;
  completed: boolean;
  rewardClaimed: boolean;
  reward: { gold?: number; xp?: number };
  expiresAt: string;
}

const DailyQuests: React.FC = () => {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    fetchQuests();
    const interval = setInterval(fetchQuests, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchQuests = async () => {
    try {
      const response = await api.get('/quests/daily');
      setQuests(response.data);
    } catch (error) {
      console.error('Error fetching quests:', error);
    } finally {
      setLoading(false);
    }
  };

  const claimReward = async (questId: string) => {
    try {
      await api.post(`/quests/claim/${questId}`);
      fetchQuests();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to claim reward');
    }
  };

  if (loading) return null;

  const expiresIn = quests.length > 0
    ? Math.max(0, Math.floor((new Date(quests[0].expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)))
    : 0;

  return (
    <div className="daily-quests">
      <div className="dq-header">
        <h3><Target size={16} /> Daily Quests</h3>
        <span className="dq-timer">Resets in {expiresIn}h</span>
      </div>
      <div className="dq-list">
        {quests.map(quest => (
          <div
            key={quest.id}
            className={`dq-item ${quest.completed ? 'dq-done' : ''} ${quest.rewardClaimed ? 'dq-claimed' : ''}`}
          >
            <div className="dq-info">
              <div className="dq-title">{quest.title}</div>
              <div className="dq-desc">{quest.description}</div>
              <div className="dq-progress-bar">
                <div
                  className="dq-progress-fill"
                  style={{ width: `${Math.min(100, (quest.progress / quest.required) * 100)}%` }}
                />
              </div>
              <div className="dq-progress-text">{quest.progress}/{quest.required}</div>
            </div>
            <div className="dq-reward">
              {quest.rewardClaimed ? (
                <CheckCircle size={20} className="dq-check" />
              ) : quest.completed ? (
                <button className="dq-claim-btn" onClick={() => claimReward(quest.id)}>
                  <Gift size={14} /> Claim
                </button>
              ) : (
                <div className="dq-reward-preview">
                  {quest.reward.gold && <span>{quest.reward.gold} G</span>}
                  {quest.reward.xp && <span>{quest.reward.xp} XP</span>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DailyQuests;
