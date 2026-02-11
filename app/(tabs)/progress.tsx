import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Animated, Easing, View, Text, StyleSheet, ScrollView, Alert, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-chart-kit';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ActivityIndicator, Button, Card, IconButton, Modal as PaperModal, Portal } from 'react-native-paper';
import { OpenStreetMapView, type MapMarker } from '../../components/OpenStreetMapView';
import { usePremiumGate } from '../../lib/billing/premiumGate';
import {
  getCurrentWeekKey,
  getPremiumInsightMeterState,
  unlockWeeklyPremiumInsightPreview,
  type PremiumInsightMeterState,
} from '../../lib/billing/premiumInsights';
import { logBillingError, logBillingInfo } from '../../lib/billing/telemetry';
import { getByOwnerId } from '../../lib/data/repositories/dogProfileRepo';
import { listByOwner as listTriggerLogsByOwner } from '../../lib/data/repositories/triggerLogRepo';
import { listByOwner as listWalksByOwner } from '../../lib/data/repositories/walkRepo';
import { listByWalkIds as listWalkPointsByWalkIds } from '../../lib/data/repositories/walkPointRepo';
import { getLocalOwnerId } from '../../lib/localApp';

const ACCENT_COLOR = '#1D4ED8';

interface TriggerLog {
  id: string;
  trigger_type: string;
  severity: number;
  distance_meters: number | null;
  logged_at: string;
  location_latitude: number | null;
  location_longitude: number | null;
}

interface Stats {
  totalLogs: number;
  averageSeverity: number;
  mostCommonTrigger: string;
  thisWeekCount: number;
  lastWeekCount: number;
}

interface HeatmapDay {
  dateKey: string;
  count: number;
  averageSeverity: number;
}

interface ReportDogProfile {
  name?: string;
}

interface ReportWalk {
  id: string;
  started_at: string;
  ended_at: string | null;
  success_rating: number | null;
}

interface WalkRoutePoint {
  latitude: number;
  longitude: number;
}

interface WalkRouteOverlay {
  walkId: string;
  startedAt: string;
  points: WalkRoutePoint[];
}

interface WeeklyCoachSummary {
  trend: 'improving' | 'stable' | 'challenging';
  headline: string;
  supportingText: string;
  actionText: string;
}

const TRIGGER_COLORS: { [key: string]: string } = {
  'Dog_OffLeash': '#EF4444',
  'Dog_OnLeash': '#F97316',
  'Human': '#3B82F6',
  'Bike': '#10B981',
  'Car': '#6B7280',
  'Noise': '#8B5CF6',
  'Other': '#6B7280',
};

const TRIGGER_LABELS: { [key: string]: string } = {
  'Dog_OffLeash': 'Dog (Off-leash)',
  'Dog_OnLeash': 'Dog (On-leash)',
  'Human': 'Human',
  'Bike': 'Bike',
  'Car': 'Car',
  'Noise': 'Noise',
  'Other': 'Other',
};

const TRIGGER_SHORT_LABELS: { [key: string]: string } = {
  'Dog_OffLeash': 'Dog Off',
  'Dog_OnLeash': 'Dog On',
  'Human': 'Human',
  'Bike': 'Bike',
  'Car': 'Car',
  'Noise': 'Noise',
  'Other': 'Other',
};

