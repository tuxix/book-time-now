export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          audience: string
          created_at: string
          id: string
          message: string
          sent_by: string | null
          title: string
        }
        Insert: {
          audience?: string
          created_at?: string
          id?: string
          message: string
          sent_by?: string | null
          title: string
        }
        Update: {
          audience?: string
          created_at?: string
          id?: string
          message?: string
          sent_by?: string | null
          title?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean | null
          reservation_id: string
          sender_id: string
          sender_role: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean | null
          reservation_id: string
          sender_id: string
          sender_role: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean | null
          reservation_id?: string
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          is_admin: boolean | null
          phone: string | null
          role: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_admin?: boolean | null
          phone?: string | null
          role: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_admin?: boolean | null
          phone?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      reservation_services: {
        Row: {
          base_price: number | null
          created_at: string
          id: string
          reservation_id: string
          selected_options: Json | null
          service_id: string | null
          service_name: string
          total_price: number | null
        }
        Insert: {
          base_price?: number | null
          created_at?: string
          id?: string
          reservation_id: string
          selected_options?: Json | null
          service_id?: string | null
          service_name: string
          total_price?: number | null
        }
        Update: {
          base_price?: number | null
          created_at?: string
          id?: string
          reservation_id?: string
          selected_options?: Json | null
          service_id?: string | null
          service_name?: string
          total_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_services_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          cancelled_by: string | null
          checkin_code: string | null
          commitment_fee_amount: number | null
          created_at: string
          customer_id: string
          end_time: string
          fee: number | null
          id: string
          payment_status: string | null
          refund_amount: number | null
          reservation_date: string
          retained_amount: number | null
          start_time: string
          status: string
          store_id: string
          total_amount: number | null
        }
        Insert: {
          cancelled_by?: string | null
          checkin_code?: string | null
          commitment_fee_amount?: number | null
          created_at?: string
          customer_id: string
          end_time: string
          fee?: number | null
          id?: string
          payment_status?: string | null
          refund_amount?: number | null
          reservation_date: string
          retained_amount?: number | null
          start_time: string
          status?: string
          store_id: string
          total_amount?: number | null
        }
        Update: {
          cancelled_by?: string | null
          checkin_code?: string | null
          commitment_fee_amount?: number | null
          created_at?: string
          customer_id?: string
          end_time?: string
          fee?: number | null
          id?: string
          payment_status?: string | null
          refund_amount?: number | null
          reservation_date?: string
          retained_amount?: number | null
          start_time?: string
          status?: string
          store_id?: string
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          customer_id: string
          id: string
          rating: number
          reservation_id: string
          store_id: string
          store_reply: string | null
          store_reply_at: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_id: string
          id?: string
          rating: number
          reservation_id: string
          store_id: string
          store_reply?: string | null
          store_reply_at?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          rating?: number
          reservation_id?: string
          store_id?: string
          store_reply?: string | null
          store_reply_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: true
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      service_option_groups: {
        Row: {
          id: string
          label: string
          required: boolean | null
          selection_type: string
          service_id: string
          sort_order: number | null
        }
        Insert: {
          id?: string
          label: string
          required?: boolean | null
          selection_type?: string
          service_id: string
          sort_order?: number | null
        }
        Update: {
          id?: string
          label?: string
          required?: boolean | null
          selection_type?: string
          service_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_option_groups_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "store_services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_option_items: {
        Row: {
          group_id: string
          id: string
          label: string
          price_modifier: number | null
          sort_order: number | null
        }
        Insert: {
          group_id: string
          id?: string
          label: string
          price_modifier?: number | null
          sort_order?: number | null
        }
        Update: {
          group_id?: string
          id?: string
          label?: string
          price_modifier?: number | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_option_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "service_option_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      store_photos: {
        Row: {
          caption: string | null
          created_at: string
          display_order: number | null
          id: string
          image_url: string
          is_cover: boolean | null
          store_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          image_url: string
          is_cover?: boolean | null
          store_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          image_url?: string
          is_cover?: boolean | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_photos_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_services: {
        Row: {
          base_price: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          store_id: string
        }
        Insert: {
          base_price?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          store_id: string
        }
        Update: {
          base_price?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_services_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_time_slots: {
        Row: {
          capacity: number | null
          day_of_week: number
          end_time: string
          id: string
          is_available: boolean | null
          start_time: string
          store_id: string
        }
        Insert: {
          capacity?: number | null
          day_of_week: number
          end_time: string
          id?: string
          is_available?: boolean | null
          start_time: string
          store_id: string
        }
        Update: {
          capacity?: number | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_available?: boolean | null
          start_time?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_time_slots_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          accepting_bookings: boolean | null
          address: string | null
          announcement: string | null
          avatar_url: string | null
          base_service_price: number | null
          buffer_minutes: number | null
          cancellation_hours: number | null
          categories: string[] | null
          category: string | null
          category_locked_until: string | null
          created_at: string
          daily_bookings_count: number | null
          daily_bookings_date: string | null
          description: string | null
          id: string
          image: string | null
          is_open: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          phone: string | null
          primary_category: string | null
          rating: number | null
          review_count: number | null
          subscription_tier: string | null
          user_id: string
        }
        Insert: {
          accepting_bookings?: boolean | null
          address?: string | null
          announcement?: string | null
          avatar_url?: string | null
          base_service_price?: number | null
          buffer_minutes?: number | null
          cancellation_hours?: number | null
          categories?: string[] | null
          category?: string | null
          category_locked_until?: string | null
          created_at?: string
          daily_bookings_count?: number | null
          daily_bookings_date?: string | null
          description?: string | null
          id?: string
          image?: string | null
          is_open?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          phone?: string | null
          primary_category?: string | null
          rating?: number | null
          review_count?: number | null
          subscription_tier?: string | null
          user_id: string
        }
        Update: {
          accepting_bookings?: boolean | null
          address?: string | null
          announcement?: string | null
          avatar_url?: string | null
          base_service_price?: number | null
          buffer_minutes?: number | null
          cancellation_hours?: number | null
          categories?: string[] | null
          category?: string | null
          category_locked_until?: string | null
          created_at?: string
          daily_bookings_count?: number | null
          daily_bookings_date?: string | null
          description?: string | null
          id?: string
          image?: string | null
          is_open?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone?: string | null
          primary_category?: string | null
          rating?: number | null
          review_count?: number | null
          subscription_tier?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
