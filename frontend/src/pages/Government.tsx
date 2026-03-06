import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Crown, FileText, AlertTriangle } from 'lucide-react';
import './Government.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const Government: React.FC = () => {
  const { user } = useAuth();
  const [policies, setPolicies] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [impeachments, setImpeachments] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('policies');

  useEffect(() => {
    fetchPolicies();
    fetchPositions();
    fetchImpeachments();
  }, []);

  const fetchPolicies = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/governance/policies`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPolicies(response.data);
    } catch (error) {
      console.error('Error fetching policies:', error);
    }
  };

  const fetchPositions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/governance/positions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPositions(response.data);
    } catch (error) {
      console.error('Error fetching positions:', error);
    }
  };

  const fetchImpeachments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/governance/impeachment`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setImpeachments(response.data);
    } catch (error) {
      console.error('Error fetching impeachments:', error);
    }
  };

  const proposePolicy = async () => {
    const name = prompt('Policy name:');
    const description = prompt('Policy description:');
    const policyType = prompt('Policy type (economic/military/social):');

    if (!name || !description || !policyType) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/governance/policies`, {
        name,
        description,
        policyType,
        effects: {}
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Policy proposed!');
      fetchPolicies();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to propose policy');
    }
  };

  const voteOnPolicy = async (policyId: string, vote: boolean) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/governance/policies/${policyId}/vote`, {
        vote
      }, {
        headers: { Authorization: `Bearer ${token}` }
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
              {positions.map(position => (
                <div key={position.id} className="position-card">
                  <div className="position-title">
                    {position.position === 'president' && '👑 President'}
                    {position.position === 'minister_economy' && '💼 Minister of Economy'}
                    {position.position === 'minister_defense' && '⚔️ Minister of Defense'}
                  </div>
                  <div className="holder">
                    {position.holder ? (
                      <strong>{position.holder.username}</strong>
                    ) : (
                      <em>Vacant</em>
                    )}
                  </div>
                  {position.startDate && (
                    <small>Since: {new Date(position.startDate).toLocaleDateString()}</small>
                  )}
                </div>
              ))}
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
