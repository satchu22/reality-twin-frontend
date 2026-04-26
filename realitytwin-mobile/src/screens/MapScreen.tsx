import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import MapView, { LatLng, Marker, Polyline, Region } from "react-native-maps";
import * as Location from "expo-location";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";

import RouteCard from "../components/RouteCard";
import { getRoutes, type RouteItem } from "../services/api";
import type { RootStackParamList } from "../../App";

const DEFAULT_REGION: Region = {
  latitude: 39.8283,
  longitude: -98.5795,
  latitudeDelta: 25,
  longitudeDelta: 25,
};

function toLatLng([latitude, longitude]: [number, number]): LatLng {
  return { latitude, longitude };
}

export default function MapScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);

  const loadRoutes = useCallback(async () => {
    try {
      const routeData = await getRoutes();
      setRoutes(routeData);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load routes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoutes();
  }, [loadRoutes]);

  useEffect(() => {
    async function syncLocation() {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({});
        setRegion({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          latitudeDelta: 10,
          longitudeDelta: 10,
        });
      } catch (locationError) {
        console.log("Location unavailable", locationError);
      }
    }

    void syncLocation();
  }, []);

  const markers = useMemo(
    () =>
      routes.flatMap((route) => [
        { key: `${route.routeId}-source`, coordinate: route.source, route },
        { key: `${route.routeId}-dest`, coordinate: route.dest, route },
      ]),
    [routes],
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22d3ee" size="large" />
        <Text style={styles.infoText}>Loading routes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={region} showsUserLocation>
        {routes.map((route) => (
          <Polyline
            key={route.routeId}
            coordinates={[toLatLng(route.source), toLatLng(route.dest)]}
            strokeColor="#22d3ee"
            strokeWidth={3}
            tappable
            onPress={() => navigation.navigate("Simulation", { route })}
          />
        ))}

        {markers.map((marker) => (
          <Marker
            key={marker.key}
            coordinate={toLatLng(marker.coordinate)}
            title={marker.route.name}
            description={
              marker.route.distanceKm !== null
                ? `${marker.route.distanceKm} km`
                : "Distance unavailable"
            }
            onPress={() => navigation.navigate("Simulation", { route: marker.route })}
          />
        ))}
      </MapView>

      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>Active Routes</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <FlatList
          data={routes}
          keyExtractor={(item) => item.routeId}
          renderItem={({ item }) => (
            <RouteCard
              route={item}
              onPress={() => navigation.navigate("Simulation", { route: item })}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#020617",
    flex: 1,
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
  map: {
    flex: 1,
  },
  sheet: {
    backgroundColor: "#020617",
    borderTopColor: "#1e293b",
    borderTopWidth: 1,
    height: "42%",
    padding: 16,
  },
  sheetTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  error: {
    color: "#fda4af",
    marginBottom: 10,
  },
});
