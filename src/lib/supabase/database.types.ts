// Generado desde el esquema de Supabase (generate_typescript_types). No editar a mano.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
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
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
