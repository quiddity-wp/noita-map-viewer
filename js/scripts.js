// IIIF Plugin
L.TileLayer.Iiif = L.TileLayer.extend({
  options: {
    continuousWorld: true,
    tileSize: 256,
    updateWhenIdle: true,
    tileFormat: 'jpg',
    fitBounds: true,
    setMaxBounds: false
  },

  initialize: function(url, options) {
    options = typeof options !== 'undefined' ? options : {};

    if (options.maxZoom) {
      this._customMaxZoom = true;
    }

    // Check for explicit tileSize set
    if (options.tileSize) {
      this._explicitTileSize = true;
    }

    // Check for an explicit quality
    if (options.quality) {
      this._explicitQuality = true;
    }

    options = L.setOptions(this, options);
    this._infoPromise = null;
    this._infoUrl = url;
    this._baseUrl = this._templateUrl();
    this._getInfo();
  },
  getTileUrl: function(coords) {
    var _this = this,
      x = coords.x,
      y = (coords.y),
      zoom = _this._getZoomForUrl(),
      scale = Math.pow(2, _this.maxNativeZoom - zoom),
      tileBaseSize = _this.options.tileSize * scale,
      minx = (x * tileBaseSize),
      miny = (y * tileBaseSize),
      maxx = Math.min(minx + tileBaseSize, _this.x),
      maxy = Math.min(miny + tileBaseSize, _this.y);
    
    var xDiff = (maxx - minx);
    var yDiff = (maxy - miny);

    // Canonical URI Syntax for v2
    var size = Math.ceil(xDiff / scale) + ',';
    if (_this.type === 'ImageService3') {
      // Cannonical URI Syntax for v3
      size = size + Math.ceil(yDiff / scale) + ',';
    }

    return L.Util.template(this._baseUrl, L.extend({
      format: _this.options.tileFormat,
      quality: _this.quality,
      region: [minx, miny, xDiff, yDiff].join(','),
      rotation: 0,
      size: size
    }, this.options));
  },
  onAdd: function(map) {
    var _this = this;

    // Wait for info.json fetch and parse to complete
    Promise.all([_this._infoPromise]).then(function() {
      // Store unmutated imageSizes
      _this._imageSizesOriginal = _this._imageSizes.slice(0); 

      // Set maxZoom for map
      map._layersMaxZoom = _this.maxZoom;

      // Call add TileLayer
      L.TileLayer.prototype.onAdd.call(_this, map);

      // Set minZoom and minNativeZoom based on how the imageSizes match up
      var smallestImage = _this._imageSizes[0];
      var mapSize = _this._map.getSize();
      var newMinZoom = 0;
      // Loop back through 5 times to see if a better fit can be found.
      for (var i = 1; i <= 5; i++) {
        if (smallestImage.x > mapSize.x || smallestImage.y > mapSize.y) {
          smallestImage = smallestImage.divideBy(2);
          _this._imageSizes.unshift(smallestImage);
          newMinZoom = -i;
        } else {
          break;
        }
      }
      _this.options.minZoom = newMinZoom;
      _this.options.minNativeZoom = newMinZoom;
      _this._prev_map_layersMinZoom = _this._map._layersMinZoom;
      _this._map._layersMinZoom = newMinZoom;

      if (_this.options.fitBounds) {
        _this._fitBounds();
      }

      if(_this.options.setMaxBounds) {
        _this._setMaxBounds();
      }

      // Reset tile sizes to handle non 256x256 IIIF tiles
      _this.on('tileload', function(tile, url) {

        var height = tile.tile.naturalHeight,
          width = tile.tile.naturalWidth;

        // No need to resize if tile is 256 x 256
        if (height === 256 && width === 256) return;

        tile.tile.style.width = width + 'px';
        tile.tile.style.height = height + 'px';

      });
    })
    .catch(function(err){
        console.error(err);
    });
  },
  onRemove: function(map) {
    var _this = this;
    
    map._layersMinZoom = _this._prev_map_layersMinZoom;
    _this._imageSizes = _this._imageSizesOriginal;

    // Remove maxBounds set for this image
    if(_this.options.setMaxBounds) {
      map.setMaxBounds(null);
    }

    // Call remove TileLayer
    L.TileLayer.prototype.onRemove.call(_this, map);

  },
  _fitBounds: function() {
    var _this = this;

    // Find best zoom level and center map
    var initialZoom = _this._getInitialZoom(_this._map.getSize());
    var offset = _this._imageSizes.length - 1 - _this.options.maxNativeZoom;
    var imageSize = _this._imageSizes[initialZoom + offset];
    var sw = _this._map.options.crs.pointToLatLng(L.point(0, imageSize.y), initialZoom);
    var ne = _this._map.options.crs.pointToLatLng(L.point(imageSize.x, 0), initialZoom);
    var bounds = L.latLngBounds(sw, ne);

    _this._map.fitBounds(bounds, true);
  },
  _setMaxBounds: function() {
    var _this = this;

    // Find best zoom level, center map, and constrain viewer
    var initialZoom = _this._getInitialZoom(_this._map.getSize());
    var imageSize = _this._imageSizes[initialZoom];
    var sw = _this._map.options.crs.pointToLatLng(L.point(0, imageSize.y), initialZoom);
    var ne = _this._map.options.crs.pointToLatLng(L.point(imageSize.x, 0), initialZoom);
    var bounds = L.latLngBounds(sw, ne);

    _this._map.setMaxBounds(bounds, true);
  },
  _getInfo: function() {
    var _this = this;

    _this._infoPromise = fetch(_this._infoUrl)
      .then(function(response) {
        return response.json();
      })
      .catch(function(err){
          console.error(err);
      })
      .then(function(data) {
        _this.y = data.height;
        _this.x = data.width;

        var tierSizes = [],
          imageSizes = [],
          scale,
          width_,
          height_,
          tilesX_,
          tilesY_;

        // Set quality based off of IIIF version
        if (data.profile instanceof Array) {
          _this.profile = data.profile[0];
        }else {
          _this.profile = data.profile;
        }
        _this.type = data.type;

        _this._setQuality();

        // Unless an explicit tileSize is set, use a preferred tileSize
        if (!_this._explicitTileSize) {
          // Set the default first
          _this.options.tileSize = 256;
          if (data.tiles) {
            // Image API 2.0 Case
            _this.options.tileSize = data.tiles[0].width;
          } else if (data.tile_width){
            // Image API 1.1 Case
            _this.options.tileSize = data.tile_width;
          }
        }

        function ceilLog2(x) {
          return Math.ceil(Math.log(x) / Math.LN2);
        };

        // Calculates maximum native zoom for the layer
        _this.maxNativeZoom = Math.max(
          ceilLog2(_this.x / _this.options.tileSize),
          ceilLog2(_this.y / _this.options.tileSize),
          0
        );
        _this.options.maxNativeZoom = _this.maxNativeZoom;
        
        // Enable zooming further than native if maxZoom option supplied
        if (_this._customMaxZoom && _this.options.maxZoom > _this.maxNativeZoom) {
          _this.maxZoom = _this.options.maxZoom;
        }
        else {
          _this.maxZoom = _this.maxNativeZoom;
        }
        
        for (var i = 0; i <= _this.maxZoom; i++) {
          scale = Math.pow(2, _this.maxNativeZoom - i);
          width_ = Math.ceil(_this.x / scale);
          height_ = Math.ceil(_this.y / scale);
          tilesX_ = Math.ceil(width_ / _this.options.tileSize);
          tilesY_ = Math.ceil(height_ / _this.options.tileSize);
          tierSizes.push([tilesX_, tilesY_]);
          imageSizes.push(L.point(width_,height_));
        }

        _this._tierSizes = tierSizes;
        _this._imageSizes = imageSizes;
      })
      .catch(function(err){
          console.error(err);
      });
      
  },

  _setQuality: function() {
    var _this = this;
    var profileToCheck = _this.profile;

    if (_this._explicitQuality) {
      return;
    }

    // If profile is an object
    if (typeof(profileToCheck) === 'object') {
      profileToCheck = profileToCheck['@id'];
    }

    // Set the quality based on the IIIF compliance level
    switch (true) {
      case /^http:\/\/library.stanford.edu\/iiif\/image-api\/1.1\/compliance.html.*$/.test(profileToCheck):
        _this.options.quality = 'native';
        break;
      // Assume later profiles and set to default
      default:
        _this.options.quality = 'default';
        break;
    }
  },

  _infoToBaseUrl: function() {
    return this._infoUrl.replace('info.json', '');
  },
  _templateUrl: function() {
    return this._infoToBaseUrl() + '{region}/{size}/{rotation}/{quality}.{format}';
  },
  _isValidTile: function(coords) {
    var _this = this;
    var zoom = _this._getZoomForUrl();
    var sizes = _this._tierSizes[zoom];
    var x = coords.x;
    var y = coords.y;
    if (zoom < 0 && x >= 0 && y >= 0) {
      return true;
    }

    if (!sizes) return false;
    if (x < 0 || sizes[0] <= x || y < 0 || sizes[1] <= y) {
      return false;
    }else {
      return true;
    }
  },
  _tileShouldBeLoaded: function(coords) {
    return this._isValidTile(coords);
  },
  _getInitialZoom: function (mapSize) {
    var _this = this;
    var tolerance = 0.8;
    var imageSize;
    // Calculate an offset between the zoom levels and the array accessors
    var offset = _this._imageSizes.length - 1 - _this.options.maxNativeZoom;
    for (var i = _this._imageSizes.length - 1; i >= 0; i--) {
      imageSize = _this._imageSizes[i];
      if (imageSize.x * tolerance < mapSize.x && imageSize.y * tolerance < mapSize.y) {
        return i - offset;
      }
    }
    // return a default zoom
    return 2;
  }
});

