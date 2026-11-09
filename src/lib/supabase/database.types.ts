// Generado desde el esquema de Supabase (generate_typescript_types). No editar a mano.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      assets: {
        Row: {
          broker: string;
          created_at: string;
          currency: string;
          id: string;
          isin: string | null;
          kind: string;
          market: string | null;
          name: string;
          price_source: string;
          price_symbol: string | null;
          symbol: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          broker?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          isin?: string | null;
          kind?: string;
          market?: string | null;
          name: string;
          price_source?: string;
          price_symbol?: string | null;
          symbol?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          broker?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          isin?: string | null;
          kind?: string;
          market?: string | null;
          name?: string;
          price_source?: string;
          price_symbol?: string | null;
          symbol?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      investment_operations: {
        Row: {
          asset_id: string;
          cash_eur_cents: number | null;
          created_at: string;
          external_id: string | null;
          gross_local: number | null;
          id: string;
          is_split: boolean;
          notes: string | null;
          price: number | null;
          quantity: number;
          source: string;
          trade_date: string;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          asset_id: string;
          cash_eur_cents?: number | null;
          created_at?: string;
          external_id?: string | null;
          gross_local?: number | null;
          id?: string;
          is_split?: boolean;
          notes?: string | null;
          price?: number | null;
          quantity?: number;
          source?: string;
          trade_date: string;
          type: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          asset_id?: string;
          cash_eur_cents?: number | null;
          created_at?: string;
          external_id?: string | null;
          gross_local?: number | null;
          id?: string;
          is_split?: boolean;
          notes?: string | null;
          price?: number | null;
          quantity?: number;
          source?: string;
          trade_date?: string;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      asset_prices: {
        Row: {
          asset_id: string;
          close: number;
          price_date: string;
          source: string;
          user_id: string;
        };
        Insert: {
          asset_id: string;
          close: number;
          price_date: string;
          source?: string;
          user_id?: string;
        };
        Update: {
          asset_id?: string;
          close?: number;
          price_date?: string;
          source?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      fx_rates: {
        Row: {
          currency: string;
          eur_per_unit: number;
          rate_date: string;
          user_id: string;
        };
        Insert: {
          currency: string;
          eur_per_unit: number;
          rate_date: string;
          user_id?: string;
        };
        Update: {
          currency?: string;
          eur_per_unit?: number;
          rate_date?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      budgets: {
        Row: {
          amount_cents: number;
          category_id: string;
          created_at: string;
          id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount_cents: number;
          category_id: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          amount_cents?: number;
          category_id?: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      recurring_payments: {
        Row: {
          account_id: string | null;
          active: boolean;
          amount_cents: number;
          category_id: string | null;
          created_at: string;
          frequency: string;
          id: string;
          match_pattern: string | null;
          name: string;
          next_due: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          active?: boolean;
          amount_cents: number;
          category_id?: string | null;
          created_at?: string;
          frequency?: string;
          id?: string;
          match_pattern?: string | null;
          name: string;
          next_due: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          account_id?: string | null;
          active?: boolean;
          amount_cents?: number;
          category_id?: string | null;
          created_at?: string;
          frequency?: string;
          id?: string;
          match_pattern?: string | null;
          name?: string;
          next_due?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      savings_goals: {
        Row: {
          account_id: string | null;
          archived: boolean;
          created_at: string;
          id: string;
          name: string;
          saved_cents: number;
          target_cents: number;
          target_date: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          archived?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          saved_cents?: number;
          target_cents: number;
          target_date?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          account_id?: string | null;
          archived?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          saved_cents?: number;
          target_cents?: number;
          target_date?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      body_measurements: {
        Row: {
          arm_cm: number | null;
          body_fat_pct: number | null;
          chest_cm: number | null;
          created_at: string;
          id: string;
          measured_on: string;
          notes: string | null;
          thigh_cm: number | null;
          updated_at: string;
          user_id: string;
          waist_cm: number | null;
          weight_kg: number | null;
        };
        Insert: {
          arm_cm?: number | null;
          body_fat_pct?: number | null;
          chest_cm?: number | null;
          created_at?: string;
          id?: string;
          measured_on: string;
          notes?: string | null;
          thigh_cm?: number | null;
          updated_at?: string;
          user_id?: string;
          waist_cm?: number | null;
          weight_kg?: number | null;
        };
        Update: {
          arm_cm?: number | null;
          body_fat_pct?: number | null;
          chest_cm?: number | null;
          created_at?: string;
          id?: string;
          measured_on?: string;
          notes?: string | null;
          thigh_cm?: number | null;
          updated_at?: string;
          user_id?: string;
          waist_cm?: number | null;
          weight_kg?: number | null;
        };
        Relationships: [];
      };
      gym_exercises: {
        Row: {
          created_at: string;
          hevy_template_id: string | null;
          id: string;
          muscle_group: string;
          muscle_group_manual: boolean;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          hevy_template_id?: string | null;
          id?: string;
          muscle_group?: string;
          muscle_group_manual?: boolean;
          name: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          hevy_template_id?: string | null;
          id?: string;
          muscle_group?: string;
          muscle_group_manual?: boolean;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      gym_sets: {
        Row: {
          distance_m: number | null;
          duration_s: number | null;
          exercise_id: string;
          exercise_index: number;
          exercise_notes: string | null;
          id: string;
          reps: number | null;
          rpe: number | null;
          set_index: number;
          set_type: string;
          superset_id: number | null;
          user_id: string;
          weight_kg: number | null;
          workout_id: string;
        };
        Insert: {
          distance_m?: number | null;
          duration_s?: number | null;
          exercise_id: string;
          exercise_index: number;
          exercise_notes?: string | null;
          id?: string;
          reps?: number | null;
          rpe?: number | null;
          set_index: number;
          set_type?: string;
          superset_id?: number | null;
          user_id?: string;
          weight_kg?: number | null;
          workout_id: string;
        };
        Update: {
          distance_m?: number | null;
          duration_s?: number | null;
          exercise_id?: string;
          exercise_index?: number;
          exercise_notes?: string | null;
          id?: string;
          reps?: number | null;
          rpe?: number | null;
          set_index?: number;
          set_type?: string;
          superset_id?: number | null;
          user_id?: string;
          weight_kg?: number | null;
          workout_id?: string;
        };
        Relationships: [];
      };
      gym_workouts: {
        Row: {
          created_at: string;
          description: string | null;
          ended_at: string | null;
          external_id: string;
          id: string;
          source: string;
          started_at: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          ended_at?: string | null;
          external_id: string;
          id?: string;
          source?: string;
          started_at: string;
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          ended_at?: string | null;
          external_id?: string;
          id?: string;
          source?: string;
          started_at?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      accounts: {
        Row: {
          archived: boolean;
          created_at: string;
          currency: string;
          id: string;
          initial_balance_cents: number;
          name: string;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          archived?: boolean;
          created_at?: string;
          currency?: string;
          id?: string;
          initial_balance_cents?: number;
          name: string;
          type: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          archived?: boolean;
          created_at?: string;
          currency?: string;
          id?: string;
          initial_balance_cents?: number;
          name?: string;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          name: string;
          parent_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind: string;
          name: string;
          parent_id?: string | null;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          name?: string;
          parent_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      import_profiles: {
        Row: {
          account_id: string | null;
          created_at: string;
          id: string;
          mapping: Json;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          created_at?: string;
          id?: string;
          mapping: Json;
          name: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          account_id?: string | null;
          created_at?: string;
          id?: string;
          mapping?: Json;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "import_profiles_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      integrations: {
        Row: {
          account_email: string | null;
          created_at: string;
          encrypted_token: string | null;
          id: string;
          provider: string;
          scopes: string[];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_email?: string | null;
          created_at?: string;
          encrypted_token?: string | null;
          id?: string;
          provider: string;
          scopes?: string[];
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          account_email?: string | null;
          created_at?: string;
          encrypted_token?: string | null;
          id?: string;
          provider?: string;
          scopes?: string[];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          currency: string;
          display_name: string | null;
          timezone: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          currency?: string;
          display_name?: string | null;
          timezone?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          currency?: string;
          display_name?: string | null;
          timezone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      rules: {
        Row: {
          amount_sign: string;
          category_id: string;
          created_at: string;
          id: string;
          match_type: string;
          pattern: string;
          priority: number;
          user_id: string;
        };
        Insert: {
          amount_sign?: string;
          category_id: string;
          created_at?: string;
          id?: string;
          match_type?: string;
          pattern: string;
          priority?: number;
          user_id?: string;
        };
        Update: {
          amount_sign?: string;
          category_id?: string;
          created_at?: string;
          id?: string;
          match_type?: string;
          pattern?: string;
          priority?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rules_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions: {
        Row: {
          account_id: string;
          amount_cents: number;
          booked_on: string;
          category_id: string | null;
          created_at: string;
          description: string;
          id: string;
          import_hash: string | null;
          notes: string | null;
          source: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id: string;
          amount_cents: number;
          booked_on: string;
          category_id?: string | null;
          created_at?: string;
          description: string;
          id?: string;
          import_hash?: string | null;
          notes?: string | null;
          source?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          account_id?: string;
          amount_cents?: number;
          booked_on?: string;
          category_id?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          import_hash?: string | null;
          notes?: string | null;
          source?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      account_balances: { Args: never; Returns: { account_id: string; balance_cents: number }[] };
      category_spending: {
        Args: { p_from: string; p_to: string };
        Returns: { category_id: string; spent_cents: number }[];
      };
      monthly_cashflow: {
        Args: { p_from: string; p_to: string };
        Returns: { expense_cents: number; income_cents: number; month: string }[];
      };
      net_worth_by_month: {
        Args: { p_from: string; p_to: string };
        Returns: { month: string; net_worth_cents: number }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
