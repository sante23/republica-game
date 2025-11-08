import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';
import { ArrowLeft, Vote, Users, Calendar, Award } from 'lucide-react';
import './Politics.css';

interface Election {
  id: string;
  position: string;
  status: string;
  startDate: string;
  endDate: string;
  totalVotes: number;
  candidates?: any[];
}

const Politics: React.FC = () => {
  const navigate = useNavigate();
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchElections();
  }, []);

  const fetchElections = async () => {
    try {
      const response = await api.get('/politics/elections');
      setElections(response.data.elections);
    } catch (error) {
      console.error('Failed to fetch elections:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'UPCOMING': return 'status-upcoming';
      case 'REGISTRATION': return 'status-registration';
      case 'CAMPAIGN': return 'status-campaign';
      case 'VOTING': return 'status-voting';
      case 'COMPLETED': return 'status-completed';
      default: return '';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="politics-page">
      <header className="politics-header">
        <button onClick={() => navigate('/')} className="back-button">
          <ArrowLeft /> Back
        </button>
        <h1>Political Arena</h1>
      </header>

      <div className="politics-intro">
        <div className="intro-card">
          <Award size={32} />
          <div>
            <h3>Democracy in Action</h3>
            <p>Vote for leaders, run for office, and shape the future of your world!</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading elections...</div>
      ) : (
        <div className="elections-grid">
          <section className="elections-section">
            <h2>Active Elections</h2>
            {elections.length === 0 ? (
              <div className="empty-state">
                <Vote size={48} />
                <p>No active elections at the moment</p>
              </div>
            ) : (
              <div className="elections-list">
                {elections.map(election => (
                  <div key={election.id} className="election-card">
                    <div className="election-header">
                      <h3>{election.position}</h3>
                      <span className={`status ${getStatusColor(election.status)}`}>
                        {election.status}
                      </span>
                    </div>
                    <div className="election-info">
                      <div className="info-row">
                        <Calendar size={16} />
                        <span>Start: {formatDate(election.startDate)}</span>
                      </div>
                      <div className="info-row">
                        <Calendar size={16} />
                        <span>End: {formatDate(election.endDate)}</span>
                      </div>
                      <div className="info-row">
                        <Users size={16} />
                        <span>Total Votes: {election.totalVotes}</span>
                      </div>
                    </div>
                    <div className="election-actions">
                      {election.status === 'REGISTRATION' && (
                        <button className="btn-primary">Register as Candidate</button>
                      )}
                      {election.status === 'VOTING' && (
                        <button className="btn-primary">Cast Your Vote</button>
                      )}
                      {election.status === 'CAMPAIGN' && (
                        <button className="btn-secondary">View Candidates</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="political-info">
            <h2>Political Positions</h2>
            <div className="positions-list">
              <div className="position-card">
                <h3>🏛️ Mayor</h3>
                <p>Governs a single city</p>
                <ul>
                  <li>Term: 30 days</li>
                  <li>Required Level: 10</li>
                  <li>Controls local taxes</li>
                  <li>City development</li>
                </ul>
              </div>
              <div className="position-card">
                <h3>🏛️ Governor</h3>
                <p>Manages a region</p>
                <ul>
                  <li>Term: 45 days</li>
                  <li>Required Level: 25</li>
                  <li>Regional trade</li>
                  <li>Infrastructure</li>
                </ul>
              </div>
              <div className="position-card">
                <h3>🏛️ President</h3>
                <p>Leads the entire world</p>
                <ul>
                  <li>Term: 60 days</li>
                  <li>Required Level: 40</li>
                  <li>Foreign policy</li>
                  <li>National defense</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default Politics;