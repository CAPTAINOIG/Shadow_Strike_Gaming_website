// Shadow Strike: Last Stand - combat zone layout ("Outpost Kestrel").
// Forward is -Z. The squad starts at the FOB in the south, crosses an open
// approach with scattered cover, clears a village checkpoint and ruins, then
// breaches the walled enemy compound in the north. Flank routes run along the
// west (farmhouse, ruins, wall breach) and east (MG nest, house, side yard).

export const PLAY_AREA = { minX: -56, maxX: 56, minZ: -100, maxZ: 32 };
export const PLAYER_SPAWN = { x: 2, z: 18, yaw: 0 };

// Dirt roads (polyline centre, width).
export const ROADS = [
  { points: [[2, 60], [1.5, 22], [1, 8], [3, -12], [1, -30], [2, -48], [2, -62], [1, -98]], width: 6.5 },
  { points: [[-40, -29], [-20, -30.5], [0, -30], [20, -29], [38, -31]], width: 4.6 },
];

// Tyre tracks running along the main road.
export const TRACKS = [
  { points: [[2.6, 40], [2.2, 8], [3.8, -12], [1.8, -30], [2.7, -48], [2.5, -62], [1.6, -80]], width: 2.4 },
];

// Ground patches: set key, centre, radius x/z, rotation.
export const GROUND_PATCHES = [
  ['grass', -26, 14, 9, 6, 0.3], ['grass', 22, 22, 10, 7, 1.1], ['grass', -36, -14, 8, 10, 0.7], ['grass', 32, -18, 9, 6, 2.2],
  ['grass', -14, -60, 6, 5, 0.4], ['grass', 36, -46, 7, 9, 1.4], ['grass', -40, -80, 8, 6, 0.9], ['grass', 18, 6, 6, 4, 0.2],
  ['mud', -6, 2, 5, 3.5, 0.6], ['mud', 14, -40, 4, 6, 1.9], ['mud', -16, -74, 6, 4, 0.1], ['mud', 6, -64, 5, 4, 0.5],
  ['burned', -2, -6, 3.2, 3.2, 0], ['burned', 12, -2, 4.2, 3.2, 0.8], ['burned', 8, -14, 2.6, 2.6, 0], ['burned', 20, -27, 2.8, 2.2, 0.3],
  ['groundRocks', 28, -4, 6, 4, 0.9], ['groundRocks', -30, -40, 7, 5, 0.2], ['groundRocks', 34, -62, 5, 7, 1.2],
];