export default function ProgressScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const [logs, setLogs] = useState<TriggerLog[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalLogs: 0,
    averageSeverity: 0,
    mostCommonTrigger: '',
    thisWeekCount: 0,
    lastWeekCount: 0,
  });
  const [timeRange, setTimeRange] = useState<'7days' | '30days' | '90days'>('7days');
  const [exporting, setExporting] = useState(false);
  const [heatmapDays, setHeatmapDays] = useState<HeatmapDay[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [walkRoutes, setWalkRoutes] = useState<WalkRouteOverlay[]>([]);
  const [showRoutesOnMap, setShowRoutesOnMap] = useState(true);
  const [insightMeterState, setInsightMeterState] = useState<PremiumInsightMeterState | null>(null);
  const [isWeeklyInsightUnlocked, setIsWeeklyInsightUnlocked] = useState(false);
  const [isUnlockingInsight, setIsUnlockingInsight] = useState(false);
  const {
    status: subscriptionStatus,
    isLoading: isSubscriptionLoading,
    isPremium,
    openPaywall,
    refresh: refreshSubscription,
  } = usePremiumGate('progress-report-export');
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const currentWeekKey = useMemo(() => getCurrentWeekKey(), []);
  const hasLoggedPreviewImpression = useRef(false);
  const isTablet = windowWidth >= 768;
  const contentHorizontalPadding = isTablet ? 28 : 24;
  const contentColumnWidth = Math.max(280, Math.min(windowWidth - contentHorizontalPadding * 2, 960));
  const chartWidth = Math.min(contentColumnWidth, isTablet ? 860 : contentColumnWidth);
  const barChartMinWidth = Object.keys(TRIGGER_LABELS).length * (isTablet ? 92 : 82);
  const barChartWidth = Math.max(chartWidth, barChartMinWidth);
  const shouldScrollBarChart = barChartWidth > chartWidth;
  const heatmapCardWidth = Math.min(chartWidth, isTablet ? 620 : chartWidth);

  const fetchLogs = useCallback(async () => {
    try {
      const ownerId = await getLocalOwnerId();

      const daysBack = timeRange === '7days' ? 7 : timeRange === '30days' ? 30 : 90;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      const records = await listTriggerLogsByOwner(ownerId, {
        since: cutoffDate.toISOString(),
        sort: 'logged_at',
      });

      setLogs(records as TriggerLog[]);
      calculateStats(records as TriggerLog[]);
      await fetchHeatmapLogs(ownerId);
      await fetchWalkRoutes(ownerId, cutoffDate.toISOString());
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  }, [timeRange]);

  const fetchHeatmapLogs = async (ownerId: string) => {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 41);

      const records = await listTriggerLogsByOwner(ownerId, {
        since: cutoffDate.toISOString(),
        sort: 'logged_at',
      });

      const byDay = new Map<string, { count: number; severitySum: number }>();

      (records as unknown as TriggerLog[]).forEach((record) => {
        const key = record.logged_at.split('T')[0];
        const current = byDay.get(key) ?? { count: 0, severitySum: 0 };
        byDay.set(key, {
          count: current.count + 1,
          severitySum: current.severitySum + record.severity,
        });
      });

      const days: HeatmapDay[] = [];
      for (let i = 41; i >= 0; i--) {
        const day = new Date();
        day.setDate(day.getDate() - i);
        const key = day.toISOString().split('T')[0];
        const aggregate = byDay.get(key);
        const count = aggregate?.count ?? 0;
        const averageSeverity = count > 0 ? aggregate!.severitySum / count : 0;

        days.push({
          dateKey: key,
          count,
          averageSeverity,
        });
      }

      setHeatmapDays(days);
    } catch (error) {
      console.error('Error fetching heatmap logs:', error);
      setHeatmapDays([]);
    }
  };

  const fetchWalkRoutes = async (ownerId: string, since: string) => {
    try {
      const walks = await listWalksByOwner(ownerId, {
        since,
        sort: '-started_at',
      });

      const validWalks = (walks as ReportWalk[]).filter((walk) => typeof walk.id === 'string' && walk.id.length > 0);
      if (validWalks.length === 0) {
        setWalkRoutes([]);
        return;
      }

      const walkPoints = await listWalkPointsByWalkIds(validWalks.map((walk) => walk.id), {
        sort: 'captured_at',
      });

      const walkPointMap = new Map<string, WalkRoutePoint[]>();
      walkPoints.forEach((point) => {
        const current = walkPointMap.get(point.walk_id) ?? [];
        current.push({
          latitude: point.latitude,
          longitude: point.longitude,
        });
        walkPointMap.set(point.walk_id, current);
      });

      const overlays: WalkRouteOverlay[] = validWalks
        .map((walk) => {
          const points = walkPointMap.get(walk.id) ?? [];
          return {
            walkId: walk.id,
            startedAt: walk.started_at,
            points,
          };
        })
        .filter((route) => route.points.length >= 2);

      setWalkRoutes(overlays);
    } catch (error) {
      console.error('Error fetching walk routes:', error);
      setWalkRoutes([]);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const refreshInsightMeter = useCallback(async () => {
    try {
      const meter = await getPremiumInsightMeterState();
      setInsightMeterState(meter);
      setIsWeeklyInsightUnlocked(meter.unlockedWeekKeys.includes(currentWeekKey));
    } catch (error) {
      console.error('Error loading premium insight meter:', error);
    }
  }, [currentWeekKey]);

  useEffect(() => {
    refreshInsightMeter();
  }, [refreshInsightMeter]);

  useEffect(() => {
    if (isPremium) {
      setIsWeeklyInsightUnlocked(true);
      return;
    }

    setIsWeeklyInsightUnlocked(Boolean(insightMeterState?.unlockedWeekKeys.includes(currentWeekKey)));
  }, [currentWeekKey, insightMeterState, isPremium]);

  useEffect(() => {
    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entranceAnim]);

  const calculateStats = (logs: TriggerLog[]) => {
    if (logs.length === 0) {
      setStats({
        totalLogs: 0,
        averageSeverity: 0,
        mostCommonTrigger: '',
        thisWeekCount: 0,
        lastWeekCount: 0,
      });
      return;
    }

    const totalSeverity = logs.reduce((sum, log) => sum + log.severity, 0);
    const avgSeverity = totalSeverity / logs.length;

    // Find most common trigger
    const triggerCounts: { [key: string]: number } = {};
    logs.forEach(log => {
      triggerCounts[log.trigger_type] = (triggerCounts[log.trigger_type] || 0) + 1;
    });
    const mostCommon = Object.entries(triggerCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || '';

    // This week vs last week
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - 7);
    const lastWeekStart = new Date(now);
    lastWeekStart.setDate(now.getDate() - 14);

    const thisWeek = logs.filter(log => new Date(log.logged_at) >= thisWeekStart).length;
    const lastWeek = logs.filter(log => {
      const date = new Date(log.logged_at);
      return date >= lastWeekStart && date < thisWeekStart;
    }).length;

    setStats({
      totalLogs: logs.length,
      averageSeverity: avgSeverity,
      mostCommonTrigger: mostCommon,
      thisWeekCount: thisWeek,
      lastWeekCount: lastWeek,
    });
  };

  const getLineChartData = () => {
    if (logs.length === 0) return { labels: [], datasets: [{ data: [] }] };

    const daysBack = timeRange === '7days' ? 7 : timeRange === '30days' ? 30 : 90;
    const dailyCounts: { [key: string]: number } = {};

    // Initialize all days with 0
    for (let i = daysBack - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      dailyCounts[key] = 0;
    }

    // Count logs per day
    logs.forEach(log => {
      const key = log.logged_at.split('T')[0];
      if (dailyCounts.hasOwnProperty(key)) {
        dailyCounts[key]++;
      }
    });

    // Format labels based on time range
    const labels = Object.keys(dailyCounts).map(date => {
      if (timeRange === '7days') {
        return new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
      } else if (timeRange === '30days') {
        return new Date(date).toLocaleDateString('en-US', { day: 'numeric' });
      } else {
        return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    });

    // Show every 7th label for 90 days to avoid crowding
    const displayLabels = timeRange === '90days' 
      ? labels.map((label, i) => i % 7 === 0 ? label : '')
      : labels;

    return {
      labels: displayLabels,
      datasets: [{ data: Object.values(dailyCounts) }],
    };
  };

  const getBarChartData = () => {
    const triggerCounts: { [key: string]: number } = {};
    
    Object.keys(TRIGGER_LABELS).forEach(key => {
      triggerCounts[key] = 0;
    });

    logs.forEach(log => {
      if (triggerCounts.hasOwnProperty(log.trigger_type)) {
        triggerCounts[log.trigger_type]++;
      }
    });

    const labels = Object.keys(triggerCounts).map(key => TRIGGER_SHORT_LABELS[key] || TRIGGER_LABELS[key] || key);
    const data = Object.values(triggerCounts);

    return { labels, datasets: [{ data }] };
  };

  const getSeverityColor = (severity: number) => {
    if (severity <= 2) return '#10B981';
    if (severity === 3) return '#F59E0B';
    return '#EF4444';
  };

  const getHeatmapColor = (day: HeatmapDay) => {
    if (day.count === 0) return '#D1FAE5';
    if (day.count <= 1 && day.averageSeverity <= 2) return '#86EFAC';
    if (day.count <= 2 && day.averageSeverity <= 3.2) return '#FCD34D';
    return '#FCA5A5';
  };

  const getHeatmapLabel = (day: HeatmapDay) => {
    if (day.count === 0) return 'Good day (no reactions)';
    if (day.count <= 1 && day.averageSeverity <= 2) return 'Good day';
    if (day.count <= 2 && day.averageSeverity <= 3.2) return 'Mixed day';
    return 'Challenging day';
  };

  const heatmapWeeks = [] as HeatmapDay[][];
  for (let i = 0; i < heatmapDays.length; i += 7) {
    heatmapWeeks.push(heatmapDays.slice(i, i + 7));
  }

  const weeklyCoachSummary = useMemo<WeeklyCoachSummary | null>(() => {
    if (heatmapDays.length < 14) {
      return null;
    }

    const latestDays = heatmapDays.slice(-14);
    const previousWeek = latestDays.slice(0, 7);
    const recentWeek = latestDays.slice(7);

    const previousCount = previousWeek.reduce((total, day) => total + day.count, 0);
    const recentCount = recentWeek.reduce((total, day) => total + day.count, 0);

    const previousSeverityTotal = previousWeek.reduce((total, day) => total + (day.averageSeverity * day.count), 0);
    const recentSeverityTotal = recentWeek.reduce((total, day) => total + (day.averageSeverity * day.count), 0);

    const previousAvgSeverity = previousCount > 0 ? previousSeverityTotal / previousCount : 0;
    const recentAvgSeverity = recentCount > 0 ? recentSeverityTotal / recentCount : 0;

    const recentLogsByTrigger: Record<string, number> = {};
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    logs.forEach((log) => {
      if (new Date(log.logged_at) < fourteenDaysAgo) {
        return;
      }

      recentLogsByTrigger[log.trigger_type] = (recentLogsByTrigger[log.trigger_type] ?? 0) + 1;
    });

    const focusTrigger = Object.entries(recentLogsByTrigger)
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    const focusTriggerLabel = focusTrigger ? (TRIGGER_LABELS[focusTrigger] || focusTrigger) : 'your main trigger';

    if (recentCount === 0) {
      return {
        trend: 'improving',
        headline: 'Zero reactions logged this week.',
        supportingText: 'This is a major win. Keep your current structure and distance strategy consistent.',
        actionText: 'Repeat your easiest route 2 to 3 times this week to lock in progress.',
      };
    }

    const countDelta = recentCount - previousCount;
    const severityDelta = recentAvgSeverity - previousAvgSeverity;

    if (countDelta <= 0 && severityDelta <= 0.15) {
      return {
        trend: 'improving',
        headline: 'Reactivity trend is improving week over week.',
        supportingText: `You logged ${recentCount} reactions this week (${Math.abs(countDelta)} fewer than last week).`,
        actionText: `Keep building on this with controlled setups around ${focusTriggerLabel}.`,
      };
    }

    if (countDelta >= 2 || severityDelta >= 0.45) {
      return {
        trend: 'challenging',
        headline: 'This week looked more challenging than last week.',
        supportingText: `Reaction volume and intensity both climbed. The biggest pressure point appears around ${focusTriggerLabel}.`,
        actionText: `For the next 3 walks, increase distance early and end sessions after the first escalation cue.`,
      };
    }

    return {
      trend: 'stable',
      headline: 'Progress is stable, but not improving yet.',
      supportingText: `You are holding around ${recentCount} reactions per week with similar intensity to last week.`,
      actionText: `Pick one focus trigger (${focusTriggerLabel}) and track distance on every encounter this week.`,
    };
  }, [heatmapDays, logs]);

  const hasLockedWeeklyInsight = !isPremium && !isWeeklyInsightUnlocked;
  const previewRemaining = insightMeterState?.remaining ?? 0;
  const isInsightMeterLoading = !insightMeterState && !isPremium;

  useEffect(() => {
    if (!weeklyCoachSummary || !insightMeterState || isPremium || isWeeklyInsightUnlocked || hasLoggedPreviewImpression.current) {
      return;
    }

    hasLoggedPreviewImpression.current = true;
    logBillingInfo('insight_preview_shown', {
      source: 'progress-weekly-coach',
      remaining: previewRemaining,
    });
  }, [insightMeterState, isPremium, isWeeklyInsightUnlocked, previewRemaining, weeklyCoachSummary]);

  const handleWeeklyInsightUnlock = async () => {
    if (isPremium || isWeeklyInsightUnlocked) {
      return;
    }

    try {
      setIsUnlockingInsight(true);

      const unlockResult = await unlockWeeklyPremiumInsightPreview(currentWeekKey);
      setInsightMeterState(unlockResult);
      setIsWeeklyInsightUnlocked(unlockResult.unlocked);

      if (unlockResult.unlocked) {
        logBillingInfo('insight_preview_unlocked', {
          source: 'progress-weekly-coach',
          weekKey: currentWeekKey,
          consumed: unlockResult.consumed,
          remaining: unlockResult.remaining,
        });
        return;
      }

      logBillingInfo('insight_preview_limit_reached', {
        source: 'progress-weekly-coach',
        weekKey: currentWeekKey,
      });
      openPaywall();
    } catch (error) {
      logBillingError('insight_preview_unlock_failed', error, {
        source: 'progress-weekly-coach',
        weekKey: currentWeekKey,
      });
      Alert.alert('Preview unavailable', 'Could not unlock this summary right now. Please try again.');
    } finally {
      setIsUnlockingInsight(false);
    }
  };

  const generateReport = async () => {
    try {
      setExporting(true);
      const ownerId = await getLocalOwnerId();

      // Fetch dog profile
      const dogProfile = await getByOwnerId(ownerId);

      // Fetch logs for report
      const daysBack = timeRange === '7days' ? 7 : timeRange === '30days' ? 30 : 90;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      const logsResult = await listTriggerLogsByOwner(ownerId, {
        since: cutoffDate.toISOString(),
        sort: '-logged_at',
      });

      // Fetch walks for report
      const walksResult = await listWalksByOwner(ownerId, {
        since: cutoffDate.toISOString(),
        sort: '-started_at',
      });

      // Generate report HTML
      const html = generateReportHTML(
        dogProfile,
        logsResult as TriggerLog[],
        walksResult as ReportWalk[],
        timeRange
      );

      // Generate PDF from HTML
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      // Share the PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `${dogProfile?.name || 'Dog'} - Training Report`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Success', 'Report generated successfully!');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      Alert.alert('Error', 'Failed to generate report. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const generateReportHTML = (
    dogProfile: ReportDogProfile | null,
    logs: TriggerLog[],
    walks: ReportWalk[],
    timeRange: string
  ) => {
    const timeRangeLabel = timeRange === '7days' ? 'Last 7 Days' : timeRange === '30days' ? 'Last 30 Days' : 'Last 90 Days';
    
    // Calculate stats
    const totalLogs = logs.length;
    const avgSeverity = totalLogs > 0 ? (logs.reduce((sum, log) => sum + log.severity, 0) / totalLogs).toFixed(1) : '0';
    
    // Most common trigger
    const triggerCounts: { [key: string]: number } = {};
    logs.forEach(log => {
      triggerCounts[log.trigger_type] = (triggerCounts[log.trigger_type] || 0) + 1;
    });
    const mostCommon = Object.entries(triggerCounts)
      .sort((a, b) => b[1] - a[1])[0];

    // Walk stats
    const totalWalks = walks.length;
    const completedWalks = walks.filter(w => w.ended_at).length;
    const avgRating = completedWalks > 0 
      ? (walks.filter(w => w.ended_at).reduce((sum, w) => sum + (w.success_rating || 0), 0) / completedWalks).toFixed(1)
      : 'N/A';

    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; }
             h1 { color: #1D4ED8; }
            h2 { color: #374151; margin-top: 30px; }
            .stats { display: flex; gap: 20px; margin: 20px 0; }
            .stat-box { background: #F3F4F6; padding: 20px; border-radius: 8px; flex: 1; }
             .stat-value { font-size: 32px; font-weight: bold; color: #1D4ED8; }
            .stat-label { color: #6B7280; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
             th { background: #DBEAFE; padding: 12px; text-align: left; }
            td { padding: 12px; border-bottom: 1px solid #E5E7EB; }
            .footer { margin-top: 40px; color: #9CA3AF; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>🐕 ${dogProfile?.name || 'Dog'} Training Report</h1>
          <p>Generated on ${new Date().toLocaleDateString()} | ${timeRangeLabel}</p>
          
          <h2>Overview</h2>
          <div class="stats">
            <div class="stat-box">
              <div class="stat-value">${totalLogs}</div>
              <div class="stat-label">Total Reactions</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${avgSeverity}</div>
              <div class="stat-label">Avg Severity</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${totalWalks}</div>
              <div class="stat-label">Walks Completed</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${avgRating}</div>
              <div class="stat-label">Avg Walk Rating</div>
            </div>
          </div>

          ${mostCommon ? `
          <h2>Most Common Trigger</h2>
          <p>${TRIGGER_LABELS[mostCommon[0]]} (${mostCommon[1]} incidents)</p>
          ` : ''}

          <h2>Recent Activity</h2>
          <table>
            <tr>
              <th>Date</th>
              <th>Trigger</th>
              <th>Severity</th>
              <th>Distance</th>
            </tr>
            ${logs.slice(0, 10).map(log => `
              <tr>
                <td>${new Date(log.logged_at).toLocaleDateString()}</td>
                <td>${TRIGGER_LABELS[log.trigger_type] || log.trigger_type}</td>
                <td>${log.severity}/5</td>
                <td>${log.distance_meters ? log.distance_meters + 'm' : 'N/A'}</td>
              </tr>
            `).join('')}
          </table>

          <div class="footer">
            Generated by Reactive Dog App | Keep up the great work! 🐾
          </div>
        </body>
      </html>
    `;
  };

  const chartConfig = {
    backgroundColor: '#fff',
    backgroundGradientFrom: '#fff',
    backgroundGradientTo: '#fff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(29, 78, 216, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: ACCENT_COLOR,
    },
  };

  const barChartConfig = {
    ...chartConfig,
    color: (opacity = 1, index?: number) => {
      const colors = Object.values(TRIGGER_COLORS);
      return index !== undefined ? colors[index % colors.length] : `rgba(29, 78, 216, ${opacity})`;
    },
  };

  const mapMarkers = useMemo<MapMarker[]>(() => {
    return logs
      .filter((log) => log.location_latitude && log.location_longitude)
      .map((log) => ({
        id: log.id,
        coordinate: {
          latitude: log.location_latitude!,
          longitude: log.location_longitude!,
        },
        color: TRIGGER_COLORS[log.trigger_type] || '#6B7280',
        size: 9,
      }));
  }, [logs]);

  const mapRouteLines = useMemo(() => {
    return showRoutesOnMap ? walkRoutes.map((route) => route.points) : [];
  }, [showRoutesOnMap, walkRoutes]);

  const mapMarkerCount = mapMarkers.length;
  const hasMapData = mapMarkerCount > 0 || walkRoutes.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingHorizontal: contentHorizontalPadding }]}
      >
        <Animated.View
          style={[
            styles.contentColumn,
            {
              width: contentColumnWidth,
              opacity: entranceAnim,
              transform: [{ translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            },
          ]}
        >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerTextBlock}>
              <Text style={styles.title}>Progress</Text>
              <Text style={styles.subtitle}>Track your dog&apos;s improvement over time</Text>
            </View>
            <View style={styles.headerButtons}>
              <Button
                mode="contained-tonal"
                icon="map-marker"
                style={[styles.mapButton, !hasMapData && styles.mapButtonDisabled]}
                onPress={() => setShowMap(true)}
                disabled={!hasMapData}
              >
                Map
              </Button>
              <Button
                mode="contained-tonal"
                icon="file-pdf-box"
                style={[styles.exportButton, exporting && styles.exportButtonDisabled]}
                onPress={() => {
                  if (isPremium) {
                    logBillingInfo('progress_export_started');
                    generateReport();
                    return;
                  }

                  if (subscriptionStatus === 'inactive') {
                    openPaywall();
                    return;
                  }

                  logBillingInfo('progress_export_blocked_unknown_status');
                  Alert.alert(
                    'Subscription status unavailable',
                    'We could not verify your subscription right now. You can refresh or view plans.',
                    [
                      {
                        text: 'View Plans',
                        onPress: () => {
                          openPaywall();
                        },
                      },
                      {
                        text: 'Refresh',
                        onPress: () => {
                          refreshSubscription().catch((error) => {
                            logBillingError('progress_subscription_refresh_failed', error);
                          });
                        },
                      },
                      {
                        text: 'Later',
                        style: 'cancel',
                      },
                    ]
                  );
                }}
                disabled={isSubscriptionLoading || exporting || logs.length === 0}
              >
                {exporting ? (
                  <ActivityIndicator size="small" color="#7C3AED" />
                ) : isSubscriptionLoading ? (
                  'Checking...'
                ) : isPremium ? (
                  'Export'
                ) : subscriptionStatus === 'inactive' ? (
                  'Premium'
                ) : (
                  'Plans / Retry'
                )}
              </Button>
            </View>
          </View>
          {subscriptionStatus === 'inactive' ? (
            <Pressable style={styles.premiumHintRow} onPress={openPaywall}>
              <MaterialCommunityIcons name="lock-outline" size={15} color="#1E3A8A" />
              <Text style={styles.premiumHintText}>PDF export and weekly coach insights are premium. Tap to unlock.</Text>
            </Pressable>
          ) : null}
          {subscriptionStatus === 'unknown' && !isSubscriptionLoading ? (
            <Pressable
              style={styles.subscriptionStatusHintRow}
              onPress={() => {
                refreshSubscription().catch((error) => {
                  logBillingError('progress_subscription_manual_refresh_failed', error);
                });
              }}
            >
              <MaterialCommunityIcons name="cloud-alert-outline" size={15} color="#7C2D12" />
              <Text style={styles.subscriptionStatusHintText}>Subscription check failed. Tap to refresh.</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Time Range Selector */}
        <View style={styles.timeRangeContainer}>
          {(['7days', '30days', '90days'] as const).map((range) => (
            <Pressable
              key={range}
              style={({ pressed }) => [
                styles.timeRangeButton,
                timeRange === range && styles.timeRangeButtonActive,
                pressed && styles.timeRangeButtonPressed,
              ]}
              onPress={() => setTimeRange(range)}
            >
              <Text
                style={[
                  styles.timeRangeText,
                  timeRange === range && styles.timeRangeTextActive,
                ]}
              >
                {range === '7days' ? '7 Days' : range === '30days' ? '30 Days' : '90 Days'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Card.Content style={styles.statCardContent}>
            <MaterialCommunityIcons name="chart-line" size={24} color={ACCENT_COLOR} />
            <Text style={styles.statValue}>{stats.totalLogs}</Text>
            <Text style={styles.statLabel}>Total Reactions</Text>
            </Card.Content>
          </Card>

          <Card style={styles.statCard}>
            <Card.Content style={styles.statCardContent}>
            <MaterialCommunityIcons name="alert-circle" size={24} color={getSeverityColor(stats.averageSeverity)} />
            <Text style={styles.statValue}>{stats.averageSeverity.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Avg Severity</Text>
            </Card.Content>
          </Card>

          <Card style={styles.statCard}>
            <Card.Content style={styles.statCardContent}>
            <MaterialCommunityIcons name="fire" size={24} color="#EF4444" />
            <Text style={styles.statValue}>
              {stats.thisWeekCount}
            </Text>
            <Text style={styles.statLabel}>This Week</Text>
            </Card.Content>
          </Card>

          <Card style={styles.statCard}>
            <Card.Content style={styles.statCardContent}>
            <MaterialCommunityIcons 
              name={stats.thisWeekCount <= stats.lastWeekCount ? "trending-down" : "trending-up"} 
              size={24} 
              color={stats.thisWeekCount <= stats.lastWeekCount ? "#10B981" : "#EF4444"} 
            />
            <Text style={[styles.statValue, { color: stats.thisWeekCount <= stats.lastWeekCount ? "#10B981" : "#EF4444" }]}>
              {stats.thisWeekCount <= stats.lastWeekCount ? 'Better' : 'More'}
            </Text>
            <Text style={styles.statLabel}>vs Last Week</Text>
            </Card.Content>
          </Card>
        </View>

        {/* Most Common Trigger */}
        {stats.mostCommonTrigger && (
          <View style={styles.insightCard}>
            <MaterialCommunityIcons name="lightbulb" size={24} color="#F59E0B" />
            <View style={styles.insightContent}>
              <Text style={styles.insightTitle}>Most Common Trigger</Text>
              <Text style={styles.insightText}>
                {TRIGGER_LABELS[stats.mostCommonTrigger] || stats.mostCommonTrigger}
              </Text>
            </View>
          </View>
        )}

        {weeklyCoachSummary ? (
          <View style={[styles.coachCard, hasLockedWeeklyInsight && styles.coachCardLocked]}>
            <View style={styles.coachHeaderRow}>
              <View style={styles.coachIconWrap}>
                <MaterialCommunityIcons name="account-heart-outline" size={20} color="#1D4ED8" />
              </View>
              <View style={styles.coachHeaderTextWrap}>
                <Text style={styles.coachTitle}>Weekly Coach Summary</Text>
                <Text style={styles.coachSubtitle}>
                  {isPremium
                    ? 'Premium insight active'
                    : isInsightMeterLoading
                      ? 'Checking free previews...'
                      : hasLockedWeeklyInsight
                      ? `${previewRemaining} free preview${previewRemaining === 1 ? '' : 's'} left this month`
                      : 'Preview unlocked for this week'}
                </Text>
              </View>
            </View>

            {hasLockedWeeklyInsight ? (
              <>
                <Text style={styles.coachPreviewHeadline}>{weeklyCoachSummary.headline}</Text>
                <Text style={styles.coachLockedText}>Unlock this week&apos;s action plan and deeper trend interpretation.</Text>
                <Button
                  mode="contained"
                  buttonColor={previewRemaining > 0 ? '#1D4ED8' : '#0F766E'}
                  style={styles.coachUnlockButton}
                  loading={isUnlockingInsight || isInsightMeterLoading}
                  disabled={isUnlockingInsight || isInsightMeterLoading}
                  onPress={() => {
                    if (isInsightMeterLoading) {
                      return;
                    }

                    if (previewRemaining > 0) {
                      handleWeeklyInsightUnlock();
                      return;
                    }

                    openPaywall();
                  }}
                >
                  {isInsightMeterLoading
                    ? 'Checking...'
                    : previewRemaining > 0
                      ? `Unlock weekly plan (${previewRemaining} left)`
                      : 'View Premium Plans'}
                </Button>
              </>
            ) : (
              <>
                <Text style={styles.coachHeadline}>{weeklyCoachSummary.headline}</Text>
                <Text style={styles.coachSupportingText}>{weeklyCoachSummary.supportingText}</Text>
                <View style={styles.coachActionRow}>
                  <MaterialCommunityIcons
                    name={weeklyCoachSummary.trend === 'challenging' ? 'flag-outline' : 'run-fast'}
                    size={18}
                    color={weeklyCoachSummary.trend === 'challenging' ? '#9A3412' : '#0F766E'}
                  />
                  <Text style={styles.coachActionText}>{weeklyCoachSummary.actionText}</Text>
                </View>
              </>
            )}
          </View>
        ) : null}

        {/* Line Chart - Reactions Over Time */}
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>Reactions Over Time</Text>
          {logs.length > 0 ? (
            <View style={styles.chartFrame}>
              <LineChart
                data={getLineChartData()}
                width={chartWidth}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                fromZero
              />
            </View>
          ) : (
            <View style={[styles.emptyChart, { width: chartWidth, alignSelf: 'center' }]}>
              <MaterialCommunityIcons name="chart-line-variant" size={48} color="#D1D5DB" />
              <Text style={styles.emptyChartText}>No data yet</Text>
              <Text style={styles.emptyChartSubtext}>Start logging triggers to see your progress</Text>
            </View>
          )}
        </View>

        {/* Bar Chart - Triggers by Type */}
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>Triggers by Type</Text>
          {logs.length > 0 ? (
            <>
              <ScrollView
                horizontal={shouldScrollBarChart}
                showsHorizontalScrollIndicator={shouldScrollBarChart}
                persistentScrollbar={shouldScrollBarChart}
                bounces={false}
                contentContainerStyle={[styles.chartFrame, shouldScrollBarChart && styles.chartFrameScrollable]}
              >
                <BarChart
                  data={getBarChartData()}
                  width={barChartWidth}
                  height={200}
                  chartConfig={barChartConfig}
                  style={styles.chart}
                  fromZero
                  yAxisLabel=""
                  yAxisSuffix=""
                />
              </ScrollView>
              {shouldScrollBarChart ? (
                <View style={styles.chartScrollHintRow}>
                  <MaterialCommunityIcons name="gesture-swipe-horizontal" size={14} color="#64748B" />
                  <Text style={styles.chartScrollHintText}>Swipe to see all triggers</Text>
                </View>
              ) : null}
            </>
          ) : (
            <View style={[styles.emptyChart, { width: chartWidth, alignSelf: 'center' }]}> 
              <MaterialCommunityIcons name="chart-bar" size={48} color="#D1D5DB" />
              <Text style={styles.emptyChartText}>No data yet</Text>
            </View>
          )}
        </View>

        {/* Good vs Bad Days Heatmap */}
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>Good Days vs Bad Days</Text>
          {heatmapDays.length > 0 ? (
            <View style={[styles.heatmapCard, { width: heatmapCardWidth, alignSelf: 'center' }]}>
              <Text style={styles.heatmapSubtitle}>Last 6 weeks</Text>
              <View style={styles.heatmapGrid}>
                {heatmapWeeks.map((week, weekIndex) => (
                  <View key={`week-${weekIndex}`} style={styles.heatmapWeekColumn}>
                    {week.map((day) => (
                      <View
                        key={day.dateKey}
                        style={[styles.heatmapCell, { backgroundColor: getHeatmapColor(day) }]}
                      />
                    ))}
                  </View>
                ))}
              </View>

              <View style={styles.heatmapLegend}>
                <View style={styles.heatmapLegendItem}>
                  <View style={[styles.heatmapLegendDot, { backgroundColor: '#D1FAE5' }]} />
                  <Text style={styles.heatmapLegendText}>Good</Text>
                </View>
                <View style={styles.heatmapLegendItem}>
                  <View style={[styles.heatmapLegendDot, { backgroundColor: '#FCD34D' }]} />
                  <Text style={styles.heatmapLegendText}>Mixed</Text>
                </View>
                <View style={styles.heatmapLegendItem}>
                  <View style={[styles.heatmapLegendDot, { backgroundColor: '#FCA5A5' }]} />
                  <Text style={styles.heatmapLegendText}>Challenging</Text>
                </View>
              </View>

              <Text style={styles.heatmapHintText}>
                Today: {getHeatmapLabel(heatmapDays[heatmapDays.length - 1])}
              </Text>
            </View>
          ) : (
            <View style={[styles.emptyChart, { width: chartWidth, alignSelf: 'center' }]}>
              <MaterialCommunityIcons name="calendar-month-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyChartText}>No heatmap data yet</Text>
            </View>
          )}
        </View>

        {/* Recent Activity */}
        {logs.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.recentTitle}>Recent Activity</Text>
            {logs.slice(-5).reverse().map((log, index) => (
              <View key={log.id} style={styles.recentItem}>
                <View style={[
                  styles.severityIndicator,
                  { backgroundColor: getSeverityColor(log.severity) }
                ]}>
                  <Text style={styles.severityText}>{log.severity}</Text>
                </View>
                <View style={styles.recentDetails}>
                  <Text style={styles.recentType}>{TRIGGER_LABELS[log.trigger_type] || log.trigger_type}</Text>
                  <Text style={styles.recentDate}>
                    {new Date(log.logged_at).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                {log.distance_meters !== null && log.distance_meters !== undefined && (
             <Text style={styles.recentDistance}>{log.distance_meters}m</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Encouragement Message */}
        {stats.thisWeekCount === 0 && logs.length > 0 && (
          <View style={[styles.insightCard, { backgroundColor: '#D1FAE5' }]}>
            <MaterialCommunityIcons name="star" size={24} color="#10B981" />
            <View style={styles.insightContent}>
              <Text style={[styles.insightTitle, { color: '#065F46' }]}>Amazing Week!</Text>
              <Text style={[styles.insightText, { color: '#065F46' }]}>
                No reactions logged this week. Keep up the great work!
              </Text>
            </View>
          </View>
        )}
        </Animated.View>
      </ScrollView>

      <Portal>
        <PaperModal visible={showMap} onDismiss={() => setShowMap(false)} contentContainerStyle={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.mapHeader}>
              <Text style={styles.mapTitle}>Walk & Trigger Map</Text>
              <IconButton icon="close" mode="contained-tonal" onPress={() => setShowMap(false)} />
            </View>

            <View style={styles.mapControlsRow}>
              <Pressable
                style={[styles.mapControlButton, showRoutesOnMap && styles.mapControlButtonActive]}
                onPress={() => setShowRoutesOnMap((previous) => !previous)}
              >
                <MaterialCommunityIcons
                  name={showRoutesOnMap ? 'map-marker-path' : 'map-marker-path'}
                  size={14}
                  color={showRoutesOnMap ? '#1E3A8A' : '#64748B'}
                />
                <Text style={[styles.mapControlText, showRoutesOnMap && styles.mapControlTextActive]}>
                  Routes {walkRoutes.length > 0 ? `(${walkRoutes.length})` : ''}
                </Text>
              </Pressable>
              <View style={styles.mapControlInfoWrap}>
                <Text style={styles.mapControlInfoText}>Markers: {mapMarkerCount}</Text>
              </View>
            </View>
            
            <View style={styles.mapContainer}>
              <OpenStreetMapView
                id={`progress-${timeRange}`}
                style={styles.map}
                routeLines={mapRouteLines}
                markers={mapMarkers}
                fitToElements
                zoomLevel={14}
              />
              
              {/* Legend */}
              <View style={styles.mapLegend}>
                <Text style={styles.legendTitle}>Map Legend</Text>
                {showRoutesOnMap ? (
                  <View style={styles.routeLegendRow}>
                    <View style={styles.routeLegendLine} />
                    <Text style={styles.routeLegendText}>Walk routes</Text>
                  </View>
                ) : null}
                <View style={styles.legendItems}>
                  {Object.entries(TRIGGER_LABELS).map(([key, label]) => (
                    <View key={key} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: TRIGGER_COLORS[key] }]} />
                      <Text style={styles.legendText}>{label.split(' ')[0]}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </PaperModal>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F7FB',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: 24,
    paddingBottom: 120,
  },
  contentColumn: {
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
  },
  timeRangeContainer: {
    flexDirection: 'row',
    backgroundColor: '#EAF0F8',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  timeRangeButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  timeRangeButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  timeRangeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  timeRangeTextActive: {
    color: '#0F172A',
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9E2EC',
  },
  statCardContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  insightContent: {
    marginLeft: 16,
    flex: 1,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  insightText: {
    fontSize: 14,
    color: '#92400E',
  },
  coachCard: {
    backgroundColor: '#EEF4FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 10,
  },
  coachCardLocked: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  coachHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  coachIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachHeaderTextWrap: {
    flex: 1,
  },
  coachTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  coachSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#475569',
  },
  coachPreviewHeadline: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  coachLockedText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#475569',
  },
  coachUnlockButton: {
    marginTop: 2,
  },
  coachHeadline: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  coachSupportingText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#334155',
  },
  coachActionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 2,
  },
  coachActionText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: '#0F172A',
  },
  chartSection: {
    marginBottom: 32,
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  chart: {
    borderRadius: 16,
  },
  chartFrame: {
    alignItems: 'center',
  },
  chartFrameScrollable: {
    paddingHorizontal: 4,
  },
  chartScrollHintRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  chartScrollHintText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  heatmapCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 16,
  },
  heatmapSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
  },
  heatmapGrid: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  heatmapWeekColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  heatmapCell: {
    width: '78%',
    maxWidth: 72,
    aspectRatio: 1,
    borderRadius: 10,
  },
  heatmapLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 8,
  },
  heatmapLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heatmapLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  heatmapLegendText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  heatmapHintText: {
    fontSize: 12,
    color: '#64748B',
  },
  emptyChart: {
    height: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#D9E2EC',
    borderStyle: 'dashed',
  },
  emptyChartText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 12,
  },
  emptyChartSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  recentSection: {
    marginBottom: 24,
  },
  recentTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 8,
  },
  severityIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  severityText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  recentDetails: {
    flex: 1,
  },
  recentType: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  recentDate: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  recentDistance: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C3AED',
  },
  headerTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 10,
  },
  headerTextBlock: {
    width: '100%',
  },
  headerButtons: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  mapButton: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0EDFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  mapButtonDisabled: {
    opacity: 0.5,
  },
  exportButton: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0EDFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  exportButtonDisabled: {
    opacity: 0.5,
  },
  premiumHintRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  premiumHintText: {
    fontSize: 13,
    color: '#1E3A8A',
    fontWeight: '600',
  },
  subscriptionStatusHintRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subscriptionStatusHintText: {
    fontSize: 13,
    color: '#7C2D12',
    fontWeight: '600',
  },
  // Map Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#D9E2EC',
    backgroundColor: '#fff',
  },
  mapTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  mapControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 10,
    backgroundColor: '#fff',
  },
  mapControlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    gap: 6,
  },
  mapControlButtonActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#93C5FD',
  },
  mapControlText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  mapControlTextActive: {
    color: '#1E3A8A',
  },
  mapControlInfoWrap: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  mapControlInfoText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  mapLegend: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  routeLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  routeLegendLine: {
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2563EB',
  },
  routeLegendText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#475569',
  },
  calloutContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  calloutSeverity: {
    fontSize: 12,
    color: '#6B7280',
  },
  calloutDate: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
});
