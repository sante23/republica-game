import React, { useEffect, useState } from 'react';
import { useGame } from '../contexts/GameContext';
import api from '../config/api';
import { TrendingUp, ArrowRightLeft, Settings } from 'lucide-react';
import './Economy.css';

const Economy: React.FC = () => {
  const { cities } = useGame();
  const [tradeRoutes, setTradeRoutes] = useState<any[]>([]);
  const [autoOrders, setAutoOrders] = useState<any[]>([]);
  const [taxSettings, setTaxSettings] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('routes');
  const [selectedCity, setSelectedCity] = useState<any>(null);

  useEffect(() => {
    if (cities.length > 0 && !selectedCity) {
      setSelectedCity(cities[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities]);

  useEffect(() => {
    if (selectedCity) {
      fetchTradeRoutes();
    }
    fetchAutoOrders();
    fetchTaxSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCity]);

  const fetchTradeRoutes = async () => {
    if (!selectedCity) return;
    try {
      const response = await api.get(`/economy/trade-routes/city/${selectedCity.id}`);
      setTradeRoutes(response.data);
    } catch (error) {
      console.error('Error fetching trade routes:', error);
    }
  };

  const fetchAutoOrders = async () => {
    try {
      const response = await api.get('/economy/auto-orders');
      setAutoOrders(response.data);
    } catch (error) {
      console.error('Error fetching auto orders:', error);
    }
  };

  const fetchTaxSettings = async () => {
    try {
      const response = await api.get('/economy/tax-settings');
      setTaxSettings(response.data);
    } catch (error) {
      console.error('Error fetching tax settings:', error);
    }
  };

  const createTradeRoute = async () => {
    const toCityId = prompt('Enter destination city ID:');
    const resourceType = prompt('Resource type (food/wood/stone/gold):');
    const quantity = prompt('Quantity per hour:');

    if (!toCityId || !resourceType || !quantity) return;

    try {
      await api.post('/economy/trade-routes', {
        fromCityId: selectedCity.id,
        toCityId,
        resourceType,
        quantityPerHour: parseFloat(quantity)
      });
      alert('Trade route created!');
      fetchTradeRoutes();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create trade route');
    }
  };

  const createAutoOrder = async () => {
    const resourceType = prompt('Resource type:');
    const orderType = prompt('Order type (buy/sell):');
    const price = prompt('Price per unit:');
    const quantity = prompt('Quantity:');

    if (!resourceType || !orderType || !price || !quantity) return;

    try {
      await api.post('/economy/auto-orders', {
        resourceType,
        orderType,
        price: parseFloat(price),
        quantity: parseInt(quantity)
      });
      alert('Auto order created!');
      fetchAutoOrders();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create auto order');
    }
  };

  return (
    <div className="economy-page">
      <h1>📊 Economic Management</h1>

      {/* City Selector */}
      <div className="city-selector">
        <label>Select City:</label>
        <select
          value={selectedCity?.id || ''}
          onChange={(e) => setSelectedCity(cities.find(c => c.id === e.target.value))}
        >
          {cities.map(city => (
            <option key={city.id} value={city.id}>{city.name}</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={activeTab === 'routes' ? 'active' : ''}
          onClick={() => setActiveTab('routes')}
        >
          <ArrowRightLeft size={18} /> Trade Routes
        </button>
        <button
          className={activeTab === 'orders' ? 'active' : ''}
          onClick={() => setActiveTab('orders')}
        >
          <TrendingUp size={18} /> Auto Orders
        </button>
        <button
          className={activeTab === 'tax' ? 'active' : ''}
          onClick={() => setActiveTab('tax')}
        >
          <Settings size={18} /> Tax Settings
        </button>
      </div>

      {/* Trade Routes Tab */}
      {activeTab === 'routes' && (
        <div className="section">
          <div className="section-header">
            <h2>Trade Routes</h2>
            <button className="btn-primary" onClick={createTradeRoute}>
              Create Route
            </button>
          </div>
          {tradeRoutes.length === 0 ? (
            <p>No trade routes yet</p>
          ) : (
            <div className="routes-list">
              {tradeRoutes.map(route => (
                <div key={route.id} className="route-card">
                  <div className="route-info">
                    <strong>{route.fromCity?.name}</strong> → <strong>{route.toCity?.name}</strong>
                  </div>
                  <div>Resource: {route.resourceType}</div>
                  <div>Quantity/hour: {route.quantityPerHour}</div>
                  <div>Status: {route.active ? '✅ Active' : '❌ Inactive'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Auto Orders Tab */}
      {activeTab === 'orders' && (
        <div className="section">
          <div className="section-header">
            <h2>Automatic Orders</h2>
            <button className="btn-primary" onClick={createAutoOrder}>
              Create Order
            </button>
          </div>
          {autoOrders.length === 0 ? (
            <p>No auto orders yet</p>
          ) : (
            <div className="orders-list">
              {autoOrders.map(order => (
                <div key={order.id} className="order-card">
                  <div className={`order-type ${order.orderType}`}>
                    {order.orderType.toUpperCase()}
                  </div>
                  <div>Resource: {order.resourceType}</div>
                  <div>Price: {order.price} gold</div>
                  <div>Quantity: {order.quantity} (Filled: {order.filled})</div>
                  <div>Status: {order.active ? '✅ Active' : '❌ Inactive'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tax Settings Tab */}
      {activeTab === 'tax' && taxSettings && (
        <div className="section">
          <h2>Tax Settings</h2>
          <div className="tax-info">
            <div className="tax-item">
              <label>Tax Rate:</label>
              <span>{taxSettings.taxRate}%</span>
            </div>
            <div className="tax-item">
              <label>Social Spending:</label>
              <span>{taxSettings.socialSpending}%</span>
            </div>
            <div className="tax-item">
              <label>Military Spending:</label>
              <span>{taxSettings.militarySpending}%</span>
            </div>
            <div className="tax-item">
              <label>Infrastructure Spending:</label>
              <span>{taxSettings.infrastructureSpending}%</span>
            </div>
          </div>
          <p className="note">⚠️ Only government officials can modify tax settings</p>
        </div>
      )}
    </div>
  );
};

export default Economy;