export const BUILDINGS = [
  // Two-storey concrete block west of the crossroads, exterior stairs to the upper floor.
  {
    id: 'blockhouse', x: -19, z: -32, yaw: 0, width: 12, depth: 9, material: 'concrete', parapet: 0.8,
    floors: [
      {
        height: 3.2,
        n: [{ at: -3, w: 1.3, h: 1.2, sill: 1 }, { at: 3, w: 1.3, h: 1.2, sill: 1 }],
        s: [{ at: 3.5, w: 1.1, h: 2.2 }, { at: -1, w: 1.3, h: 1.2, sill: 1 }, { at: -4, w: 1.3, h: 1.2, sill: 1 }],
        e: [{ at: -2.8, w: 1.1, h: 2.2 }, { at: 1.6, w: 1.2, h: 1.2, sill: 1 }],
        w: [{ at: 0, w: 1.3, h: 1.2, sill: 1 }],
      },
      {
        height: 3,
        n: [{ at: -3, w: 1.3, h: 1.2, sill: 0.9 }, { at: 3, w: 1.3, h: 1.2, sill: 0.9 }],
        s: [{ at: 3, w: 1.3, h: 1.2, sill: 0.9 }, { at: -3, w: 1.3, h: 1.2, sill: 0.9 }],
        e: [{ at: -1.4, w: 1.1, h: 2.1 }],
        w: [{ at: -2, w: 1.3, h: 1.2, sill: 0.9 }, { at: 2, w: 1.3, h: 1.2, sill: 0.9 }],
      },
    ],
    stairs: { lx: 6.75, lz: 3.6, yaw: Math.PI, width: 1.3, rise: 3.44, run: 4, landing: 1.4 },
    rubble: [{ lx: 8.6, lz: -3.8, radius: 1.1, height: 0.6 }],
  },
  // Single-storey plaster house east of the road, north-east corner blown open.
  {
    id: 'house', x: 15, z: -25, yaw: 0, width: 9, depth: 7, material: 'plasterDamaged', parapet: 0.6,
    floors: [{
      height: 3.1,
      n: [{ at: -2.5, w: 1.2, h: 1.2, sill: 1 }, { at: 3, w: 2.2, h: 3.2, breach: true }],
      s: [{ at: 2, w: 1.1, h: 2.2 }, { at: -2, w: 1.2, h: 1.2, sill: 1 }],
      e: [{ at: 0.5, w: 1.2, h: 1.2, sill: 1 }],
      w: [{ at: -1, w: 1.1, h: 2.2 }, { at: 1.6, w: 1.2, h: 1.2, sill: 1 }],
    }],
    rubble: [{ lx: 3.2, lz: -4.6, radius: 1.6, height: 0.9 }, { lx: 2.6, lz: -2.6, radius: 0.9, height: 0.4 }],
  },
  // Roofless brick ruin south of the compound wall.
  {
    id: 'ruin', x: -5, z: -44, yaw: 0.15, width: 8, depth: 6, material: 'brick', roof: false, parapet: 0,
    floors: [{ height: 2.9, s: [{ at: 1.5, w: 1.2, h: 2.2 }], e: [{ at: 0, w: 1.2, h: 1.1, sill: 1 }], n: [{ at: -2, w: 1.2, h: 1.1, sill: 1 }] }],
    ruined: {
      n: [2.6, 2.4, 1.8, 1.2, 0.9, 1.6, 2.2, 2.5],
      s: [2.4, 2.7, 2.2, 1.4, 0.8, 0.6, 1.1, 1.9],
      e: [2.2, 1.7, 1.0, 0.7, 1.5, 2.1],
      w: [1.2, 0.7, 0.5, 0.9, 1.6, 2.0],
    },
    rubble: [{ lx: -2.5, lz: 1.5, radius: 1.4, height: 0.7 }, { lx: 4.6, lz: 2.4, radius: 1.2, height: 0.5 }, { lx: -4.6, lz: -1, radius: 1.1, height: 0.5 }],
  },
  // Collapsed farmhouse on the western approach.
  {
    id: 'farmhouse', x: -23, z: -5, yaw: 0.22, width: 8, depth: 6.5, material: 'plasterDamaged', roof: false, parapet: 0,
    floors: [{ height: 2.8, e: [{ at: 0.8, w: 1.1, h: 2.1 }], s: [{ at: -1.5, w: 1.2, h: 1.1, sill: 1 }, { at: 2.2, w: 1.2, h: 1.1, sill: 1 }], n: [{ at: 1, w: 1.2, h: 1.1, sill: 1 }] }],
    ruined: {
      n: [2.6, 2.7, 2.5, 2.2, 1.4, 0.8, 0.6, 1.0],
      w: [1.0, 0.6, 0.4, 0.8, 1.6, 2.2],
    },
    rubble: [{ lx: -1, lz: -4.4, radius: 1.7, height: 0.8 }, { lx: -5, lz: 0, radius: 1.3, height: 0.6 }],
  },
  // Compound warehouse: concrete shell, wide vehicle door, high windows.
  {
    id: 'warehouse', x: -22, z: -77, yaw: 0, width: 18, depth: 12, material: 'concrete', roofMaterial: 'corrugated', parapet: 0.4,
    floors: [{
      height: 5.6,
      s: [{ at: -2, w: 5, h: 4.2 }, { at: 6, w: 1.2, h: 1, sill: 3.6 }, { at: -7, w: 1.2, h: 1, sill: 3.6 }],
      e: [{ at: 2.5, w: 1.1, h: 2.2 }, { at: -2.5, w: 1.2, h: 1, sill: 3.6 }],
      n: [{ at: 0, w: 1.4, h: 1, sill: 3.6 }, { at: 6, w: 1.4, h: 1, sill: 3.6 }],
      w: [{ at: 0, w: 1.1, h: 2.2 }],
    }],
  },
  // Command post inside the compound.
  {
    id: 'command', x: 23, z: -73, yaw: 0, width: 10, depth: 8, material: 'plaster', parapet: 0.7,
    floors: [{
      height: 3.3,
      w: [{ at: 1.5, w: 1.1, h: 2.2 }, { at: -2, w: 1.3, h: 1.2, sill: 1 }],
      s: [{ at: 0, w: 1.1, h: 2.2 }, { at: 3, w: 1.3, h: 1.2, sill: 1 }, { at: -3, w: 1.3, h: 1.2, sill: 1 }],
      n: [{ at: -2.5, w: 1.3, h: 1.2, sill: 1 }, { at: 2.5, w: 1.3, h: 1.2, sill: 1 }],
      e: [{ at: 0, w: 1.3, h: 1.2, sill: 1 }],
    }],
  },
];

