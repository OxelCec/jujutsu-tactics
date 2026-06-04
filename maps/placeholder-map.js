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
