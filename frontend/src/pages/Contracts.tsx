import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import api from '../config/api';
import { ArrowLeft, FileText, Check, X } from 'lucide-react';
import './Contracts.css';

interface Contract {
  id: string;
  sellerId: string;
  buyerId: string;
  resource: string;
  quantityPerDelivery: number;
  pricePerUnit: number;
  deliveriesTotal: number;
  deliveriesCompleted: number;
  intervalHours: number;
  nextDeliveryAt: string | null;
  status: string;
  seller: { username: string };
  buyer: { username: string };
}

const Contracts: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => { fetchContracts(); }, []);

  const fetchContracts = async () => {
    try {
      const res = await api.get('/contracts/my');
      setContracts(res.data);
    } catch (err) {
      console.error('Failed to fetch contracts:', err);
    } finally {
      setLoading(false);
    }
  };

  const respondToContract = async (contractId: string, accept: boolean) => {
    try {
      await api.post(`/contracts/${contractId}/respond`, { accept });
      await fetchContracts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const cancelContract = async (contractId: string) => {
    if (!window.confirm('Cancel this contract?')) return;
    try {
      await api.post(`/contracts/${contractId}/cancel`);
      await fetchContracts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const pending = contracts.filter(c => c.status === 'proposed' && c.buyerId === user?.id);
  const active = contracts.filter(c => c.status === 'active');
  const myProposals = contracts.filter(c => c.status === 'proposed' && c.sellerId === user?.id);
  const history = contracts.filter(c => ['completed', 'cancelled', 'breached'].includes(c.status));

  const getTimeToDelivery = (nextDeliveryAt: string | null) => {
    if (!nextDeliveryAt) return '-';
    const diff = new Date(nextDeliveryAt).getTime() - Date.now();
    if (diff <= 0) return 'Now';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="contracts-page">
      <header className="contracts-header">
        <button onClick={() => navigate('/')} className="back-button">
          <ArrowLeft /> Back
        </button>
        <h1><FileText size={28} /> Trade Contracts</h1>
      </header>

      {/* Pending proposals for me */}
      {pending.length > 0 && (
        <section className="contracts-section">
          <h2>Pending Proposals</h2>
          <div className="contracts-list">
            {pending.map(c => (
              <div key={c.id} className="contract-card pending">
                <div className="contract-info">
                  <div className="contract-parties">
                    <strong>{c.seller.username}</strong> wants to sell you
                  </div>
                  <div className="contract-terms">
                    <span>{c.quantityPerDelivery} {c.resource}</span>
                    <span>at {c.pricePerUnit} credits/unit</span>
                    <span>{c.deliveriesTotal} deliveries every {c.intervalHours}h</span>
                  </div>
                  <div className="contract-total">
                    Total cost: {(c.quantityPerDelivery * c.pricePerUnit * c.deliveriesTotal).toLocaleString()} credits
                  </div>
                </div>
                <div className="contract-actions">
                  <button className="btn-accept" onClick={() => respondToContract(c.id, true)}>
                    <Check size={14} /> Accept
                  </button>
                  <button className="btn-reject" onClick={() => respondToContract(c.id, false)}>
                    <X size={14} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active contracts */}
      <section className="contracts-section">
        <h2>Active Contracts</h2>
        {loading ? (
          <div className="loading">Loading...</div>
        ) : active.length === 0 ? (
          <p className="empty-text">No active contracts</p>
        ) : (
          <div className="contracts-list">
            {active.map(c => {
              const isSeller = c.sellerId === user?.id;
              return (
                <div key={c.id} className="contract-card active">
                  <div className="contract-info">
                    <div className="contract-parties">
                      <span className={`role-badge ${isSeller ? 'seller' : 'buyer'}`}>
                        {isSeller ? 'Selling to' : 'Buying from'}
                      </span>
                      <strong>{isSeller ? c.buyer.username : c.seller.username}</strong>
                    </div>
                    <div className="contract-terms">
                      <span>{c.quantityPerDelivery} {c.resource}</span>
                      <span>{c.pricePerUnit} cr/unit</span>
                      <span>Every {c.intervalHours}h</span>
                    </div>
                    <div className="contract-progress">
                      <div className="contract-progress-bar">
                        <div style={{ width: `${(c.deliveriesCompleted / c.deliveriesTotal) * 100}%` }} />
                      </div>
                      <span>{c.deliveriesCompleted} / {c.deliveriesTotal} deliveries</span>
                    </div>
                    <div className="contract-next">
                      Next delivery: {getTimeToDelivery(c.nextDeliveryAt)}
                    </div>
                  </div>
                  <button className="btn-cancel-contract" onClick={() => cancelContract(c.id)}>Cancel</button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* My pending proposals */}
      {myProposals.length > 0 && (
        <section className="contracts-section">
          <h2>My Proposals (waiting for response)</h2>
          <div className="contracts-list">
            {myProposals.map(c => (
              <div key={c.id} className="contract-card proposed">
                <div className="contract-info">
                  <span>Proposed to <strong>{c.buyer.username}</strong></span>
                  <span>{c.quantityPerDelivery} {c.resource} at {c.pricePerUnit} cr/unit</span>
                </div>
                <button className="btn-cancel-contract" onClick={() => cancelContract(c.id)}>Cancel</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* History */}
      {history.length > 0 && (
        <section className="contracts-section">
          <h2>History</h2>
          <div className="contracts-list">
            {history.map(c => (
              <div key={c.id} className={`contract-card history status-${c.status}`}>
                <div className="contract-info">
                  <span>{c.seller.username} &rarr; {c.buyer.username}</span>
                  <span>{c.quantityPerDelivery} {c.resource} ({c.deliveriesCompleted}/{c.deliveriesTotal})</span>
                  <span className={`status-badge status-${c.status}`}>{c.status}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default Contracts;
