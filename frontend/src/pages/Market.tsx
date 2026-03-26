import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../contexts/GameContext';
import { useToast } from '../contexts/ToastContext';
import api from '../config/api';
import { ArrowLeft, TrendingUp, ShoppingCart, Package, BarChart2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { playSound } from '../utils/sounds';
import CreateListingModal from '../components/CreateListingModal';
import NpcMerchant from '../components/NpcMerchant';
import './Market.css';

interface Listing {
  id: string;
  resource: string;
  quantity: number;
  pricePerUnit: number;
  seller: {
    username: string;
    reputation: number;
  };
  city: {
    name: string;
  };
}

const Market: React.FC = () => {
  const navigate = useNavigate();
  const { cities } = useGame();
  const toast = useToast();
  const [listings, setListings] = useState<Listing[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [chartResource, setChartResource] = useState('food');
  const [showChart, setShowChart] = useState(false);

  useEffect(() => {
    fetchListings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const fetchListings = async () => {
    try {
      const params = filter !== 'all' ? { resource: filter } : {};
      const response = await api.get('/market/listings', { params });
      setListings(response.data.listings);
    } catch (error) {
      console.error('Failed to fetch listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const buyListing = async (listingId: string) => {
    setBuying(listingId);
    try {
      await api.post(`/market/buy/${listingId}`);
      fetchListings();
      playSound('trade');
      toast.success('Purchase successful!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Purchase failed');
    } finally {
      setBuying(null);
    }
  };

  const createListing = async (cityId: string, resource: string, quantity: number, pricePerUnit: number) => {
    try {
      await api.post('/market/sell', { cityId, resource, quantity, pricePerUnit });
      fetchListings();
      toast.success('Listing created successfully! 🏪');
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to create listing';
      throw new Error(errorMsg);
    }
  };

  const resourceIcons: Record<string, string> = {
    food: '🌾',
    wood: '🪵',
    stone: '🪨',
    iron: '⚙️',
    gold: '🪙',
    energy: '⚡',
  };

  return (
    <div className="market-page">
      <header className="market-header">
        <button onClick={() => navigate('/')} className="back-button">
          <ArrowLeft /> Back
        </button>
        <h1>Global Marketplace</h1>
        <button className="btn-primary" onClick={() => setIsCreateModalOpen(true)}>
          <Package /> Create Listing
        </button>
      </header>

      <NpcMerchant />

      <div className="market-filters">
        <button 
          className={filter === 'all' ? 'active' : ''} 
          onClick={() => setFilter('all')}
        >
          All Resources
        </button>
        {Object.entries(resourceIcons).map(([resource, icon]) => (
          <button
            key={resource}
            className={filter === resource ? 'active' : ''}
            onClick={() => setFilter(resource)}
          >
            {icon} {resource.charAt(0).toUpperCase() + resource.slice(1)}
          </button>
        ))}
      </div>

      {/* Price History Chart */}
      <div className="price-chart-section">
        <button className="btn-chart-toggle" onClick={() => {
          setShowChart(!showChart);
          if (!showChart) {
            api.get(`/market/history/${chartResource}`).then(r => setPriceHistory(r.data)).catch(() => {});
          }
        }}>
          <BarChart2 size={16} /> {showChart ? 'Hide' : 'Show'} Price History
        </button>

        {showChart && (
          <div className="price-chart-container">
            <div className="chart-resource-selector">
              {Object.entries(resourceIcons).map(([res, icon]) => (
                <button
                  key={res}
                  className={chartResource === res ? 'active' : ''}
                  onClick={() => {
                    setChartResource(res);
                    api.get(`/market/history/${res}`).then(r => setPriceHistory(r.data)).catch(() => {});
                  }}
                >
                  {icon} {res}
                </button>
              ))}
            </div>
            {priceHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={priceHistory.map(p => ({
                  time: new Date(p.snapshotAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  avg: p.avgPrice,
                  min: p.minPrice,
                  max: p.maxPrice
                }))}>
                  <XAxis dataKey="time" tick={{ fill: '#718096', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#718096', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#2d3748', border: 'none', borderRadius: 8, color: '#fff' }} />
                  <Line type="monotone" dataKey="avg" stroke="#667eea" strokeWidth={2} dot={false} name="Avg Price" />
                  <Line type="monotone" dataKey="min" stroke="#48bb78" strokeWidth={1} dot={false} name="Min" />
                  <Line type="monotone" dataKey="max" stroke="#fc8181" strokeWidth={1} dot={false} name="Max" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="no-data">No price history yet. Data is recorded hourly.</p>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading">Loading market...</div>
      ) : listings.length === 0 ? (
        <div className="empty-state">
          <ShoppingCart size={64} />
          <h3>No listings available</h3>
          <p>Check back later or create your own listing!</p>
        </div>
      ) : (
        <div className="listings-table">
          <table>
            <thead>
              <tr>
                <th>Resource</th>
                <th>Quantity</th>
                <th>Price/Unit</th>
                <th>Total</th>
                <th>Seller</th>
                <th>Location</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {listings.map(listing => (
                <tr key={listing.id}>
                  <td>
                    <span className="resource-name">
                      {resourceIcons[listing.resource]} {listing.resource}
                    </span>
                  </td>
                  <td>{listing.quantity.toLocaleString()}</td>
                  <td>🪙 {listing.pricePerUnit}</td>
                  <td className="total-price">
                    🪙 {(listing.quantity * listing.pricePerUnit).toLocaleString()}
                  </td>
                  <td>
                    <div className="seller-info">
                      <span>{listing.seller.username}</span>
                      <span className="reputation">⭐ {listing.seller.reputation}</span>
                    </div>
                  </td>
                  <td>{listing.city.name}</td>
                  <td>
                    <button
                      className="btn-buy"
                      onClick={() => buyListing(listing.id)}
                      disabled={buying === listing.id}
                    >
                      {buying === listing.id ? 'Buying...' : 'Buy'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="market-stats">
        <div className="stat">
          <TrendingUp />
          <span>Active Listings: {listings.length}</span>
        </div>
        <div className="stat">
          <span>Average Prices:</span>
          {Object.keys(resourceIcons).map(resource => {
            const resourceListings = listings.filter(l => l.resource === resource);
            const avgPrice = resourceListings.length > 0
              ? (resourceListings.reduce((sum, l) => sum + l.pricePerUnit, 0) / resourceListings.length).toFixed(2)
              : '0';
            return (
              <span key={resource}>
                {resourceIcons[resource]} {avgPrice}
              </span>
            );
          })}
        </div>
      </div>

      <CreateListingModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onConfirm={createListing}
        cities={cities}
      />
    </div>
  );
};

export default Market;