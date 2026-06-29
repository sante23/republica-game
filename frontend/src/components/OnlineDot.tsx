import React from 'react';
import { useGame } from '../contexts/GameContext';

interface OnlineDotProps {
  userId?: string;
  showOffline?: boolean;
}

// Small presence indicator. Reads live online state from GameContext so it can be
// dropped next to any username across the app (chat, leaderboard, map, player cards).
const OnlineDot: React.FC<OnlineDotProps> = ({ userId, showOffline = true }) => {
  const { onlineUsers } = useGame();
  if (!userId) return null;

  const online = onlineUsers.has(userId);
  if (!online && !showOffline) return null;

  return (
    <span
      title={online ? 'Online now' : 'Offline'}
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        marginRight: 5,
        verticalAlign: 'middle',
        background: online ? '#48bb78' : '#718096',
        boxShadow: online ? '0 0 6px #48bb78' : 'none',
        transition: 'background 0.3s, box-shadow 0.3s',
      }}
    />
  );
};

export default OnlineDot;