L.tileLayer.iiif = function(url, options) {
  return new L.TileLayer.Iiif(url, options);
};

// Initialize map
var map = L.map('map', {
  center: [0, 0],
  crs: L.CRS.Simple,
  zoom: 0
});

L.tileLayer.iiif('iiif3/info.json').addTo(map);

// Mouse Position plugin
L.Control.MousePosition = L.Control.extend({
  options: {
    position: 'bottomleft',
    separator: ' : ',
    emptyString: 'Unavailable',
    lngFirst: false,
    numDigits: 2,
    lngFormatter: undefined,
    latFormatter: undefined,
    prefix: ""
  },

  onAdd: function (map) {
    this._container = L.DomUtil.create('div', 'leaflet-control-mouseposition');
    L.DomEvent.disableClickPropagation(this._container);
    map.on('mousemove', this._onMouseMove, this);
    this._container.innerHTML=this.options.emptyString;
    return this._container;
  },

  onRemove: function (map) {
    map.off('mousemove', this._onMouseMove)
  },

  _onMouseMove: function (e) {
    var lng = this.options.lngFormatter ? this.options.lngFormatter(e.latlng.lng) : L.Util.formatNum(e.latlng.lng, this.options.numDigits);
    var lat = this.options.latFormatter ? this.options.latFormatter(e.latlng.lat) : L.Util.formatNum(e.latlng.lat, this.options.numDigits);
    var value = this.options.lngFirst ? lng + this.options.separator + lat : lat + this.options.separator + lng;
    var prefixAndValue = this.options.prefix + ' ' + value;
    this._container.innerHTML = prefixAndValue;
  }

});

L.Map.mergeOptions({
    positionControl: false
});

L.Map.addInitHook(function () {
    if (this.options.positionControl) {
        this.positionControl = new L.Control.MousePosition();
        this.addControl(this.positionControl);
    }
});

L.control.mousePosition = function (options) {
    return new L.Control.MousePosition(options);
};