// Free-standing walls: centre, yaw, length, height, thickness, material, openings.
export const WALLS = [
  // Compound perimeter (precast concrete), gate on the road and a breach to the west.
  { cx: 0, cz: -54, yaw: 0, length: 88, height: 2.8, thickness: 0.4, material: 'precast', openings: [{ at: 2, w: 9, h: 4, breach: true }, { at: -28, w: 4, h: 4, breach: true }] },
  { cx: -44, cz: -75, yaw: Math.PI / 2, length: 42, height: 2.8, thickness: 0.4, material: 'precast' },
  { cx: 44, cz: -75, yaw: -Math.PI / 2, length: 42, height: 2.8, thickness: 0.4, material: 'precast', openings: [{ at: 8, w: 3.5, h: 4, breach: true }] },
  { cx: 0, cz: -96, yaw: 0, length: 88, height: 2.8, thickness: 0.4, material: 'precast' },
  // Low field walls on the approach.
  { cx: -9.5, cz: -14.5, yaw: 0.05, length: 8, height: 1.05, thickness: 0.4, material: 'brick', openings: [{ at: 1, w: 1.4, h: 2, breach: true }] },
  { cx: 12.5, cz: -17.5, yaw: -0.12, length: 7, height: 1.05, thickness: 0.4, material: 'brick' },
  { cx: -30, cz: -20, yaw: 1.2, length: 10, height: 1.1, thickness: 0.4, material: 'plasterBroken', profile: [1.1, 1.0, 0.8, 0.5, 0.4, 0.7, 1.0, 1.1, 0.9, 0.6] },
  { cx: 28, cz: -40, yaw: 0.3, length: 9, height: 1.2, thickness: 0.4, material: 'brick', profile: [1.2, 1.2, 1.1, 0.9, 0.7, 1.0, 1.2, 1.2, 1.1] },
  // Village yard walls.
  { cx: 22, cz: -32.5, yaw: 0, length: 7, height: 2.1, thickness: 0.3, material: 'plasterDamaged' },
  { cx: -26.5, cz: -42, yaw: Math.PI / 2, length: 8, height: 2.1, thickness: 0.3, material: 'plasterDamaged', openings: [{ at: 1, w: 1.2, h: 3, breach: true }] },
];

export const RUBBLE = [
  { lx: -28, lz: -53, radius: 1.8, height: 0.8, material: 'plasterBroken' },
  { lx: -28, lz: -55.4, radius: 1.4, height: 0.6, material: 'plasterBroken' },
  { lx: 45, lz: -66.5, radius: 1.3, height: 0.6, material: 'plasterBroken' },
  { lx: -2, lz: -6, radius: 1.2, height: 0.4, material: 'groundRocks', collider: false },
];

