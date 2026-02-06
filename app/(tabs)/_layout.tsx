import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_COLORS = {
  active: '#6D28D9',
  inactive: '#6B7280',
  background: '#FFFFFF',
  border: '#E5E7EB',
  activeBackground: '#EDE9FE',
};

const iconMap = {
  index: { active: 'home', inactive: 'home-outline' },
  'walk-tab': { active: 'walk', inactive: 'walk' },
  log: { active: 'plus-circle', inactive: 'plus-circle-outline' },
  progress: { active: 'chart-line', inactive: 'chart-line-variant' },
  community: { active: 'forum', inactive: 'forum-outline' },
} as const;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const tabBarBottomPadding = Math.max(insets.bottom, 10);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: TAB_COLORS.active,
        tabBarInactiveTintColor: TAB_COLORS.inactive,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarStyle: {
          height: 62 + tabBarBottomPadding,
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: tabBarBottomPadding,
          backgroundColor: TAB_COLORS.background,
          borderTopWidth: 1,
          borderTopColor: TAB_COLORS.border,
        },
        tabBarItemStyle: {
          borderRadius: 14,
          marginHorizontal: 3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarActiveBackgroundColor: TAB_COLORS.activeBackground,
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={iconMap.index[focused ? 'active' : 'inactive']}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="walk-tab"
        options={{
          title: 'Walk',
          tabBarActiveBackgroundColor: TAB_COLORS.activeBackground,
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={iconMap['walk-tab'][focused ? 'active' : 'inactive']}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log',
          tabBarActiveBackgroundColor: TAB_COLORS.activeBackground,
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={iconMap.log[focused ? 'active' : 'inactive']}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarActiveBackgroundColor: TAB_COLORS.activeBackground,
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={iconMap.progress[focused ? 'active' : 'inactive']}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Community',
          tabBarActiveBackgroundColor: TAB_COLORS.activeBackground,
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={iconMap.community[focused ? 'active' : 'inactive']}
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
