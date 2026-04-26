import { Pressable, StyleSheet, Text, View } from "react-native";

import type { DecisionOption } from "../services/api";

type DecisionCardProps = {
  option: DecisionOption;
  isBest: boolean;
  isApproved: boolean;
  loading: boolean;
  onApprove: () => void;
};

export default function DecisionCard({
  option,
  isBest,
  isApproved,
  loading,
  onApprove,
}: DecisionCardProps) {
  return (
    <View style={[styles.card, isBest ? styles.cardBest : null]}>
      <View style={styles.header}>
        <Text style={styles.title}>{option.name}</Text>
        {isBest ? <Text style={styles.bestBadge}>Best</Text> : null}
      </View>

      <Text style={styles.metric}>Delay: {option.delay} days</Text>
      <Text style={styles.metric}>Cost: ${option.cost}</Text>
      <Text style={styles.metric}>Risk: {option.risk}</Text>

      <Pressable
        disabled={loading}
        onPress={onApprove}
        style={[styles.button, loading ? styles.buttonDisabled : null]}
      >
        <Text style={styles.buttonText}>
          {loading ? "Approving..." : isApproved ? "Approved" : "Approve Decision"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0f172a",
    borderColor: "#1e293b",
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
  },
  cardBest: {
    borderColor: "#22d3ee",
    backgroundColor: "#083344",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  bestBadge: {
    backgroundColor: "#22d3ee",
    borderRadius: 999,
    color: "#082f49",
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metric: {
    color: "#cbd5e1",
    fontSize: 14,
    marginBottom: 6,
  },
  button: {
    alignItems: "center",
    backgroundColor: "#22d3ee",
    borderRadius: 14,
    marginTop: 12,
    paddingVertical: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#082f49",
    fontSize: 14,
    fontWeight: "700",
  },
});
