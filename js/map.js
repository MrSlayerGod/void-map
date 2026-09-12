'use strict';

import { Position } from './model/Position.js';

// Import controls
import { CollectionControl } from './controls/collection_control.js';
import { CoordinatesControl } from './controls/coordinates_control.js';
import { LocalCoordinatesControl } from './controls/local_coordinates_control.js';
import { RegionBaseCoordinatesControl } from './controls/region_base_coordinates_control.js';
import { GridControl } from './controls/grid_control.js';
import { LocationLookupControl } from './controls/location_lookup_control.js';
import { MapLabelControl } from './controls/map_label_control.js';
import { PlaneControl } from './controls/plane_control.js';
import { RegionLabelsControl } from './controls/region_labels_control.js';
import { RegionLookupControl } from './controls/region_lookup_control.js';
import { TitleLabel } from './controls/title_label.js';

$(document).ready(function () {
    const urlParams = new URLSearchParams(window.location.search);

    const tileSize = 256;
    const numTiles = 256;
    const startX = 50
    const startY = 50
    const bounds = [[-tileSize * numTiles / 4, -tileSize * numTiles / 2], [tileSize * numTiles, tileSize * numTiles]];
    L.CRS.SimpleOffset = L.extend({}, L.CRS.Simple, {
        offsetZoom: 8,
        scale: function (zoom) {
            return Math.pow(2, zoom - this.offsetZoom);
        },

        zoom: function (scale) {
            return Math.log(scale) / Math.LN2 + this.offsetZoom;
        },
    });
    const map = L.map('map', {
        crs: L.CRS.SimpleOffset,
        maxBounds: bounds,
        center: [tileSize * startY, tileSize * startX],
        minZoom: 10,
        maxZoom: 11,
        zoom: 10,
        zoomControl: false,
    });

    map.plane = 0;

    // Parse markers from URL: `markers=x1,y1:x2,y2:...` or a single `marker=x,y[,z]`
    function parseCoordList(str) {
        const pairs = [];
        if (!str) {
            return pairs;
        }
        const parts = str.split(':');
        for (const part of parts) {
            const m = part.match(/^\s*(-?\d+)\s*,\s*(-?\d+)\s*$/);
            if (m) {
                pairs.push({ x: parseInt(m[1], 10), y: parseInt(m[2], 10) });
            }
        }
        return pairs;
    }

    const markers = parseCoordList(urlParams.get('markers'));
    if (markers.length === 0 && urlParams.get('marker')) {
        const m = urlParams.get('marker').match(/^\s*(-?\d+)\s*,\s*(-?\d+)\s*(?:,\s*(-?\d+)\s*)?$/);
        if (m) {
            markers.push({ x: parseInt(m[1], 10), y: parseInt(m[2], 10) });
        }
    }

    const centreZ = parseInt(urlParams.get('centreZ'), 10);
    if (!isNaN(centreZ) && centreZ >= 0 && centreZ <= 3) {
        map.plane = centreZ;
    }

    const CustomTileLayer = L.TileLayer.extend({
        getTileUrl: function (coords) {
            // return `./map_tiles/${map.plane}/${coords.z}/${coords.x}/${-coords.y}.png`;
            return `https://cdn.jsdelivr.net/gh/MrSlayerGod/void-map-tiles@master/${map.plane}/${coords.z}/${coords.x}/${-coords.y}.png`;
        },
    })
    map.updateMapPath = function () {
        if (map.tile_layer !== undefined) {
            map.removeLayer(map.tile_layer);
        }
        map.tile_layer = new CustomTileLayer({
            tileSize: tileSize,
            bounds: bounds,
        });
        map.tile_layer.addTo(map);
        map.invalidateSize();
    }

    map.updateMapPath();
    map.getContainer().focus();

    map.addControl(new TitleLabel());
    map.addControl(new CoordinatesControl());
    map.addControl(new RegionBaseCoordinatesControl());
    map.addControl(new LocalCoordinatesControl());
    map.addControl(L.control.zoom());
    map.addControl(new PlaneControl());
    map.addControl(new LocationLookupControl());
    map.addControl(new MapLabelControl());
    map.addControl(new CollectionControl({position: 'topright'}));
    map.addControl(new RegionLookupControl());
    map.addControl(new GridControl());
    map.addControl(new RegionLabelsControl());

    var prevMouseRect, prevMousePos;
    map.on('mousemove', function (e) {
        var mousePos = Position.fromLatLng(map, e.latlng, map.plane);

        if (prevMousePos !== mousePos) {

            prevMousePos = mousePos;

            if (prevMouseRect !== undefined) {
                map.removeLayer(prevMouseRect);
            }

            prevMouseRect = mousePos.toLeaflet(map);
            prevMouseRect.addTo(map);
        }
    });

    // Deep-link support: centre the view and draw spawn markers from URL params
    const markerLayer = L.layerGroup().addTo(map);

    function toLatLngList() {
        return markers.map(function (c) {
            return Position.toCentreLatLng(map, c.x, c.y);
        });
    }

    function clampZoom(z) {
        z = parseInt(z, 10);
        if (isNaN(z)) {
            return 8;
        }
        return Math.min(11, Math.max(10, z));
    }

    function applyUrlView() {
        const latlngs = toLatLngList();

        if (latlngs.length > 1) {
            map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40], maxZoom: 11 });
        } else if (latlngs.length === 1) {
            map.setView(latlngs[0], clampZoom(urlParams.get('zoom')), { animate: false });
        } else {
            const centreX = parseInt(urlParams.get('centreX'), 10);
            const centreY = parseInt(urlParams.get('centreY'), 10);
            if (!isNaN(centreX) && !isNaN(centreY)) {
                map.setView(Position.toCentreLatLng(map, centreX, centreY), clampZoom(urlParams.get('zoom')), { animate: false });
            }
        }

        markers.forEach(function (c) {
            L.marker(Position.toCentreLatLng(map, c.x, c.y))
                .bindPopup(`<b>(${c.x}, ${c.y})</b>`)
                .addTo(markerLayer);
        });
    }

    applyUrlView();

    const setUrlParams = () => {
        const mapCentre = map.getBounds().getCenter()
        const centrePos = Position.fromLatLng(map, mapCentre, map.plane);

        const zoom = map.getZoom();

        window.history.replaceState(null, null, `?centreX=${centrePos.x}&centreY=${centrePos.y}&centreZ=${centrePos.z}&zoom=${zoom}`);
    };

    map.on('moveend', setUrlParams);
    map.on('zoomend', setUrlParams);
});