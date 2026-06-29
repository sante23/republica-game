import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { useGame } from '../contexts/GameContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { ArrowLeft, Vote, Users, Award, Trophy, Megaphone, ThumbsUp, Bot, Clock, Gift } from 'lucide-react';
import { playSound } from '../utils/sounds';
import RegisterCandidateModal from '../components/RegisterCandidateModal';
import VoteModal from '../components/VoteModal';
import ViewCandidatesModal from '../components/ViewCandidatesModal';
import './Politics.css';

interface Candidate {
  id: string;
  username: string;
  isNpc?: boolean;
  platform?: { key: string; label: string; emoji: string; color: string } | null;
  promises?: string[];
  endorsements?: number;
  campaignSpend?: number;
  votes: number;
  percentage: number;
}

interface Election {
  id: string;
  position: string;
  status: string;
  cityId?: string | null;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  totalVotes: number;
  support?: number;
  candidates: Candidate[];
  leader?: Candidate | null;
  prize?: string[];
  phaseEndsAt?: string;
}

const phaseLabel: Record<string, string> = {
  UPCOMING: 'Opens soon',
  REGISTRATION: 'Registration closes in',
  CAMPAIGN: 'Voting opens in',
  VOTING: 'Voting closes in',
  COMPLETED: 'Completed',
};

