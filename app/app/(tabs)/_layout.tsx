import { Tabs } from 'expo-router';
import { SpotlightTabBar } from '../../components/SpotlightTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <SpotlightTabBar {...props} />}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="dogs" />
      <Tabs.Screen name="tracking" />
      <Tabs.Screen name="book" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
