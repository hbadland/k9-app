import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../../lib/theme';

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={ic.wrap}>
      <Text style={ic.icon}>{emoji}</Text>
      <Text style={[ic.label, focused && ic.labelActive]}>{label}</Text>
    </View>
  );
}

const ic = StyleSheet.create({
  wrap:        { alignItems: 'center', gap: 4, paddingTop: 8 },
  icon:        { fontSize: 23, lineHeight: 27 },
  label:       { fontSize: 10, color: C.textDim, letterSpacing: 0.3 },
  labelActive: { color: C.gold },
});

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          height: 88,
          backgroundColor: `${C.dark}F7`,
          borderTopColor: 'rgba(255,255,255,0.06)',
          borderTopWidth: 1,
          elevation: 0,
        },
        tabBarBackground: () => (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: `${C.dark2}F7` }]} />
        ),
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Home" focused={focused} /> }}
      />
      <Tabs.Screen
        name="dogs"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🐾" label="My Dogs" focused={focused} /> }}
      />
      <Tabs.Screen
        name="book"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📅" label="Book" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Profile" focused={focused} /> }}
      />
    </Tabs>
  );
}
