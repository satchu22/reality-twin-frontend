export type RealtimeNotification = {
  id: number;
  user_id: number;
  transaction_id?: number | null;
  message: string;
  type: "info" | "warning" | "critical";
  is_read: boolean;
  created_at: string;
};

export type RealtimeSimulationUpdate = {
  route_id?: number | string | null;
  route?: string;
  distance_km?: number;
  disruption_type?: string;
  best_option?: string;
  approved_option?: string;
  message?: string;
  risk?: "low" | "medium" | "high";
  explanation?: string[];
  options?: Array<{
    name: string;
    route_type: string;
    route: string;
    delay: number;
    cost: number;
    total_time: number;
    total_cost: number;
    risk: "low" | "medium" | "high";
    score?: number;
    explanation: string[];
    event_types: Array<"weather" | "traffic" | "satellite" | "global_event">;
    live_events_used: Array<{
      id: number;
      source: "weather" | "traffic" | "satellite" | "global_event";
      event_type: string;
      severity: "low" | "medium" | "high";
      lat: number;
      lng: number;
      radius_km: number;
      description: string;
      confidence: number;
    }>;
  }>;
};

export type RealtimeRouteUpdate = {
  route_id?: number | string | null;
  status?: string;
  disruption_type?: string;
  best_option?: string;
  event_count?: number;
};

export type RealtimeTransaction = {
  id: number;
  company_id: number;
  amount: number;
  status: "pending" | "paid" | "overdue";
  due_date: string;
  description: string;
  created_at: string;
};

export type RealtimeTransactionUpdate = {
  transaction: RealtimeTransaction;
};

export type RealtimeMessage =
  | { type: "simulation_update"; data: RealtimeSimulationUpdate }
  | { type: "notification"; data: RealtimeNotification }
  | { type: "route_update"; data: RealtimeRouteUpdate }
  | { type: "transaction_update"; data: RealtimeTransactionUpdate };

export type RealtimeStatus = "connecting" | "connected" | "reconnecting" | "polling";
