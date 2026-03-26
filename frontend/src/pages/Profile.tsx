import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import api from '../config/api';
import { ArrowLeft, User, Star, Shield, Trophy, Building, Sword } from 'lucide-react';
import './Profile.css';

interface Achievement {
  id: string;
  name: string;
  unlocked: boolean;
}

interface BattleStats {
  wins: number;
  losses: number;
  total: number;
}

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cities } = useGame();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [battleStats, setBattleStats] = useState<BattleStats>({ wins: 0, losses: 0, total: 0 });

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      const [achRes, battleRes] = await Promise.all([
        api.get('/achievements/my'),
        api.get('/military/battles')
      ]);
      setAchievements(achRes.data);
      const battles = battleRes.data;
      const wins = battles.filter((b: any) =>
        (b.attackerId === user?.id && b.outcome === 'attacker_win') ||
        (b.defenderId === user?.id && b.outcome === 'defender_win')
      ).length;
      setBattleStats({ wins, losses: battles.length - wins, total: battles.length });
    } catch (err) {
      console.error('Failed to load profile data:', err);
    }
  };

  if (!user) return null;

  const xpRequired = user.level * 100 * 1.5;
  const xpProgress = (user.experience / xpRequired) * 100;
  const totalPop = cities.reduce((s, c) => s + c.population, 0);
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const isProtected = user.protectedUntil && new Date(user.protectedUntil) > new Date();

  return (
    <div className="profile-page">
      <header className="profile-header">
        <button onClick={() => navigate('/')} className="back-button"><ArrowLeft /> Back</button>
        <h1><User size={28} /> Player Profile</h1>
      </header>

      <div className="profile-card">
        <div className="profile-avatar">
          <div className="avatar-circle">
            <span>{user.username.charAt(0).toUpperCase()}</span>
          </div>
          <h2>{user.username}</h2>
          {isProtected && (
            <div className="profile-shield"><Shield size={14} /> Protected</div>
          )}
        </div>

        <div className="profile-stats-grid">
          <div className="profile-stat">
            <Star size={20} />
            <div>
              <span className="stat-val">Level {user.level}</span>
              <div className="xp-bar">
                <div className="xp-fill" style={{ width: `${xpProgress}%` }} />
              </div>
              <span className="stat-sub">{user.experience} / {xpRequired} XP</span>
            </div>
          </div>

          <div className="profile-stat">
            <span className="stat-icon">Credits</span>
            <span className="stat-val">{user.credits.toLocaleString()}</span>
          </div>

          <div className="profile-stat">
            <span className="stat-icon">Reputation</span>
            <span className="stat-val">{user.reputation}</span>
          </div>

          <div className="profile-stat">
            <Building size={20} />
            <div>
              <span className="stat-val">{cities.length} Cities</span>
              <span className="stat-sub">{totalPop.toLocaleString()} total pop.</span>
            </div>
          </div>

          <div className="profile-stat">
            <Sword size={20} />
            <div>
              <span className="stat-val">{battleStats.total} Battles</span>
              <span className="stat-sub">{battleStats.wins}W / {battleStats.losses}L</span>
            </div>
          </div>

          <div className="profile-stat">
            <Trophy size={20} />
            <div>
              <span className="stat-val">{unlockedCount} / {achievements.length}</span>
              <span className="stat-sub">Achievements</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cities list */}
      <section className="profile-section">
        <h3>Your Cities</h3>
        <div className="profile-cities">
          {cities.map(city => (
            <div key={city.id} className="profile-city" onClick={() => navigate(`/city/${city.id}`)}>
              <strong>{city.name}</strong>
              <span>Pop: {city.population.toLocaleString()}</span>
              <span>Happiness: {city.happiness}%</span>
            </div>
          ))}
        </div>
      </section>

      {/* Recent achievements */}
      <section className="profile-section">
        <h3>Achievements ({unlockedCount}/{achievements.length})</h3>
        <div className="profile-achievements">
          {achievements.filter(a => a.unlocked).map(a => (
            <span key={a.id} className="profile-ach unlocked">{a.name}</span>
          ))}
          {achievements.filter(a => !a.unlocked).slice(0, 5).map(a => (
            <span key={a.id} className="profile-ach locked">{a.name}</span>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Profile;
