import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useGame } from "../contexts/GameContext";
import { Home, ShoppingCart, Vote, Trophy, Map, Sword, BarChart3, Landmark, LogOut, Award, CreditCard, FileText } from "lucide-react";
import "./Navbar.css";
import NotificationBell from "./NotificationBell";

const RESOURCE_COLORS: Record<string, string> = {
  food: '#f6ad55',
  wood: '#68d391',
  stone: '#a0aec0',
  iron: '#fc8181',
  gold: '#fbd38d',
  energy: '#63b3ed',
};

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { cities, selectedCity } = useGame();

  if (!user) return null;

  // Use selectedCity if available, otherwise first city
  const displayCity = selectedCity || (cities.length > 0 ? cities[0] : null);

  const navItems = [
    { path: "/", icon: <Home size={18} />, label: "Home" },
    { path: "/market", icon: <ShoppingCart size={18} />, label: "Market" },
    { path: "/military", icon: <Sword size={18} />, label: "Military" },
    { path: "/economy", icon: <BarChart3 size={18} />, label: "Economy" },
    { path: "/politics", icon: <Vote size={18} />, label: "Politics" },
    { path: "/government", icon: <Landmark size={18} />, label: "Gov" },
    { path: "/world-map", icon: <Map size={18} />, label: "Map" },
    { path: "/leaderboard", icon: <Trophy size={18} />, label: "Ranks" },
    { path: "/banking", icon: <CreditCard size={18} />, label: "Bank" },
    { path: "/contracts", icon: <FileText size={18} />, label: "Contracts" },
    { path: "/achievements", icon: <Award size={18} />, label: "Awards" },
  ];

  return (
    <>
      <nav className="main-navbar">
        <div className="navbar-brand">
          <Link to="/">REPUBLICA</Link>
        </div>
        <div className="navbar-links">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link ${location.pathname === item.path ? "active" : ""}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
        <div className="navbar-user">
          <NotificationBell />
          <Link to="/profile" className="user-info">
            Lv.{user.level} | {user.credits} G
          </Link>
          <button className="logout-btn" onClick={logout}>
            <LogOut size={16} />
          </button>
        </div>
      </nav>
      {displayCity && (
        <div className="resource-topbar">
          <span className="resource-topbar-city">{displayCity.name}</span>
          {['food', 'wood', 'stone', 'iron', 'gold', 'energy'].map(res => (
            <div className="res-topbar-item" key={res}>
              <span className="res-topbar-dot" style={{ background: RESOURCE_COLORS[res] }} />
              <span className="res-topbar-label">{res.charAt(0).toUpperCase() + res.slice(1)}</span>
              <span className="res-topbar-val">{Math.floor(displayCity.resources?.[res] || 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default Navbar;
