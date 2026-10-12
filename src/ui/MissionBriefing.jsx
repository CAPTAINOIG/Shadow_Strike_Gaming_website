import React, { useState } from 'react';
import { preloadCharacterAssets } from '../game/characterAssets';
import { useGameStore } from '../store/gameStore';

export default function MissionBriefing({ onBack }) {
  const mission = useGameStore((state) => state.currentMission);
  const startGame = useGameStore((state) => state.startGame);
  const selectedLevel = useGameStore((state) => state.selectedLevel);
  const setSelectedLevel = useGameStore((state) => state.setSelectedLevel);
  const [stage, setStage] = useState('briefing');
  const [assetError, setAssetError] = useState(null);
  const [progress, setProgress] = useState(0);

  const deploySquad = async () => {
    setStage('loading');
    setAssetError(null);
    try {
      await preloadCharacterAssets(selectedLevel, setProgress);
      startGame();
    } catch (error) {
      console.error('Mission character assets could not be prepared.', error);
      setAssetError(error);
      setStage('asset-error');
    }
  };

  if (stage === 'loading') {
    return (
      <div className="briefing-screen" role="status" aria-live="polite">
        <div className="briefing-grid" />
        <div className="briefing-loading">
          <div className="briefing-kicker">ASSET MANIFEST</div>
          <h2>PREPARING INSERTION</h2>
          <div className="briefing-load-track"><span style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          <p>Checking required character, weapon, level and animation files… {Math.round(progress * 100)}%</p>
          <div className="briefing-loading-status">SECURE LINK // STAND BY</div>
        </div>
      </div>
    );
  }

  if (stage === 'asset-error') {
    return (
      <div className="briefing-screen">
        <div className="briefing-grid" />
        <div className="briefing-loading briefing-error">
          <div className="briefing-kicker">ASSET CHECK FAILED</div>
          <h2>REQUIRED ASSETS MISSING</h2>
          <p role="alert" style={{ whiteSpace: 'pre-wrap', textAlign: 'left', maxHeight: '34vh', overflowY: 'auto' }}>{assetError?.message || 'Required game assets could not be loaded.'}</p>
          <div className="briefing-actions">
            <button className="briefing-button primary" onClick={deploySquad}>RECHECK ASSETS</button>
            <button className="briefing-button" onClick={() => setStage('briefing')}>RETURN TO BRIEFING</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="briefing-screen">
      <div className="briefing-grid" />
      <section className="briefing-panel" aria-labelledby="briefing-title">
        <header className="briefing-header">
          <div>
            <div className="briefing-kicker">OPERATION // 01</div>
            <h2 id="briefing-title">{mission.name}</h2>
          </div>
          <div className="briefing-status"><span /> READY TO DEPLOY</div>
        </header>

        <div className="briefing-content">
          <div className="briefing-main">
            <div className="briefing-label">SITUATION REPORT</div>
            <p>{mission.brief}</p>
            <div className="briefing-label">DEPLOYMENT ZONE</div>
            <div className="briefing-levels" role="group" aria-label="Select deployment zone">
              <button type="button" aria-pressed={selectedLevel === 'swamp'} onClick={() => setSelectedLevel('swamp')}>
                <strong>01 // BLACKWATER</strong><span>Overgrown swamp · concrete ruins</span>
              </button>
              <button type="button" aria-pressed={selectedLevel === 'snow'} onClick={() => setSelectedLevel('snow')}>
                <strong>02 // FROSTLINE</strong><span>Snowbound city · wrecked armor</span>
              </button>
            </div>
            <div className="briefing-route">
              <span className="briefing-route-line" />
              <span>URBAN DISTRICT</span>
              <span>HOSTILE CONTACTS</span>
              <span>EXTRACTION: PENDING</span>
            </div>
            <div className="briefing-label">MISSION OBJECTIVES</div>
            <ol className="briefing-objectives">
              {mission.objectives.map((objective, index) => (
                <li key={objective.id}>
                  <span>0{index + 1}</span>
                  <span>{objective.text}</span>
                </li>
              ))}
            </ol>
          </div>

          <aside className="briefing-roster">
            <div className="briefing-label">SQUAD MANIFEST</div>
            <div className="briefing-roster-count">03 <span>OPERATORS</span></div>
            <div className="briefing-roster-list">
              <div><i className="team-dot player" /> YOU <span>LEAD</span></div>
              <div><i className="team-dot friendly" /> ALPHA-2 <span>RIFLE</span></div>
              <div><i className="team-dot friendly" /> ALPHA-3 <span>RIFLE</span></div>
            </div>
            <div className="briefing-enemy-count"><strong>{String(mission.enemyCount).padStart(2, '0')}</strong><span>HOSTILE UNITS · COMMANDER INCLUDED</span></div>
          </aside>
        </div>

        <footer className="briefing-footer">
          <button className="briefing-button" onClick={onBack}>BACK</button>
          <div className="briefing-controls">WASD MOVE <span>•</span> MOUSE AIM <span>•</span> LMB FIRE</div>
          <button className="briefing-button primary" onClick={deploySquad}>DEPLOY SQUAD <span>›</span></button>
        </footer>
      </section>
    </div>
  );
}
