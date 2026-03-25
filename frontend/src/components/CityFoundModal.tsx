import React, { useState } from 'react';
import './CityFoundModal.css';

interface CityFoundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, x: number, y: number) => Promise<void>;
}

const CityFoundModal: React.FC<CityFoundModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (name.length < 3) {
      setError('City name must be at least 3 characters');
      return;
    }

    // Auto-generate random coordinates
    const x = Math.floor(Math.random() * 2001) - 1000;
    const y = Math.floor(Math.random() * 2001) - 1000;

    setLoading(true);
    try {
      await onConfirm(name, x, y);
      setName('');
      onClose();
    } catch (err: any) {
      // If location occupied, retry with different coords
      if (err.message?.includes('occupied')) {
        const x2 = Math.floor(Math.random() * 2001) - 1000;
        const y2 = Math.floor(Math.random() * 2001) - 1000;
        try {
          await onConfirm(name, x2, y2);
          setName('');
          onClose();
          return;
        } catch (err2: any) {
          setError(err2.message || 'Failed to create city');
        }
      } else {
        setError(err.message || 'Failed to create city');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setError('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Found New City</h2>
          <button className="modal-close" onClick={handleClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="city-form">
          <div className="form-group">
            <label htmlFor="cityName">Choose a name for your city</label>
            <input
              id="cityName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rome, Carthage, Alexandria..."
              minLength={3}
              maxLength={100}
              required
              disabled={loading}
              autoFocus
            />
            <p className="form-hint">Your settlers will find the best location automatically.</p>
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
              disabled={loading || name.length < 3}
            >
              {loading ? 'Founding...' : 'Found City'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CityFoundModal;
