import { useEffect, useMemo, useRef, useState } from 'react';
import { NativeModules, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  Camera,
  type CameraRef,
  LineLayer,
  MapView,
  PointAnnotation,
  ShapeSource,
} from '@maplibre/maplibre-react-native';

export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

export interface MapMarker {
  id: string;
  coordinate: MapCoordinate;
  color?: string;
  size?: number;
}

interface OpenStreetMapViewProps {
  id: string;
  style?: StyleProp<ViewStyle>;
  routeLines?: MapCoordinate[][];
  markers?: MapMarker[];
  initialCenter?: MapCoordinate;
  followCoordinate?: MapCoordinate | null;
  autoCenter?: boolean;
  zoomLevel?: number;
  interactive?: boolean;
  fitToElements?: boolean;
  routeColor?: string;
  routeWidth?: number;
  onUserInteractionStart?: () => void;
}

type Position = [number, number];

const DEFAULT_CENTER: Position = [32.8597, 39.9334];
const hasNativeMapLibreModule = Boolean((NativeModules as { MLRNModule?: unknown }).MLRNModule);

const OPENFREEMAP_VECTOR_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const OSM_RASTER_FALLBACK_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-raster',
      type: 'raster',
      source: 'osm',
    },
  ],
} as const;

const toPosition = (coordinate: MapCoordinate): Position => {
  return [coordinate.longitude, coordinate.latitude];
};

const getBounds = (positions: Position[]) => {
  const longitudes = positions.map((position) => position[0]);
  const latitudes = positions.map((position) => position[1]);

  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);

  return {
    northEast: [maxLongitude, maxLatitude] as Position,
    southWest: [minLongitude, minLatitude] as Position,
  };
};

const toRouteFeature = (routeLine: MapCoordinate[]) => {
  const positions = routeLine.map(toPosition);
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: positions,
    },
  } as GeoJSON.Feature<GeoJSON.LineString>;
};

export function OpenStreetMapView({
  id,
  style,
  routeLines = [],
  markers = [],
  initialCenter,
  followCoordinate,
  autoCenter = false,
  zoomLevel = 15,
  interactive = true,
  fitToElements = false,
  routeColor = '#2563EB',
  routeWidth = 4,
  onUserInteractionStart,
}: OpenStreetMapViewProps) {
  const [mapStyle, setMapStyle] = useState<string | object>(OPENFREEMAP_VECTOR_STYLE_URL);
  const cameraRef = useRef<CameraRef>(null);

  const routeFeatures = useMemo(() => {
    return routeLines.filter((line) => line.length >= 2).map(toRouteFeature);
  }, [routeLines]);

  const allPositions = useMemo(() => {
    const routePositions = routeLines.flatMap((line) => line.map(toPosition));
    const markerPositions = markers.map((marker) => toPosition(marker.coordinate));
    return [...routePositions, ...markerPositions];
  }, [markers, routeLines]);

  const defaultCenter = useMemo(() => {
    if (initialCenter) {
      return toPosition(initialCenter);
    }

    if (allPositions.length > 0) {
      return allPositions[allPositions.length - 1];
    }

    return DEFAULT_CENTER;
  }, [allPositions, initialCenter]);

  useEffect(() => {
    if (!fitToElements || allPositions.length === 0 || !cameraRef.current) {
      return;
    }

    if (allPositions.length === 1) {
      cameraRef.current.setCamera({
        centerCoordinate: allPositions[0],
        zoomLevel,
        animationDuration: 0,
      });
      return;
    }

    const bounds = getBounds(allPositions);
    cameraRef.current.fitBounds(bounds.northEast, bounds.southWest, [36, 36, 36, 36], 0);
  }, [allPositions, fitToElements, zoomLevel]);

  const followLatitude = followCoordinate?.latitude;
  const followLongitude = followCoordinate?.longitude;

  useEffect(() => {
    if (!cameraRef.current || !autoCenter || followLatitude === undefined || followLongitude === undefined) {
      return;
    }

    cameraRef.current.setCamera({
      centerCoordinate: [followLongitude, followLatitude],
      zoomLevel,
      animationDuration: 300,
      animationMode: 'easeTo',
    });
  }, [autoCenter, followLatitude, followLongitude, zoomLevel]);

  if (!hasNativeMapLibreModule) {
    return (
      <View style={[style, styles.fallbackContainer]}>
        <Text style={styles.fallbackText}>Map engine unavailable in this build.</Text>
      </View>
    );
  }

  return (
    <MapView
      style={style}
      mapStyle={mapStyle}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      rotateEnabled={interactive}
      pitchEnabled={false}
      compassEnabled={interactive}
      logoEnabled={false}
      attributionEnabled
      onDidFailLoadingMap={() => {
        setMapStyle(OSM_RASTER_FALLBACK_STYLE);
      }}
      onRegionWillChange={(event) => {
        const isUserInteraction = (event as { properties?: { isUserInteraction?: boolean } }).properties
          ?.isUserInteraction;

        if (isUserInteraction) {
          onUserInteractionStart?.();
        }
      }}
    >
      <Camera ref={cameraRef} defaultSettings={{ centerCoordinate: defaultCenter, zoomLevel }} />

      {routeFeatures.map((feature, index) => (
        <ShapeSource key={`${id}-route-source-${index}`} id={`${id}-route-source-${index}`} shape={feature}>
          <LineLayer
            id={`${id}-route-line-${index}`}
            style={{
              lineColor: routeColor,
              lineWidth: routeWidth,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </ShapeSource>
      ))}

      {markers.map((marker) => {
        const markerSize = marker.size ?? 12;

        return (
          <PointAnnotation
            key={`${id}-marker-${marker.id}`}
            id={`${id}-marker-${marker.id}`}
            coordinate={toPosition(marker.coordinate)}
          >
            <View
              style={[
                styles.marker,
                {
                  width: markerSize,
                  height: markerSize,
                  borderRadius: markerSize / 2,
                  backgroundColor: marker.color ?? '#2563EB',
                },
              ]}
            />
          </PointAnnotation>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  marker: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  fallbackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  fallbackText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
});
