import React, { useState } from 'react';
import './CityFoundModal.css';

interface CityFoundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, x: number, y: number) => Promise<void>;
}

const CityFoundModal: React.FC<CityFoundModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [name, setName] = useState('');
  const [x, setX] = useState('');
  const [y, setY] = useState('');
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

    const xCoord = parseInt(x);
    const yCoord = parseInt(y);

    if (isNaN(xCoord) || isNaN(yCoord)) {
      setError('Coordinates must be valid numbers');
      return;
    }

    if (xCoord < -1000 || xCoord > 1000 || yCoord < -1000 || yCoord > 1000) {
      setError('Coordinates must be between -1000 and 1000');
      return;
    }

    setLoading(true);
    try {
      await onConfirm(name, xCoord, yCoord);
      setName('');
      setX('');
      setY('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create city');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setX('');
    setY('');
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
            <label htmlFor="cityName">City Name</label>
            <input
              id="cityName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter city name"
              minLength={3}
              maxLength={100}
              required
              disabled={loading}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="cityX">X Coordinate</label>
              <input
                id="cityX"
                type="number"
                value={x}
                onChange={(e) => setX(e.target.value)}
                placeholder="X"
                min={-1000}
                max={1000}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="cityY">Y Coordinate</label>
              <input
                id="cityY"
                type="number"
                value={y}
                onChange={(e) => setY(e.target.value)}
                placeholder="Y"
                min={-1000}
                max={1000}
                required
                disabled={loading}
              />
            </div>
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
              {loading ? 'Creating...' : 'Found City'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CityFoundModal;
