import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0f172a',
        tabBarInactiveTintColor: '#94a3b8',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Billing',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>🧾</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="items"
        options={{
          title: 'Items',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>📦</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="bills"
        options={{
          title: 'Bills',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>📜</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="credit"
        options={{
          title: 'Credit',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>💳</Text>
          ),
        }}
      />
    </Tabs>
  );
}
