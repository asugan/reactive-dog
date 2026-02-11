import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Vibration, Animated, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { getByOwnerId } from '../../lib/data/repositories/dogProfileRepo';
import { create as createTriggerLog } from '../../lib/data/repositories/triggerLogRepo';
import { update as updateWalk } from '../../lib/data/repositories/walkRepo';
import { createMany as createWalkPoints, type CreateWalkPointInput } from '../../lib/data/repositories/walkPointRepo';
import { OpenStreetMapView, type MapMarker } from '../../components/OpenStreetMapView';
import { getLocalOwnerId } from '../../lib/localApp';
import { cancelReminderById, scheduleActiveWalkCheckInReminder } from '../../lib/notifications/notificationService';

const TRIGGER_OPTIONS = [
  { id: 'Dog_OffLeash', label: 'Dog Off-leash', emoji: '🐕' },
  { id: 'Dog_OnLeash', label: 'Dog On-leash', emoji: '🐕‍🦺' },
  { id: 'Human', label: 'Human', emoji: '👤' },
  { id: 'Bike', label: 'Bike', emoji: '🚲' },
  { id: 'Car', label: 'Car', emoji: '🚗' },
  { id: 'Noise', label: 'Noise', emoji: '🔊' },
];

interface LocationData {
  latitude: number;
  longitude: number;
}

interface QuickLogMapMarker {
  id: string;
  triggerType: string;
  severity: number;
  coordinate: LocationData;
}

const ROUTE_RECORDING_MIN_DISTANCE_METERS = 8;
const ROUTE_PERSIST_INTERVAL_MS = 12000;
const MAX_IN_MEMORY_ROUTE_POINTS = 800;
const LAST_KNOWN_LOCATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const LAST_KNOWN_LOCATION_REQUIRED_ACCURACY_METERS = 2500;
const DEV_TEST_LOCATION: LocationData = {
  latitude: 39.9334,
  longitude: 32.8597,
};

const getDistanceMeters = (from: LocationData, to: LocationData) => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371000;

  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
};

const getSingleParam = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

