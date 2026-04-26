import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import DecisionCard from "../components/DecisionCard";
import {
  approveDecision,
  simulateRoute,
  type DecisionOption,
  type SimulationResponse,
} from "../services/api";
import type { RootStackParamList } from "../../App";

type SimulationScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "Simulation"
>;

export default function SimulationScreen({
  route,
}: SimulationScreenProps) {
  const selectedRoute = route.params.route;
  const [simulationResult, setSimulationResult] =
    useState<SimulationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvedOptionName, setApprovedOptionName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(
    () => simulationResult?.options?.slice(0, 3) ?? [],
    [simulationResult],
  );

  async function handleSimulateDisruption() {
    if (loading) {
      return;
    }

    if (selectedRoute.distanceKm === null) {
      setError("Route distance is unavailable for simulation.");
      return;
    }

    setLoading(true);
    setError(null);
    setApprovedOptionName(null);

    try {
      const result = await simulateRoute({
        route_id: selectedRoute.routeId,
        distance_km: selectedRoute.distanceKm,
        disruption_type: "weather",
      });

      console.log("Mobile simulation response", result);
      setSimulationResult(result);

      if (!result.options || result.options.length === 0) {
        setError("Simulation completed but returned no decision options.");
      }
    } catch (simulationError) {
      console.error("Mobile simulation request failed", simulationError);
      setSimulationResult(null);
      setError(
        simulationError instanceof Error
          ? simulationError.message
          : "Simulation failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveDecision(option: DecisionOption) {
    if (approvalLoading) {
      return;
    }

    setApprovalLoading(true);
    setError(null);

    try {
      const result = await approveDecision(selectedRoute.routeId, option.name);
      console.log("Approved option", option.name);
      console.log("Approval response", result);
      setApprovedOptionName(option.name);
    } catch (approvalError) {
      setError(
        approvalError instanceof Error
          ? approvalError.message
          : "Decision approval failed",
      );
    } finally {
      setApprovalLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{selectedRoute.name}</Text>

      <View style={styles.routeCard}>
        <Text style={styles.label}>Distance</Text>
        <Text style={styles.value}>
          {selectedRoute.distanceKm !== null
            ? `${selectedRoute.distanceKm} km`
            : "Unavailable"}
        </Text>

        <Text style={[styles.label, styles.spaced]}>Status</Text>
        <Text style={styles.value}>{selectedRoute.status}</Text>
      </View>

      <Pressable
        disabled={loading}
        onPress={handleSimulateDisruption}
        style={[styles.button, loading ? styles.buttonDisabled : null]}
      >
        {loading ? (
          <ActivityIndicator color="#082f49" />
        ) : (
          <Text style={styles.buttonText}>Simulate Disruption</Text>
        )}
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {simulationResult ? (
        <View style={styles.results}>
          <Text style={styles.sectionTitle}>Decision Options</Text>
          <Text style={styles.bestText}>
            Best option: {simulationResult.best_option}
          </Text>

          {options.length === 0 ? (
            <Text style={styles.emptyText}>No decision options available.</Text>
          ) : (
            options.map((option) => (
              <DecisionCard
                key={option.name}
                option={option}
                isBest={option.name === simulationResult.best_option}
                isApproved={approvedOptionName === option.name}
                loading={approvalLoading}
                onApprove={() => handleApproveDecision(option)}
              />
            ))
          )}
        </View>
      ) : null}
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
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 16,
  },
  routeCard: {
    backgroundColor: "#0f172a",
    borderColor: "#1e293b",
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 18,
    padding: 16,
  },
  label: {
    color: "#94a3b8",
    fontSize: 13,
  },
  value: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  spaced: {
    marginTop: 16,
  },
  button: {
    alignItems: "center",
    backgroundColor: "#22d3ee",
    borderRadius: 14,
    marginBottom: 16,
    paddingVertical: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#082f49",
    fontSize: 16,
    fontWeight: "700",
  },
  error: {
    color: "#fda4af",
    marginBottom: 12,
  },
  results: {
    marginTop: 8,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  bestText: {
    color: "#cbd5e1",
    marginBottom: 14,
  },
  emptyText: {
    color: "#94a3b8",
  },
});
