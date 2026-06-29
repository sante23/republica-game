import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { ArrowLeft, MapPin, Users, Crown, ZoomIn, ZoomOut, Crosshair } from 'lucide-react';
import './WorldMap.css';
import AttackModal from '../components/AttackModal';

interface WorldCity {
  id: string;
  name: string;
  x: number;
  y: number;
  population: number;
  isCapital: boolean;
  userId: string;
  owner: {
    username: string;
    level: number;
  };
}

const WorldMap: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cities, setCities] = useState<WorldCity[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [selectedCity, setSelectedCity] = useState<WorldCity | null>(null);
  const [attackOpen, setAttackOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchWorldCities();
  }, []);

  const fetchWorldCities = async () => {
    try {
      const response = await api.get('/cities/world');
      setCities(response.data.cities);
    } catch (error) {
      console.error('Failed to fetch world cities:', error);
    } finally {
      setLoading(false);
    }
  };

  const goToCity = (cityId: string, ownerId: string) => {
    if (ownerId === user?.id) {
      navigate(`/city/${cityId}`);
    }
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.max(0.5, Math.min(4, prev + (e.deltaY > 0 ? -0.15 : 0.15))));
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  };

  const handleMouseUp = () => setIsPanning(false);

  const centerOnPlayer = () => {
    const myCities = cities.filter(c => c.userId === user?.id);
    if (myCities.length > 0) {
      const avgX = myCities.reduce((s, c) => s + c.x, 0) / myCities.length;
      const avgY = myCities.reduce((s, c) => s + c.y, 0) / myCities.length;
      setPan({ x: -avgX * zoom * 3, y: -avgY * zoom * 3 });
      setZoom(2);
    }
  };

  const minX = Math.min(...cities.map(c => c.x), -100);
  const maxX = Math.max(...cities.map(c => c.x), 100);
  const minY = Math.min(...cities.map(c => c.y), -100);
  const maxY = Math.max(...cities.map(c => c.y), 100);
  const mapWidth = maxX - minX || 200;
  const mapHeight = maxY - minY || 200;

  const filteredCities = filter
    ? cities.filter(c =>
        c.name.toLowerCase().includes(filter.toLowerCase()) ||
        c.owner.username.toLowerCase().includes(filter.toLowerCase())
      )
    : cities;

  const uniqueOwners = new Set(cities.map(c => c.owner.username)).size;
  const myCities = cities.filter(c => c.userId === user?.id).map(c => ({ id: c.id, name: c.name }));

  return (
    <div className="world-map-page">
      <header className="world-map-header">
        <button onClick={() => navigate('/')} className="back-button">
          <ArrowLeft /> Back
        </button>
        <h1>World Map</h1>
        <div className="map-search">
          <input
            type="text"
            placeholder="Search cities or players..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
        <div className="view-toggle">
          <button className={viewMode === 'map' ? 'active' : ''} onClick={() => setViewMode('map')}>Map</button>
          <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>List</button>
        </div>
      </header>

      <div className="world-stats">
        <div className="stat"><MapPin size={16} /><span>{cities.length} Cities</span></div>
        <div className="stat"><Users size={16} /><span>{uniqueOwners} Players</span></div>
        <div className="stat"><Crown size={16} /><span>{cities.reduce((s, c) => s + c.population, 0).toLocaleString()} Pop.</span></div>
      </div>

      {loading ? (
        <div className="loading">Loading world map...</div>
      ) : viewMode === 'map' ? (
        <div className="map-container">
          <div className="map-toolbar">
            <button onClick={() => setZoom(z => Math.min(4, z + 0.3))} title="Zoom In"><ZoomIn size={16} /></button>
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.3))} title="Zoom Out"><ZoomOut size={16} /></button>
            <button onClick={centerOnPlayer} title="Center on your cities"><Crosshair size={16} /></button>
            <span className="zoom-level">{Math.round(zoom * 100)}%</span>
          </div>
          <div
            className="map-canvas"
            ref={mapRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Grid lines */}
            <svg className="map-grid" viewBox={`${minX - 10} ${minY - 10} ${mapWidth + 20} ${mapHeight + 20}`}
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
              {Array.from({ length: Math.ceil(mapWidth / 50) + 1 }, (_, i) => {
                const x = minX + i * 50;
                return <line key={`v${i}`} x1={x} y1={minY - 10} x2={x} y2={maxY + 10} stroke="rgba(100,126,234,0.1)" strokeWidth={0.5} />;
              })}
              {Array.from({ length: Math.ceil(mapHeight / 50) + 1 }, (_, i) => {
                const y = minY + i * 50;
                return <line key={`h${i}`} x1={minX - 10} y1={y} x2={maxX + 10} y2={y} stroke="rgba(100,126,234,0.1)" strokeWidth={0.5} />;
              })}
            </svg>

            {/* Cities */}
            <div className="map-cities-layer" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
              {filteredCities.map(city => {
                const left = ((city.x - minX) / mapWidth) * 100;
                const top = ((city.y - minY) / mapHeight) * 100;
                const isOwn = city.userId === user?.id;
                const popSize = Math.max(8, Math.min(24, Math.log10(city.population + 1) * 5));

                return (
                  <div
                    key={city.id}
                    className={`city-marker ${isOwn ? 'own-city' : ''} ${city.isCapital ? 'capital' : ''} ${selectedCity?.id === city.id ? 'selected' : ''}`}
                    style={{ left: `${left}%`, top: `${top}%` }}
                    onClick={(e) => { e.stopPropagation(); setSelectedCity(city); }}
                    onDoubleClick={() => goToCity(city.id, city.userId)}
                  >
                    <div className="city-dot" style={{ width: popSize, height: popSize }} />
                    <span className="city-name">{city.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* City detail panel */}
          {selectedCity && (
            <div className="city-detail-panel">
              <h3>
                {selectedCity.isCapital && <Crown size={14} />}
                {selectedCity.name}
              </h3>
              <p><strong>Owner:</strong> {selectedCity.owner.username} (Lv.{selectedCity.owner.level})</p>
              <p><strong>Population:</strong> {selectedCity.population.toLocaleString()}</p>
              <p><strong>Location:</strong> ({selectedCity.x}, {selectedCity.y})</p>
              {selectedCity.userId === user?.id ? (
                <button className="btn-primary" onClick={() => navigate(`/city/${selectedCity.id}`)}>
                  Manage City
                </button>
              ) : myCities.length > 0 && (
                <button className="btn-primary" onClick={() => setAttackOpen(true)}>
                  ⚔️ Attack
                </button>
              )}
              <button className="btn-close" onClick={() => setSelectedCity(null)}>Close</button>
            </div>
          )}

          <div className="map-legend">
            <div className="legend-item"><div className="legend-marker own-city" /><span>Your Cities</span></div>
            <div className="legend-item"><div className="legend-marker" /><span>Other Cities</span></div>
            <div className="legend-item"><Crown size={14} style={{ color: '#FFD700' }} /><span>Capitals</span></div>
          </div>
        </div>
      ) : (
        <div className="cities-list">
          <table>
            <thead>
              <tr>
                <th>City</th>
                <th>Owner</th>
                <th>Level</th>
                <th>Population</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {filteredCities.map(city => (
                <tr
                  key={city.id}
                  className={city.userId === user?.id ? 'own-city-row' : ''}
                  onClick={() => goToCity(city.id, city.userId)}
                  style={{ cursor: city.userId === user?.id ? 'pointer' : 'default' }}
                >
                  <td>
                    {city.isCapital && <Crown size={14} style={{ color: '#FFD700', marginRight: '4px' }} />}
                    <strong>{city.name}</strong>
                  </td>
                  <td>{city.owner.username}</td>
                  <td>Lv.{city.owner.level}</td>
                  <td>{city.population.toLocaleString()}</td>
                  <td>({city.x}, {city.y})</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AttackModal
        isOpen={attackOpen}
        onClose={() => { setAttackOpen(false); fetchWorldCities(); }}
        defender={selectedCity ? { id: selectedCity.id, name: selectedCity.name } : null}
        myCities={myCities}
      />
    </div>
  );
};

export default WorldMap;
