export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      accounts: {
        Row: {
          archived: boolean;
          created_at: string;
          currency: string;
          id: string;
          initial_balance_cents: number;
          manual_balance_cents: number | null;
          manual_balance_on: string | null;
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
          manual_balance_cents?: number | null;
          manual_balance_on?: string | null;
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
          manual_balance_cents?: number | null;
          manual_balance_on?: string | null;
          name?: string;
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
        Relationships: [
          {
            foreignKeyName: "asset_prices_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
        ];
      };
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
      body_measurements: {
        Row: {
          abdomen_cm: number | null;
          arm_cm: number | null;
          body_fat_pct: number | null;
          calf_cm: number | null;
          chest_cm: number | null;
          created_at: string;
          hip_cm: number | null;
          id: string;
          measured_on: string;
          notes: string | null;
          shoulder_cm: number | null;
          thigh_cm: number | null;
          updated_at: string;
          user_id: string;
          waist_cm: number | null;
          weight_kg: number | null;
        };
        Insert: {
          abdomen_cm?: number | null;
          arm_cm?: number | null;
          body_fat_pct?: number | null;
          calf_cm?: number | null;
          chest_cm?: number | null;
          created_at?: string;
          hip_cm?: number | null;
          id?: string;
          measured_on: string;
          notes?: string | null;
          shoulder_cm?: number | null;
          thigh_cm?: number | null;
          updated_at?: string;
          user_id?: string;
          waist_cm?: number | null;
          weight_kg?: number | null;
        };
        Update: {
          abdomen_cm?: number | null;
          arm_cm?: number | null;
          body_fat_pct?: number | null;
          calf_cm?: number | null;
          chest_cm?: number | null;
          created_at?: string;
          hip_cm?: number | null;
          id?: string;
          measured_on?: string;
          notes?: string | null;
          shoulder_cm?: number | null;
          thigh_cm?: number | null;
          updated_at?: string;
          user_id?: string;
          waist_cm?: number | null;
          weight_kg?: number | null;
        };
        Relationships: [];
      };
      brain_links: {
        Row: {
          a: string;
          b: string;
          created_at: string;
          user_id: string;
        };
        Insert: {
          a: string;
          b: string;
          created_at?: string;
          user_id?: string;
        };
        Update: {
          a?: string;
          b?: string;
          created_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brain_links_a_fkey";
            columns: ["a"];
            isOneToOne: false;
            referencedRelation: "brain_memories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brain_links_b_fkey";
            columns: ["b"];
            isOneToOne: false;
            referencedRelation: "brain_memories";
            referencedColumns: ["id"];
          },
        ];
      };
      brain_memories: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          source: string;
          tags: string[];
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          source?: string;
          tags?: string[];
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          source?: string;
          tags?: string[];
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      brain_tokens: {
        Row: {
          created_at: string;
          id: string;
          label: string;
          last_used_at: string | null;
          token_hash: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          label?: string;
          last_used_at?: string | null;
          token_hash: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          label?: string;
          last_used_at?: string | null;
          token_hash?: string;
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
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "investment_operations_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
        ];
      };
      net_worth_snapshots: {
        Row: {
          cash_cents: number;
          created_at: string;
          day: string;
          investments_cents: number;
          total_cents: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cash_cents: number;
          created_at?: string;
          day: string;
          investments_cents: number;
          total_cents?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          cash_cents?: number;
          created_at?: string;
          day?: string;
          investments_cents?: number;
          total_cents?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      nutrition_cheats: {
        Row: {
          ai_notes: string | null;
          carbs_g: number | null;
          created_at: string;
          description: string;
          eaten_on: string;
          estimated_by: string;
          fat_g: number | null;
          id: string;
          kcal: number | null;
          protein_g: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          ai_notes?: string | null;
          carbs_g?: number | null;
          created_at?: string;
          description: string;
          eaten_on: string;
          estimated_by?: string;
          fat_g?: number | null;
          id?: string;
          kcal?: number | null;
          protein_g?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          ai_notes?: string | null;
          carbs_g?: number | null;
          created_at?: string;
          description?: string;
          eaten_on?: string;
          estimated_by?: string;
          fat_g?: number | null;
          id?: string;
          kcal?: number | null;
          protein_g?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      nutrition_foods: {
        Row: {
          carbs_g: number;
          category: string;
          cooked_factor: number | null;
          cooked_from: string | null;
          created_at: string;
          fat_g: number;
          id: string;
          kcal: number;
          name: string;
          price_cents_per_kg: number | null;
          price_source: string | null;
          protein_g: number;
          source: string;
          unit_grams: number | null;
          unit_label: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          carbs_g?: number;
          category?: string;
          cooked_factor?: number | null;
          cooked_from?: string | null;
          created_at?: string;
          fat_g?: number;
          id?: string;
          kcal: number;
          name: string;
          price_cents_per_kg?: number | null;
          price_source?: string | null;
          protein_g?: number;
          source?: string;
          unit_grams?: number | null;
          unit_label?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          carbs_g?: number;
          category?: string;
          cooked_factor?: number | null;
          cooked_from?: string | null;
          created_at?: string;
          fat_g?: number;
          id?: string;
          kcal?: number;
          name?: string;
          price_cents_per_kg?: number | null;
          price_source?: string | null;
          protein_g?: number;
          source?: string;
          unit_grams?: number | null;
          unit_label?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nutrition_foods_cooked_from_fkey";
            columns: ["cooked_from"];
            isOneToOne: false;
            referencedRelation: "nutrition_foods";
            referencedColumns: ["id"];
          },
        ];
      };
      nutrition_logs: {
        Row: {
          created_at: string;
          eaten_on: string;
          food_id: string;
          grams: number;
          group_id: string | null;
          id: string;
          meal_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          eaten_on: string;
          food_id: string;
          grams: number;
          group_id?: string | null;
          id?: string;
          meal_id?: string | null;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          eaten_on?: string;
          food_id?: string;
          grams?: number;
          group_id?: string | null;
          id?: string;
          meal_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nutrition_logs_food_id_fkey";
            columns: ["food_id"];
            isOneToOne: false;
            referencedRelation: "nutrition_foods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nutrition_logs_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "nutrition_plan_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nutrition_logs_meal_id_fkey";
            columns: ["meal_id"];
            isOneToOne: false;
            referencedRelation: "nutrition_plan_meals";
            referencedColumns: ["id"];
          },
        ];
      };
      nutrition_meal_checks: {
        Row: {
          day: string;
          id: string;
          meal_id: string;
          note: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          day: string;
          id?: string;
          meal_id: string;
          note?: string | null;
          status: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          day?: string;
          id?: string;
          meal_id?: string;
          note?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nutrition_meal_checks_meal_id_fkey";
            columns: ["meal_id"];
            isOneToOne: false;
            referencedRelation: "nutrition_plan_meals";
            referencedColumns: ["id"];
          },
        ];
      };
      nutrition_plan_groups: {
        Row: {
          id: string;
          kind: string;
          meal_id: string;
          name: string;
          notes: string | null;
          position: number;
          user_id: string;
        };
        Insert: {
          id?: string;
          kind: string;
          meal_id: string;
          name: string;
          notes?: string | null;
          position?: number;
          user_id?: string;
        };
        Update: {
          id?: string;
          kind?: string;
          meal_id?: string;
          name?: string;
          notes?: string | null;
          position?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nutrition_plan_groups_meal_id_fkey";
            columns: ["meal_id"];
            isOneToOne: false;
            referencedRelation: "nutrition_plan_meals";
            referencedColumns: ["id"];
          },
        ];
      };
      nutrition_plan_meals: {
        Row: {
          id: string;
          name: string;
          notes: string | null;
          plan_id: string;
          position: number;
          user_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          notes?: string | null;
          plan_id: string;
          position?: number;
          user_id?: string;
        };
        Update: {
          id?: string;
          name?: string;
          notes?: string | null;
          plan_id?: string;
          position?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nutrition_plan_meals_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "nutrition_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      nutrition_plan_options: {
        Row: {
          amount: number;
          food_id: string;
          group_id: string;
          id: string;
          position: number;
          unit: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          food_id: string;
          group_id: string;
          id?: string;
          position?: number;
          unit?: string;
          user_id?: string;
        };
        Update: {
          amount?: number;
          food_id?: string;
          group_id?: string;
          id?: string;
          position?: number;
          unit?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nutrition_plan_options_food_id_fkey";
            columns: ["food_id"];
            isOneToOne: false;
            referencedRelation: "nutrition_foods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nutrition_plan_options_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "nutrition_plan_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      nutrition_plans: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          name: string;
          notes: string | null;
          starts_on: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          notes?: string | null;
          starts_on?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          starts_on?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      nutrition_reviews: {
        Row: {
          adherence: number | null;
          created_at: string;
          id: string;
          notes: string | null;
          phase: string | null;
          review_on: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          adherence?: number | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          phase?: string | null;
          review_on: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          adherence?: number | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          phase?: string | null;
          review_on?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      nutrition_settings: {
        Row: {
          review_sheet_id: string | null;
          reviews_synced_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          review_sheet_id?: string | null;
          reviews_synced_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          review_sheet_id?: string | null;
          reviews_synced_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      nutrition_shopping_picks: {
        Row: {
          days_per_week: number;
          id: string;
          option_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          days_per_week: number;
          id?: string;
          option_id: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          days_per_week?: number;
          id?: string;
          option_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nutrition_shopping_picks_option_id_fkey";
            columns: ["option_id"];
            isOneToOne: false;
            referencedRelation: "nutrition_plan_options";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          currency: string;
          display_name: string | null;
          monthly_salary_cents: number | null;
          timezone: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          currency?: string;
          display_name?: string | null;
          monthly_salary_cents?: number | null;
          timezone?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          currency?: string;
          display_name?: string | null;
          monthly_salary_cents?: number | null;
          timezone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      property_listings: {
        Row: {
          confidence: string;
          created_at: string;
          data: Json;
          discard_reason: string;
          first_price_cents: number;
          first_seen_at: string;
          id: string;
          last_checked_at: string;
          listing_state: string;
          municipality: string;
          neighborhood: string;
          price_cents: number;
          removed_at: string | null;
          seen_at: string | null;
          rooms: number | null;
          source: string;
          sqm: number | null;
          status: string;
          title: string;
          updated_at: string;
          url: string;
          url_key: string | null;
          user_id: string;
          user_notes: string;
        };
        Insert: {
          confidence?: string;
          created_at?: string;
          data?: Json;
          discard_reason?: string;
          first_price_cents: number;
          first_seen_at?: string;
          id?: string;
          last_checked_at?: string;
          listing_state?: string;
          municipality: string;
          neighborhood?: string;
          price_cents: number;
          removed_at?: string | null;
          seen_at?: string | null;
          rooms?: number | null;
          source?: string;
          sqm?: number | null;
          status?: string;
          title?: string;
          updated_at?: string;
          url: string;
          url_key?: string | null;
          user_id?: string;
          user_notes?: string;
        };
        Update: {
          confidence?: string;
          created_at?: string;
          data?: Json;
          discard_reason?: string;
          first_price_cents?: number;
          first_seen_at?: string;
          id?: string;
          last_checked_at?: string;
          listing_state?: string;
          municipality?: string;
          neighborhood?: string;
          price_cents?: number;
          removed_at?: string | null;
          seen_at?: string | null;
          rooms?: number | null;
          source?: string;
          sqm?: number | null;
          status?: string;
          title?: string;
          updated_at?: string;
          url?: string;
          url_key?: string | null;
          user_id?: string;
          user_notes?: string;
        };
        Relationships: [];
      };
      property_price_history: {
        Row: {
          id: number;
          listing_id: string;
          price_cents: number;
          seen_at: string;
          user_id: string;
        };
        Insert: {
          id?: never;
          listing_id: string;
          price_cents: number;
          seen_at?: string;
          user_id?: string;
        };
        Update: {
          id?: never;
          listing_id?: string;
          price_cents?: number;
          seen_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_price_history_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "property_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      property_runs: {
        Row: {
          examined: number;
          id: string;
          ran_at: string;
          saved: number;
          summary: string;
          user_id: string;
        };
        Insert: {
          examined?: number;
          id?: string;
          ran_at?: string;
          saved?: number;
          summary?: string;
          user_id?: string;
        };
        Update: {
          examined?: number;
          id?: string;
          ran_at?: string;
          saved?: number;
          summary?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      property_settings: {
        Row: {
          assumptions: Json;
          criteria: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          assumptions?: Json;
          criteria?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          assumptions?: Json;
          criteria?: Json;
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
        Relationships: [
          {
            foreignKeyName: "recurring_payments_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_payments_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
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
      scheduled_tasks: {
        Row: {
          archived: boolean;
          created_at: string;
          criteria: Json;
          description: string;
          fields: Json;
          id: string;
          name: string;
          schedule: string;
          slug: string;
          special_view: string | null;
          updated_at: string;
          user_id: string;
          view: string | null;
        };
        Insert: {
          archived?: boolean;
          created_at?: string;
          criteria?: Json;
          description?: string;
          fields?: Json;
          id?: string;
          name: string;
          schedule?: string;
          slug: string;
          special_view?: string | null;
          updated_at?: string;
          user_id?: string;
          view?: string | null;
        };
        Update: {
          archived?: boolean;
          created_at?: string;
          criteria?: Json;
          description?: string;
          fields?: Json;
          id?: string;
          name?: string;
          schedule?: string;
          slug?: string;
          special_view?: string | null;
          updated_at?: string;
          user_id?: string;
          view?: string | null;
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
        Relationships: [
          {
            foreignKeyName: "savings_goals_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      statement_files: {
        Row: {
          account_id: string;
          balance_ok: boolean | null;
          drive_file_id: string;
          id: string;
          inserted: number;
          name: string;
          period: string | null;
          processed_at: string;
          rows_found: number;
          user_id: string;
        };
        Insert: {
          account_id: string;
          balance_ok?: boolean | null;
          drive_file_id: string;
          id?: string;
          inserted?: number;
          name: string;
          period?: string | null;
          processed_at?: string;
          rows_found?: number;
          user_id?: string;
        };
        Update: {
          account_id?: string;
          balance_ok?: boolean | null;
          drive_file_id?: string;
          id?: string;
          inserted?: number;
          name?: string;
          period?: string | null;
          processed_at?: string;
          rows_found?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      task_items: {
        Row: {
          changed_at: string | null;
          data: Json;
          first_seen_at: string;
          history: Json;
          id: string;
          item_key: string;
          last_seen_at: string;
          removed_at: string | null;
          status: string;
          task_id: string;
          user_id: string;
        };
        Insert: {
          changed_at?: string | null;
          data?: Json;
          first_seen_at?: string;
          history?: Json;
          id?: string;
          item_key: string;
          last_seen_at?: string;
          removed_at?: string | null;
          status?: string;
          task_id: string;
          user_id?: string;
        };
        Update: {
          changed_at?: string | null;
          data?: Json;
          first_seen_at?: string;
          history?: Json;
          id?: string;
          item_key?: string;
          last_seen_at?: string;
          removed_at?: string | null;
          status?: string;
          task_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_items_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "scheduled_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      task_runs: {
        Row: {
          found: number;
          id: string;
          ok: boolean;
          ran_at: string;
          removed: number;
          summary: string;
          task_id: string;
          user_id: string;
        };
        Insert: {
          found?: number;
          id?: string;
          ok?: boolean;
          ran_at?: string;
          removed?: number;
          summary?: string;
          task_id: string;
          user_id?: string;
        };
        Update: {
          found?: number;
          id?: string;
          ok?: boolean;
          ran_at?: string;
          removed?: number;
          summary?: string;
          task_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_runs_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "scheduled_tasks";
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
      wardrobe_garments: {
        Row: {
          color_details: Json;
          fabric: string | null;
          formality: number;
          needs_review: boolean;
          pattern: string;
          category: string;
          colors: string[];
          created_at: string;
          cutout: boolean;
          id: string;
          image_path: string;
          name: string;
          occasions: string[];
          updated_at: string;
          user_id: string;
          warmth: number;
        };
        Insert: {
          color_details?: Json;
          fabric?: string | null;
          formality?: number;
          needs_review?: boolean;
          pattern?: string;
          category: string;
          colors?: string[];
          created_at?: string;
          cutout?: boolean;
          id?: string;
          image_path: string;
          name: string;
          occasions?: string[];
          updated_at?: string;
          user_id?: string;
          warmth?: number;
        };
        Update: {
          color_details?: Json;
          fabric?: string | null;
          formality?: number;
          needs_review?: boolean;
          pattern?: string;
          category?: string;
          colors?: string[];
          created_at?: string;
          cutout?: boolean;
          id?: string;
          image_path?: string;
          name?: string;
          occasions?: string[];
          updated_at?: string;
          user_id?: string;
          warmth?: number;
        };
        Relationships: [];
      };
      wardrobe_outfit_items: {
        Row: {
          garment_id: string;
          outfit_id: string;
          user_id: string;
        };
        Insert: {
          garment_id: string;
          outfit_id: string;
          user_id?: string;
        };
        Update: {
          garment_id?: string;
          outfit_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wardrobe_outfit_items_garment_id_fkey";
            columns: ["garment_id"];
            isOneToOne: false;
            referencedRelation: "wardrobe_garments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_outfit_items_outfit_id_fkey";
            columns: ["outfit_id"];
            isOneToOne: false;
            referencedRelation: "wardrobe_outfits";
            referencedColumns: ["id"];
          },
        ];
      };
      wardrobe_outfits: {
        Row: {
          favorite: boolean;
          created_at: string;
          id: string;
          name: string;
          note: string | null;
          occasion: string | null;
          user_id: string;
        };
        Insert: {
          favorite?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          note?: string | null;
          occasion?: string | null;
          user_id?: string;
        };
        Update: {
          favorite?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          note?: string | null;
          occasion?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      wardrobe_settings: {
        Row: {
          city: string | null;
          latitude: number | null;
          longitude: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          city?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          city?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      wardrobe_wears: {
        Row: {
          created_at: string;
          garment_id: string;
          user_id: string;
          worn_on: string;
        };
        Insert: {
          created_at?: string;
          garment_id: string;
          user_id?: string;
          worn_on: string;
        };
        Update: {
          created_at?: string;
          garment_id?: string;
          user_id?: string;
          worn_on?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wardrobe_wears_garment_id_fkey";
            columns: ["garment_id"];
            isOneToOne: false;
            referencedRelation: "wardrobe_garments";
            referencedColumns: ["id"];
          },
        ];
      };
      user_api_keys: {
        Row: {
          created_at: string;
          encrypted_key: string;
          hint: string;
          id: string;
          provider: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          encrypted_key: string;
          hint: string;
          id?: string;
          provider: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          encrypted_key?: string;
          hint?: string;
          id?: string;
          provider?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_invite: { Args: { p_email: string }; Returns: undefined };
      is_admin: { Args: never; Returns: boolean };
      list_invites: {
        Args: never;
        Returns: { email: string; invited_at: string; joined: boolean; is_admin: boolean }[];
      };
      remove_invite: { Args: { p_email: string }; Returns: undefined };
      account_balances: {
        Args: never;
        Returns: {
          account_id: string;
          balance_cents: number;
        }[];
      };
      account_last_movements: {
        Args: never;
        Returns: {
          account_id: string;
          last_booked_on: string;
        }[];
      };
      brain_call: {
        Args: { p_action: string; p_args?: Json; p_token: string };
        Returns: Json;
      };
      category_spending: {
        Args: { p_from: string; p_to: string };
        Returns: {
          category_id: string;
          spent_cents: number;
        }[];
      };
      monthly_cashflow: {
        Args: { p_from: string; p_to: string };
        Returns: {
          expense_cents: number;
          income_cents: number;
          month: string;
        }[];
      };
      net_worth_by_month: {
        Args: { p_from: string; p_to: string };
        Returns: {
          month: string;
          net_worth_cents: number;
        }[];
      };
      property_call: {
        Args: { p_action: string; p_args?: Json; p_token: string };
        Returns: Json;
      };
      task_call: {
        Args: { p_action: string; p_args?: Json; p_token: string };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
