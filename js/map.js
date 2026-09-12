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
        minZoom: 4,
        maxZoom: 11,
        zoom: 8,
        zoomControl: false,
    });

    map.plane = 0;

    // Deep link support: centreX/centreY/centreZ/zoom + marker=x,y[,z] from the URL
    const urlParams = new URLSearchParams(window.location.search);

    const centreZ = parseInt(urlParams.get('centreZ'), 10);
    if (!isNaN(centreZ) && centreZ >= 0 && centreZ <= 3) {
        map.plane = centreZ;
    }

    const CustomTileLayer = L.TileLayer.extend({
        getTileUrl: function (coords) {
            // return `./map_tiles/${map.plane}/${coords.z}/${coords.x}/${-coords.y}.png`;
            return `https://raw.githubusercontent.com/GregHib/void-map-tiles/master/${map.plane}/${coords.z}/${coords.x}/${-coords.y}.png`;
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

    // Centre the view on the requested coordinates and draw the marker pin
    const centreX = parseInt(urlParams.get('centreX'), 10);
    const centreY = parseInt(urlParams.get('centreY'), 10);

    if (!isNaN(centreX) && !isNaN(centreY)) {
        let requestedZoom = parseInt(urlParams.get('zoom'), 10);
        if (isNaN(requestedZoom)) {
            requestedZoom = 8;
        }
        requestedZoom = Math.min(11, Math.max(4, requestedZoom));
        map.setView(Position.toCentreLatLng(map, centreX, centreY), requestedZoom, { animate: false });
    }

    const markerParam = urlParams.get('marker');
    if (markerParam) {
        const m = markerParam.match(/^\s*(-?\d+)\s*,\s*(-?\d+)(?:\s*,\s*(-?\d+))?\s*$/);
        if (m) {
            const mx = parseInt(m[1], 10);
            const my = parseInt(m[2], 10);
            L.marker(Position.toCentreLatLng(map, mx, my))
                .bindPopup(`<b>(${mx}, ${my})</b>`)
                .addTo(map);
        }
    }

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

    const setUrlParams = () => {
        const mapCentre = map.getBounds().getCenter()
        const centrePos = Position.fromLatLng(map, mapCentre, map.plane);

        const zoom = map.getZoom();

        window.history.replaceState(null, null, `?centreX=${centrePos.x}&centreY=${centrePos.y}&centreZ=${centrePos.z}&zoom=${zoom}`);
    };

    map.on('moveend', setUrlParams);
    map.on('zoomend', setUrlParams);
});