export default function ActiveWalkScreen() {
  const { walkId, distanceThreshold, technique } = useLocalSearchParams();
  const walkIdParam = getSingleParam(walkId);
  const distanceThresholdParam = getSingleParam(distanceThreshold);
  const distanceThresholdValue = Number(distanceThresholdParam);
  const safeDistanceThreshold = Number.isFinite(distanceThresholdValue) ? distanceThresholdValue : 15;
  const techniqueParam = getSingleParam(technique);
  const safeWalkId = walkIdParam ?? null;
  const [dogId, setDogId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [duration, setDuration] = useState(0);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [logCount, setLogCount] = useState(0);
  const [showLiveMap, setShowLiveMap] = useState(true);
  const [autoCenterMap, setAutoCenterMap] = useState(true);
  const [routePoints, setRoutePoints] = useState<LocationData[]>([]);
  const [quickLogMarkers, setQuickLogMarkers] = useState<QuickLogMapMarker[]>([]);
  const [showLocationHelp, setShowLocationHelp] = useState(false);
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [selectedTrigger, setSelectedTrigger] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState(3);
  const [pulseAnim] = useState(new Animated.Value(1));

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const reminderNotificationIdRef = useRef<string | null>(null);
  const isActiveRef = useRef(true);
  const latestLocationRef = useRef<LocationData | null>(null);
  const isFlushingRoutePointsRef = useRef(false);
  const routeFlushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationRecoveryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingWalkPointBufferRef = useRef<CreateWalkPointInput[]>([]);
  const lastRecordedPointRef = useRef<LocationData | null>(null);

  // Pulse animation for active indicator
  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isActive, pulseAnim]);

  // Fetch dog profile
  useEffect(() => {
    fetchDogProfile();
  }, []);

  const fetchDogProfile = async () => {
    try {
      const ownerId = await getLocalOwnerId();
      const profile = await getByOwnerId(ownerId);
      if (profile) {
        setDogId(profile.id);
      }
    } catch (error) {
      console.error('Error fetching dog profile:', error);
    }
  };

  const flushPendingWalkPoints = useCallback(async () => {
    if (!safeWalkId || isFlushingRoutePointsRef.current || pendingWalkPointBufferRef.current.length === 0) {
      return;
    }

    isFlushingRoutePointsRef.current = true;
    const batch = pendingWalkPointBufferRef.current;
    pendingWalkPointBufferRef.current = [];

    try {
      await createWalkPoints(batch);
    } catch (error) {
      console.error('Error saving walk route points:', error);
      pendingWalkPointBufferRef.current = [...batch, ...pendingWalkPointBufferRef.current];
    } finally {
      isFlushingRoutePointsRef.current = false;
    }
  }, [safeWalkId]);

  const recenterMap = () => {
    if (!location) {
      return;
    }

    setAutoCenterMap(true);
  };

  const getSeverityPinColor = (severity: number) => {
    if (severity <= 2) {
      return '#10B981';
    }

    if (severity === 3) {
      return '#F59E0B';
    }

    return '#EF4444';
  };

  const liveMapMarkers = useMemo<MapMarker[]>(() => {
    const markers: MapMarker[] = [];

    if (routePoints.length > 0) {
      markers.push({
        id: 'walk-start',
        coordinate: routePoints[0],
        color: '#22C55E',
        size: 12,
      });
    }

    if (location) {
      markers.push({
        id: 'walk-current',
        coordinate: location,
        color: '#2563EB',
        size: 14,
      });
    }

    quickLogMarkers.forEach((marker) => {
      markers.push({
        id: marker.id,
        coordinate: marker.coordinate,
        color: getSeverityPinColor(marker.severity),
        size: 11,
      });
    });

    return markers;
  }, [location, quickLogMarkers, routePoints]);

  // Timer
  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isActive]);

  useEffect(() => {
    isActiveRef.current = isActive;
    if (!isActive) {
      void flushPendingWalkPoints();
    }
  }, [flushPendingWalkPoints, isActive]);

  useEffect(() => {
    latestLocationRef.current = location;
  }, [location]);

  useEffect(() => {
    routeFlushIntervalRef.current = setInterval(() => {
      void flushPendingWalkPoints();
    }, ROUTE_PERSIST_INTERVAL_MS);

    return () => {
      if (routeFlushIntervalRef.current) {
        clearInterval(routeFlushIntervalRef.current);
        routeFlushIntervalRef.current = null;
      }

      void flushPendingWalkPoints();
    };
  }, [flushPendingWalkPoints]);

  useEffect(() => {
    if (location) {
      setShowLocationHelp(false);
      return;
    }

    const timeout = setTimeout(() => {
      setShowLocationHelp(true);
    }, 10000);

    return () => {
      clearTimeout(timeout);
    };
  }, [location]);

  // Location tracking
  useEffect(() => {
    let isMounted = true;

    const startLocationTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Location permission is required for BAT walks');
          return;
        }

        const applyInitialLocation = (coords: Location.LocationObjectCoords, timestamp?: number) => {
          const initialPoint: LocationData = {
            latitude: coords.latitude,
            longitude: coords.longitude,
          };

          if (!isMounted) {
            return;
          }

          setLocation(initialPoint);

          if (!safeWalkId) {
            return;
          }

          const previous = lastRecordedPointRef.current;
          if (previous && getDistanceMeters(previous, initialPoint) < ROUTE_RECORDING_MIN_DISTANCE_METERS) {
            return;
          }

          setRoutePoints((previousRoutePoints) =>
            previousRoutePoints.length > 0 ? [...previousRoutePoints, initialPoint] : [initialPoint]
          );
          lastRecordedPointRef.current = initialPoint;

          pendingWalkPointBufferRef.current.push({
            walk_id: safeWalkId,
            latitude: initialPoint.latitude,
            longitude: initialPoint.longitude,
            accuracy: typeof coords.accuracy === 'number' ? coords.accuracy : null,
            captured_at: new Date(timestamp ?? Date.now()).toISOString(),
          });
        };

        try {
          const initialPosition = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            mayShowUserSettingsDialog: true,
          });
          applyInitialLocation(initialPosition.coords, initialPosition.timestamp);
        } catch (initialLocationError) {
          console.warn('Initial location unavailable, waiting for live updates:', initialLocationError);

          try {
            const lastKnownPosition = await Location.getLastKnownPositionAsync({
              maxAge: LAST_KNOWN_LOCATION_MAX_AGE_MS,
              requiredAccuracy: LAST_KNOWN_LOCATION_REQUIRED_ACCURACY_METERS,
            });

            if (lastKnownPosition) {
              applyInitialLocation(lastKnownPosition.coords, lastKnownPosition.timestamp);
            }
          } catch (lastKnownLocationError) {
            console.warn('Last known location unavailable:', lastKnownLocationError);
          }
        }

        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 3000,
            distanceInterval: 1,
          },
          (newLocation) => {
            if (isMounted) {
              const nextPoint = {
                latitude: newLocation.coords.latitude,
                longitude: newLocation.coords.longitude,
              };

              setLocation(nextPoint);

              if (!isActiveRef.current || !safeWalkId) {
                return;
              }

              const lastPoint = lastRecordedPointRef.current;
              const distanceFromLastPoint = lastPoint ? getDistanceMeters(lastPoint, nextPoint) : Infinity;
              if (distanceFromLastPoint < ROUTE_RECORDING_MIN_DISTANCE_METERS) {
                return;
              }

              lastRecordedPointRef.current = nextPoint;

              pendingWalkPointBufferRef.current.push({
                walk_id: safeWalkId,
                latitude: nextPoint.latitude,
                longitude: nextPoint.longitude,
                accuracy:
                  typeof newLocation.coords.accuracy === 'number'
                    ? newLocation.coords.accuracy
                    : null,
                captured_at: new Date(newLocation.timestamp ?? Date.now()).toISOString(),
              });

              setRoutePoints((previous) => {
                const next = [...previous, nextPoint];
                if (next.length <= MAX_IN_MEMORY_ROUTE_POINTS) {
                  return next;
                }

                return next.slice(next.length - MAX_IN_MEMORY_ROUTE_POINTS);
              });
            }
          }
        );

        locationRecoveryIntervalRef.current = setInterval(async () => {
          if (!isMounted || latestLocationRef.current) {
            return;
          }

          try {
            const recoveredPosition = await Location.getLastKnownPositionAsync({
              maxAge: LAST_KNOWN_LOCATION_MAX_AGE_MS,
              requiredAccuracy: LAST_KNOWN_LOCATION_REQUIRED_ACCURACY_METERS,
            });

            if (recoveredPosition) {
              applyInitialLocation(recoveredPosition.coords, recoveredPosition.timestamp);
            }
          } catch {
            // no-op
          }
        }, 4000);
      } catch (error) {
        console.error('Error starting location tracking:', error);
      }
    };

    startLocationTracking();

    return () => {
      isMounted = false;
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }

      if (locationRecoveryIntervalRef.current) {
        clearInterval(locationRecoveryIntervalRef.current);
        locationRecoveryIntervalRef.current = null;
      }

      void flushPendingWalkPoints();
    };
  }, [flushPendingWalkPoints, safeWalkId]);

  useEffect(() => {
    let isMounted = true;

    const syncWalkCheckInReminder = async () => {
      if (!isActive) {
        if (reminderNotificationIdRef.current) {
          await cancelReminderById(reminderNotificationIdRef.current);
          reminderNotificationIdRef.current = null;
        }
        return;
      }

      if (reminderNotificationIdRef.current) {
        return;
      }

      const reminderId = await scheduleActiveWalkCheckInReminder({
        technique: techniqueParam,
        distanceThreshold: safeDistanceThreshold,
      });

      if (!isMounted) {
        await cancelReminderById(reminderId);
        return;
      }

      reminderNotificationIdRef.current = reminderId;
    };

    syncWalkCheckInReminder().catch((error) => {
      console.error('Error syncing walk check-in reminder:', error);
    });

    return () => {
      isMounted = false;
    };
  }, [isActive, safeDistanceThreshold, techniqueParam]);

  useEffect(() => {
    return () => {
      const reminderId = reminderNotificationIdRef.current;
      reminderNotificationIdRef.current = null;
      void cancelReminderById(reminderId);
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePauseResume = () => {
    setIsActive(!isActive);
  };

  const applyDevTestLocation = () => {
    const testPoint = DEV_TEST_LOCATION;
    setLocation(testPoint);
    setAutoCenterMap(true);

    if (!safeWalkId) {
      return;
    }

    const previous = lastRecordedPointRef.current;
    const shouldPersist = !previous || getDistanceMeters(previous, testPoint) >= ROUTE_RECORDING_MIN_DISTANCE_METERS;

    if (!shouldPersist) {
      return;
    }

    lastRecordedPointRef.current = testPoint;
    setRoutePoints((current) => [...current, testPoint]);
    pendingWalkPointBufferRef.current.push({
      walk_id: safeWalkId,
      latitude: testPoint.latitude,
      longitude: testPoint.longitude,
      accuracy: null,
      captured_at: new Date().toISOString(),
    });
  };

  const handleEndWalk = () => {
    Alert.alert(
      'End Walk Session?',
      'Your progress will be saved. You can add final notes on the next screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Walk', 
          style: 'destructive',
          onPress: async () => {
            try {
              if (!safeWalkId) {
                throw new Error('Missing walk ID while ending session.');
              }

              if (reminderNotificationIdRef.current) {
                await cancelReminderById(reminderNotificationIdRef.current);
                reminderNotificationIdRef.current = null;
              }

              await flushPendingWalkPoints();

              // Update walk with end time
              await updateWalk(safeWalkId, {
                ended_at: new Date().toISOString(),
              });

              // Navigate to summary
              router.push({
                pathname: '/walk/summary',
                params: { 
                  walkId: safeWalkId,
                  duration: duration.toString(),
                  logCount: logCount.toString(),
                }
              });
            } catch (error) {
              console.error('Error ending walk:', error);
            }
          }
        }
      ]
    );
  };

  const handleQuickLog = async () => {
    if (!selectedTrigger) {
      Alert.alert('Error', 'Please select a trigger type');
      return;
    }

    const triggerType = selectedTrigger;

    if (!dogId) {
      Alert.alert('Error', 'No dog profile found');
      return;
    }

    try {
      const ownerId = await getLocalOwnerId();

      // Log trigger during walk
      await createTriggerLog({
        dog_id: dogId,
        owner_id: ownerId,
        trigger_type: triggerType,
        severity: selectedSeverity,
        location_latitude: location?.latitude || null,
        location_longitude: location?.longitude || null,
        notes: 'Logged during BAT walk session',
        logged_at: new Date().toISOString(),
      });

      // Update log count
      setLogCount(prev => prev + 1);

      if (location) {
        setQuickLogMarkers((previous) => {
          const next = [
            {
              id: `quick-${Date.now()}`,
              triggerType,
              severity: selectedSeverity,
              coordinate: {
                latitude: location.latitude,
                longitude: location.longitude,
              },
            },
            ...previous,
          ];

          if (next.length <= 120) {
            return next;
          }

          return next.slice(0, 120);
        });
      }
      
      // Vibrate for feedback
      Vibration.vibrate(200);
      
      // Reset and close modal
      setSelectedTrigger(null);
      setSelectedSeverity(3);
      setShowQuickLog(false);

      // Show success feedback
      Alert.alert('Logged!', 'Trigger logged successfully', [{ text: 'OK' }]);
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const getTechniqueReminder = () => {
    switch (techniqueParam) {
      case 'U_Turn':
        return {
          icon: 'arrow-u-left-top',
          title: 'U-Turn Technique',
          description: 'Turn away calmly when you see a trigger',
        };
      case 'Find_It':
        return {
          icon: 'magnify',
          title: 'Find It Technique',
          description: 'Scatter treats and say "Find it!"',
        };
      case 'LAT':
        return {
          icon: 'eye',
          title: 'Look at That',
          description: 'Click/treat when dog looks at trigger calmly',
        };
      default:
        return {
          icon: 'walk',
          title: 'Stay Calm',
          description: 'Maintain distance and reward good choices',
        };
    }
  };

  const reminder = getTechniqueReminder();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>BAT Walk Active</Text>
          <View style={styles.activeIndicator}>
            <Animated.View 
              style={[
                styles.activeDot,
                { transform: [{ scale: pulseAnim }] }
              ]} 
            />
            <Text style={styles.activeText}>{isActive ? 'Recording' : 'Paused'}</Text>
          </View>
        </View>
        <View style={styles.durationContainer}>
          <MaterialCommunityIcons name="timer" size={24} color="#7C3AED" />
          <Text style={styles.duration}>{formatDuration(duration)}</Text>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Technique Reminder Card */}
        <View style={styles.reminderCard}>
          <View style={styles.reminderIconContainer}>
            <MaterialCommunityIcons name={reminder.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={32} color="#7C3AED" />
          </View>
          <View style={styles.reminderContent}>
            <Text style={styles.reminderTitle}>{reminder.title}</Text>
            <Text style={styles.reminderDescription}>{reminder.description}</Text>
          </View>
        </View>

        {/* Active Check-In Reminder */}
        <View style={styles.alertCard}>
          <MaterialCommunityIcons name="bell-ring" size={28} color="#F59E0B" />
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>Check-In Reminder</Text>
            <Text style={styles.alertText}>
              Every 8 min: keep around {safeDistanceThreshold}m and apply {reminder.title}
            </Text>
          </View>
        </View>

        {/* Live Map */}
        <View style={styles.liveMapCard}>
          <View style={styles.liveMapHeaderRow}>
            <View style={styles.liveMapTitleWrap}>
              <Text style={styles.liveMapTitle}>Live Walk Map</Text>
              <Text style={styles.liveMapSubtitle}>
                {location ? `Route points: ${routePoints.length}` : 'Waiting for GPS signal...'}
              </Text>
              {!location && showLocationHelp ? (
                <View style={styles.liveMapHelpWrap}>
                  <Text style={styles.liveMapHelpText}>
                    {__DEV__
                      ? 'Emulator tip: send a mock location from Extended Controls > Location or run adb emu geo fix 32.8597 39.9334.'
                      : 'Waiting for GPS fix. Make sure location services are enabled and stay in an open-sky area for better signal.'}
                  </Text>
                  {__DEV__ ? (
                    <TouchableOpacity style={styles.liveMapHelpButton} onPress={applyDevTestLocation}>
                      <Text style={styles.liveMapHelpButtonText}>Use Test Location</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
            </View>
            <View style={styles.liveMapActionsRow}>
              <TouchableOpacity
                style={styles.liveMapActionButton}
                onPress={() => setShowLiveMap((previous) => !previous)}
              >
                <MaterialCommunityIcons name={showLiveMap ? 'eye-off-outline' : 'eye-outline'} size={18} color="#334155" />
                <Text style={styles.liveMapActionText}>{showLiveMap ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
              {showLiveMap ? (
                <TouchableOpacity
                  style={styles.liveMapActionButton}
                  onPress={recenterMap}
                  disabled={!location}
                >
                  <MaterialCommunityIcons name="crosshairs-gps" size={18} color={location ? '#334155' : '#9CA3AF'} />
                  <Text style={[styles.liveMapActionText, !location && styles.liveMapActionTextDisabled]}>Center</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {showLiveMap ? (
            <View style={styles.liveMapFrame}>
              <OpenStreetMapView
                id={`active-${safeWalkId ?? 'walk'}`}
                style={styles.liveMapView}
                routeLines={routePoints.length >= 2 ? [routePoints] : []}
                markers={liveMapMarkers}
                followCoordinate={location}
                autoCenter={autoCenterMap}
                zoomLevel={16}
                onUserInteractionStart={() => setAutoCenterMap(false)}
              />
            </View>
          ) : (
            <Text style={styles.liveMapCollapsedText}>
              Focus mode active. Tap Show to reopen the live map.
            </Text>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="map-marker" size={24} color="#6B7280" />
            <Text style={styles.statValue}>
              {location ? 'Tracking' : 'Waiting...'}
            </Text>
            <Text style={styles.statLabel}>Location</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="alert-circle" size={24} color="#EF4444" />
            <Text style={styles.statValue}>{logCount}</Text>
            <Text style={styles.statLabel}>Triggers</Text>
          </View>
        </View>

        {/* Quick Log Button */}
        <TouchableOpacity
          style={styles.quickLogButton}
          onPress={() => setShowQuickLog(true)}
        >
          <MaterialCommunityIcons name="plus-circle" size={32} color="#fff" />
          <Text style={styles.quickLogButtonText}>Quick Log Trigger</Text>
        </TouchableOpacity>

        {/* Technique Tips */}
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>Quick Tips</Text>
          <View style={styles.tipRow}>
            <MaterialCommunityIcons name="check-circle" size={16} color="#10B981" />
            <Text style={styles.tipText}>Stay below threshold distance</Text>
          </View>
          <View style={styles.tipRow}>
            <MaterialCommunityIcons name="check-circle" size={16} color="#10B981" />
            <Text style={styles.tipText}>Reward calm behavior immediately</Text>
          </View>
          <View style={styles.tipRow}>
            <MaterialCommunityIcons name="check-circle" size={16} color="#10B981" />
            <Text style={styles.tipText}>End on a positive note</Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer Controls */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.controlButton, styles.pauseButton]}
          onPress={handlePauseResume}
        >
          <MaterialCommunityIcons 
            name={isActive ? 'pause' : 'play'} 
            size={28} 
            color="#fff" 
          />
          <Text style={styles.controlButtonText}>
            {isActive ? 'Pause' : 'Resume'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.endButton]}
          onPress={handleEndWalk}
        >
          <MaterialCommunityIcons name="stop" size={28} color="#fff" />
          <Text style={styles.controlButtonText}>End Walk</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Log Modal */}
      {showQuickLog && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Quick Log Trigger</Text>
            
            {/* Trigger Selection */}
            <Text style={styles.modalSubtitle}>What triggered your dog?</Text>
            <View style={styles.triggerGrid}>
              {TRIGGER_OPTIONS.map((trigger) => (
                <TouchableOpacity
                  key={trigger.id}
                  style={[
                    styles.triggerButton,
                    selectedTrigger === trigger.id && styles.triggerButtonActive
                  ]}
                  onPress={() => setSelectedTrigger(trigger.id)}
                >
                  <Text style={styles.triggerEmoji}>{trigger.emoji}</Text>
                  <Text 
                    style={[
                      styles.triggerLabel,
                      selectedTrigger === trigger.id && styles.triggerLabelActive
                    ]}
                  >
                    {trigger.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Severity Selection */}
            <Text style={styles.modalSubtitle}>Severity (1-5)</Text>
            <View style={styles.severityContainer}>
              {[1, 2, 3, 4, 5].map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.severityButton,
                    selectedSeverity === level && styles.severityButtonActive,
                    selectedSeverity === level && { 
                      backgroundColor: level <= 2 ? '#10B981' : level === 3 ? '#F59E0B' : '#EF4444' 
                    }
                  ]}
                  onPress={() => setSelectedSeverity(level)}
                >
                  <Text style={[
                    styles.severityButtonText,
                    selectedSeverity === level && styles.severityButtonTextActive
                  ]}>
                    {level}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setSelectedTrigger(null);
                  setSelectedSeverity(3);
                  setShowQuickLog(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleQuickLog}
                disabled={!selectedTrigger}
              >
                <Text style={styles.saveButtonText}>Log It</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  activeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  activeText: {
    fontSize: 14,
    color: '#6B7280',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  duration: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7C3AED',
    marginLeft: 8,
  },
  contentScroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 28,
  },
  reminderCard: {
    flexDirection: 'row',
    backgroundColor: '#EDE9FE',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  reminderIconContainer: {
    width: 56,
    height: 56,
    backgroundColor: '#fff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  reminderContent: {
    flex: 1,
    justifyContent: 'center',
  },
  reminderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7C3AED',
    marginBottom: 4,
  },
  reminderDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  alertCard: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  alertContent: {
    marginLeft: 12,
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
  },
  alertText: {
    fontSize: 14,
    color: '#B45309',
    marginTop: 2,
  },
  liveMapCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 14,
    marginBottom: 16,
  },
  liveMapHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  liveMapTitleWrap: {
    flex: 1,
  },
  liveMapTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  liveMapSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#475569',
  },
  liveMapHelpText: {
    marginTop: 4,
    fontSize: 11,
    color: '#64748B',
  },
  liveMapHelpWrap: {
    marginTop: 4,
    gap: 6,
  },
  liveMapHelpButton: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#E2E8F0',
  },
  liveMapHelpButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  liveMapActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  liveMapActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E2EC',
    gap: 5,
  },
  liveMapActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  liveMapActionTextDisabled: {
    color: '#9CA3AF',
  },
  liveMapFrame: {
    height: 210,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  liveMapView: {
    flex: 1,
  },
  liveMapCollapsedText: {
    fontSize: 13,
    color: '#475569',
    paddingVertical: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  quickLogButton: {
    backgroundColor: '#7C3AED',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    marginBottom: 20,
  },
  quickLogButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
  },
  tipsContainer: {
    backgroundColor: '#F9FAFB',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  pauseButton: {
    backgroundColor: '#6B7280',
  },
  endButton: {
    backgroundColor: '#EF4444',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 20,
  },
  modalSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  triggerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  triggerButtonActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  triggerEmoji: {
    fontSize: 18,
    marginRight: 6,
  },
  triggerLabel: {
    fontSize: 14,
    color: '#374151',
  },
  triggerLabelActive: {
    color: '#7C3AED',
    fontWeight: '600',
  },
  severityContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  severityButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    alignItems: 'center',
  },
  severityButtonActive: {
    backgroundColor: '#7C3AED',
  },
  severityButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6B7280',
  },
  severityButtonTextActive: {
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  saveButton: {
    backgroundColor: '#7C3AED',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