const PH = (id) => `/assets/props/ph/${id}/${id}_1k.gltf`;
// Photogrammetry-heavy Poly Haven models, decimated with glTF-Transform (see scripts/optimize-props.sh).
const OPT = (id) => `/assets/props/ph_opt/${id}.glb`;
export const PROP_MODELS = {
  crate: { path: OPT('wooden_military_crate'), surface: 'wood' },
  crateOld: { path: OPT('old_military_crate'), surface: 'wood' },
  ammo: { path: PH('ammo_box'), surface: 'metal' },
  jerrycan: { path: OPT('metal_jerrycan_green'), surface: 'metal' },
  barrel: { path: PH('barrel_03'), surface: 'metal' },
  barrelBlue: { path: PH('Barrel_01'), surface: 'metal' },
  barrier: { path: OPT('concrete_road_barrier'), surface: 'concrete' },
  coveredCar: { path: OPT('covered_car'), surface: 'vehicle' },
  tyre: { path: PH('old_tyre'), surface: 'dirt' },
  cement: { path: PH('cement_bag'), surface: 'sandbag' },
  boulder: { path: OPT('namaqualand_boulder_02'), surface: 'concrete', scale: 0.8 },
  boulderB: { path: OPT('namaqualand_boulder_02'), surface: 'concrete' },
  shrub: { path: OPT('shrub_01'), surface: 'dirt', collider: false },
  shrubB: { path: OPT('shrub_02'), surface: 'dirt', collider: false },
  deadTree: { path: OPT('dead_tree_trunk'), surface: 'wood' },
  utility: { path: PH('utility_box_01'), surface: 'metal' },
  propane: { path: PH('propane_tank'), surface: 'metal' },
  trash: { path: PH('trashbag'), surface: 'dirt', collider: false },
  compressor: { path: OPT('old_military_compressor'), surface: 'metal' },
  plasticCrate: { path: OPT('plastic_crate_01'), surface: 'wood' },
  ladder: { path: PH('wooden_ladder'), surface: 'wood', collider: false },
  sandbags: { path: '/assets/props/sandbags_long.glb', surface: 'sandbag' },
  sandbagsShort: { path: '/assets/props/sandbags_short.glb', surface: 'sandbag' },
  container: { path: '/assets/props/container.glb', surface: 'metal', scale: [1.2, 1.27, 1.5], tint: '#4f5a44' },
  containerRust: { path: '/assets/props/container.glb', surface: 'metal', scale: [1.2, 1.27, 1.5], tint: '#6e4330' },
  humvee: { path: '/assets/vehicles/humvee.glb', surface: 'vehicle', scale: 0.98 },
  humveeWreck: { path: '/assets/vehicles/humvee.glb', surface: 'vehicle', scale: 0.98, tint: '#3a3632', burnt: true },
  m939: { path: '/assets/vehicles/m939.glb', surface: 'vehicle', scale: 1.02 },
  lmtv: { path: '/assets/vehicles/lmtv.glb', surface: 'vehicle', scale: 1.05, tint: '#a39572' },
};

