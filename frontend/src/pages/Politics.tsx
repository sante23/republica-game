import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';
import { ArrowLeft, Vote, Users, Calendar, Award } from 'lucide-react';
import RegisterCandidateModal from '../components/RegisterCandidateModal';
import VoteModal from '../components/VoteModal';
import ViewCandidatesModal from '../components/ViewCandidatesModal';
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
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [activeElectionId, setActiveElectionId] = useState('');

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

  const handleRegister = async (program: string) => {
    try {
      await api.post(`/politics/elections/${activeElectionId}/register`, { program });
      fetchElections();
      alert('Successfully registered as candidate!');
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to register';
      throw new Error(errorMsg);
    }
  };

  const handleVote = async (candidateId: string) => {
    try {
      await api.post(`/politics/elections/${activeElectionId}/vote`, { candidateId });
      fetchElections();
      alert('Vote cast successfully!');
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to vote';
      throw new Error(errorMsg);
    }
  };

  const openRegisterModal = (electionId: string) => {
    setActiveElectionId(electionId);
    setIsRegisterModalOpen(true);
  };

  const openVoteModal = (electionId: string) => {
    setActiveElectionId(electionId);
    setIsVoteModalOpen(true);
  };

  const openViewModal = (electionId: string) => {
    setActiveElectionId(electionId);
    setIsViewModalOpen(true);
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
                        <button className="btn-primary" onClick={() => openRegisterModal(election.id)}>
                          Register as Candidate
                        </button>
                      )}
                      {election.status === 'VOTING' && (
                        <>
                          <button className="btn-primary" onClick={() => openVoteModal(election.id)}>
                            Cast Your Vote
                          </button>
                          <button className="btn-secondary" onClick={() => openViewModal(election.id)}>
                            View Candidates
                          </button>
                        </>
                      )}
                      {election.status === 'CAMPAIGN' && (
                        <button className="btn-secondary" onClick={() => openViewModal(election.id)}>
                          View Candidates
                        </button>
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

      <RegisterCandidateModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onConfirm={handleRegister}
        electionId={activeElectionId}
        position={elections.find(e => e.id === activeElectionId)?.position || ''}
      />

      <VoteModal
        isOpen={isVoteModalOpen}
        onClose={() => setIsVoteModalOpen(false)}
        onConfirm={handleVote}
        electionId={activeElectionId}
        position={elections.find(e => e.id === activeElectionId)?.position || ''}
      />

      <ViewCandidatesModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        electionId={activeElectionId}
        position={elections.find(e => e.id === activeElectionId)?.position || ''}
      />
    </div>
  );
};

export default Politics;