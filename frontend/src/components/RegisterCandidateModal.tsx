import React, { useState } from 'react';
import './CityFoundModal.css';

interface RegisterCandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (program: string) => Promise<void>;
  electionId: string;
  position: string;
}

const RegisterCandidateModal: React.FC<RegisterCandidateModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  electionId,
  position
}) => {
  const [program, setProgram] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (program.length < 50) {
      setError('Program must be at least 50 characters');
      return;
    }

    if (program.length > 1000) {
      setError('Program must be less than 1000 characters');
      return;
    }

    setLoading(true);
    try {
      await onConfirm(program);
      setProgram('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setProgram('');
    setError('');
    onClose();
  };

  const costs: Record<string, number> = {
    MAYOR: 1000,
    GOVERNOR: 5000,
    PRESIDENT: 10000
  };

  const levels: Record<string, number> = {
    MAYOR: 10,
    GOVERNOR: 25,
    PRESIDENT: 40
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Register as Candidate for {position}</h2>
          <button className="modal-close" onClick={handleClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="city-form">
          <div className="form-group">
            <p style={{ color: '#aaa', marginBottom: '16px' }}>
              Registration Cost: 🪙 {costs[position] || 0} Credits<br />
              Required Level: {levels[position] || 0}
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="program">Your Political Program</label>
            <textarea
              id="program"
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              placeholder="Describe your vision and policies (50-1000 characters)..."
              minLength={50}
              maxLength={1000}
              rows={8}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: '#0f0f1e',
                border: '1px solid #2d2d44',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
            <span style={{ fontSize: '12px', color: '#888', marginTop: '4px', display: 'block' }}>
              {program.length} / 1000 characters (min 50)
            </span>
          </div>

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
              disabled={loading}
            >
              {loading ? 'Registering...' : 'Register as Candidate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterCandidateModal;
