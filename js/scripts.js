var viewer = OpenSeadragon({
  id: "osd-viewer",
  minZoomLevel: 0,
  defaultZoomLevel: 0,
  tileSources: [""]
});

var zoomLevels = viewer.zoomLevels({
  levels: [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
});
