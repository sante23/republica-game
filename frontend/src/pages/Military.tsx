import React, { useEffect, useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { useToast } from '../contexts/ToastContext';
import api from '../config/api';
import { Sword, Target, Users } from 'lucide-react';
import CrisisPanel from '../components/CrisisPanel';
import './Military.css';

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
  const { cities, fetchCities } = useGame();
  const toast = useToast();
  const [selectedCity, setSelectedCity] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [battles, setBattles] = useState<any[]>([]);
  const [alliances, setAlliances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('units');

  // Load the player's cities on mount so a direct visit / refresh of /military
  // still has a selectable city (cities live in context, otherwise only Dashboard fetches them).
  useEffect(() => {
    if (cities.length === 0) fetchCities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cities.length > 0 && !selectedCity) {
      setSelectedCity(cities[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities]);

  useEffect(() => {
    if (selectedCity) {
      fetchUnits();
    }
    fetchBattles();
    fetchAlliances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCity]);

  const fetchUnits = async () => {
    if (!selectedCity) return;
    try {
      const response = await api.get(`/military/city/${selectedCity.id}`);
      setUnits(response.data);
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  };

  const fetchBattles = async () => {
    try {
      const response = await api.get('/military/battles');
      setBattles(response.data);
    } catch (error) {
      console.error('Error fetching battles:', error);
    }
  };

  const fetchAlliances = async () => {
    try {
      const response = await api.get('/military/alliances');
      setAlliances(response.data);
    } catch (error) {
      console.error('Error fetching alliances:', error);
    }
  };

  const trainUnits = async (unitType: string, quantity: number) => {
    if (!selectedCity) {
      toast.warning('You need a city first. Go to Home and found your city, then come back to train troops.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/military/train', {
        cityId: selectedCity.id,
        unitType,
        quantity
      });
      toast.success(`Trained ${quantity} ${UNIT_TYPES[unitType as keyof typeof UNIT_TYPES].name}!`);
      fetchUnits();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to train units');
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

      {/* Cooperative endgame: world boss + war effort */}
      <CrisisPanel />

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
              {battles.map(battle => {
                const isAttacker = battle.attacker?.username !== battle.defender?.username;
                const totalAttLoss = battle.attackerLosses ? Object.values(battle.attackerLosses as Record<string, number>).reduce((s, v) => s + v, 0) : 0;
                const totalDefLoss = battle.defenderLosses ? Object.values(battle.defenderLosses as Record<string, number>).reduce((s, v) => s + v, 0) : 0;

                return (
                  <div key={battle.id} className={`battle-card ${battle.outcome}`}>
                    <div className="battle-header">
                      <span className={`battle-outcome ${battle.outcome}`}>
                        {battle.outcome === 'attacker_win' ? 'VICTORY' : 'DEFEAT'}
                      </span>
                      <small>{new Date(battle.battle_date || battle.battleDate).toLocaleString()}</small>
                    </div>
                    <div className="battle-versus">
                      <div className="battle-side attacker-side">
                        <strong>{battle.attacker?.username}</strong>
                        <span className="battle-city-name">{battle.attackerCity?.name}</span>
                      </div>
                      <span className="battle-vs">VS</span>
                      <div className="battle-side defender-side">
                        <strong>{battle.defender?.username}</strong>
                        <span className="battle-city-name">{battle.defenderCity?.name}</span>
                      </div>
                    </div>
                    <div className="battle-stats-grid">
                      <div className="battle-stat-box">
                        <div className="battle-stat-label">Attacker Losses</div>
                        <div className="battle-stat-value loss">{totalAttLoss} units</div>
                        {battle.attackerLosses && Object.entries(battle.attackerLosses as Record<string, number>).map(([type, count]) => (
                          count > 0 && <div key={type} className="battle-unit-loss">{type}: -{count}</div>
                        ))}
                      </div>
                      <div className="battle-stat-box">
                        <div className="battle-stat-label">Defender Losses</div>
                        <div className="battle-stat-value loss">{totalDefLoss} units</div>
                        {battle.defenderLosses && Object.entries(battle.defenderLosses as Record<string, number>).map(([type, count]) => (
                          count > 0 && <div key={type} className="battle-unit-loss">{type}: -{count}</div>
                        ))}
                      </div>
                      {battle.resourcesPlundered && (
                        <div className="battle-stat-box plunder">
                          <div className="battle-stat-label">Plundered</div>
                          {Object.entries(battle.resourcesPlundered as Record<string, number>).map(([res, amt]) => (
                            amt > 0 && <div key={res} className="battle-plunder-item">+{amt} {res}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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