// [model, x, z, yaw, scale?, y?]
export const PROPS = [
  // FOB
  ['humvee', 8.5, 15, 1.75], ['container', -13, 19, 0.04], ['containerRust', 16, 21, -0.1],
  ['sandbags', -5.2, 7.6, 0], ['sandbags', 9.2, 7.9, 0.03], ['sandbags', -9.4, 8.6, -0.35], ['sandbags', 13.3, 8.9, 0.4],
  ['barrier', -1.5, 8.6, 0.05], ['barrier', 5.6, 8.7, -0.05],
  ['crate', -8.6, 14.2, 0.2], ['crate', -8.5, 15.6, -0.1], ['crateOld', -7.4, 15, 1.5], ['ammo', -7.1, 13.4, 0.4], ['ammo', -6.6, 13.5, 0.1],
  ['jerrycan', 11.4, 13.4, 0.3], ['jerrycan', 11.8, 13.7, 1.1], ['jerrycan', 11.1, 13.9, 0.8], ['plasticCrate', 5.4, 20.4, 0.5],
  ['barrelBlue', -10.9, 22, 0], ['barrelBlue', -10.2, 22.7, 0], ['propane', 14.3, 17.1, 0], ['cement', -3.4, 21.5, 0.6],

  // Approach
  ['coveredCar', -8.6, -3.5, 0.75], ['humveeWreck', 12.5, -2.2, 2.25], ['tyre', 14.6, -5.4, 0.4], ['tyre', 10.1, 0.6, 1.2],
  ['sandbags', 17, -12.1, 0], ['sandbagsShort', 15.2, -10.3, Math.PI / 2], ['sandbagsShort', 18.9, -10.3, Math.PI / 2],
  ['ammo', 17.2, -11.1, 0.2], ['crateOld', -6.4, -15.6, 0.3],
  ['boulder', -34, -10, 0.5, 1.4], ['boulderB', 29, -6, 1.8, 1.1], ['boulder', 31, -22, 2.4, 1.1], ['boulderB', -38, 4, 0.2, 1.3],
  ['boulder', -3.5, -9.5, 1.1, 0.6], ['deadTree', -30, 7, 0.4], ['deadTree', 25, 3, 2.1], ['deadTree', -35, -30, 1.2],
  ['shrub', -28, 12, 0], ['shrub', 24, 20, 1], ['shrubB', -18, 6, 2], ['shrub', 31, -14, 0.5], ['shrubB', -37, -18, 1.7], ['shrub', 20, -6, 2.8],
  ['shrubB', 6, -8, 0.6], ['shrub', -14, -22, 1.4], ['shrubB', 33, 8, 0.2],

  // Village
  ['barrier', -0.6, -19.4, 0.12], ['barrier', 5.2, -21.6, -0.1], ['barrier', 9.5, -19.2, 0.25], ['sandbagsShort', -4.8, -20.3, 0.1],
  ['m939', 6.2, -37, 1.45], ['container', 25, -39.5, 0.42], ['barrel', 11.2, -33.5, 0], ['barrel', 11.9, -33.1, 0], ['barrel', 11.5, -34.2, 0],
  ['crate', 19.8, -21, 0.3], ['crateOld', 8.4, -26.4, 1.2], ['utility', -12.6, -27.6, Math.PI / 2], ['trash', -11.8, -26.5, 0.4], ['trash', 9.7, -28.6, 2],
  ['tyre', -12.4, -37.3, 0.3], ['plasticCrate', -9.2, -46.5, 0.3], ['cement', 2.4, -42.5, 1.2], ['shrubB', 31, -28, 0.6], ['shrub', -33, -35, 1.1],
  ['ladder', -13.2, -36.8, Math.PI / 2], ['jerrycan', -24.2, -27.1, 0.3],

  // Compound
  ['barrier', -0.8, -58, 0.08], ['barrier', 5.4, -60.5, -0.12], ['sandbags', -6.2, -57.6, 0], ['sandbags', 10.4, -57.8, 0],
  ['lmtv', -4, -67, 0.45], ['container', 8, -84.5, 0.05], ['containerRust', 14.2, -86.4, -0.2], ['container', 8.4, -84.5, 0.05, 1, 2.6],
  ['compressor', 31, -84, 0.3], ['barrel', -35, -63, 0], ['barrel', -34.3, -63.6, 0], ['barrel', -35.6, -64.2, 0], ['barrelBlue', -34.6, -64.6, 0],
  ['propane', 34, -86, 0], ['propane', 34.7, -86.3, 0], ['utility', 17.5, -68.6, 0], ['crate', -16, -73, 0.2], ['crate', -16.1, -74.4, 0.1], ['crateOld', -26, -74, 1.3],
  ['ammo', -27, -80, 0.6], ['crate', -29, -79, 1.1], ['crateOld', 4, -78, 0.4], ['crate', 16.4, -79.4, 0.9], ['sandbagsShort', 20, -67.2, 0], ['sandbagsShort', 26, -67.2, 0],
  ['trash', 30, -70, 1.1], ['plasticCrate', 28.6, -76, 0.8], ['jerrycan', -4.4, -63.4, 0.5], ['shrubB', -38, -88, 0.4], ['shrub', 38, -90, 2.2],
];

// Distant scenery outside the play boundary.
export const BACKDROP = [
  ['boulder', -62, -30, 0.2, 3.2], ['boulderB', 64, -50, 1.4, 3], ['boulder', 60, 10, 2.2, 2.6], ['deadTree', -66, 12, 0.3, 1.4],
  ['shrub', -60, -70, 0.2, 1.6], ['shrubB', 66, -86, 0.9, 1.5], ['deadTree', 61, -18, 1.7, 1.2], ['boulderB', -64, -96, 0.9, 2.8],
];

// Cover the AI uses when no cell-based cover is better (also patrol anchors).
export const SQUAD_SPAWN = [[-1.5, 20.5], [5.5, 20.5], [2, 23]];
