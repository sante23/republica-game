import { useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { playSound } from '../utils/sounds';

const GameEventListener: React.FC = () => {
  const { socket } = useGame();
  const { user } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (!socket || !user) return;

    const handlers: Record<string, (...args: any[]) => void> = {
      'world-event': (data: any) => {
        toast.warning(`${data.title}: ${data.description}`, 8000);
        playSound('notification');
      },
      'election-completed': (data: any) => {
        let msg: string;
        if (data.recalled) {
          msg = `⚠️ The ${data.position} was recalled — approval collapsed!`;
        } else if (data.winnerName) {
          msg = `${data.position} election won by ${data.winnerName}${data.isNpc ? ' 🤖 (NPC caretaker)' : '!'}`;
        } else {
          msg = `${data.position} election ended with no winner.`;
        }
        toast.info(msg, 6000);
        playSound('notification');
      },
      'election-phase': (data: any) => {
        if (data.status === 'VOTING') {
          toast.info(`🗳️ Voting is now open for the ${data.position} election!`, 6000);
          playSound('notification');
        }
      },
      'market-transaction': (data: any) => {
        if (data.seller === user.username) {
          toast.success(`Sold ${data.quantity} ${data.resource} for ${data.price} credits!`, 5000);
          playSound('trade');
        }
      },
      'new-city': (data: any) => {
        if (data.owner !== user.username) {
          toast.info(`${data.owner} founded a new city: ${data.name}`, 4000);
        }
      },
      'chat-message': (data: any) => {
        if (data.channel === 'private' && data.senderId !== user.id) {
          toast.info(`Message from ${data.sender?.username}: ${data.content.slice(0, 50)}`, 4000);
          playSound('notification');
        }
      }
    };

    for (const [event, handler] of Object.entries(handlers)) {
      socket.on(event, handler);
    }

    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        socket.off(event, handler);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, user]);

  return null;
};

export default GameEventListener;
