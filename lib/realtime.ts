import { type SimulationOption } from "@/lib/simulate";

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
  total_time?: number;
  total_time_hours?: number;
  total_cost?: number;
  total_cost_usd?: number;
  disruption_type?: string;
  best_option?: string;
  approved_option?: string;
  message?: string;
  risk?: "low" | "medium" | "high";
  risk_level?: "low" | "medium" | "high";
  explanation?: string[];
  options?: SimulationOption[];
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
