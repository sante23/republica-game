import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { Building, Coins, Users, TrendingUp, Globe, Award, Shield } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import CityFoundModal from '../components/CityFoundModal';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { cities, fetchCities, loading, createCity } = useGame();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchCities();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPopulation = cities.reduce((sum, city) => sum + city.population, 0);
  const totalResources = cities.reduce((sum, city) => {
    const cityTotal = Object.values(city.resources).reduce((a, b) => a + b, 0);
    return sum + cityTotal;
  }, 0);

  // Production chart data
  const productionData = cities.length > 0 ? [
    { name: 'Food', value: cities.reduce((s, c) => s + (c.production?.food || 0), 0) },
    { name: 'Wood', value: cities.reduce((s, c) => s + (c.production?.wood || 0), 0) },
    { name: 'Stone', value: cities.reduce((s, c) => s + (c.production?.stone || 0), 0) },
    { name: 'Iron', value: cities.reduce((s, c) => s + (c.production?.iron || 0), 0) },
    { name: 'Gold', value: cities.reduce((s, c) => s + (c.production?.gold || 0), 0) },
  ] : [];

  const handleFoundCity = async (name: string, x: number, y: number) => {
    const result = await createCity(name, x, y);
    if (result.success) {
      await fetchCities();
    } else {
      throw new Error(result.error);
    }
  };

  // Newbie protection status
  const isProtected = user?.protectedUntil && new Date(user.protectedUntil) > new Date();
  const protectionHoursLeft = isProtected
    ? Math.ceil((new Date(user!.protectedUntil!).getTime() - Date.now()) / (1000 * 60 * 60))
    : 0;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Welcome back, {user?.username}!</h1>
          {isProtected && (
            <div className="protection-badge">
              <Shield size={14} />
              Newbie Protection: {protectionHoursLeft}h remaining
            </div>
          )}
        </div>
        <div className="user-stats">
          <span className="stat">
            <Award size={16} /> Level {user?.level}
          </span>
          <span className="stat">
            <Coins size={16} /> {user?.credits} Credits
          </span>
          <span className="stat">
            <Globe size={16} /> World #{user?.worldId}
          </span>
        </div>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <Building className="stat-icon" />
          <div className="stat-content">
            <h3>Cities</h3>
            <p className="stat-value">{cities.length}</p>
            <p className="stat-desc">Max: {Math.floor((user?.level || 0) / 5) + 1}</p>
          </div>
        </div>

        <div className="stat-card">
          <Users className="stat-icon" />
          <div className="stat-content">
            <h3>Population</h3>
            <p className="stat-value">{totalPopulation.toLocaleString()}</p>
            <p className="stat-desc">Citizens across all cities</p>
          </div>
        </div>

        <div className="stat-card">
          <TrendingUp className="stat-icon" />
          <div className="stat-content">
            <h3>Resources</h3>
            <p className="stat-value">{Math.floor(totalResources).toLocaleString()}</p>
            <p className="stat-desc">Total stockpiled</p>
          </div>
        </div>

        <div className="stat-card">
          <Award className="stat-icon" />
          <div className="stat-content">
            <h3>Reputation</h3>
            <p className="stat-value">{user?.reputation}</p>
            <p className="stat-desc">Political standing</p>
          </div>
        </div>
      </div>

      {/* Production Chart */}
      {productionData.length > 0 && (
        <div className="production-chart-section">
          <h2>Total Production (per hour)</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={productionData}>
                <XAxis dataKey="name" tick={{ fill: '#718096', fontSize: 12 }} />
                <YAxis tick={{ fill: '#718096', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: '#2d3748', border: 'none', borderRadius: 8, color: '#fff' }}
                  labelStyle={{ color: '#a0aec0' }}
                />
                <Bar dataKey="value" fill="url(#productionGradient)" radius={[4, 4, 0, 0]} />
                <defs>
                  <linearGradient id="productionGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#667eea" />
                    <stop offset="100%" stopColor="#764ba2" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="cities-section">
        <div className="section-header">
          <h2>Your Cities</h2>
          {cities.length < Math.floor((user?.level || 0) / 5) + 1 && (
            <button className="btn-primary" onClick={() => setIsModalOpen(true)}>Found New City</button>
          )}
        </div>

        {loading ? (
          <div className="loading">Loading cities...</div>
        ) : cities.length === 0 ? (
          <div className="empty-state">
            <Building size={64} />
            <h3>No cities yet</h3>
            <p>Found your first city to start building your empire!</p>
            <button className="btn-primary" onClick={() => setIsModalOpen(true)}>Found First City</button>
          </div>
        ) : (
          <div className="cities-grid">
            {cities.map(city => (
              <Link to={`/city/${city.id}`} key={city.id} className="city-card">
                <div className="city-card-header">
                  <h3>{city.name}</h3>
                  {city.isCapital && <span className="capital-badge">Capital</span>}
                </div>
                <div className="city-stats">
                  <div className="city-stat">
                    <Users size={16} />
                    <span>{city.population.toLocaleString()}</span>
                  </div>
                  <div className="city-stat">
                    <span>Happiness {city.happiness}%</span>
                  </div>
                  <div className="city-stat">
                    <span>({city.x}, {city.y})</span>
                  </div>
                </div>
                <div className="city-resources">
                  <div className="resource">Food {Math.floor(city.resources.food)}</div>
                  <div className="resource">Wood {Math.floor(city.resources.wood)}</div>
                  <div className="resource">Stone {Math.floor(city.resources.stone)}</div>
                  <div className="resource">Gold {Math.floor(city.resources.gold)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <nav className="dashboard-nav">
        <Link to="/market" className="nav-card">
          <h3>Marketplace</h3>
          <p>Trade resources with other players</p>
        </Link>
        <Link to="/politics" className="nav-card">
          <h3>Politics</h3>
          <p>Vote and run for office</p>
        </Link>
        <Link to="/leaderboard" className="nav-card">
          <h3>Leaderboard</h3>
          <p>See top players</p>
        </Link>
        <Link to="/world-map" className="nav-card">
          <h3>World Map</h3>
          <p>Explore cities around the world</p>
        </Link>
        <Link to="/military" className="nav-card">
          <h3>Military</h3>
          <p>Train units and wage war</p>
        </Link>
        <Link to="/economy" className="nav-card">
          <h3>Economy</h3>
          <p>Manage trade routes and taxes</p>
        </Link>
        <Link to="/government" className="nav-card">
          <h3>Government</h3>
          <p>Propose policies and govern</p>
        </Link>
        <Link to="/banking" className="nav-card">
          <h3>Banking</h3>
          <p>Loans and financial services</p>
        </Link>
        <Link to="/contracts" className="nav-card">
          <h3>Contracts</h3>
          <p>Trade agreements with players</p>
        </Link>
        <Link to="/achievements" className="nav-card">
          <h3>Achievements</h3>
          <p>Track your progress</p>
        </Link>
      </nav>

      <CityFoundModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleFoundCity}
      />
    </div>
  );
};

export default Dashboard;
