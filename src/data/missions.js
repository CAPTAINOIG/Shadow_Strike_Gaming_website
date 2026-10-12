// Shadow Strike: Last Stand - Mission Data
export const MISSIONS = [
  {
    id: 'mission_1',
    name: 'FIRST CONTACT',
    brief: 'Eliminate hostile forces in the combat zone. Engage and neutralize all enemy combatants.',
    objectives: [
      { id: 'obj_eliminate', text: 'Eliminate all hostile units and the Wraith commander', type: 'eliminate', target: 10, current: 0 },
      { id: 'obj_survive', text: 'Keep at least one squad member alive', type: 'survive', target: 1, current: 3 },
    ],
    enemyCount: 10,
    friendlyCount: 3,
    rewards: { xp: 500, credits: 200 },
    unlocked: true,
    completed: false,
  },
];

export const DEFAULT_MISSION = MISSIONS[0];
