import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import api from '../config/api';
import { Crown, FileText, AlertTriangle, Zap } from 'lucide-react';
import './Government.css';

const Government: React.FC = () => {
  useAuth(); // ensure authenticated
  const { cities } = useGame();
  const [policies, setPolicies] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [impeachments, setImpeachments] = useState<any[]>([]);
  const [mayorStatus, setMayorStatus] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('policies');

  useEffect(() => {
    fetchPolicies();
    fetchPositions();
    fetchImpeachments();
    if (cities.length > 0) {
      fetchMayorStatus(cities[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities]);

  const fetchPolicies = async () => {
    try {
      const response = await api.get('/governance/policies');
      setPolicies(response.data);
    } catch (error) {
      console.error('Error fetching policies:', error);
    }
  };

  const fetchPositions = async () => {
    try {
      const response = await api.get('/governance/positions');
      setPositions(response.data);
    } catch (error) {
      console.error('Error fetching positions:', error);
    }
  };

  const fetchImpeachments = async () => {
    try {
      const response = await api.get('/governance/impeachment');
      setImpeachments(response.data);
    } catch (error) {
      console.error('Error fetching impeachments:', error);
    }
  };

  const fetchMayorStatus = async (cityId: string) => {
    try {
      const response = await api.get(`/governance/mayor/${cityId}`);
      setMayorStatus(response.data);
    } catch (error) {
      console.error('Error fetching mayor status:', error);
    }
  };

  const activateMayorPower = async (power: string) => {
    if (!cities[0]) return;
    try {
      if (power === 'boost') {
        await api.post('/governance/mayor/boost', { cityId: cities[0].id });
        alert('Production boost activated! +10% for 4 hours.');
      } else if (power === 'tax') {
        const rate = prompt('Set new tax rate (0-50):');
        if (rate === null) return;
        await api.post('/governance/mayor/tax', { cityId: cities[0].id, taxRate: parseInt(rate) });
        alert(`Tax rate set to ${rate}%`);
      } else if (power === 'ban') {
        const username = prompt('Enter player username to ban from local market (12h):');
        if (!username) return;
        await api.post('/governance/mayor/ban', { cityId: cities[0].id, targetUsername: username });
        alert(`${username} banned from local market for 12 hours.`);
      }
      fetchMayorStatus(cities[0].id);
    } catch (error: any) {
      alert(error.response?.data?.error || `Failed to use ${power} power`);
    }
  };

  const proposePolicy = async () => {
    const name = prompt('Policy name:');
    const description = prompt('Policy description:');
    const policyType = prompt('Policy type (economic/military/social):');

    if (!name || !description || !policyType) return;

    try {
      await api.post('/governance/policies', {
        name,
        description,
        policyType,
        effects: {}
      });
      alert('Policy proposed!');
      fetchPolicies();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to propose policy');
    }
  };

  const voteOnPolicy = async (policyId: string, vote: boolean) => {
    try {
      await api.post(`/governance/policies/${policyId}/vote`, {
        vote
      });
      alert('Vote recorded!');
      fetchPolicies();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to vote');
    }
  };

  return (
    <div className="government-page">
      <h1>🏛️ Government</h1>

      {/* Mayor Powers Panel */}
      {mayorStatus?.isMayor && (
        <div className="mayor-powers-panel">
          <h3><Crown size={16} /> Mayor Powers - {mayorStatus.cityName}</h3>
          <div className="mayor-powers-grid">
            <button className="mayor-power-btn boost" onClick={() => activateMayorPower('boost')}>
              <Zap size={18} />
              <div>
                <strong>Production Boost</strong>
                <span>+10% production for 4h (24h cooldown)</span>
              </div>
            </button>
            <button className="mayor-power-btn tax" onClick={() => activateMayorPower('tax')}>
              <Crown size={18} />
              <div>
                <strong>Set Tax Rate</strong>
                <span>Current: {mayorStatus.taxRate}%</span>
              </div>
            </button>
            <button className="mayor-power-btn ban" onClick={() => activateMayorPower('ban')}>
              <AlertTriangle size={18} />
              <div>
                <strong>Market Ban</strong>
                <span>Ban a player from local market for 12h</span>
              </div>
            </button>
          </div>
        </div>
      )}
      {mayorStatus?.hasMayor && !mayorStatus.isMayor && (
        <div className="mayor-info-banner">
          Mayor of {mayorStatus.cityName}: <strong>{mayorStatus.mayorName}</strong>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button
          className={activeTab === 'policies' ? 'active' : ''}
          onClick={() => setActiveTab('policies')}
        >
          <FileText size={18} /> Policies
        </button>
        <button
          className={activeTab === 'positions' ? 'active' : ''}
          onClick={() => setActiveTab('positions')}
        >
          <Crown size={18} /> Government Positions
        </button>
        <button
          className={activeTab === 'impeachment' ? 'active' : ''}
          onClick={() => setActiveTab('impeachment')}
        >
          <AlertTriangle size={18} /> Impeachment
        </button>
      </div>

      {/* Policies Tab */}
      {activeTab === 'policies' && (
        <div className="section">
          <div className="section-header">
            <h2>Policies</h2>
            <button className="btn-primary" onClick={proposePolicy}>
              Propose Policy
            </button>
          </div>
          {policies.length === 0 ? (
            <p>No policies yet</p>
          ) : (
            <div className="policies-list">
              {policies.map(policy => (
                <div key={policy.id} className="policy-card">
                  <div className={`status ${policy.status}`}>
                    {policy.status}
                  </div>
                  <h3>{policy.name}</h3>
                  <p>{policy.description}</p>
                  <div className="policy-info">
                    <span>Type: {policy.policyType}</span>
                    <span>Proposed by: {policy.proposer?.username}</span>
                  </div>
                  {policy.status === 'proposed' && (
                    <div className="vote-section">
                      <div className="votes">
                        <span className="votes-for">👍 {policy.votesFor}</span>
                        <span className="votes-against">👎 {policy.votesAgainst}</span>
                      </div>
                      <div className="vote-buttons">
                        <button
                          className="btn-vote for"
                          onClick={() => voteOnPolicy(policy.id, true)}
                        >
                          Vote For
                        </button>
                        <button
                          className="btn-vote against"
                          onClick={() => voteOnPolicy(policy.id, false)}
                        >
                          Vote Against
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Government Positions Tab */}
      {activeTab === 'positions' && (
        <div className="section">
          <h2>Government Positions</h2>
          {positions.length === 0 ? (
            <p>No positions filled yet</p>
          ) : (
            <div className="positions-list">
              {positions.map(position => {
                const titles: Record<string, string> = {
                  president: '👑 President',
                  governor: '🏷️ Governor',
                  mayor: '🏛️ Mayor',
                  minister_economy: '💼 Minister of Economy',
                  minister_defense: '⚔️ Minister of Defense',
                };
                const approval = position.approval;
                const promises = position.promises || [];
                const approvalColor = approval >= 60 ? '#4CAF50' : approval >= 30 ? '#f6ad55' : '#fc8181';
                return (
                  <div key={position.id} className="position-card">
                    <div className="position-title">{titles[position.position] || position.position}</div>
                    <div className="holder">
                      {position.isNpc ? (
                        <strong>🤖 {position.npcName} <span className="npc-tag">NPC</span></strong>
                      ) : position.holder ? (
                        <strong>{position.holder.username}</strong>
                      ) : (
                        <em>Vacant</em>
                      )}
                    </div>
                    {position.startDate && (
                      <small>Since: {new Date(position.startDate).toLocaleDateString()}</small>
                    )}
                    {approval != null && (
                      <div className="approval">
                        <div className="approval-head">
                          <span>Approval</span><span>{approval}%</span>
                        </div>
                        <div className="approval-bar">
                          <div className="approval-fill" style={{ width: `${approval}%`, background: approvalColor }} />
                        </div>
                      </div>
                    )}
                    {promises.length > 0 && (
                      <div className="scorecard">
                        <div className="scorecard-title">Campaign promises</div>
                        {promises.map((p: any, i: number) => (
                          <div key={i} className="promise-row">
                            <span>{p.kept === true ? '✅' : p.kept === false ? '❌' : '⏳'}</span>
                            <span className="promise-label">{p.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Impeachment Tab */}
      {activeTab === 'impeachment' && (
        <div className="section">
          <h2>Impeachment Votes</h2>
          {impeachments.length === 0 ? (
            <p>No active impeachment votes</p>
          ) : (
            <div className="impeachments-list">
              {impeachments.map(impeachment => (
                <div key={impeachment.id} className="impeachment-card">
                  <div className="impeachment-header">
                    <strong>Target:</strong> {impeachment.target?.username} ({impeachment.targetPosition})
                  </div>
                  <div><strong>Initiated by:</strong> {impeachment.initiator?.username}</div>
                  {impeachment.reason && <div><strong>Reason:</strong> {impeachment.reason}</div>}
                  <div className="votes">
                    <span>Support: {impeachment.votesFor}</span>
                    <span>Oppose: {impeachment.votesAgainst}</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress"
                      style={{width: `${(impeachment.votesFor / 20) * 100}%`}}
                    />
                  </div>
                  <small>Needs 20 votes, 2/3 majority to pass</small>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Government;
