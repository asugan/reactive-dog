import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-chart-kit';

const { width } = Dimensions.get('window');

interface TriggerLog {
  id: string;
  trigger_type: string;
  severity: number;
  distance_meters: number | null;
  logged_at: string;
}

interface Stats {
  totalLogs: number;
  averageSeverity: number;
  mostCommonTrigger: string;
  thisWeekCount: number;
  lastWeekCount: number;
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

export default function ProgressScreen() {
  const [logs, setLogs] = useState<TriggerLog[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalLogs: 0,
    averageSeverity: 0,
    mostCommonTrigger: '',
    thisWeekCount: 0,
    lastWeekCount: 0,
  });
  const [timeRange, setTimeRange] = useState<'7days' | '30days' | '90days'>('7days');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, [timeRange]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const daysBack = timeRange === '7days' ? 7 : timeRange === '30days' ? 30 : 90;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      const { data, error } = await supabase
        .from('trigger_logs')
        .select('*')
        .eq('owner_id', user.id)
        .gte('logged_at', cutoffDate.toISOString())
        .order('logged_at', { ascending: true });

      if (error) {
        console.error('Error fetching logs:', error);
        return;
      }

      setLogs(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

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

    const labels = Object.keys(triggerCounts).map(key => TRIGGER_LABELS[key].split(' ')[0]);
    const data = Object.values(triggerCounts);

    return { labels, datasets: [{ data }] };
  };

  const getSeverityColor = (severity: number) => {
    if (severity <= 2) return '#10B981';
    if (severity === 3) return '#F59E0B';
    return '#EF4444';
  };

  const chartConfig = {
    backgroundColor: '#fff',
    backgroundGradientFrom: '#fff',
    backgroundGradientTo: '#fff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(124, 58, 237, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#7C3AED',
    },
  };

  const barChartConfig = {
    ...chartConfig,
    color: (opacity = 1, index?: number) => {
      const colors = Object.values(TRIGGER_COLORS);
      return index !== undefined ? colors[index % colors.length] : `rgba(124, 58, 237, ${opacity})`;
    },
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Progress</Text>
          <Text style={styles.subtitle}>Track your dog's improvement over time</Text>
        </View>

        {/* Time Range Selector */}
        <View style={styles.timeRangeContainer}>
          {(['7days', '30days', '90days'] as const).map((range) => (
            <TouchableOpacity
              key={range}
              style={[
                styles.timeRangeButton,
                timeRange === range && styles.timeRangeButtonActive,
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
            </TouchableOpacity>
          ))}
        </View>

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="chart-line" size={24} color="#7C3AED" />
            <Text style={styles.statValue}>{stats.totalLogs}</Text>
            <Text style={styles.statLabel}>Total Reactions</Text>
          </View>

          <View style={styles.statCard}>
            <MaterialCommunityIcons name="alert-circle" size={24} color={getSeverityColor(stats.averageSeverity)} />
            <Text style={styles.statValue}>{stats.averageSeverity.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Avg Severity</Text>
          </View>

          <View style={styles.statCard}>
            <MaterialCommunityIcons name="fire" size={24} color="#EF4444" />
            <Text style={styles.statValue}>
              {stats.thisWeekCount}
            </Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>

          <View style={styles.statCard}>
            <MaterialCommunityIcons 
              name={stats.thisWeekCount <= stats.lastWeekCount ? "trending-down" : "trending-up"} 
              size={24} 
              color={stats.thisWeekCount <= stats.lastWeekCount ? "#10B981" : "#EF4444"} 
            />
            <Text style={[styles.statValue, { color: stats.thisWeekCount <= stats.lastWeekCount ? "#10B981" : "#EF4444" }]}>
              {stats.thisWeekCount <= stats.lastWeekCount ? 'Better' : 'More'}
            </Text>
            <Text style={styles.statLabel}>vs Last Week</Text>
          </View>
        </View>

        {/* Most Common Trigger */}
        {stats.mostCommonTrigger && (
          <View style={styles.insightCard}>
            <MaterialCommunityIcons name="lightbulb" size={24} color="#F59E0B" />
            <View style={styles.insightContent}>
              <Text style={styles.insightTitle}>Most Common Trigger</Text>
              <Text style={styles.insightText}>
                {TRIGGER_LABELS[stats.mostCommonTrigger]}
              </Text>
            </View>
          </View>
        )}

        {/* Line Chart - Reactions Over Time */}
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>Reactions Over Time</Text>
          {logs.length > 0 ? (
            <LineChart
              data={getLineChartData()}
              width={width - 48}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
              fromZero
            />
          ) : (
            <View style={styles.emptyChart}>
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
            <BarChart
              data={getBarChartData()}
              width={width - 48}
              height={200}
              chartConfig={barChartConfig}
              style={styles.chart}
              fromZero
              showValuesOnTopOfBars
              yAxisLabel=""
              yAxisSuffix=""
            />
          ) : (
            <View style={styles.emptyChart}>
              <MaterialCommunityIcons name="chart-bar" size={48} color="#D1D5DB" />
              <Text style={styles.emptyChartText}>No data yet</Text>
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
                  <Text style={styles.recentType}>{TRIGGER_LABELS[log.trigger_type]}</Text>
                  <Text style={styles.recentDate}>
                    {new Date(log.logged_at).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                {log.distance_meters && (
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  timeRangeContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
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
  timeRangeButtonActive: {
    backgroundColor: '#fff',
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
    color: '#1F2937',
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
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
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
  emptyChart: {
    height: 200,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
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
});
