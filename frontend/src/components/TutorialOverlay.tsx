import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import './TutorialOverlay.css';

interface TutorialStep {
  id: string;
  title: string;
  content: string;
  target?: string; // CSS selector to highlight
  action?: string; // navigation action
  position: 'center' | 'top' | 'bottom' | 'left' | 'right';
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to REPUBLICA!',
    content: 'You are about to enter a world of politics, economics, and warfare. This tutorial will guide you through the basics. Let\'s start building your empire!',
    position: 'center'
  },
  {
    id: 'foundCity',
    title: 'Found Your First City',
    content: 'Every empire starts with a city. Click "Found First City" or "Found New City" on the Dashboard to establish your capital. Choose a name and location wisely!',
    target: '.empty-state .btn-primary, .section-header .btn-primary',
    action: '/',
    position: 'bottom'
  },
  {
    id: 'buildings',
    title: 'Build & Grow',
    content: 'Your city needs buildings to thrive. Build Farms for food, Sawmills for wood, Mines for stone & iron, and Houses for population. Each building costs resources, so plan carefully!',
    target: '.buildings-panel',
    position: 'left'
  },
  {
    id: 'market',
    title: 'Trade on the Market',
    content: 'The Marketplace lets you buy and sell resources with other players. Use it to get resources you lack and sell surplus goods for credits.',
    action: '/market',
    position: 'center'
  },
  {
    id: 'military',
    title: 'Build Your Army',
    content: 'Train Infantry, Cavalry, Archers, and Siege units. Each has strengths and weaknesses (rock-paper-scissors style). Build Walls and Towers to defend your city!',
    action: '/military',
    position: 'center'
  },
  {
    id: 'politics',
    title: 'Enter Politics',
    content: 'Run for Mayor, Governor, or President. Propose policies, vote on laws, and shape the world. Political power unlocks unique abilities like setting taxes and declaring war.',
    action: '/politics',
    position: 'center'
  }
];

const TutorialOverlay: React.FC = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (user && user.tutorialCompleted && !user.tutorialCompleted.completed) {
      // Find the first incomplete step
      const firstIncomplete = TUTORIAL_STEPS.findIndex(
        step => !user.tutorialCompleted[step.id]
      );
      if (firstIncomplete >= 0) {
        setCurrentStep(firstIncomplete);
        setVisible(true);
      }
    }
  }, [user]);

  const completeStep = async (stepId: string) => {
    try {
      const response = await api.put('/auth/tutorial', { step: stepId });
      updateUser({ tutorialCompleted: response.data.tutorialCompleted });
    } catch (err) {
      console.error('Failed to update tutorial:', err);
    }
  };

  const handleNext = async () => {
    const step = TUTORIAL_STEPS[currentStep];
    await completeStep(step.id);

    if (currentStep < TUTORIAL_STEPS.length - 1) {
      const nextStep = TUTORIAL_STEPS[currentStep + 1];
      if (nextStep.action) {
        navigate(nextStep.action);
      }
      setCurrentStep(currentStep + 1);
    } else {
      await completeStep('completed');
      setVisible(false);
    }
  };

  const handleSkip = async () => {
    for (const step of TUTORIAL_STEPS) {
      await completeStep(step.id);
    }
    await completeStep('completed');
    setVisible(false);
  };

  if (!visible) return null;

  const step = TUTORIAL_STEPS[currentStep];
  const progress = ((currentStep + 1) / TUTORIAL_STEPS.length) * 100;

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-backdrop" />
      <div className={`tutorial-tooltip tutorial-pos-${step.position}`}>
        <div className="tutorial-header">
          <span className="tutorial-step-label">
            Step {currentStep + 1} of {TUTORIAL_STEPS.length}
          </span>
          <button className="tutorial-skip" onClick={handleSkip}>
            Skip Tutorial
          </button>
        </div>
        <h3 className="tutorial-title">{step.title}</h3>
        <p className="tutorial-content">{step.content}</p>
        <div className="tutorial-progress">
          <div className="tutorial-progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <div className="tutorial-footer">
          <div className="tutorial-dots">
            {TUTORIAL_STEPS.map((_, i) => (
              <span
                key={i}
                className={`tutorial-dot ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'done' : ''}`}
              />
            ))}
          </div>
          <button className="tutorial-next-btn" onClick={handleNext}>
            {currentStep < TUTORIAL_STEPS.length - 1 ? 'Next' : 'Finish!'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;
