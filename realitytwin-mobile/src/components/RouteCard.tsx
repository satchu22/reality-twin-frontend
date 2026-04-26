import { Pressable, StyleSheet, Text, View } from "react-native";

import type { RouteItem } from "../services/api";

type RouteCardProps = {
  route: RouteItem;
  onPress: () => void;
};

export default function RouteCard({ route, onPress }: RouteCardProps) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>{route.name}</Text>
        <Text style={styles.badge}>{route.status}</Text>
      </View>
      <Text style={styles.text}>
        Distance: {route.distanceKm !== null ? `${route.distanceKm} km` : "Unavailable"}
      </Text>
      <Text style={styles.text}>
        Start: {route.source[0].toFixed(2)}, {route.source[1].toFixed(2)}
      </Text>
      <Text style={styles.text}>
        End: {route.dest[0].toFixed(2)}, {route.dest[1].toFixed(2)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0f172a",
    borderColor: "#1e293b",
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: {
    color: "#ffffff",
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    marginRight: 12,
  },
  badge: {
    backgroundColor: "#164e63",
    borderRadius: 999,
    color: "#67e8f9",
    fontSize: 12,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 4,
    textTransform: "capitalize",
  },
  text: {
    color: "#cbd5e1",
    fontSize: 13,
    marginTop: 2,
  },
});