// Mini Map plugin
(function (factory, window) {

  if (typeof define === 'function' && define.amd) {
    define(['leaflet'], factory);

  } else if (typeof exports === 'object') {
    module.exports = factory(require('leaflet'));
  }

  if (typeof window !== 'undefined' && window.L) {
    window.L.Control.MiniMap = factory(L);
    window.L.control.minimap = function (layer, options) {
      return new window.L.Control.MiniMap(layer, options);
    };
  }
}(function (L) {

  var MiniMap = L.Control.extend({

    includes: L.Evented ? L.Evented.prototype : L.Mixin.Events,

    options: {
      position: 'bottomright',
      toggleDisplay: false,
      zoomLevelOffset: -5,
      zoomLevelFixed: false,
      centerFixed: false,
      zoomAnimation: true,
      autoToggleDisplay: false,
      minimized: false,
      width: 150,
      height: 150,
      collapsedWidth: 16,
      collapsedHeight: 16,
      aimingRectOptions: {color: '#30a3f1', weight: 1, interactive: false},
      shadowRectOptions: {color: '#fff', weight: 1, interactive: false, opacity: 0, fillOpacity: 0},
      strings: {hideText: 'Hide MiniMap', showText: 'Show MiniMap'},
      mapOptions: {}
    },

    initialize: function (layer, options) {
      L.Util.setOptions(this, options);
      this.options.aimingRectOptions.interactive = false;
      this.options.shadowRectOptions.interactive = false;
      this._layer = layer;
    },

    onAdd: function (map) {

      this._mainMap = map;

      this._container = L.DomUtil.create('div', 'leaflet-control-minimap');
      this._container.style.width = this.options.width + 'px';
      this._container.style.height = this.options.height + 'px';
      L.DomEvent.disableClickPropagation(this._container);
      L.DomEvent.on(this._container, 'mousewheel', L.DomEvent.stopPropagation);

      var mapOptions = {
        attributionControl: false,
        dragging: !this.options.centerFixed,
        zoomControl: false,
        zoomAnimation: this.options.zoomAnimation,
        autoToggleDisplay: this.options.autoToggleDisplay,
        touchZoom: this.options.centerFixed ? 'center' : !this._isZoomLevelFixed(),
        scrollWheelZoom: this.options.centerFixed ? 'center' : !this._isZoomLevelFixed(),
        doubleClickZoom: this.options.centerFixed ? 'center' : !this._isZoomLevelFixed(),
        boxZoom: !this._isZoomLevelFixed(),
        crs: map.options.crs
      };
      mapOptions = L.Util.extend(this.options.mapOptions, mapOptions);

      this._miniMap = new L.Map(this._container, mapOptions);

      this._miniMap.addLayer(this._layer);

      this._mainMapMoving = false;
      this._miniMapMoving = false;

      this._userToggledDisplay = false;
      this._minimized = false;

      if (this.options.toggleDisplay) {
        this._addToggleButton();
      }

      this._miniMap.whenReady(L.Util.bind(function () {
        this._aimingRect = L.rectangle(this._mainMap.getBounds(), this.options.aimingRectOptions).addTo(this._miniMap);
        this._shadowRect = L.rectangle(this._mainMap.getBounds(), this.options.shadowRectOptions).addTo(this._miniMap);
        this._mainMap.on('moveend', this._onMainMapMoved, this);
        this._mainMap.on('move', this._onMainMapMoving, this);
        this._miniMap.on('movestart', this._onMiniMapMoveStarted, this);
        this._miniMap.on('move', this._onMiniMapMoving, this);
        this._miniMap.on('moveend', this._onMiniMapMoved, this);
      }, this));

      return this._container;
    },

    addTo: function (map) {
      L.Control.prototype.addTo.call(this, map);

      var center = this.options.centerFixed || this._mainMap.getCenter();
      this._miniMap.setView(center, this._decideZoom(true));
      this._setDisplay(this.options.minimized);
      return this;
    },

    onRemove: function (map) {
      this._mainMap.off('moveend', this._onMainMapMoved, this);
      this._mainMap.off('move', this._onMainMapMoving, this);
      this._miniMap.off('moveend', this._onMiniMapMoved, this);

      this._miniMap.removeLayer(this._layer);
    },

    changeLayer: function (layer) {
      this._miniMap.removeLayer(this._layer);
      this._layer = layer;
      this._miniMap.addLayer(this._layer);
    },

    _addToggleButton: function () {
      this._toggleDisplayButton = this.options.toggleDisplay ? this._createButton(
        '', this._toggleButtonInitialTitleText(), ('leaflet-control-minimap-toggle-display leaflet-control-minimap-toggle-display-' +
        this.options.position), this._container, this._toggleDisplayButtonClicked, this) : undefined;

      this._toggleDisplayButton.style.width = this.options.collapsedWidth + 'px';
      this._toggleDisplayButton.style.height = this.options.collapsedHeight + 'px';
    },

    _toggleButtonInitialTitleText: function () {
      if (this.options.minimized) {
        return this.options.strings.showText;
      } else {
        return this.options.strings.hideText;
      }
    },

    _createButton: function (html, title, className, container, fn, context) {
      var link = L.DomUtil.create('a', className, container);
      link.innerHTML = html;
      link.href = '#';
      link.title = title;

      var stop = L.DomEvent.stopPropagation;

      L.DomEvent
        .on(link, 'click', stop)
        .on(link, 'mousedown', stop)
        .on(link, 'dblclick', stop)
        .on(link, 'click', L.DomEvent.preventDefault)
        .on(link, 'click', fn, context);

      return link;
    },

    _toggleDisplayButtonClicked: function () {
      this._userToggledDisplay = true;
      if (!this._minimized) {
        this._minimize();
      } else {
        this._restore();
      }
    },

    _setDisplay: function (minimize) {
      if (minimize !== this._minimized) {
        if (!this._minimized) {
          this._minimize();
        } else {
          this._restore();
        }
      }
    },

    _minimize: function () {
      if (this.options.toggleDisplay) {
        this._container.style.width = this.options.collapsedWidth + 'px';
        this._container.style.height = this.options.collapsedHeight + 'px';
        this._toggleDisplayButton.className += (' minimized-' + this.options.position);
        this._toggleDisplayButton.title = this.options.strings.showText;
      } else {
        this._container.style.display = 'none';
      }
      this._minimized = true;
      this._onToggle();
    },

    _restore: function () {
      if (this.options.toggleDisplay) {
        this._container.style.width = this.options.width + 'px';
        this._container.style.height = this.options.height + 'px';
        this._toggleDisplayButton.className = this._toggleDisplayButton.className
          .replace('minimized-' + this.options.position, '');
        this._toggleDisplayButton.title = this.options.strings.hideText;
      } else {
        this._container.style.display = 'block';
      }
      this._minimized = false;
      this._onToggle();
    },

    _onMainMapMoved: function (e) {
      if (!this._miniMapMoving) {
        var center = this.options.centerFixed || this._mainMap.getCenter();

        this._mainMapMoving = true;
        this._miniMap.setView(center, this._decideZoom(true));
        this._setDisplay(this._decideMinimized());
      } else {
        this._miniMapMoving = false;
      }
      this._aimingRect.setBounds(this._mainMap.getBounds());
    },

    _onMainMapMoving: function (e) {
      this._aimingRect.setBounds(this._mainMap.getBounds());
    },

    _onMiniMapMoveStarted: function (e) {
      if (!this.options.centerFixed) {
        var lastAimingRect = this._aimingRect.getBounds();
        var sw = this._miniMap.latLngToContainerPoint(lastAimingRect.getSouthWest());
        var ne = this._miniMap.latLngToContainerPoint(lastAimingRect.getNorthEast());
        this._lastAimingRectPosition = {sw: sw, ne: ne};
      }
    },

    _onMiniMapMoving: function (e) {
      if (!this.options.centerFixed) {
        if (!this._mainMapMoving && this._lastAimingRectPosition) {
          this._shadowRect.setBounds(new L.LatLngBounds(this._miniMap.containerPointToLatLng(this._lastAimingRectPosition.sw), this._miniMap.containerPointToLatLng(this._lastAimingRectPosition.ne)));
          this._shadowRect.setStyle({opacity: 1, fillOpacity: 0.3});
        }
      }
    },

    _onMiniMapMoved: function (e) {
      if (!this._mainMapMoving) {
        this._miniMapMoving = true;
        this._mainMap.setView(this._miniMap.getCenter(), this._decideZoom(false));
        this._shadowRect.setStyle({opacity: 0, fillOpacity: 0});
      } else {
        this._mainMapMoving = false;
      }
    },

    _isZoomLevelFixed: function () {
      var zoomLevelFixed = this.options.zoomLevelFixed;
      return this._isDefined(zoomLevelFixed) && this._isInteger(zoomLevelFixed);
    },

    _decideZoom: function (fromMaintoMini) {
      if (!this._isZoomLevelFixed()) {
        if (fromMaintoMini) {
          return this._mainMap.getZoom() + this.options.zoomLevelOffset;
        } else {
          var currentDiff = this._miniMap.getZoom() - this._mainMap.getZoom();
          var proposedZoom = this._miniMap.getZoom() - this.options.zoomLevelOffset;
          var toRet;

          if (currentDiff > this.options.zoomLevelOffset && this._mainMap.getZoom() < this._miniMap.getMinZoom() - this.options.zoomLevelOffset) {
            if (this._miniMap.getZoom() > this._lastMiniMapZoom) {
              toRet = this._mainMap.getZoom() + 1;
              this._miniMap.setZoom(this._miniMap.getZoom() - 1);
            } else {
              toRet = this._mainMap.getZoom();
            }
          } else {
            toRet = proposedZoom;
          }
          this._lastMiniMapZoom = this._miniMap.getZoom();
          return toRet;
        }
      } else {
        if (fromMaintoMini) {
          return this.options.zoomLevelFixed;
        } else {
          return this._mainMap.getZoom();
        }
      }
    },

    _decideMinimized: function () {
      if (this._userToggledDisplay) {
        return this._minimized;
      }

      if (this.options.autoToggleDisplay) {
        if (this._mainMap.getBounds().contains(this._miniMap.getBounds())) {
          return true;
        }
        return false;
      }

      return this._minimized;
    },

    _isInteger: function (value) {
      return typeof value === 'number';
    },

    _isDefined: function (value) {
      return typeof value !== 'undefined';
    },

    _onToggle: function () {
      L.Util.requestAnimFrame(function () {
        L.DomEvent.on(this._container, 'transitionend', this._fireToggleEvents, this);
        if (!L.Browser.any3d) {
          L.Util.requestAnimFrame(this._fireToggleEvents, this);
        }
      }, this);
    },

    _fireToggleEvents: function () {
      L.DomEvent.off(this._container, 'transitionend', this._fireToggleEvents, this);
      var data = { minimized: this._minimized };
      this.fire(this._minimized ? 'minimize' : 'restore', data);
      this.fire('toggle', data);
    }
  });

  L.Map.mergeOptions({
    miniMapControl: false
  });

  L.Map.addInitHook(function () {
    if (this.options.miniMapControl) {
      this.miniMapControl = (new MiniMap()).addTo(this);
    }
  });

  return MiniMap;

}, window));

