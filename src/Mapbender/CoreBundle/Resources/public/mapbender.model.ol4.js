window.Mapbender = Mapbender || {};
window.Mapbender.MapModelOl4 = (function() {
    'use strict';

    /**
     * @param {Object} mbMap
     * @constructor
     */
    function MapModelOl4(mbMap) {
        Mapbender.MapModelBase.apply(this, arguments);
        this._geojsonFormat = new ol.format.GeoJSON();
        this._wktFormat = new ol.format.WKT();
        this._initMap();
        window.Mapbender.vectorLayerPool = window.Mapbender.VectorLayerPool.factory(Mapbender.mapEngine, this.olMap);
        this.displayPois(this._poiOptions);
    }

    MapModelOl4.prototype = Object.create(Mapbender.MapModelBase.prototype);
    Object.assign(MapModelOl4.prototype, {
        constructor: MapModelOl4,
        _geojsonFormat: null,
        sourceTree: [],



    _initMap: function() {
        var options = {
            srs: this._startProj,
            maxExtent: Mapbender.mapEngine.transformBounds(this.mapMaxExtent, this._configProj, this._startProj),
            startExtent: Mapbender.mapEngine.transformBounds(this.mapStartExtent, this._configProj, this._startProj),
            scales : this.mbMap.options.scales,
            dpi: this.mbMap.options.dpi,
            tileSize: this.mbMap.options.tileSize
        };

        this.vectorLayer = {};
        if (!options || !options.srs || !options.maxExtent) {
            console.error("Options srs and maxExtent required");
            throw new Error("Can't initialize model");
        }
        this.options = options;

        this.viewOptions_ = this.calculateViewOptions_(this._startProj, this.mbMap.options.scales, options.maxExtent, options.dpi);
        var view = new ol.View(this.viewOptions_);
        // remove zoom after creating view
        delete this.viewOptions_['zoom'];
        this.olMap = new ol.Map({
            view: view,
            target: this.mbMap.element.attr('id')
        });
        this._patchNavigation(this.olMap);
        this.map = new Mapbender.NotMapQueryMap(this.mbMap.element, this.olMap);

        this._initEvents(this.olMap, this.mbMap);
        this.setExtent(options.startExtent || options.maxExtent);
        this.initializeSourceLayers();
        this.processUrlParams();
    },
    /**
     * @param {ol.Map} olMap
     * @private
     */
    _patchNavigation: function(olMap) {
        var interactions = olMap.getInteractions().getArray();
        for (var i = 0; i < interactions.length; ++i) {
            var interaction = interactions[i];
            if (interaction instanceof ol.interaction.MouseWheelZoom) {
                // Reign in built-in trackpad specialization for better stability on high-resolution pads
                /** @type {(ol.interaction.MouseWheelZoom)} */ interaction;
                interaction.constrainResolution_ = true;    // disable transient touchpad zoom overshooting (inconsistent with wheel)
                interaction.trackpadEventGap_ = 60;         // discrete event debounce milliseconds; reduced from original 400
                interaction.trackpadDeltaPerZoom_ = 2000;   // increased from original 300
            }
        }
    },
    _initEvents: function(olMap, mbMap) {
        var self = this;
        olMap.on('moveend', function() {
            var scales = self._getScales();
            var zoom = self.getCurrentZoomLevel();
            self.sourceTree.map(function(source) {
                self._checkSource(source, true);
            });
            // @todo: figure out how to distinguish zoom change from panning
            mbMap.element.trigger('mbmapzoomchanged', {
                mbMap: mbMap,
                zoom: zoom,
                scale: scales[zoom]
            });
        });
        olMap.on("singleclick", function(data) {
            $(self.mbMap.element).trigger('mbmapclick', {
                mbMap: self.mbMap,
                pixel: data.pixel.slice(),
                coordinate: data.coordinate.slice()
            });
        });
    },
    /**
     * Injects native layers into the map at the "natural" position for the source.
     * This supports multiple layers for the same source.
     *
     * @param {Mapbender.Source} source
     * @param {Array<ol.Layer>} olLayers
     * @private
     */
    _spliceLayers: function(source, olLayers) {
        var sourceIndex = this.sourceTree.indexOf(source);
        if (sourceIndex === -1) {
            console.error("Can't splice layers for source with unknown position", source, olLayers);
            throw new Error("Can't splice layers for source with unknown position");
        }
        var olMap = this.olMap;
        var layerCollection = olMap.getLayers();
        var afterLayer = layerCollection[0]; // hopefully, that's a base layer
        for (var s = sourceIndex - 1; s >= 0; --s) {
            var previousSource = this.sourceTree[s];
            var previousLayer = (previousSource.nativeLayers.slice(-1))[0];
            if (previousLayer) {
                afterLayer = previousLayer;
                break;
            }
        }
        var baseIndex = layerCollection.getArray().indexOf(afterLayer) + 1;
        for (var i = 0; i < olLayers.length; ++i) {
            var olLayer = olLayers[i];
            layerCollection.insertAt(baseIndex + i, olLayer);
            olLayer.mbConfig = source;
            this._initLayerEvents(olLayer, source, i);
        }
    },
    _initLayerEvents: function(olLayer, source, sourceLayerIndex) {
        var mbMap = this.mbMap;
        var nativeSource = olLayer.getSource();
        var engine = Mapbender.mapEngine;
        var tmp = {
            pendingLoads: 0
        };
        nativeSource.on(["tileloadstart", "imageloadstart"], function() {
            if (!tmp.pendingLoads) {
                mbMap.element.trigger('mbmapsourceloadstart', {
                    mbMap: mbMap,
                    source: source
                });
            }
            ++tmp.pendingLoads;
        });
        nativeSource.on(["tileloaderror", "imageloaderror"], function(data) {
            tmp.pendingLoads = Math.max(0, tmp.pendingLoads - 1);
            if (engine.getLayerVisibility(olLayer)) {
                mbMap.element.trigger('mbmapsourceloaderror', {
                    mbMap: mbMap,
                    source: source
                });
            }
        });
        nativeSource.on(["tileloadend", "imageloadend"], function() {
            tmp.pendingLoads = Math.max(0, tmp.pendingLoads - 1);
            if (!tmp.pendingLoads) {
                mbMap.element.trigger('mbmapsourceloadend', {
                    mbMap: mbMap,
                    source: source
                });
            }
        });
    },
    zoomToFullExtent: function() {
        var currentSrsName = this.getCurrentProjectionCode();
        var extent = Mapbender.mapEngine.transformBounds(this.mapMaxExtent, this._configProj, currentSrsName);
        this.setExtent(extent);
    },
    /**
     * @param {Array<number>} boundsOrCoords
     */
    setExtent: function(boundsOrCoords) {
        var bounds;
        if ($.isArray(boundsOrCoords)) {
            bounds = boundsOrCoords;
        } else {
            bounds = [
                boundsOrCoords.left,
                boundsOrCoords.bottom,
                boundsOrCoords.right,
                boundsOrCoords.top
            ];
        }
        this.olMap.getView().fit(bounds);
    },
    /**
     * @param {Number} x projected
     * @param {Number} y projected
     * @param {Object} [options]
     * @param {Number} [options.minScale]
     * @param {Number} [options.maxScale]
     * @param {Number|String} [options.zoom]
     */
    centerXy: function(x, y, options) {
        var geom = new ol.geom.Point([x, y]);
        var zoom = null;
        var ztfOptions = options && Object.assign({}, options) || undefined;
        if (options && (options.zoom || parseInt(options.zoom) === 0)) {
            zoom = this._clampZoomLevel(parseInt(options.zoom));
            delete ztfOptions['zoom'];
            var scales = this._getScales();
            ztfOptions.minScale = scales[zoom];
            ztfOptions.maxScale = scales[zoom];
        }
        this.zoomToFeature(new ol.Feature(geom), ztfOptions);
    },
    /**
     * @param {ol.Feature} feature
     * @param {Object} [options]
     * @param {number=} options.buffer in meters
     * @param {number=} options.minScale
     * @param {number=} options.maxScale
     * @param {boolean=} options.center to forcibly recenter map (default: true); otherwise
     *      just keeps feature in view
     */
    zoomToFeature: function(feature, options) {
        var center_ = !options || (options.center || typeof options.center === 'undefined');
        var bounds = this._getBufferedFeatureBounds(feature, (options && options.buffer) || 0);

        var view = this.olMap.getView();
        var zoom0 = Math.floor(view.getZoomForResolution(view.getResolutionForExtent(bounds)));
        var zoom = this._adjustZoom(zoom0, options);
        var zoomNow = this.getCurrentZoomLevel();
        var viewExtent = view.calculateExtent();
        var featureInView = ol.extent.intersects(viewExtent, bounds);
        if (center_ || zoom !== zoomNow || !featureInView) {
            view.setCenter(ol.extent.getCenter(bounds));
            this.setZoomLevel(zoom, false);
        }
    },
    /**
     * @param {ol.Feature} feature
     * @param {Object} [options]
     * @param {number=} options.buffer in meters
     * @param {boolean=} options.center to forcibly recenter map (default: true); otherwise
     *      just keeps feature in view
     */
    panToFeature: function(feature, options) {
        var center_ = !options || (options.center || typeof options.center === 'undefined');
        var bounds = this._getBufferedFeatureBounds(feature, (options && options.buffer) || 0);

        var view = this.olMap.getView();
        var viewExtent = view.calculateExtent();
        var featureInView = ol.extent.intersects(viewExtent, bounds);
        if (center_ || !featureInView) {
            view.setCenter(ol.extent.getCenter(bounds));
        }
    },
    setZoomLevel: function(level, allowTransitionEffect) {
        var _level = this._clampZoomLevel(level);
        if (_level !== this.getCurrentZoomLevel()) {
            if (allowTransitionEffect) {
                this.olMap.getView().animate({zoom: _level, duration: 300});
            } else {
                this.olMap.getView().setZoom(_level);
            }
        }
    },
    getCurrentZoomLevel: function() {
        return this.olMap.getView().getZoom();
    },
    zoomIn: function() {
        this.setZoomLevel(this.getCurrentZoomLevel() + 1, true);
    },
    zoomOut: function() {
        this.setZoomLevel(this.getCurrentZoomLevel() - 1, true);
    },
    getCurrentProjectionUnits: function() {
        var proj;
        if (this.olMap) {
            proj = this.olMap.getView().getProjection();
        } else {
            proj = ol.proj.get(this._startProj);
        }
        return proj.getUnits() || 'degrees';
    },
    getCurrentProjectionCode: function() {
        if (this.olMap) {
            return this.olMap.getView().getProjection().getCode();
        } else {
            return this._startProj;
        }
    },
    /**
     * Parses a single (E)WKT feature from text. Returns the engine-native feature.
     *
     * @param {String} text
     * @param {String} [sourceSrsName]
     * @return {OpenLayers.Feature.Vector}
     */
    parseWktFeature: function(text, sourceSrsName) {
        var ewktMatch = text.match(/^SRID=([^;]*);(.*)$/);
        if (ewktMatch) {
            return this.parseWktFeature(ewktMatch[2], ewktMatch[1]);
        }
        var targetSrsName = this.olMap.getView().getProjection().getCode();
        return this._wktFormat.readFeatureFromText(text, {
            dataProjection: sourceSrsName || null,
            featureProjection: targetSrsName
        });
    },
    /**
     * @param {*} data
     * @param {String} [sourceSrsName]
     * @return {*}
     */
    parseGeoJsonFeature: function(data, sourceSrsName) {
        var feature = this._geojsonFormat.readFeature(data);
        var geometry = feature && feature.getGeometry();
        if (geometry && sourceSrsName) {
            var targetSrsName = this.olMap.getView().getProjection().getCode();
            geometry.transform(sourceSrsName, targetSrsName);
        }
        return feature;
    },
    /**
     *
     * @param {ol.Feature} feature
     * @return {Object}
     */
    featureToGeoJsonGeometry: function(feature) {
        return this._geojsonFormat.writeFeatureObject(feature).geometry;
    },
    _getScales: function() {
        // @todo: fractional zoom: method must not be called
        var view = this.olMap.getView();
        var dpi = parseFloat(this.mbMap.options.dpi) || 72;
        var self = this;
        return view.getResolutions().map(function(res) {
            var scale0 = self.resolutionToScale(res, dpi);
            return parseInt('' + Math.round(scale0));
        });
    },
    DRAWTYPES: ['Point', 'LineString', 'LinearRing', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon', 'GeometryCollection', 'Circle', 'Box'],

    /**
     * @todo is not complete yet
     *
     * @param {Object} options
     * @returns {ol.style.Style}
     */
    createStyle: function createStyle(options) {
    var style = new ol.style.Style();

    if (options['fill']) {
        var fill = new ol.style.Fill(options['fill']);
        style.setFill(fill);
    }

    if (options['stroke']) {
        var stroke = new ol.style.Stroke(options['stroke']);
        style.setStroke(stroke);
    }

    if (options['circle']) {
        var circle = new ol.style.Circle({
            radius: options['circle'].radius,
            fill: new ol.style.Fill({
                color: options['circle'].color
            }),
            stroke: new ol.style.Stroke(options['circle']['stroke'])
        });
        style.setImage(circle);
    }

    if (options['text']) {
        var text = new ol.style.Text({
            font: options['text']['font'],
            text: options['text']['text'],
            fill: new ol.style.Fill({
                color: options['text']['fill'].color
            }),
            stroke: new ol.style.Stroke(options['text']['stroke']),
            offsetY: options['text']['offsetY']
        });
        style.setText(text);
    }

    return style;
},

createDrawControl: function(type, owner, options){
    if(!_.contains( this.DRAWTYPES,type )){
        throw new Error('Mapbender.Model.createDrawControl only supports the operations' + this.DRAWTYPES.toString()+ 'not' + type);
    }
    options = options || {};
    options.source = options.source ||  new ol.source.Vector({wrapX: false});

    var drawOptions = {
        type: type,
        source: options.source
    };
    if (type === 'Box') {
        drawOptions.geometryFunction = ol.interaction.Draw.createBox();
        drawOptions.type = 'Circle';
    }

    var draw = new ol.interaction.Draw(drawOptions);

    this.olMap.addInteraction(draw);
},
createModifyInteraction: function(owner, style, vectorId, featureId, events) {
    var vectorLayer = this.vectorLayer[owner][vectorId];
    var features = vectorLayer.getSource().getFeatures();
    var selectInteraction = new ol.interaction.Select({
        layers: vectorLayer,
        style: style
    });
    selectInteraction.getFeatures().push(features[0]);

    this.vectorLayer[owner][vectorId].interactions = this.vectorLayer[owner][vectorId].interactions  || {};
    this.vectorLayer[owner][vectorId].interactions.select = this.vectorLayer[owner][vectorId].interactions.select  || {};
    this.vectorLayer[owner][vectorId].interactions.select[vectorId] = selectInteraction;

    var modify = new ol.interaction.Modify({
        features: selectInteraction.getFeatures()
    });

    this.vectorLayer[owner][vectorId].interactions = this.vectorLayer[owner][vectorId].interactions  || {};
    this.vectorLayer[owner][vectorId].interactions[vectorId] = modify;

    _.each(events, function(value, key) {
        modify.on(key, value);
    }.bind(this));

    this.olMap.getInteractions().extend([selectInteraction, modify]);

    return vectorId;
},

deselectFeatureById: function(owner, vectorId) {
    var vectorLayer = this.vectorLayer[owner][vectorId];
    if (!vectorLayer.interactions.select) {
        return;
    }
    var interaction = vectorLayer.interactions.select[vectorId];
    interaction.getFeatures().clear();
},
/**
 *
 * @param owner
 * @param vectorId
 * @param featureId
 * @returns {ol.Feature}
 */
getFeatureById: function(owner, vectorId, featureId) {
    var source = this.vectorLayer[owner][vectorId].getSource();
    return source.getFeatureById(featureId);
},

    _changeLayerProjection: function(olLayer, newProj) {
        var nativeSource = olLayer.getSource();
        if (nativeSource) {
            nativeSource.projection_ = newProj;
        }
    },
    /**
     * Update map view according to selected projection
     *
     * @param {string} srsNameFrom
     * @param {string} srsNameTo
     */
    _changeProjectionInternal: function(srsNameFrom, srsNameTo) {
        var engine = Mapbender.mapEngine;
        var currentView = this.olMap.getView();
        var fromProj = ol.proj.get(srsNameFrom);
        var toProj = ol.proj.get(srsNameTo);
        var i, j, source, olLayers;
        if (!fromProj || !fromProj.getUnits() || !toProj || !toProj.getUnits()) {
            console.error("Missing / incomplete transformations (log order from / to)", [srsNameFrom, srsNameTo], [fromProj, toProj]);
            throw new Error("Missing / incomplete transformations");
        }
        for (i = 0; i < this.sourceTree.length; ++i) {
            source = this.sourceTree[i];
            if (source.checkRecreateOnSrsSwitch(srsNameFrom, srsNameTo)) {
                Mapbender.mapEngine.removeLayers(this.olMap, source.getNativeLayers());
                source.destroyLayers();
            } else {
                olLayers = source.getNativeLayers();
                for (j = 0; j < olLayers.length; ++ j) {
                    this._changeLayerProjection(olLayers[j], toProj);
                }
            }
        }

        // transform projection extent (=max extent)
        // DO NOT use currentView.getProjection().getExtent() here!
        // Going back and forth between SRSs, there is extreme drift in the
        // calculated values. Always start from the configured maxExtent.
        var newMaxExtent = Mapbender.mapEngine.transformBounds(this.mapMaxExtent, this._configProj, srsNameTo);
        var zoomLevel = this.getCurrentZoomLevel();

        var currentCenter = currentView.getCenter();
        var newCenter = ol.proj.transform(currentCenter, fromProj, toProj);

        var mbMapOptions = this.mbMap.options;
        var resolutionOptions = this.calculateViewOptions_(srsNameTo, mbMapOptions.scales, newMaxExtent, mbMapOptions.dpi);
        var newViewOptions = Object.assign({}, this.viewOptions_, resolutionOptions, {
            projection: srsNameTo,
            center: newCenter,
            zoom: zoomLevel
        });

        var newView = new ol.View(newViewOptions);
        this.olMap.setView(newView);
        for (i = 0; i < this.sourceTree.length; ++i) {
            source = this.sourceTree[i];
            if (source.checkRecreateOnSrsSwitch(srsNameFrom, srsNameTo)) {
                olLayers = source.initializeLayers(srsNameTo);
                for (j = 0; j < olLayers.length; ++j) {
                    var olLayer = olLayers[j];
                    engine.setLayerVisibility(olLayer, false);
                }
                this._spliceLayers(source, olLayers);
            }
        }
        var self = this;
        self.sourceTree.map(function(source) {
            self._checkSource(source, false);
        });
    },

        /**
         * @return {Array<Number>}
         */
        getCurrentExtentArray: function() {
            return this.olMap.getView().calculateExtent();
        },
        /**
         * @param {ol.layer.Vector} olLayer
         * @param {ol.Feature} feature
         * @param {Number} resolution
         * @return {Object}
         */
        extractSvgFeatureStyle: function(olLayer, feature, resolution) {
            var styleOptions = {};
            var layerStyleFn = olLayer.getStyleFunction();
            var featureStyleFn = feature.getStyleFunction();
            var olStyle = (featureStyleFn || layerStyleFn)(feature, resolution);
            if (Array.isArray(olStyle)) {
                olStyle = olStyle[0];
            }
            /** @var {ol.style.Style} olStyle */
            Object.assign(styleOptions, this._extractSvgGeometryStyle(olStyle));
            var text = olStyle.getText();
            var label = text && text.getText();
            if (label) {
                Object.assign(styleOptions, this._extractSvgLabelStyle(text), {
                    label: label
                });
            }
            return styleOptions;
        },
        /**
         * @param {ol.style.Style} olStyle
         * @return {Object}
         * @private
         */
        _extractSvgGeometryStyle: function(olStyle) {
            var style = {};
            var fill = olStyle.getFill();
            var stroke = olStyle.getStroke();
            var image = olStyle.getImage();
            if (fill) {
                Object.assign(style, Mapbender.StyleUtil.cssColorToSvgRules(fill.getColor(), 'fillColor', 'fillOpacity'))
            }
            if (stroke) {
                Object.assign(style, Mapbender.StyleUtil.cssColorToSvgRules(stroke.getColor(), 'strokeColor', 'strokeOpacity'));
                style['strokeWidth'] = stroke.getWidth();
                style['strokeDashstyle'] = stroke.getLineDash() ||  'solid';
            }
            if (image && (image instanceof ol.style.RegularShape)) {
                style['pointRadius'] = image.getRadius() || 6;
            }
            if (image && (image instanceof ol.style.Icon)) {
                var anchor = image.getAnchor();
                var iconElement = image.getImage(1);
                var iconUrl = iconElement && iconElement.src;
                if (anchor !== null && iconUrl) {
                    var size = image.getSize() || [iconElement.naturalWidth, iconElement.naturalHeight];
                    Object.assign(style, {
                        externalGraphic: iconUrl,
                        graphicXOffset: -anchor[0],
                        graphicYOffset: -anchor[1],
                        graphicWidth: size[0],
                        graphicHeight: size[1]
                    });
                }
            }
            return style;
        },
        /**
         * @param {ol.style.Text} olTextStyle
         * @return {Object}
         * @private
         */
        _extractSvgLabelStyle: function(olTextStyle) {
            var style = {};
            var stroke = olTextStyle.getStroke();
            Object.assign(style,
                Mapbender.StyleUtil.cssColorToSvgRules(olTextStyle.getFill().getColor(), 'fontColor', 'fontOpacity'),
                Mapbender.StyleUtil.cssColorToSvgRules(stroke.getColor(), 'labelOutlineColor', 'labelOutlineOpacity')
            );
            style['labelOutlineWidth'] = stroke.getWidth();

            style['labelAlign'] = [olTextStyle.getTextAlign().slice(0, 1), olTextStyle.getTextBaseline().slice(0, 1)].join('');
            style['labelXOffset'] = olTextStyle.getOffsetX();
            style['labelYOffset'] = olTextStyle.getOffsetY();
            return style;
        },
        /**
         * @param {String} srsName
         * @param {Array<Number>}scales
         * @param {Array<Number>=} [maxExtent]
         * @param {Number=} [dpi]
         * @return {{}}
         * @private
         */
        calculateViewOptions_: function(srsName, scales, maxExtent, dpi) {
            var viewOptions = {
                projection: srsName
            };
            if (scales && scales.length) {
                var upm = Mapbender.mapEngine.getProjectionUnitsPerMeter(srsName);
                var inchesPerMetre = 39.37;
                var dpi_ = dpi || 72;
                viewOptions['resolutions'] = scales.map(function(scale) {
                    return scale * upm / (inchesPerMetre * dpi_);
                });
            } else {
                viewOptions.zoom = 7; // hope for the best
            }
            if (maxExtent) {
                viewOptions.extent = maxExtent;
            }
            return viewOptions;
        }
    });

    return MapModelOl4;
}());
