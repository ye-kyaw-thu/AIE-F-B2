// Generated from applied migrations in embedded PostgreSQL.
// Regenerate: npm run db:types. Do not edit by hand.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      alerts: {
        Row: {
          id: string;
          trader_id: string;
          shipment_id: string | null;
          gate_id: string | null;
          title: string;
          message: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          trader_id: string;
          shipment_id?: string | null;
          gate_id?: string | null;
          title: string;
          message: string;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          trader_id?: string;
          shipment_id?: string | null;
          gate_id?: string | null;
          title?: string;
          message?: string;
          is_read?: boolean;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "alerts_trader_id_fkey"; columns: ["trader_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "alerts_shipment_id_fkey"; columns: ["shipment_id"]; isOneToOne: false; referencedRelation: "shipments"; referencedColumns: ["id"] },
          { foreignKeyName: "alerts_gate_id_fkey"; columns: ["gate_id"]; isOneToOne: false; referencedRelation: "gate_statuses"; referencedColumns: ["id"] },
        ];
      };
      documents: {
        Row: {
          id: string;
          shipment_id: string;
          driver_id: string;
          document_type: string;
          file_url: string;
          original_name: string;
          mime_type: string;
          size_bytes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          shipment_id: string;
          driver_id: string;
          document_type: string;
          file_url: string;
          original_name: string;
          mime_type: string;
          size_bytes: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          shipment_id?: string;
          driver_id?: string;
          document_type?: string;
          file_url?: string;
          original_name?: string;
          mime_type?: string;
          size_bytes?: number;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "documents_shipment_id_fkey"; columns: ["shipment_id"]; isOneToOne: false; referencedRelation: "shipments"; referencedColumns: ["id"] },
          { foreignKeyName: "documents_driver_id_fkey"; columns: ["driver_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      driver_invitations: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          phone: string;
          invited_by: string;
          driver_id: string | null;
          status: string;
          created_at: string;
          last_attempt_at: string;
          last_sent_at: string | null;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          full_name: string;
          phone?: string;
          invited_by: string;
          driver_id?: string | null;
          status?: string;
          created_at?: string;
          last_attempt_at?: string;
          last_sent_at?: string | null;
          accepted_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          phone?: string;
          invited_by?: string;
          driver_id?: string | null;
          status?: string;
          created_at?: string;
          last_attempt_at?: string;
          last_sent_at?: string | null;
          accepted_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "driver_invitations_invited_by_fkey"; columns: ["invited_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "driver_invitations_driver_id_fkey"; columns: ["driver_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      gate_statuses: {
        Row: {
          id: string;
          gate_name: string;
          location: string;
          status: Database["public"]["Enums"]["gate_status"];
          reason: string;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          gate_name: string;
          location: string;
          status?: Database["public"]["Enums"]["gate_status"];
          reason?: string;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          gate_name?: string;
          location?: string;
          status?: Database["public"]["Enums"]["gate_status"];
          reason?: string;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "gate_statuses_updated_by_fkey"; columns: ["updated_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          role: Database["public"]["Enums"]["app_role"];
          created_at: string;
          driver_access: string;
          phone: string;
        };
        Insert: {
          id: string;
          full_name: string;
          email: string;
          role?: Database["public"]["Enums"]["app_role"];
          created_at?: string;
          driver_access?: string;
          phone?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          role?: Database["public"]["Enums"]["app_role"];
          created_at?: string;
          driver_access?: string;
          phone?: string;
        };
        Relationships: [
        ];
      };
      shipment_updates: {
        Row: {
          id: string;
          shipment_id: string;
          driver_id: string | null;
          actor_id: string;
          status: Database["public"]["Enums"]["shipment_status"];
          note: string;
          latitude: number | null;
          longitude: number | null;
          sync_status: Database["public"]["Enums"]["sync_status"];
          occurred_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          shipment_id: string;
          driver_id?: string | null;
          actor_id: string;
          status: Database["public"]["Enums"]["shipment_status"];
          note?: string;
          latitude?: number | null;
          longitude?: number | null;
          sync_status?: Database["public"]["Enums"]["sync_status"];
          occurred_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          shipment_id?: string;
          driver_id?: string | null;
          actor_id?: string;
          status?: Database["public"]["Enums"]["shipment_status"];
          note?: string;
          latitude?: number | null;
          longitude?: number | null;
          sync_status?: Database["public"]["Enums"]["sync_status"];
          occurred_at?: string;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "shipment_updates_shipment_id_fkey"; columns: ["shipment_id"]; isOneToOne: false; referencedRelation: "shipments"; referencedColumns: ["id"] },
          { foreignKeyName: "shipment_updates_driver_id_fkey"; columns: ["driver_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "shipment_updates_actor_id_fkey"; columns: ["actor_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      shipments: {
        Row: {
          id: string;
          shipment_number: string;
          trader_id: string;
          driver_id: string | null;
          origin: string;
          destination: string;
          cargo_type: string;
          cargo_description: string;
          quantity: number;
          quantity_unit: string;
          pickup_date: string;
          route_gate_id: string;
          status: Database["public"]["Enums"]["shipment_status"];
          current_lat: number | null;
          current_lng: number | null;
          special_notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shipment_number?: string;
          trader_id: string;
          driver_id?: string | null;
          origin: string;
          destination: string;
          cargo_type: string;
          cargo_description: string;
          quantity: number;
          quantity_unit?: string;
          pickup_date: string;
          route_gate_id: string;
          status?: Database["public"]["Enums"]["shipment_status"];
          current_lat?: number | null;
          current_lng?: number | null;
          special_notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shipment_number?: string;
          trader_id?: string;
          driver_id?: string | null;
          origin?: string;
          destination?: string;
          cargo_type?: string;
          cargo_description?: string;
          quantity?: number;
          quantity_unit?: string;
          pickup_date?: string;
          route_gate_id?: string;
          status?: Database["public"]["Enums"]["shipment_status"];
          current_lat?: number | null;
          current_lng?: number | null;
          special_notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "shipments_trader_id_fkey"; columns: ["trader_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "shipments_driver_id_fkey"; columns: ["driver_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "shipments_route_gate_id_fkey"; columns: ["route_gate_id"]; isOneToOne: false; referencedRelation: "gate_statuses"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      activate_invited_driver: { Args: Record<string, never>; Returns: string };
      append_driver_update: { Args: { p_id: string | null; p_shipment_id: string | null; p_expected_updated_at: string | null; p_status: Database["public"]["Enums"]["shipment_status"] | null; p_note: string | null; p_latitude: number | null; p_longitude: number | null; p_occurred_at: string | null }; Returns: string };
      broadcast_alert: { Args: { p_title: string | null; p_message: string | null }; Returns: number };
      change_gate_status: { Args: { p_id: string | null; p_expected_updated_at: string | null; p_status: Database["public"]["Enums"]["gate_status"] | null; p_reason: string | null }; Returns: string };
      create_shipment: { Args: { p_input: Json | null }; Returns: string };
      edit_requested_shipment: { Args: { p_shipment_id: string | null; p_expected_updated_at: string | null; p_input: Json | null }; Returns: string };
      finalize_driver_invitation: { Args: { p_invitation_id: string | null; p_user_id: string | null }; Returns: string };
      manage_shipment: { Args: { p_id: string | null; p_expected_updated_at: string | null; p_action: string | null; p_driver_id: string | null; p_status: Database["public"]["Enums"]["shipment_status"] | null; p_note: string | null }; Returns: string };
      mark_alert_read: { Args: { p_id: string | null; p_is_read: boolean | null }; Returns: string };
      register_shipment_document: { Args: { p_id: string | null; p_shipment_id: string | null; p_document_type: string | null; p_original_name: string | null; p_mime_type: string | null; p_size_bytes: number | null; p_extension: string | null }; Returns: string };
      reserve_driver_invitation: { Args: { p_full_name: string | null; p_email: string | null; p_phone: string | null; p_retry_id: string | null }; Returns: string };
      set_driver_access: { Args: { p_driver_id: string | null; p_expected_access: string | null; p_enable: boolean | null }; Returns: string };
      shipment_driver_name: { Args: { p_shipment_id: string | null }; Returns: string };
      shipment_milestones: { Args: { p_shipment_id: string | null }; Returns: Json };
    };
    Enums: {
      app_role: "admin" | "trader" | "driver";
      gate_status: "open" | "delayed" | "closed";
      shipment_status: "requested" | "approved" | "picked_up" | "in_transit" | "arrived_at_checkpoint" | "customs" | "delivered";
      sync_status: "pending" | "synced";
    };
    CompositeTypes: { [_ in never]: never };
  };
};