// Initialize Mouse Position plugin
L.control.mousePosition().addTo(map);

// Initialize Mini Map plugin
var map2 = new L.tileLayer.iiif('iiif3/info.json');
var miniMap = new L.Control.MiniMap(map2, { toggleDisplay: true }).addTo(map);

// Map marker icons
var check = L.icon({iconUrl: 'images/check.png', iconSize: [26, 26]});
var circle_blue = L.icon({iconUrl: 'images/circle-blue.png', iconSize: [26, 26]});
var comment = L.icon({iconUrl: 'images/comment.png', iconSize: [26, 26]});
var error = L.icon({iconUrl: 'images/error.png', iconSize: [26, 26]});
var face_happy = L.icon({iconUrl: 'images/face-happy.png', iconSize: [26, 26]});
var face_sad = L.icon({iconUrl: 'images/face-sad.png', iconSize: [26, 26]});
var flag_green = L.icon({iconUrl: 'images/flag-green.png', iconSize: [21, 26]});
var flag_violet = L.icon({iconUrl: 'images/flag-violet.png', iconSize: [21, 26]});
var heart = L.icon({iconUrl: 'images/heart.png', iconSize: [26, 24]});
var help = L.icon({iconUrl: 'images/help.png', iconSize: [26, 26]});
var person = L.icon({iconUrl: 'images/person.png', iconSize: [26, 26]});
var pin2_blue = L.icon({iconUrl: 'images/pin2-blue.png', iconSize: [26, 26]});
var pin2_red = L.icon({iconUrl: 'images/pin2-red.png', iconSize: [26, 26]});
var pin3_red = L.icon({iconUrl: 'images/pin3-red.png', iconSize: [18, 24]});
var pin_blue = L.icon({iconUrl: 'images/pin-blue.png', iconSize: [22, 27]});
var pin_green = L.icon({iconUrl: 'images/pin-green.png', iconSize: [22, 27]});
var pin_red = L.icon({iconUrl: 'images/pin-red.png', iconSize: [22, 27]});
var star = L.icon({iconUrl: 'images/star.png', iconSize: [26, 26]});

