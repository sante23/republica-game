import React, { useState, useEffect } from 'react';
import api from '../config/api';
import './CityFoundModal.css';

interface Candidate {
  id: string;
  username: string;
  program?: string;
  votes: number;
  percentage: number;
}

interface VoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (candidateId: string) => Promise<void>;
  electionId: string;
  position: string;
}

const VoteModal: React.FC<VoteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  electionId,
  position
}) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingCandidates, setFetchingCandidates] = useState(false);

  useEffect(() => {
    if (isOpen && electionId) {
      fetchCandidates();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, electionId]);

  const fetchCandidates = async () => {
    setFetchingCandidates(true);
    try {
      const response = await api.get(`/politics/elections/${electionId}/results`);
      setCandidates(response.data.election.candidates || []);
    } catch (error) {
      console.error('Failed to fetch candidates:', error);
      setError('Failed to load candidates');
    } finally {
      setFetchingCandidates(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedCandidate) {
      setError('Please select a candidate');
      return;
    }

    setLoading(true);
    try {
      await onConfirm(selectedCandidate);
      setSelectedCandidate('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to cast vote');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedCandidate('');
    setError('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Vote for {position}</h2>
          <button className="modal-close" onClick={handleClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="city-form">
          {fetchingCandidates ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>
              Loading candidates...
            </div>
          ) : candidates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>
              No candidates registered yet
            </div>
          ) : (
            <div className="form-group">
              <label>Select Candidate</label>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {candidates.map(candidate => (
                  <div
                    key={candidate.id}
                    onClick={() => setSelectedCandidate(candidate.id)}
                    style={{
                      padding: '12px',
                      margin: '8px 0',
                      background: selectedCandidate === candidate.id ? '#2d2d44' : '#0f0f1e',
                      border: `2px solid ${selectedCandidate === candidate.id ? '#4CAF50' : '#2d2d44'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ color: '#fff' }}>{candidate.username}</strong>
                      <span style={{ color: '#4CAF50' }}>{candidate.votes} votes ({candidate.percentage}%)</span>
                    </div>
                    {candidate.program && (
                      <p style={{ fontSize: '13px', color: '#aaa', margin: 0 }}>
                        {candidate.program}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button
              type="button"
              onClick={handleClose}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !selectedCandidate || candidates.length === 0}
            >
              {loading ? 'Voting...' : 'Cast Vote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VoteModal;
