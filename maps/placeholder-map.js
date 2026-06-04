window.GameData = window.GameData || {};

window.GameData.maps = {
  placeholder: {
    id: "placeholder",
    name: "Placeholder 10x10x3",
    size: 10,
    levels: 3,
    stairs: [
      { x: 2, y: 2, levels: [0, 1] },
      { x: 7, y: 3, levels: [1, 2] },
      { x: 4, y: 7, levels: [0, 1, 2] },
      { x: 8, y: 8, levels: [1, 2] },
    ],
    spawns: {
      b1: { x: 1, y: 1, z: 0 },
      b2: { x: 1, y: 3, z: 0 },
      r1: { x: 8, y: 8, z: 2 },
      r2: { x: 8, y: 6, z: 2 },
    },
  },
};
