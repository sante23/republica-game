import React, { useState } from 'react';
import './CreateListingModal.css';

interface City {
  id: string;
  name: string;
  resources: Record<string, number>;
}

interface CreateListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (cityId: string, resource: string, quantity: number, pricePerUnit: number) => Promise<void>;
  cities: City[];
}

const CreateListingModal: React.FC<CreateListingModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  cities
}) => {
  const [cityId, setCityId] = useState('');
  const [resource, setResource] = useState('food');
  const [quantity, setQuantity] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const resourceOptions = [
    { value: 'food', label: '🌾 Food', icon: '🌾' },
    { value: 'wood', label: '🪵 Wood', icon: '🪵' },
    { value: 'stone', label: '🪨 Stone', icon: '🪨' },
    { value: 'iron', label: '⚙️ Iron', icon: '⚙️' },
    { value: 'gold', label: '🪙 Gold', icon: '🪙' },
    { value: 'energy', label: '⚡ Energy', icon: '⚡' },
  ];

  const selectedCity = cities.find(c => c.id === cityId);
  const availableAmount = selectedCity?.resources[resource] || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!cityId) {
      setError('Please select a city');
      return;
    }

    const qty = parseInt(quantity);
    const price = parseFloat(pricePerUnit);

    if (isNaN(qty) || qty < 1) {
      setError('Quantity must be at least 1');
      return;
    }

    if (isNaN(price) || price < 0.01) {
      setError('Price must be at least 0.01');
      return;
    }

    if (qty > availableAmount) {
      setError(`Not enough ${resource}. Available: ${Math.floor(availableAmount)}`);
      return;
    }

    setLoading(true);
    try {
      await onConfirm(cityId, resource, qty, price);
      setCityId('');
      setQuantity('');
      setPricePerUnit('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create listing');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCityId('');
    setQuantity('');
    setPricePerUnit('');
    setError('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Market Listing</h2>
          <button className="modal-close" onClick={handleClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="listing-form">
          <div className="form-group">
            <label htmlFor="city">Select City</label>
            <select
              id="city"
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              required
              disabled={loading}
            >
              <option value="">-- Select a city --</option>
              {cities.map(city => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="resource">Resource</label>
            <select
              id="resource"
              value={resource}
              onChange={(e) => setResource(e.target.value)}
              required
              disabled={loading}
            >
              {resourceOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {selectedCity && (
              <span className="resource-available">
                Available: {Math.floor(availableAmount)}
              </span>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="quantity">Quantity</label>
              <input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Amount"
                min={1}
                max={Math.floor(availableAmount)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="price">Price per Unit (🪙)</label>
              <input
                id="price"
                type="number"
                step="0.01"
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(e.target.value)}
                placeholder="0.00"
                min={0.01}
                required
                disabled={loading}
              />
            </div>
          </div>

          {quantity && pricePerUnit && (
            <div className="total-preview">
              Total Value: 🪙 {(parseInt(quantity) * parseFloat(pricePerUnit)).toFixed(2)}
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
              disabled={loading || !cityId}
            >
              {loading ? 'Creating...' : 'Create Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateListingModal;
