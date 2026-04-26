import "react-native-gesture-handler";

import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { Text } from "react-native";

import DashboardScreen from "./src/screens/DashboardScreen";
import MapScreen from "./src/screens/MapScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";
import SimulationScreen from "./src/screens/SimulationScreen";
import type { RouteItem } from "./src/services/api";

export type RootStackParamList = {
  Tabs: undefined;
  Simulation: {
    route: RouteItem;
  };
};

export type TabParamList = {
  Dashboard: undefined;
  Map: undefined;
  Notifications: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function TabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#020617" },
        headerTintColor: "#ffffff",
        tabBarStyle: { backgroundColor: "#020617", borderTopColor: "#1e293b" },
        tabBarActiveTintColor: "#22d3ee",
        tabBarInactiveTintColor: "#94a3b8",
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 16 }}>D</Text>,
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 16 }}>M</Text>,
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 16 }}>N</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: "#020617" },
          headerTintColor: "#ffffff",
          contentStyle: { backgroundColor: "#020617" },
        }}
      >
        <Stack.Screen
          name="Tabs"
          component={TabsNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Simulation"
          component={SimulationScreen}
          options={{ title: "Simulation" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
