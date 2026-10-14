// Shadow Strike: Last Stand - Mission Data
export const MISSIONS = [
  {
    id: 'mission_1',
    name: 'OPERATION KESTREL',
    brief: 'Insurgents hold the village checkpoint and the walled compound north of FOB Kestrel. Push through, clear the compound and neutralise their commander.',
    objectives: [
      { id: 'obj_eliminate', text: 'Clear hostile positions', type: 'eliminate', target: 9, current: 0 },
      { id: 'obj_commander', text: 'Neutralise the compound commander', type: 'commander', target: 1, current: 0 },
      { id: 'obj_survive', text: 'Keep your squad alive', type: 'survive', target: 1, current: 3 },
    ],
    rewards: { xp: 500, credits: 200 },
    unlocked: true,
    completed: false,
  },
];

export const DEFAULT_MISSION = MISSIONS[0];
