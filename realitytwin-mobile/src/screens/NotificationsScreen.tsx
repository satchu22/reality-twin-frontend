import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";

import { getNotifications, type NotificationItem } from "../services/api";

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const notificationData = await getNotifications();
      setNotifications(notificationData);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load notifications",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22d3ee" size="large" />
        <Text style={styles.infoText}>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notifications</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadNotifications();
            }}
            tintColor="#22d3ee"
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No notifications available.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.message}>{item.message}</Text>
            <Text style={styles.time}>
              {new Date(item.created_at).toLocaleString()}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#020617",
    flex: 1,
    padding: 20,
  },
  centered: {
    alignItems: "center",
    backgroundColor: "#020617",
    flex: 1,
    justifyContent: "center",
  },
  infoText: {
    color: "#cbd5e1",
    marginTop: 12,
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 16,
  },
  error: {
    color: "#fda4af",
    marginBottom: 12,
  },
  emptyText: {
    color: "#94a3b8",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#0f172a",
    borderColor: "#1e293b",
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  message: {
    color: "#ffffff",
    fontSize: 15,
    marginBottom: 8,
  },
  time: {
    color: "#94a3b8",
    fontSize: 12,
  },
});