// Map marker coordinates
var achievement_pillars = L.marker([-0.23501, 0.18648], {icon: pin_blue}).addTo(map);
var avarice_diamond = L.marker([-0.27933, 0.27166], {icon: pin_blue}).addTo(map);
var bammalam_monument = L.marker([-0.24079, 0.18417], {icon: pin_blue}).addTo(map);
var big_fungus = L.marker([-0.27115, 0.24407], {icon: flag_violet}).addTo(map);
var blood_portal = L.marker([-0.2483, 0.0907], {icon: pin_blue}).addTo(map);
var buried_eye_portal = L.marker([-0.27969, 0.22857], {icon: pin_blue}).addTo(map);
var cabin = L.marker([-0.24738, 0.10316], {icon: pin_blue}).addTo(map);
var cabin_secret_01 = L.marker([-0.24911, 0.10304], {icon: pin_blue}).addTo(map);
var cabin_secret_02 = L.marker([-0.25073, 0.10031], {icon: pin_blue}).addTo(map);
var cauldron_room = L.marker([-0.28828, 0.22812], {icon: help}).addTo(map);
var coral_chest = L.marker([-0.20908, 0.2874], {icon: pin_blue}).addTo(map);
var curse_of_greed = L.marker([-0.24257, 0.18824], {icon: pin_blue}).addTo(map);
var dark_cave = L.marker([-0.25056, 0.18481], {icon: heart}).addTo(map);
var dark_chest = L.marker([-0.36641, 0.22832], {icon: pin_blue}).addTo(map);
var dark_moon = L.marker([-0.53619, 0.20076], {icon: pin_blue}).addTo(map);
var dragon = L.marker([-0.30357, 0.21684], {icon: error}).addTo(map);
var end_of_everything_room = L.marker([-0.36259, 0.16139], {icon: pin_blue}).addTo(map);
var esa_carving = L.marker([-0.23927, 0.18647], {icon: pin_blue}).addTo(map);
var essence_eater_east = L.marker([-0.24593, 0.29548], {icon: pin_blue}).addTo(map);
var essence_eater_west = L.marker([-0.24458, 0.1459], {icon: pin_blue}).addTo(map);
var essence_of_air = L.marker([-0.20428, 0.09843], {icon: pin_blue}).addTo(map);
var essence_of_earth = L.marker([-0.2318, 0.32284], {icon: pin_blue}).addTo(map);
var essence_of_fire = L.marker([-0.24876, 0.0907], {icon: pin_blue}).addTo(map);
var essence_of_spirits = L.marker([-0.34995, 0.09055], {icon: pin_blue}).addTo(map);
var essence_of_water = L.marker([-0.37359, 0.15747], {icon: pin_blue}).addTo(map);
var evil_eye = L.marker([-0.24429, 0.18011], {icon: pin_blue}).addTo(map);
var experimental_wand = L.marker([-0.32245, 0.32285], {icon: pin_blue}).addTo(map);
var eye_room = L.marker([-0.28742, 0.1693], {icon: pin_blue}).addTo(map);
var friend_cavern_01 = L.marker([-0.27963, 0.11807], {icon: flag_green}).addTo(map);
var friend_cavern_02 = L.marker([-0.28339, 0.16137], {icon: flag_green}).addTo(map);
var friend_cavern_03 = L.marker([-0.2914, 0.2244], {icon: flag_green}).addTo(map);
var friend_cavern_04 = L.marker([-0.33472, 0.11417], {icon: flag_green}).addTo(map);
var friend_cavern_05 = L.marker([-0.34653, 0.16142], {icon: flag_green}).addTo(map);
var friend_cavern_06 = L.marker([-0.32288, 0.23228], {icon: flag_green}).addTo(map)
var fungal_altar_01 = L.marker([-0.20908, 0.2445], {icon: flag_violet}).addTo(map);
var fungal_altar_02 = L.marker([-0.25999, 0.31501], {icon: flag_violet}).addTo(map);
var fungal_altar_03 = L.marker([-0.32294, 0.29926], {icon: flag_violet}).addTo(map);
var fungal_altar_04 = L.marker([-0.26002, 0.17328], {icon: flag_violet}).addTo(map);
var fungal_altar_05 = L.marker([-0.323, 0.18913], {icon: flag_violet}).addTo(map);
var fungus_quest = L.marker([-0.2459, 0.24442], {icon: flag_violet}).addTo(map);
var gate_guardian = L.marker([-0.33518, 0.22055], {icon: error}).addTo(map);
var gold_biome_01 = L.marker([-0.22056, 0.03922], {icon: pin_blue}).addTo(map);
var gold_biome_02 = L.marker([-0.37393, 0.09059], {icon: pin_blue}).addTo(map);
var gold_biome_03 = L.marker([-0.22052, 0.31489], {icon: pin_blue}).addTo(map);
var gourd_cave = L.marker([-0.19748, 0.07436], {icon: heart}).addTo(map);
var grand_master = L.marker([-0.36302, 0.29526], {icon: error}).addTo(map);
var guard_cave_404 = L.marker([-0.19675, 0.35046], {icon: pin_blue}).addTo(map);
var high_alchemist = L.marker([-0.25282, 0.16142], {icon: error}).addTo(map);
var hourglass_room = L.marker([-0.28622, 0.21195], {icon: pin_blue}).addTo(map);
var kantele = L.marker([-0.24019, 0.18575], {icon: pin_blue}).addTo(map);
var karl_the_mighty = L.marker([-0.26356, 0.22387], {icon: face_happy}).addTo(map);
var kolmi = L.marker([-0.34618, 0.22609], {icon: error}).addTo(map);
var leviathan = L.marker([-0.32317, 0.09114], {icon: error}).addTo(map);
var mecha_kolmi = L.marker([-0.33108, 0.3071], {icon: error}).addTo(map);
var meditation_cube_room = L.marker([-0.26392, 0.1654], {icon: pin_blue}).addTo(map);
var moon = L.marker([-0.04732, 0.20093], {icon: pin_blue}).addTo(map);
var moon_radar_perk = L.marker([-0.27122, 0.32285], {icon: pin_blue}).addTo(map);
var mountain_altar = L.marker([-0.23696, 0.20481], {icon: pin_blue}).addTo(map);
var music_box_desert = L.marker([-0.24573, 0.31179], {icon: pin_blue}).addTo(map);
var music_box_giant_tree = L.marker([-0.23557, 0.18415], {icon: pin_blue}).addTo(map);
var music_box_lake = L.marker([-0.24302, 0.10513], {icon: pin_blue}).addTo(map);
var music_box_pond = L.marker([-0.2476, 0.22034], {icon: pin_blue}).addTo(map);
var music_stone = L.marker([-0.27122, 0.17323], {icon: pin_blue}).addTo(map);
var ocarina = L.marker([-0.1972, 0.12206], {icon: pin_blue}).addTo(map);
var orb_cement = L.marker([-0.37087, 0.27953], {icon: circle_blue}).addTo(map);
var orb_deercoy = L.marker([-0.35906, 0.12991], {icon: circle_blue}).addTo(map);
var orb_earthquake = L.marker([-0.23692, 0.27558], {icon: circle_blue}).addTo(map);
var orb_fireworks = L.marker([-0.3709, 0.19684], {icon: circle_blue}).addTo(map);
var orb_holy_bomb = L.marker([-0.27635, 0.16535], {icon: circle_blue}).addTo(map);
var orb_necromancy = L.marker([-0.26852, 0.27561], {icon: circle_blue}).addTo(map);
var orb_nuke L.marker([-0.26852, 0.27561], {icon: circle_blue}).addTo(map);
var orb_sea_of_lava = L.marker([-0.23767, 0.20481], {icon: circle_blue}).addTo(map);
var orb_spiral_shot = L.marker([-0.32362, 0.1693], {icon: circle_blue}).addTo(map);
var orb_tentacle = L.marker([-0.26849, 0.12203], {icon: circle_blue}).addTo(map);
var orb_thundercloud = L.marker([-0.2528, 0.23228], {icon: circle_blue}).addTo(map);
var perk_removal_altar = L.marker([-0.30385, 0.30707], {icon: pin_blue}).addTo(map);
var portal_to_coral_chest = L.marker([-0.30217, 0.22923], {icon: pin2_red}).addTo(map);
var portal_to_hell_orb_room = L.marker([-0.30412, 0.22918], {icon: pin2_red}).addTo(map);
var portal_to_island = L.marker([-0.30312, 0.22738], {icon: pin2_red}).addTo(map);
var portal_to_nullifying_altar = L.marker([-0.30331, 0.22927], {icon: pin2_red}).addTo(map);
var portal_to_ocarina = L.marker([-0.30217, 0.22738], {icon: pin2_red}).addTo(map);
var portal_to_snowy_chasm_orb_room = L.marker([-0.30408, 0.22746], {icon: pin2_red}).addTo(map);
var power_plant_biome = L.marker([-0.3776, 0.07078], {icon: pin_blue}).addTo(map);
var power_plant_infinite = L.marker([-0.38208, 0.07088], {icon: pin_blue}).addTo(map);
var rainbow_trail_spell = L.marker([-0.22453, 0.09116], {icon: pin_blue}).addTo(map);
var reward_diamond = L.marker([-0.27913, 0.27557], {icon: pin_blue}).addTo(map);
var scales = L.marker([-0.24552, 0.29924], {icon: pin_blue}).addTo(map);
var secret_platforms = L.marker([-0.24342, 0.10513], {icon: pin_blue}).addTo(map);
var shop_hell_01 = L.marker([-0.46416, 0.1742], {icon: pin_blue}).addTo(map);
var shop_hell_02 = L.marker([-0.52346, 0.2244], {icon: pin_blue}).addTo(map);
var shop_sky_01 = L.marker([-0.08633, 0.17417], {icon: pin_blue}).addTo(map);
var shop_sky_02 = L.marker([-0.14563, 0.2244], {icon: pin_blue}).addTo(map);
var skull_portal = L.marker([-0.24628, 0.25589], {icon: pin_blue}).addTo(map);
var teleport_room = L.marker([-0.30228, 0.22831], {icon: pin_blue}).addTo(map);
var the_forgotten = L.marker([-0.34731, 0.11024], {icon: error}).addTo(map);
var the_work = L.marker([-0.36245, 0.24802], {icon: pin_blue}).addTo(map);
var three_eyes_legs = L.marker([-0.23958, 0.27554], {icon: error}).addTo(map);
var tiny = L.marker([-0.3887, 0.31326], {icon: error}).addTo(map);
var tower_entrance = L.marker([-0.31642, 0.27372], {icon: pin_blue}).addTo(map);
var tower_portal = L.marker([-0.33006, 0.16535], {icon: pin_blue}).addTo(map);
var warning_01 = L.marker([-0.23595, 0.03786], {icon: error}).addTo(map);
var warning_02 = L.marker([-0.23595, 0.36554], {icon: error}).addTo(map);
var wormy_egg = L.marker([-0.24224, 0.19079], {icon: pin_blue}).addTo(map);
var you = L.marker([-0.24526, 0.20057], {icon: pin_blue}).addTo(map);

