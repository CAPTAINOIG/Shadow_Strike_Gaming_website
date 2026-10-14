import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { useGameStore } from './store/gameStore';
import { combatSystem } from './systems/combatSystem';
import { getBrains } from './game/ai/SoldierBrain';
import { audioManager } from './systems/audioManager';

// Development-only handle for automated play-testing.
if (import.meta.env.DEV) window.__game = { store: useGameStore, combatSystem, getBrains, audioManager };

createRoot(document.getElementById('root')).render(
  <App />
);
