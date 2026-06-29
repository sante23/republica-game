import React, { useEffect, useState, useCallback } from 'react';
import { useGame } from '../contexts/GameContext';
import { useToast } from '../contexts/ToastContext';
import api from '../config/api';
import { Skull, HeartHandshake } from 'lucide-react';
import './CrisisPanel.css';

interface Boss {
  id: string; name: string; maxHp: number; hp: number; status: string;
  contributors: number; myDamage: number;
  top?: { username: string; damage: number }[];
}
interface Effort {
  id: string; title: string; resource: string; goal: number; contributed: number;
  contributors: number; myAmount: number;
}

const CrisisPanel: React.FC = () => {
  const { cities, socket } = useGame();
  const toast = useToast();
  const [boss, setBoss] = useState<Boss | null>(null);
  const [effort, setEffort] = useState<Effort | null>(null);
  const [busy, setBusy] = useState(false);
  const [donateAmt, setDonateAmt] = useState(100);

  const capital = cities.find((c: any) => c.isCapital) || cities[0] || null;

  const fetchBoss = useCallback(async () => {
    try { const r = await api.get('/military/boss'); setBoss(r.data.boss); } catch { /* ignore */ }
  }, []);
  const fetchEffort = useCallback(async () => {
    try { const r = await api.get('/economy/war-effort'); setEffort(r.data.effort); } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchBoss(); fetchEffort(); }, [fetchBoss, fetchEffort]);

  useEffect(() => {
    if (!socket) return;
    const onBoss = (d: any) => {
      if (d.defeated || d.spawned) { fetchBoss(); return; }
      setBoss(prev => prev && prev.id === d.id ? { ...prev, hp: d.hp, maxHp: d.maxHp, status: d.status } : prev);
    };
    const onEffort = (d: any) => {
      if (d.spawned || d.status === 'completed') { fetchEffort(); return; }
      setEffort(prev => prev && prev.id === d.id ? { ...prev, contributed: d.contributed } : prev);
    };
    socket.on('world-boss', onBoss);
    socket.on('war-effort', onEffort);
    return () => { socket.off('world-boss', onBoss); socket.off('war-effort', onEffort); };
  }, [socket, fetchBoss, fetchEffort]);

  const attackBoss = async () => {
    if (!boss || !capital) return;
    setBusy(true);
    try {
      const u = await api.get(`/military/city/${capital.id}`);
      const units: Record<string, number> = {};
      (u.data || []).forEach((x: any) => { if (x.quantity > 0) units[x.unitType] = x.quantity; });
      if (Object.keys(units).length === 0) { toast.error('No units to send — train an army first.'); setBusy(false); return; }
      const r = await api.post(`/military/boss/${boss.id}/attack`, { cityId: capital.id, units });
      if (r.data.defeated) toast.success(`Armada defeated! Your share: ${r.data.myReward?.credits ?? 0} credits 🎉`);
      else toast.success(`Dealt ${r.data.damageDealt} damage to the armada!`);
      fetchBoss();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Attack failed');
    } finally { setBusy(false); }
  };

  const donate = async () => {
    if (!effort || !capital) return;
    setBusy(true);
    try {
      const r = await api.post(`/economy/war-effort/${effort.id}/donate`, { cityId: capital.id, amount: donateAmt });
      if (r.data.completed) toast.success('Relief Fund complete — realm-wide buff active! 🎉');
      else toast.success(`Donated ${donateAmt} ${effort.resource}.`);
      fetchEffort();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Donation failed');
    } finally { setBusy(false); }
  };

  if (!boss && !effort) return null;

  const bossPct = boss ? Math.max(0, Math.round((boss.hp / boss.maxHp) * 100)) : 0;
  const effPct = effort ? Math.min(100, Math.round((effort.contributed / effort.goal) * 100)) : 0;

  return (
    <div className="crisis-panel">
      {boss && (
        <div className="crisis-card boss">
          <div className="crisis-head">
            <Skull size={18} />
            <strong>{boss.name}</strong>
            <span className="crisis-sub">{boss.contributors} fighting · your dmg {boss.myDamage}</span>
          </div>
          <div className="crisis-bar">
            <div className="crisis-fill boss-fill" style={{ width: `${bossPct}%` }} />
            <span className="crisis-bar-label">{boss.hp.toLocaleString()} / {boss.maxHp.toLocaleString()} HP</span>
          </div>
          <button className="crisis-btn attack" onClick={attackBoss} disabled={busy || !capital}>
            ⚔️ Attack with {capital?.name || '—'}
          </button>
        </div>
      )}

      {effort && (
        <div className="crisis-card effort">
          <div className="crisis-head">
            <HeartHandshake size={18} />
            <strong>{effort.title}</strong>
            <span className="crisis-sub">{effort.contributors} donors · you gave {effort.myAmount}</span>
          </div>
          <div className="crisis-bar">
            <div className="crisis-fill effort-fill" style={{ width: `${effPct}%` }} />
            <span className="crisis-bar-label">{effort.contributed.toLocaleString()} / {effort.goal.toLocaleString()} {effort.resource}</span>
          </div>
          <div className="crisis-donate">
            <input type="number" min={1} value={donateAmt}
              onChange={e => setDonateAmt(Math.max(1, parseInt(e.target.value) || 0))} />
            <button className="crisis-btn donate" onClick={donate} disabled={busy || !capital}>
              Donate {effort.resource}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrisisPanel;
