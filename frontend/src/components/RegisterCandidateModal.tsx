import React, { useState } from 'react';
import './CityFoundModal.css';

interface RegisterCandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (program: string, promises: string[]) => Promise<void>;
  electionId: string;
  position: string;
}

// Must mirror backend/config/electionConfig.js PROMISE_OPTIONS
const PROMISES: { id: string; label: string }[] = [
  { id: 'lower_taxes', label: 'Lower taxes for citizens' },
  { id: 'boost_production', label: 'Decree regular production boosts' },
  { id: 'public_order', label: 'Raise happiness & public order' },
  { id: 'fund_defense', label: 'Fund the military' },
  { id: 'free_market', label: 'Keep the market free (no bans)' },
  { id: 'welfare', label: 'Subsidies for new settlers' },
];

const RegisterCandidateModal: React.FC<RegisterCandidateModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  electionId,
  position
}) => {
  const [program, setProgram] = useState('');
  const [promises, setPromises] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const togglePromise = (id: string) => {
    setPromises(prev => {
      if (prev.includes(id)) return prev.filter(p => p !== id);
      if (prev.length >= 3) return prev; // cap at 3
      return [...prev, id];
    });
  };

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
      await onConfirm(program, promises);
      setProgram('');
      setPromises([]);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setProgram('');
    setPromises([]);
    setError('');
    onClose();
  };

  const costs: Record<string, number> = { MAYOR: 100, GOVERNOR: 500, PRESIDENT: 1000 };
  const levels: Record<string, number> = { MAYOR: 1, GOVERNOR: 3, PRESIDENT: 5 };

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
            <label>Campaign Promises <span style={{ color: '#888', fontWeight: 400 }}>(pick up to 3 — graded at end of term)</span></label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
              {PROMISES.map(p => {
                const active = promises.includes(p.id);
                const disabled = !active && promises.length >= 3;
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => togglePromise(p.id)}
                    disabled={disabled}
                    style={{
                      padding: '6px 10px',
                      fontSize: '12.5px',
                      borderRadius: '999px',
                      cursor: disabled ? 'default' : 'pointer',
                      background: active ? 'rgba(76,175,80,0.2)' : '#0f0f1e',
                      border: `1px solid ${active ? '#4CAF50' : '#2d2d44'}`,
                      color: active ? '#bff0c6' : disabled ? '#555' : '#ccc',
                      transition: 'all .15s'
                    }}
                  >
                    {active ? '✓ ' : ''}{p.label}
                  </button>
                );
              })}
            </div>
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
              rows={6}
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
            <button type="button" onClick={handleClose} className="btn-secondary" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Registering...' : 'Register as Candidate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterCandidateModal;
