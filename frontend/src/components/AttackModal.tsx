import React, { useState, useEffect } from 'react';
import api from '../config/api';
import { playSound } from '../utils/sounds';
import './CityFoundModal.css';

interface MyCity { id: string; name: string; }
interface Unit { unitType: string; quantity: number; }

interface AttackModalProps {
  isOpen: boolean;
  onClose: () => void;
  defender: { id: string; name: string } | null;
  myCities: MyCity[];
}

const UNIT_LABELS: Record<string, string> = {
  infantry: 'Infantry', archer: 'Archer', cavalry: 'Cavalry', siege: 'Siege Engine'
};

const AttackModal: React.FC<AttackModalProps> = ({ isOpen, onClose, defender, myCities }) => {
  const [attackerCityId, setAttackerCityId] = useState('');
  const [available, setAvailable] = useState<Record<string, number>>({});
  const [units, setUnits] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    if (isOpen && myCities.length && !attackerCityId) setAttackerCityId(myCities[0].id);
  }, [isOpen, myCities, attackerCityId]);

  useEffect(() => {
    if (!isOpen || !attackerCityId) return;
    setReport(null); setError(''); setUnits({});
    (async () => {
      try {
        const res = await api.get(`/military/city/${attackerCityId}`);
        const map: Record<string, number> = {};
        (res.data || []).forEach((u: Unit) => { map[u.unitType] = u.quantity; });
        setAvailable(map);
      } catch {
        setAvailable({});
      }
    })();
  }, [isOpen, attackerCityId]);

  if (!isOpen || !defender) return null;

  const setUnit = (type: string, val: number, max: number) => {
    setUnits(prev => ({ ...prev, [type]: Math.max(0, Math.min(isNaN(val) ? 0 : val, max)) }));
  };

  const totalSent = Object.values(units).reduce((s, v) => s + (v || 0), 0);
  const totalAvailable = Object.values(available).reduce((s, v) => s + (v || 0), 0);

  const handleAttack = async () => {
    setError('');
    if (totalSent <= 0) { setError('Select at least one unit to send.'); return; }
    setLoading(true);
    try {
      const cleaned: Record<string, number> = {};
      Object.entries(units).forEach(([k, v]) => { if (v > 0) cleaned[k] = v; });
      const res = await api.post('/military/attack', { attackerCityId, defenderCityId: defender.id, units: cleaned });
      setReport(res.data);
      playSound(res.data?.outcome === 'attacker_win' ? 'build' : 'error');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Attack failed');
      playSound('error');
    } finally {
      setLoading(false);
    }
  };

  const close = () => { setUnits({}); setReport(null); setError(''); onClose(); };

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚔️ Attack {defender.name}</h2>
          <button className="modal-close" onClick={close}>&times;</button>
        </div>

        <div className="city-form">
          {report ? (
            <div>
              <h3 style={{ color: report.outcome === 'attacker_win' ? '#4CAF50' : '#fc8181' }}>
                {report.outcome === 'attacker_win' ? '🏆 Victory!' : '💀 Defeat'}
              </h3>
              <p style={{ color: '#ccc' }}>{report.summary}</p>
              {report.plunder && Object.keys(report.plunder).length > 0 && (
                <p style={{ color: '#ffd27a' }}>
                  Plundered: {Object.entries(report.plunder).map(([r, a]) => `${a} ${r}`).join(', ')}
                </p>
              )}
              <p style={{ fontSize: 13, color: '#888' }}>
                Your losses: {report.attacker?.totalLost ?? 0} · Enemy losses: {report.defender?.totalLost ?? 0}
              </p>
              <div className="form-actions">
                <button className="btn-primary" onClick={close}>Done</button>
              </div>
            </div>
          ) : (
            <>
              {myCities.length > 1 && (
                <div className="form-group">
                  <label>Attack from</label>
                  <select
                    value={attackerCityId}
                    onChange={e => setAttackerCityId(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: '#0f0f1e', border: '1px solid #2d2d44', borderRadius: 8, color: '#fff' }}
                  >
                    {myCities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Units to send</label>
                {totalAvailable === 0 && (
                  <p style={{ color: '#fc8181', fontSize: 13 }}>No units in this city — train some first.</p>
                )}
                {['infantry', 'archer', 'cavalry', 'siege'].map(type => (
                  <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0' }}>
                    <span style={{ width: 100, color: '#ccc' }}>{UNIT_LABELS[type]}</span>
                    <input
                      type="number" min={0} max={available[type] || 0} value={units[type] || 0}
                      onChange={e => setUnit(type, parseInt(e.target.value), available[type] || 0)}
                      style={{ width: 90, padding: '6px', background: '#0f0f1e', border: '1px solid #2d2d44', borderRadius: 6, color: '#fff' }}
                    />
                    <span style={{ color: '#888', fontSize: 12 }}>/ {available[type] || 0} available</span>
                  </div>
                ))}
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="form-actions">
                <button className="btn-secondary" onClick={close} disabled={loading}>Cancel</button>
                <button className="btn-primary" onClick={handleAttack} disabled={loading || totalSent <= 0}>
                  {loading ? 'Attacking…' : `Send ${totalSent} units`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttackModal;
