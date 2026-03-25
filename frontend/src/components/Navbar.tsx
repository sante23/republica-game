import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Home, ShoppingCart, Vote, Trophy, Map, Sword, BarChart3, Landmark, LogOut, Award, CreditCard, FileText } from "lucide-react";
import "./Navbar.css";
import NotificationBell from "./NotificationBell";

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (!user) return null;

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
  );
};

export default Navbar;
