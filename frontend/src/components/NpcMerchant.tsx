import React, { useEffect, useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { useToast } from '../contexts/ToastContext';
import api from '../config/api';
import { Store } from 'lucide-react';
import './NpcMerchant.css';

interface Prices {
  [resource: string]: { buy: number; sell: number };
}

const RESOURCE_ICONS: Record<string, string> = {
  food: '🌾', wood: '🪵', stone: '🪨', iron: '⛏️', gold: '💰', energy: '⚡'
};

const NpcMerchant: React.FC = () => {
  const { cities, selectedCity } = useGame();
  const [prices, setPrices] = useState<Prices>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const city = selectedCity || (cities.length > 0 ? cities[0] : null);

  useEffect(() => {
    api.get('/merchant/prices').then(r => setPrices(r.data)).catch(console.error);
  }, []);

  const trade = async (resource: string, action: 'buy' | 'sell') => {
    if (!city) return;
    const qty = quantities[resource] || 100;
    setLoading(true);
    try {
      const response = await api.post(`/merchant/${action}`, {
        cityId: city.id,
        resource,
        quantity: qty
      });
      toast.success(response.data.message);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Trade failed');
    } finally {
      setLoading(false);
    }
  };

  if (Object.keys(prices).length === 0) return null;

  return (
    <div className="npc-merchant">
      <h3><Store size={16} /> NPC Merchant</h3>
      <p className="npc-desc">Buy and sell resources at fixed prices. Prices are less favorable than player market.</p>
      <div className="npc-grid">
        {Object.entries(prices).map(([resource, price]) => (
          <div key={resource} className="npc-row">
            <span className="npc-resource">
              {RESOURCE_ICONS[resource]} {resource.charAt(0).toUpperCase() + resource.slice(1)}
            </span>
            <span className="npc-price buy-price">Buy: {price.buy}c</span>
            <span className="npc-price sell-price">Sell: {price.sell}c</span>
            <input
              type="number"
              min="1"
              max="10000"
              value={quantities[resource] || 100}
              onChange={e => setQuantities({ ...quantities, [resource]: parseInt(e.target.value) || 0 })}
              className="npc-qty"
            />
            <button className="npc-btn npc-buy" onClick={() => trade(resource, 'buy')} disabled={loading}>
              Buy ({((quantities[resource] || 100) * price.buy)}c)
            </button>
            <button className="npc-btn npc-sell" onClick={() => trade(resource, 'sell')} disabled={loading}>
              Sell ({((quantities[resource] || 100) * price.sell)}c)
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NpcMerchant;
