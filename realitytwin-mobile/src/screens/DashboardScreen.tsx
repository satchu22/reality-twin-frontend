import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useCallback, useEffect, useState } from "react";

import { getNotifications, getOverview, getRoutes, type NotificationItem, type OverviewResponse, type RouteItem } from "../services/api";

export default function DashboardScreen() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const [overviewData, routeData, notificationData] = await Promise.all([
        getOverview(),
        getRoutes(),
        getNotifications(),
      ]);
      setOverview(overviewData);
      setRoutes(routeData);
      setNotifications(notificationData.slice(0, 3));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22d3ee" size="large" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          void loadDashboard();
        }} tintColor="#22d3ee" />
      }
    >
      <Text style={styles.title}>RealityTwin Dashboard</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.metricRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Total Routes</Text>
          <Text style={styles.metricValue}>{overview?.active_routes ?? routes.length}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Risk Summary</Text>
          <Text style={styles.metricValue}>{overview?.risk_alerts ?? 0}</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Recommended Action</Text>
        <Text style={styles.panelBody}>{overview?.best_action || "No recommendation yet."}</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Recent Decisions</Text>
        {notifications.length === 0 ? (
          <Text style={styles.panelBody}>No recent decisions available.</Text>
        ) : (
          notifications.map((notification) => (
            <View key={notification.id} style={styles.listRow}>
              <Text style={styles.listText}>{notification.message}</Text>
              <Text style={styles.listMeta}>
                {new Date(notification.created_at).toLocaleString()}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#020617",
    flex: 1,
  },
  content: {
    padding: 20,
  },
  centered: {
    alignItems: "center",
    backgroundColor: "#020617",
    flex: 1,
    justifyContent: "center",
  },
  loadingText: {
    color: "#cbd5e1",
    marginTop: 12,
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 20,
  },
  error: {
    color: "#fda4af",
    marginBottom: 16,
  },
  metricRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
  },
  metricCard: {
    backgroundColor: "#0f172a",
    borderColor: "#1e293b",
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    padding: 16,
  },
  metricLabel: {
    color: "#94a3b8",
    fontSize: 13,
  },
  metricValue: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
    marginTop: 8,
  },
  panel: {
    backgroundColor: "#0f172a",
    borderColor: "#1e293b",
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  panelTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  panelBody: {
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 20,
  },
  listRow: {
    borderTopColor: "#1e293b",
    borderTopWidth: 1,
    paddingVertical: 12,
  },
  listText: {
    color: "#ffffff",
    fontSize: 14,
    marginBottom: 4,
  },
  listMeta: {
    color: "#94a3b8",
    fontSize: 12,
  },
});
