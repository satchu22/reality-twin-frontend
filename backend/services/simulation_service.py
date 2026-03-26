def run_simulation(shipments):
    total_cost = 0
    total_delay = 0
    impacted_routes = []

    for s in shipments:
        delay = s.distance_km * 0.001
        extra_cost = s.distance_km * 0.5

        if delay > 3:
            impacted_routes.append(s.route)

        total_delay += delay
        total_cost += s.cost + extra_cost

    return {
        "delay": round(total_delay, 2),
        "cost": round(total_cost, 2),
        "impacted_routes": impacted_routes,
        "recommendation": "Optimize long-distance routes"
    }