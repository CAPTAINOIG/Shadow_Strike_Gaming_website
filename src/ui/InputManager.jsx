import React, { useEffect, useRef, useState } from 'react';
import { GAME_STATES, useGameStore } from '../store/gameStore';

function emit(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export default function InputManager() {
  const gameState = useGameStore((state) => state.gameState);
  const [touchDevice, setTouchDevice] = useState(false);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const stickRef = useRef(null);
  const aimRef = useRef(null);
  const lastAim = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)');
    // Touch-screen laptops still have a mouse: only show touch controls when
    // the primary pointer is coarse and no fine pointer is present.
    const fine = window.matchMedia('(any-pointer: fine)');
    const update = () => setTouchDevice(query.matches && !fine.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  if (!touchDevice || gameState !== GAME_STATES.PLAYING) return null;

  const updateStick = (event) => {
    if (!stickRef.current) return;
    const rect = stickRef.current.getBoundingClientRect();
    const radius = rect.width * 0.36;
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy) || 1;
    const scale = Math.min(radius, length);
    const value = { x: dx / length * scale / radius, y: -dy / length * scale / radius };
    setStick(value);
    emit('game:move', value);
  };

  const resetStick = () => {
    setStick({ x: 0, y: 0 });
    emit('game:move', { x: 0, y: 0 });
  };

  const startAim = (event) => {
    aimRef.current?.setPointerCapture(event.pointerId);
    lastAim.current = { x: event.clientX, y: event.clientY };
  };
  const updateAim = (event) => {
    if (!aimRef.current?.hasPointerCapture(event.pointerId)) return;
    const dx = event.clientX - lastAim.current.x;
    const dy = event.clientY - lastAim.current.y;
    lastAim.current = { x: event.clientX, y: event.clientY };
    emit('game:aim', { dx, dy });
  };

  const action = (type) => emit('game:action', { type });
  return (
    <div className="touch-controls" aria-label="Touch game controls">
      <div className="touch-look-zone" ref={aimRef} onPointerDown={startAim} onPointerMove={updateAim} aria-label="Drag to aim" />
      <div
        className="touch-stick"
        ref={stickRef}
        onPointerDown={(event) => { stickRef.current?.setPointerCapture(event.pointerId); updateStick(event); }}
        onPointerMove={(event) => { if (stickRef.current?.hasPointerCapture(event.pointerId)) updateStick(event); }}
        onPointerUp={resetStick}
        onPointerCancel={resetStick}
        aria-label="Move joystick"
      >
        <span className="touch-stick-knob" style={{ transform: `translate(${stick.x * 30}px, ${-stick.y * 30}px)` }} />
      </div>
      <div className="touch-actions">
        <button className="touch-fire" onPointerDown={() => emit('game:shoot', { active: true })} onPointerUp={() => emit('game:shoot', { active: false })} onPointerCancel={() => emit('game:shoot', { active: false })}>FIRE</button>
        <button onClick={() => action('aim')}>AIM</button>
        <button onClick={() => action('reload')}>RELOAD</button>
        <button onClick={() => action('cover')}>COVER</button>
        <button onClick={() => action('jump')}>JUMP</button>
        <button onClick={() => action('weapon')}>WEAPON</button>
      </div>
    </div>
  );
}
