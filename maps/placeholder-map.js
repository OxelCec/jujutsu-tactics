window.GameData = window.GameData || {};

window.GameData.maps = {
  placeholder: {
    id: "placeholder",
    name: "Edificio destruido",
    size: 10,
    levels: 3,
    stairs: [
      { x: 2, y: 2, levels: [0, 1] },
      { x: 7, y: 3, levels: [1, 2] },
      { x: 4, y: 7, levels: [0, 1, 2] },
      { x: 8, y: 8, levels: [1, 2] },
    ],
    holes: [
      { id: "hole-1", x: 3, y: 3, z: 1 },
      { id: "hole-2", x: 6, y: 7, z: 2 },
    ],
    terrainObjects: [
      { id: "cube-1", type: "cube", name: "Cubo", x: 4, y: 4, z: 1, maxHp: 30 },
      { id: "cube-2", type: "cube", name: "Cubo", x: 5, y: 2, z: 0, maxHp: 30 },
      { id: "cube-3", type: "cube", name: "Cubo", x: 5, y: 7, z: 2, maxHp: 30 },
      { id: "pillar-1", type: "pillar", name: "Pilar", x: 3, y: 5, z: 0, maxHp: 40 },
      { id: "pillar-2", type: "pillar", name: "Pilar", x: 6, y: 4, z: 1, maxHp: 40 },
    ],
    spawns: {
      blue: [
        { x: 1, y: 1, z: 1 },
        { x: 1, y: 3, z: 1 },
        { x: 2, y: 1, z: 1 },
        { x: 2, y: 3, z: 1 },
      ],
      red: [
        { x: 8, y: 8, z: 1 },
        { x: 8, y: 6, z: 1 },
        { x: 7, y: 8, z: 1 },
        { x: 7, y: 6, z: 1 },
      ],
    },
  },
};
