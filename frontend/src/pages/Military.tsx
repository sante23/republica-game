import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import axios from 'axios';
import { Sword, Shield, Target, Users, AlertCircle } from 'lucide-react';
import './Military.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const UNIT_TYPES = {
  infantry: {
    name: 'Infantry',
    cost: { food: 50, gold: 20 },
    attackPower: 10,
    defensePower: 12,
    icon: '🗡️'
  },
  cavalry: {
    name: 'Cavalry',
    cost: { food: 80, gold: 50 },
    attackPower: 18,
    defensePower: 10,
    icon: '🐎'
  },
  archer: {
    name: 'Archer',
    cost: { food: 40, wood: 30, gold: 25 },
    attackPower: 15,
    defensePower: 8,
    icon: '🏹'
  },
  siege: {
    name: 'Siege Engine',
    cost: { wood: 100, stone: 80, gold: 100 },
    attackPower: 30,
    defensePower: 5,
    icon: '🎯'
  }
};

const Military: React.FC = () => {
  const { user } = useAuth();
  const { cities } = useGame();
  const [selectedCity, setSelectedCity] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [battles, setBattles] = useState<any[]>([]);
  const [alliances, setAlliances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('units');

  useEffect(() => {
    if (cities.length > 0 && !selectedCity) {
      setSelectedCity(cities[0]);
    }
  }, [cities]);

  useEffect(() => {
    if (selectedCity) {
      fetchUnits();
    }
    fetchBattles();
    fetchAlliances();
  }, [selectedCity]);

  const fetchUnits = async () => {
    if (!selectedCity) return;
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/military/city/${selectedCity.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnits(response.data);
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  };

  const fetchBattles = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/military/battles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBattles(response.data);
    } catch (error) {
      console.error('Error fetching battles:', error);
    }
  };

  const fetchAlliances = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/military/alliances`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAlliances(response.data);
    } catch (error) {
      console.error('Error fetching alliances:', error);
    }
  };

  const trainUnits = async (unitType: string, quantity: number) => {
    if (!selectedCity) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/military/train`, {
        cityId: selectedCity.id,
        unitType,
        quantity
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`Successfully trained ${quantity} ${UNIT_TYPES[unitType as keyof typeof UNIT_TYPES].name}!`);
      fetchUnits();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to train units');
    } finally {
      setLoading(false);
    }
  };

  const getUnitCount = (type: string) => {
    const unit = units.find(u => u.unitType === type);
    return unit ? unit.quantity : 0;
  };

  return (
    <div className="military-page">
      <h1>⚔️ Military Command</h1>

      {/* City Selector */}
      <div className="city-selector">
        <label>Select City:</label>
        <select
          value={selectedCity?.id || ''}
          onChange={(e) => setSelectedCity(cities.find(c => c.id === e.target.value))}
        >
          {cities.map(city => (
            <option key={city.id} value={city.id}>{city.name}</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={activeTab === 'units' ? 'active' : ''}
          onClick={() => setActiveTab('units')}
        >
          <Sword size={18} /> Units
        </button>
        <button
          className={activeTab === 'battles' ? 'active' : ''}
          onClick={() => setActiveTab('battles')}
        >
          <Target size={18} /> Battles
        </button>
        <button
          className={activeTab === 'alliances' ? 'active' : ''}
          onClick={() => setActiveTab('alliances')}
        >
          <Users size={18} /> Alliances
        </button>
      </div>

      {/* Units Tab */}
      {activeTab === 'units' && (
        <div className="units-section">
          <h2>Train Military Units</h2>
          <div className="units-grid">
            {Object.entries(UNIT_TYPES).map(([type, stats]) => (
              <div key={type} className="unit-card">
                <div className="unit-icon">{stats.icon}</div>
                <h3>{stats.name}</h3>
                <div className="unit-stats">
                  <div>⚔️ Attack: {stats.attackPower}</div>
                  <div>🛡️ Defense: {stats.defensePower}</div>
                  <div>📊 Owned: {getUnitCount(type)}</div>
                </div>
                <div className="unit-cost">
                  {Object.entries(stats.cost).map(([resource, amount]) => (
                    <span key={resource}>{resource}: {amount}</span>
                  ))}
                </div>
                <div className="train-controls">
                  <input
                    type="number"
                    min="1"
                    defaultValue="10"
                    id={`qty-${type}`}
                  />
                  <button
                    onClick={() => {
                      const qty = parseInt((document.getElementById(`qty-${type}`) as HTMLInputElement).value);
                      trainUnits(type, qty);
                    }}
                    disabled={loading}
                  >
                    Train
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Battles Tab */}
      {activeTab === 'battles' && (
        <div className="battles-section">
          <h2>Battle History</h2>
          {battles.length === 0 ? (
            <p>No battles yet</p>
          ) : (
            <div className="battles-list">
              {battles.map(battle => (
                <div key={battle.id} className="battle-card">
                  <div className={`outcome ${battle.outcome}`}>
                    {battle.outcome === 'attacker_win' ? '🎉 Victory!' : '😔 Defeat'}
                  </div>
                  <div>
                    <strong>{battle.attacker?.username}</strong> attacked <strong>{battle.defender?.username}</strong>
                  </div>
                  <div className="battle-details">
                    <div>📍 {battle.attackerCity?.name} → {battle.defenderCity?.name}</div>
                    <div>⚔️ Losses: {JSON.stringify(battle.attackerLosses)}</div>
                    {battle.resourcesPlundered && (
                      <div>💰 Plundered: {JSON.stringify(battle.resourcesPlundered)}</div>
                    )}
                  </div>
                  <small>{new Date(battle.battleDate).toLocaleString()}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alliances Tab */}
      {activeTab === 'alliances' && (
        <div className="alliances-section">
          <h2>Alliances</h2>
          {alliances.length === 0 ? (
            <p>No alliances yet</p>
          ) : (
            <div className="alliances-list">
              {alliances.map(alliance => (
                <div key={alliance.id} className="alliance-card">
                  <div className={`status ${alliance.status}`}>
                    {alliance.status}
                  </div>
                  <div>
                    <strong>{alliance.player1?.username}</strong> ↔️ <strong>{alliance.player2?.username}</strong>
                  </div>
                  <small>{new Date(alliance.createdAt).toLocaleString()}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Military;
