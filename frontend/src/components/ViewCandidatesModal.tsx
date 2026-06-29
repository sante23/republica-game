import React, { useState, useEffect } from 'react';
import api from '../config/api';
import './CityFoundModal.css';

interface Candidate {
  id: string;
  username: string;
  program?: string;
  votes: number;
  percentage: number;
  isNpc?: boolean;
  platform?: { key: string; label: string; emoji: string; color: string } | null;
  promises?: string[];
  endorsements?: number;
  campaignSpend?: number;
}

interface ViewCandidatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  electionId: string;
  position: string;
}

const ViewCandidatesModal: React.FC<ViewCandidatesModalProps> = ({
  isOpen,
  onClose,
  electionId,
  position
}) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && electionId) {
      fetchCandidates();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, electionId]);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/politics/elections/${electionId}/results`);
      setCandidates(response.data.election.candidates || []);
      setTotalVotes(response.data.election.totalVotes || 0);
    } catch (error) {
      console.error('Failed to fetch candidates:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div className="modal-header">
          <h2>Candidates for {position}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="city-form">
          <div style={{ marginBottom: '16px', color: '#aaa' }}>
            Total Votes: {totalVotes}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>
              Loading candidates...
            </div>
          ) : candidates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>
              No candidates registered yet
            </div>
          ) : (
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {candidates.map((candidate, index) => (
                <div
                  key={candidate.id}
                  style={{
                    padding: '16px',
                    margin: '12px 0',
                    background: index === 0 ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.2) 0%, rgba(76, 175, 80, 0.05) 100%)' : '#0f0f1e',
                    border: `2px solid ${index === 0 ? '#4CAF50' : '#2d2d44'}`,
                    borderRadius: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      {index === 0 && <span style={{ fontSize: '24px' }}>🏆</span>}
                      {candidate.platform && <span style={{ fontSize: '20px' }} title={candidate.platform.label}>{candidate.platform.emoji}</span>}
                      <strong style={{ color: '#fff', fontSize: '18px' }}>{candidate.username}</strong>
                      {candidate.isNpc && (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#9ec5ff', border: '1px solid rgba(99,179,237,0.35)', background: 'rgba(99,179,237,0.12)', borderRadius: '6px', padding: '1px 5px' }}>NPC</span>
                      )}
                      {!!(candidate.endorsements && candidate.endorsements > 0) && (
                        <span style={{ fontSize: '12px', color: '#8fe3a6' }}>👍 {candidate.endorsements}</span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#4CAF50', fontSize: '20px', fontWeight: 'bold' }}>
                        {candidate.votes}
                      </div>
                      <div style={{ color: '#888', fontSize: '14px' }}>
                        {candidate.percentage}%
                      </div>
                    </div>
                  </div>

                  {candidate.promises && candidate.promises.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                      {candidate.promises.map((p, i) => (
                        <span key={i} style={{ fontSize: '11.5px', color: '#bff0c6', background: 'rgba(76,175,80,0.12)', border: '1px solid rgba(76,175,80,0.3)', borderRadius: '999px', padding: '2px 9px' }}>
                          🎯 {p}
                        </span>
                      ))}
                    </div>
                  )}

                  {candidate.program && (
                    <div style={{
                      padding: '12px',
                      background: '#1a1a2e',
                      borderRadius: '6px',
                      borderLeft: '3px solid #4CAF50'
                    }}>
                      <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px', fontWeight: 600 }}>
                        POLITICAL PROGRAM
                      </div>
                      <p style={{ fontSize: '14px', color: '#ccc', margin: 0, lineHeight: '1.6' }}>
                        {candidate.program}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="form-actions" style={{ marginTop: '20px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-primary"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewCandidatesModal;
