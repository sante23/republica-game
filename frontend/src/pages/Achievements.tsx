import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';
import { ArrowLeft, Trophy, Lock, Star } from 'lucide-react';
import './Achievements.css';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  xp: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

const ICON_MAP: Record<string, string> = {
  building: 'building', hammer: 'hammer', coins: 'coins', sword: 'sword',
  vote: 'vote', beaker: 'beaker', handshake: 'handshake', eye: 'eye',
  users: 'users', star: 'star', crown: 'crown', map: 'map', award: 'award'
};

const Achievements: React.FC = () => {
  const navigate = useNavigate();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAchievements();
  }, []);

  const fetchAchievements = async () => {
    try {
      // Check for new achievements first
      await api.post('/achievements/check');
      const res = await api.get('/achievements/my');
      setAchievements(res.data);
    } catch (err) {
      console.error('Failed to fetch achievements:', err);
    } finally {
      setLoading(false);
    }
  };

  const unlocked = achievements.filter(a => a.unlocked);
  const locked = achievements.filter(a => !a.unlocked);
  const progress = achievements.length > 0 ? Math.round((unlocked.length / achievements.length) * 100) : 0;

  return (
    <div className="achievements-page">
      <header className="achievements-header">
        <button onClick={() => navigate('/')} className="back-button">
          <ArrowLeft /> Back
        </button>
        <h1><Trophy size={28} /> Achievements</h1>
      </header>

      <div className="achievements-summary">
        <div className="summary-stat">
          <span className="summary-number">{unlocked.length}</span>
          <span className="summary-label">Unlocked</span>
        </div>
        <div className="summary-stat">
          <span className="summary-number">{achievements.length}</span>
          <span className="summary-label">Total</span>
        </div>
        <div className="summary-stat">
          <span className="summary-number">{progress}%</span>
          <span className="summary-label">Complete</span>
        </div>
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading achievements...</div>
      ) : (
        <>
          {unlocked.length > 0 && (
            <section className="achievement-section">
              <h2>Unlocked</h2>
              <div className="achievements-grid">
                {unlocked.map(a => (
                  <div key={a.id} className="achievement-card unlocked">
                    <div className="achievement-icon"><Star size={24} /></div>
                    <div className="achievement-info">
                      <h3>{a.name}</h3>
                      <p>{a.description}</p>
                      {a.xp > 0 && <span className="achievement-xp">+{a.xp} XP</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {locked.length > 0 && (
            <section className="achievement-section">
              <h2>Locked</h2>
              <div className="achievements-grid">
                {locked.map(a => (
                  <div key={a.id} className="achievement-card locked">
                    <div className="achievement-icon"><Lock size={24} /></div>
                    <div className="achievement-info">
                      <h3>{a.name}</h3>
                      <p>{a.description}</p>
                      {a.xp > 0 && <span className="achievement-xp">+{a.xp} XP</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default Achievements;