// Map marker descriptions
achievement_pillars.bindPopup("<b>Achievement Pillars</b><hr>Visit <a href=\"images/achievement_pillars.png\" target=\"_blank\" rel=\"noopener noreferrer\">this</a> link for details on how to unlock them.");
avarice_diamond.bindPopup("<b>Avarice Diamond</b> <a href=\"https://noita.fandom.com/wiki/The_Tower#Avarice_Diamond\" target=\"_blank\" rel=\"noopener noreferrer\">[wiki]");
bammalam_monument.bindPopup("<b>Bammalam Monument</b> <a href=\"https://noita.fandom.com/wiki/Giant_Tree#Left_Side\" target=\"_blank\" rel=\"noopener noreferrer\">[wiki]");
big_fungus.bindPopup("<b>Big Fungus</b><hr>Now comes pre-loaded with Mystery Fungus!");
blood_portal.bindPopup("<b>Blood Portal</b><hr>Fill this cavern with blood to open a portal back to The Mountain.");
buried_eye_portal.bindPopup("<b>Buried Eye Portal</b> <a href=\"https://noita.fandom.com/wiki/Buried_Eye\" target=\"_blank\" rel=\"noopener noreferrer\">[wiki]</a><hr>Fill the rare Snowy Depths spawn Buried Eye statue with Teleportatium to open a portal here.");
cabin.bindPopup("<b>Cabin</b><hr>Throw a Tablet (or a Reforged Tablet) here to open a portal to the containers below. Each container contains a decent wand and unlocks either Glimmer (via Tablet) or Requirement (via Reforged Tablet) spells. Reforged Tablets can be made by throwing tablets from Orb Rooms onto the Anvil in Hiisi Base.");
cabin_secret_01.bindPopup("<b>Cabin Secret</b><hr>Throw a regular Tablet in the cabin to access this. Spawns multiple Glimmer spells and an Experimental Wand. Be careful of Damned Alchemist enemy inside.");
cabin_secret_02.bindPopup("<b>Cabin Secret</b><hr>Reforge a regular Tablet at the Anvil in Hiisi base, then throw it in the cabin to access this. Spawns multiple Requirements spells and an Experimental Wand. Be careful of Damned Alchemist enemy inside.");
cauldron_room.bindPopup("<b>Cauldron Room</b> <a href=\"https://noita.fandom.com/wiki/Cauldron_Room\" target=\"_blank\" rel=\"noopener noreferrer\">[wiki]</a><hr> The Cauldron Room spawns here if you aren't using any mods. It currently doesn't have any known purpose. It exists in NG+, but not in parallel worlds.");
coral_chest.bindPopup("<b>Coral Chest</b> <a href=\"https://noita.fandom.com/wiki/Crystal_Key\" target=\"_blank\" rel=\"noopener noreferrer\">[wiki]</a><hr>Bring the Crystal Key (obtained from the High Alchemist) here after charging it at the four music boxes.");
curse_of_greed.bindPopup("<b>Curse of Greed</b><hr>Destroy the Green Crystal in the Holy Mountain to remove the curse or bring the curse to the Avarice Diamond in The Tower to unlock the Divide By 10 spell.");
dark_cave.bindPopup("<b>Dark Cave</b><hr>Always contains a Health Up and a Health Restore. The All-Seeing Eye Perk, Wormy Vision (from eating worm blood - check the nearby tree branch for small worm eggs) or a Light modifier on your spells is required to be able to see here. The layout of the Dark Cave is determined by your seed. You can see a list of possible cave layouts by visiting <a href=\"images/dark_cave.png\" target=\"_blank\" rel=\"noopener noreferrer\">this</a> link.");
dark_chest.bindPopup("<b>Dark Chest</b>  <a href=\"https://noita.fandom.com/wiki/Crystal_Key#Dark_Chest\" target=\"_blank\" rel=\"noopener noreferrer\">[wiki]</a>");
dark_moon.bindPopup("<b>Dark Moon</b>");
dragon.bindPopup("<b>Suomuhauki (aka Dragon)</b>");
end_of_everything_room.bindPopup("<b>End of Everything room</b>  <a href=\"https://noita.fandom.com/wiki/Summon_Portal\" target=\"_blank\" rel=\"noopener noreferrer\">[wiki]</a>");
esa_carving.bindPopup("<b>ESA Carving</b><hr>This is a reference to Environmental Station Alpha, another game from one of Nolla's developers.");
essence_eater_east.bindPopup("<b>Essence Eater (East)</b>");
essence_eater_west.bindPopup("<b>Essence Eater (West)</b>");
essence_of_air.bindPopup("<b>Essence of Air</b>");
essence_of_earth.bindPopup("<b>Essence of Earth</b>");
essence_of_fire.bindPopup("<b>Essence of Fire</b>");
essence_of_spirits.bindPopup("<b>Essence of Spirits</b>");
essence_of_water.bindPopup("<b>Essence of Water</b>");
evil_eye.bindPopup("<b>Paha Silmä (aka Evil Eye)</b>");
experimental_wand.bindPopup("<b>Experimental Wand</b><hr>Unlocks Funky (bullet) spell.");
eye_room.bindPopup("<b>Eye Room</b><hr>Companion to the Hourglass portal. Contains eight spells.");
friend_cavern_01.bindPopup("<b>Friend Cavern</b><hr>This is one out of six possible spawn locations. Your seed determines at which of the six locations the Friend Cavern spawns.");
friend_cavern_02.bindPopup("<b>Friend Cavern</b><hr>This is one out of six possible spawn locations. Your seed determines at which of the six locations the Friend Cavern spawns.");
friend_cavern_03.bindPopup("<b>Friend Cavern</b><hr>This is one out of six possible spawn locations. Your seed determines at which of the six locations the Friend Cavern spawns.");
friend_cavern_04.bindPopup("<b>Friend Cavern</b><hr>This is one out of six possible spawn locations. Your seed determines at which of the six locations the Friend Cavern spawns.");
friend_cavern_05.bindPopup("<b>Friend Cavern</b><hr>This is one out of six possible spawn locations. Your seed determines at which of the six locations the Friend Cavern spawns.");
friend_cavern_06.bindPopup("<b>Friend Cavern</b><hr>This is one out of six possible spawn locations. Your seed determines at which of the six locations the Friend Cavern spawns.");
fungal_altar_01.bindPopup("<b>Fungal Altar</b><hr>Bring Mystery Fungus.");
fungal_altar_02.bindPopup("<b>Fungal Altar</b><hr>Bring Mystery Fungus.");
fungal_altar_03.bindPopup("<b>Fungal Altar</b><hr>Bring Mystery Fungus.");
fungal_altar_04.bindPopup("<b>Fungal Altar</b><hr>Bring Mystery Fungus.");
fungal_altar_05.bindPopup("<b>Fungal Altar</b><hr>Bring Mystery Fungus.");
fungus_quest.bindPopup("<b>Hint for Fungus quest</b><hr>Get the Paha Silmä (Evil Eye) and a Powder Pouch filled with Mystery Fungus.");
gate_guardian.bindPopup("<b>Gate Guardian (aka Triangle Boss)</b><hr>Shoot three eggs (regular or hollow) to awaken it. Drops four random spells when defeated.");
gold_biome_01.bindPopup("<b>Gold biome</b><hr>Increasingly slanted Gold biomes are available in parallel worlds.");
gold_biome_02.bindPopup("<b>Gold biome</b>");
gold_biome_03.bindPopup("<b>Gold biome</b>");
gourd_cave.bindPopup("<b>Gourd Cave</b><hr>Can be thrown at feet for healing or thrown at Kolmi.");
grand_master.bindPopup("<b>Mestarien mestari (aka Master of Masters aka Wizard Boss)</b> <a href=\"https://noita.fandom.com/wiki/Mestarien_mestari\" target=\"_blank\" rel=\"noopener noreferrer\">[wiki]");
guard_cave_404.bindPopup("<b>Guard Cave</b><hr>This is where it would normally be, but it does not exist in parallel worlds.");
high_alchemist.bindPopup("<b>Ylialkemisti (aka High Alchemist)</b> <a href=\"https://noita.fandom.com/wiki/Ylialkemisti\" target=\"_blank\" rel=\"noopener noreferrer\">[wiki]");
hourglass_room.bindPopup("<b>Hourglass Room</b><hr>This structure can spawn on either the left or the right side of the Hiisi Base. Fill the hourglass with blood for money or fill it with teleportatium to open a portal to the Eye Room.");
kantele.bindPopup("<b>Kantele and Note spells</b>");
karl_the_mighty.bindPopup("<b>Karl the Mighty, First of its Name, Mover of Suns and Friend to All</b>");
kolmi.bindPopup("<b>Kolmisilmä (aka Kolmi)</b> <a href=\"https://noita.fandom.com/wiki/Kolmisilmä\" target=\"_blank\" rel=\"noopener noreferrer\">[wiki]</a>");
leviathan.bindPopup("<b>Syväolento (aka Leviathan)</b> <a href=\"https://noita.fandom.com/wiki/Syväolento\" target=\"_blank\" rel=\"noopener noreferrer\">[wiki]</a><hr>Exists in NG+, but not in parallel worlds.");
mecha_kolmi.bindPopup("<b>Kolmisilmän silmä (aka Mecha Kolmi)</b> <a href=\"https://noita.fandom.com/wiki/Kolmisilmän_silmä\" target=\"_blank\" rel=\"noopener noreferrer\">[wiki]");
meditation_cube_room.bindPopup("<b>Meditation Cube room</b><hr>Find a rare black and gold cube spawn in Coal Pits and stand motionless on it for one minute to open a portal here. Contains a low-tier wand and allows wand editing while inside of it.");
moon.bindPopup("<b>Moon</b>");
moon_radar_perk.bindPopup("<b>Moon Radar Perk</b>");
mountain_altar.bindPopup("<b>Mountain Altar</b>");
music_box_desert.bindPopup("<b>Desert Music Box</b>");
music_box_giant_tree.bindPopup("<b>Music Box (Giant Tree)</b>");
music_box_lake.bindPopup("<b>Lake Music Box</b>");
music_box_pond.bindPopup("<b>Music Box (Pond)</b>");
music_stone.bindPopup("<b>Music Stone</b>");
ocarina.bindPopup("<b>Ocarina and Note spells</b>");
orb_cement.bindPopup("<b>Orb (Cement)</b>");
orb_deercoy.bindPopup("<b>Orb (Deercoy)</b><hr>Unlocks Deercoy and Flock of Ducks spells.");
orb_earthquake.bindPopup("<b>Orb (Earthquake)</b><hr>Bring Paha Silmä (Evil Eye) here and look up to find a series of platforms leading to the sky and Coral Chest above.");
orb_fireworks.bindPopup("<b>Orb (Fireworks)</b>");
orb_holy_bomb.bindPopup("<b>Orb (Holy Bomb)</b>");
orb_necromancy.bindPopup("<b>Orb (Necromancy)</b>");
orb_nuke.bindPopup("<b>Orb (Nuke)</b>");
orb_sea_of_lava.bindPopup("<b>Orb (Sea of Lava)</b>");
orb_spiral_shot.bindPopup("<b>Orb (Spiral Shot)</b>");
orb_tentacle.bindPopup("<b>Orb (Tentacle)</b>");
orb_thundercloud.bindPopup("<b>Orb (Thundercloud)</b><hr>Visit <a href=\"images/orb_retrieval.png\" target=\"_blank\" rel=\"noopener noreferrer\">this</a> link for safe methods of retrieval.");
perk_removal_altar.bindPopup("<b>Perk Removal Altar</b><hr>Fill with blood (left), whiskey (center) and silver (right) to drop all of your perks. You can then choose which perks to pick back up.");
portal_to_coral_chest.bindPopup("<b>Portal to Coral Chest</b>");
portal_to_hell_orb_room.bindPopup("<b>Portal to Hell Orb Room</b>");
portal_to_island.bindPopup("<b>Portal to Island</b>");
portal_to_nullifying_altar.bindPopup("<b>Portal to Nullifying Altar</b>");
portal_to_ocarina.bindPopup("<b>Portal to Ocarina</b>");
portal_to_snowy_chasm_orb_room.bindPopup("<b>Portal to Snowy Chasm Orb Room</b>");
power_plant_biome.bindPopup("<b>Power Plant biome</b>");
power_plant_infinite.bindPopup("<b>The Power Plant biome extends downwards from here forever.</b>");
rainbow_trail_spell.bindPopup("<b>Rainbow Trail spell</b>");
reward_diamond.bindPopup("<b>Reward Diamond</b> <a href=\"https://noita.fandom.com/wiki/The_Tower#Reward_Diamond\" target=\"_blank\" rel=\"noopener noreferrer\">[wiki]");
scales.bindPopup("<b>Scales</b><hr>Restore balance to the world by creating the Sun and Dark Sun at their respective moons. Permanently unlocks the Omega Black Hole spell.");
secret_platforms.bindPopup("<b>Secret Platforms</b><hr>Bring Paha Silmä (Evil Eye) here to reveal a series of platforms leading to the sky and Ocarina.");
shop_hell_01.bindPopup("<b>Shop</b>");
shop_hell_02.bindPopup("<b>Shop</b>");
shop_sky_01.bindPopup("<b>Shop</b>");
shop_sky_02.bindPopup("<b>Shop</b>");
skull_portal.bindPopup("<b>Skull Portal</b><hr>Fill eye with water to open a portal to The Lake.");
teleport_room.bindPopup("<b>Teleport Room</b> <a href=\"https://noita.fandom.com/wiki/Teleport_Room\" target=\"_blank\" rel=\"noopener noreferrer\">[wiki]</a>");
the_forgotten.bindPopup("<b>Unohdettu (aka The Forgotten)</b> <a href=\"https://noita.fandom.com/wiki/Unohdettu\" target=\"_blank\" rel=\"noopener noreferrer\">[wiki]</a>");
the_work.bindPopup("<b>The Work</b><hr>Kill Kolmi to open a portal here.");
three_eyes_legs.bindPopup("<b>Kolmisilmän koipi (aka Pyramid Boss)</b> <a href=\"https://noita.fandom.com/wiki/Kolmisilmän_koipi\" target=\"_blank\" rel=\"noopener noreferrer\">[wiki]");
tiny.bindPopup("<b>Limatoukka (aka Maggot aka Tiny)</b> <a href=\"https://noita.fandom.com/wiki/Limatoukka\" target=\"_blank\" rel=\"noopener noreferrer\">[wiki]</a><hr>Exists in NG+, but not in parallel worlds.");
tower_entrance.bindPopup("<b>Entrance to The Tower</b>");
tower_portal.bindPopup("<b>Entrance to The Tower</b><hr>Drain or destroy the lava to reveal the portal.");
warning_01.bindPopup("<b>Warning</b><hr>Watch out for High Alchemist and Pit Boss spawns on the surface of parallel worlds.");
warning_02.bindPopup("<b>Warning</b><hr>Watch out for High Alchemist and Pit Boss spawns on the surface of parallel worlds.");
wormy_egg.bindPopup("<b>Wormy Egg</b><hr>Can be useful for the Dark Cave below.");
you.bindPopup("<b>You</b>");