function fmtCountdown(target?: string, now?: number): string {
  if (!target) return '';
  const ms = new Date(target).getTime() - (now || Date.now());
  if (ms <= 0) return 'now';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

const Politics: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { socket } = useGame();
  const { user } = useAuth();
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowTs, setNowTs] = useState(Date.now());
  const [endorsed, setEndorsed] = useState<Set<string>>(new Set());
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [activeElectionId, setActiveElectionId] = useState('');

  const fetchElections = useCallback(async () => {
    try {
      const response = await api.get('/politics/elections');
      setElections(response.data.elections || []);
    } catch (error) {
      console.error('Failed to fetch elections:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchElections();
  }, [fetchElections]);

  // 1s clock for live countdowns
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Live tally + phase changes over the socket
  useEffect(() => {
    if (!socket) return;
    const onVote = (data: any) => {
      setElections(prev => prev.map(e => e.id === data.electionId ? {
        ...e,
        candidates: data.candidates || e.candidates,
        leader: (data.candidates && data.candidates[0]) || e.leader,
        totalVotes: data.totalVotes != null ? data.totalVotes : e.totalVotes,
        support: data.support != null ? data.support : e.support,
      } : e));
    };
    const onPhase = () => fetchElections();
    socket.on('election-vote', onVote);
    socket.on('election-phase', onPhase);
    socket.on('election-completed', onPhase);
    return () => {
      socket.off('election-vote', onVote);
      socket.off('election-phase', onPhase);
      socket.off('election-completed', onPhase);
    };
  }, [socket, fetchElections]);

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

  const isCandidate = (e: Election) => !!user && e.candidates.some(c => c.id === user.id);

  const handleRegister = async (program: string, promises: string[]) => {
    try {
      await api.post(`/politics/elections/${activeElectionId}/register`, { program, promises });
      fetchElections();
      toast.success('Successfully registered as candidate! 🗳️');
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to register');
    }
  };

  const handleVote = async (candidateId: string) => {
    try {
      const res = await api.post(`/politics/elections/${activeElectionId}/vote`, { candidateId });
      fetchElections();
      const w = res.data?.weight;
      toast.success(w && w !== 1 ? `Vote cast! (weight ×${w}) ✅` : 'Vote cast successfully! ✅');
      playSound('notification');
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to vote');
    }
  };

  const handleEndorse = async (electionId: string, candidateId: string) => {
    try {
      const res = await api.post(`/politics/elections/${electionId}/endorse`, { candidateId });
      setEndorsed(prev => new Set(prev).add(electionId));
      toast.success(`Endorsement registered (weight ×${res.data?.weight ?? 1}) 👍`);
      fetchElections();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to endorse');
    }
  };

  const handleCampaign = async (electionId: string, amount: number) => {
    try {
      const res = await api.post(`/politics/elections/${electionId}/campaign`, { amount });
      toast.success(res.data?.message || 'Campaign push!');
      playSound('build');
      fetchElections();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to campaign');
    }
  };

  const openRegisterModal = (id: string) => { setActiveElectionId(id); setIsRegisterModalOpen(true); };
  const openVoteModal = (id: string) => { setActiveElectionId(id); setIsVoteModalOpen(true); };
  const openViewModal = (id: string) => { setActiveElectionId(id); setIsViewModalOpen(true); };

  const activeElection = elections.find(e => e.id === activeElectionId);

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
            <p>Run for office, rally citizens, endorse and outspend rivals — and watch the vote move live.</p>
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

                    <div className="election-countdown">
                      <Clock size={14} />
                      <span>{phaseLabel[election.status] || ''} </span>
                      <strong>{fmtCountdown(election.phaseEndsAt, nowTs)}</strong>
                      <span className="ballots"><Users size={13} /> {election.totalVotes} ballots</span>
                    </div>

                    {election.prize && election.prize.length > 0 && (
                      <div className="prize-box">
                        <Gift size={14} />
                        <span><strong>At stake:</strong> {election.prize.join(' · ')}</span>
                      </div>
                    )}

                    {/* Live results board */}
                    <div className="cand-board">
                      {election.candidates.length === 0 ? (
                        <div className="cand-empty">Candidates (incl. NPC rivals) will appear once registration opens…</div>
                      ) : (
                        election.candidates.map((c, idx) => (
                          <div className={`cand-row ${idx === 0 ? 'leading' : ''}`} key={c.id}>
                            <div className="cand-meta">
                              {idx === 0 && <Trophy size={14} className="leader-ico" />}
                              {c.platform && <span className="cand-emoji" title={c.platform.label}>{c.platform.emoji}</span>}
                              <span className="cand-name">{c.username}</span>
                              {c.isNpc && <span className="npc-badge"><Bot size={11} /> NPC</span>}
                              {!!(c.endorsements && c.endorsements > 0) && (
                                <span className="cand-endorse" title="endorsements"><ThumbsUp size={11} /> {c.endorsements}</span>
                              )}
                            </div>
                            <div className="cand-barwrap">
                              <div
                                className="cand-bar"
                                style={{ width: `${c.percentage}%`, background: c.platform?.color || '#4CAF50' }}
                              />
                              <span className="cand-pct">{c.percentage}%</span>
                            </div>
                            {(election.status === 'CAMPAIGN' || election.status === 'VOTING') && c.id !== user?.id && (
                              <button
                                className="endorse-btn"
                                onClick={() => handleEndorse(election.id, c.id)}
                                disabled={endorsed.has(election.id)}
                                title="Endorse this candidate (one per race, weighted by your reputation)"
                              >
                                <ThumbsUp size={12} /> Endorse
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {/* Candidate-only campaign spending */}
                    {isCandidate(election) && (election.status === 'CAMPAIGN' || election.status === 'VOTING') && (
                      <div className="campaign-box">
                        <span><Megaphone size={14} /> Boost your campaign:</span>
                        {[100, 250, 500].map(a => (
                          <button key={a} className="camp-btn" onClick={() => handleCampaign(election.id, a)}>
                            {a}🪙
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="election-actions">
                      {election.status === 'REGISTRATION' && !isCandidate(election) && (
                        <button className="btn-primary" onClick={() => openRegisterModal(election.id)}>
                          Register as Candidate
                        </button>
                      )}
                      {election.status === 'VOTING' && (
                        <button className="btn-primary" onClick={() => openVoteModal(election.id)}>
                          Cast Your Vote
                        </button>
                      )}
                      {(election.status === 'VOTING' || election.status === 'CAMPAIGN') && (
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
                  <li>Controls local taxes</li>
                  <li>Production boost decree</li>
                  <li>Approval-rated &amp; recallable</li>
                </ul>
              </div>
              <div className="position-card">
                <h3>🏛️ Governor</h3>
                <p>Manages a region</p>
                <ul>
                  <li>Term: 45 days</li>
                  <li>Regional trade</li>
                  <li>Infrastructure</li>
                </ul>
              </div>
              <div className="position-card">
                <h3>🏛️ President</h3>
                <p>Leads the entire world</p>
                <ul>
                  <li>Term: 60 days</li>
                  <li>Appoint ministers</li>
                  <li>National policies</li>
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
        position={activeElection?.position || ''}
      />

      <VoteModal
        isOpen={isVoteModalOpen}
        onClose={() => setIsVoteModalOpen(false)}
        onConfirm={handleVote}
        electionId={activeElectionId}
        position={activeElection?.position || ''}
      />

      <ViewCandidatesModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        electionId={activeElectionId}
        position={activeElection?.position || ''}
      />
    </div>
  );
};

export default Politics;
