import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';
import { ArrowLeft, Trophy, TrendingUp, Coins, Award, Users, Building } from 'lucide-react';
import './Leaderboard.css';

interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string;
  level: number;
  credits: number;
  reputation: number;
  experience: number;
  cityCount: number;
  totalPopulation: number;
  joinedAt: string;
}

interface Stats {
  totalUsers: number;
  totalCities: number;
  avgLevel: string;
  maxLevel: number;
  totalCredits: number;
  topPlayer: {
    username: string;
    level: number;
  } | null;
}

const Leaderboard: React.FC = () => {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [metric, setMetric] = useState('level');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
    fetchStats();
  }, [metric]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/leaderboard/top/${metric}`);
      setLeaderboard(response.data.leaderboard);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/leaderboard/stats');
      setStats(response.data.stats);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="leaderboard-page">
      <header className="leaderboard-header">
        <button onClick={() => navigate('/')} className="back-button">
          <ArrowLeft /> Back
        </button>
        <h1>🏆 Leaderboard</h1>
      </header>

      {stats && (
        <div className="stats-overview">
          <div className="stat-box">
            <Users className="stat-icon" />
            <div>
              <div className="stat-value">{stats.totalUsers}</div>
              <div className="stat-label">Total Players</div>
            </div>
          </div>
          <div className="stat-box">
            <Building className="stat-icon" />
            <div>
              <div className="stat-value">{stats.totalCities}</div>
              <div className="stat-label">Total Cities</div>
            </div>
          </div>
          <div className="stat-box">
            <TrendingUp className="stat-icon" />
            <div>
              <div className="stat-value">{stats.avgLevel}</div>
              <div className="stat-label">Avg Level</div>
            </div>
          </div>
          <div className="stat-box">
            <Trophy className="stat-icon" />
            <div>
              <div className="stat-value">{stats.topPlayer?.username || 'N/A'}</div>
              <div className="stat-label">Top Player (Lvl {stats.topPlayer?.level || 0})</div>
            </div>
          </div>
        </div>
      )}

      <div className="metric-filters">
        <button
          className={metric === 'level' ? 'active' : ''}
          onClick={() => setMetric('level')}
        >
          <Award /> Level
        </button>
        <button
          className={metric === 'credits' ? 'active' : ''}
          onClick={() => setMetric('credits')}
        >
          <Coins /> Credits
        </button>
        <button
          className={metric === 'reputation' ? 'active' : ''}
          onClick={() => setMetric('reputation')}
        >
          <Trophy /> Reputation
        </button>
        <button
          className={metric === 'experience' ? 'active' : ''}
          onClick={() => setMetric('experience')}
        >
          <TrendingUp /> Experience
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading leaderboard...</div>
      ) : leaderboard.length === 0 ? (
        <div className="empty-state">
          <Trophy size={64} />
          <h3>No players yet</h3>
          <p>Be the first to compete!</p>
        </div>
      ) : (
        <div className="leaderboard-table">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Level</th>
                <th>Credits</th>
                <th>Reputation</th>
                <th>Cities</th>
                <th>Population</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => (
                <tr key={entry.id} className={entry.rank <= 3 ? `rank-${entry.rank}` : ''}>
                  <td className="rank-cell">
                    <span className="rank-badge">
                      {getMedalEmoji(entry.rank)}
                    </span>
                  </td>
                  <td className="player-cell">
                    <strong>{entry.username}</strong>
                  </td>
                  <td>{entry.level}</td>
                  <td>🪙 {formatNumber(entry.credits)}</td>
                  <td>⭐ {entry.reputation}</td>
                  <td>{entry.cityCount}</td>
                  <td>{formatNumber(entry.totalPopulation)}</td>
                  <td className="date-cell">{formatDate(entry.joinedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
