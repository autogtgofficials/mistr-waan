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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      booking_notes: {
        Row: {
          author: string
          body: string
          booking_id: string
          created_at: string
          id: string
        }
        Insert: {
          author: string
          body: string
          booking_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author?: string
          body?: string
          booking_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_notes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_photos: {
        Row: {
          booking_id: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          booking_id: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          booking_id?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_photos_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          assigned_at: string | null
          base_total: number | null
          bucket: Database["public"]["Enums"]["booking_bucket"]
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          denting: Json | null
          garage_id: string | null
          id: string
          in_progress_at: string | null
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          profile_id: string
          queued_for_call_at: string
          quoted_at: string | null
          rating_comment: string | null
          rating_value: number | null
          service_ids: string[]
          short_id: string
          slot_date: string | null
          slot_label: string
          slot_time: string | null
          status: Database["public"]["Enums"]["booking_status"]
          symptoms: Json | null
          total: number | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          base_total?: number | null
          bucket: Database["public"]["Enums"]["booking_bucket"]
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          denting?: Json | null
          garage_id?: string | null
          id?: string
          in_progress_at?: string | null
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          profile_id: string
          queued_for_call_at?: string
          quoted_at?: string | null
          rating_comment?: string | null
          rating_value?: number | null
          service_ids?: string[]
          short_id: string
          slot_date?: string | null
          slot_label: string
          slot_time?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          symptoms?: Json | null
          total?: number | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          base_total?: number | null
          bucket?: Database["public"]["Enums"]["booking_bucket"]
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          denting?: Json | null
          garage_id?: string | null
          id?: string
          in_progress_at?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          profile_id?: string
          queued_for_call_at?: string
          quoted_at?: string | null
          rating_comment?: string | null
          rating_value?: number | null
          service_ids?: string[]
          short_id?: string
          slot_date?: string | null
          slot_label?: string
          slot_time?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          symptoms?: Json | null
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_garage_id_fkey"
            columns: ["garage_id"]
            isOneToOne: false
            referencedRelation: "garages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      garages: {
        Row: {
          active: boolean
          area: string
          commission_pct: number
          created_at: string
          distance_km: number | null
          earliest_slot: string | null
          full_address: string
          id: string
          jobs_completed: number
          lat: number | null
          lng: number | null
          mechanic_id: string | null
          owner_first_name: string
          owner_last_name: string
          phone: string
          rating: number
          service_buckets: Database["public"]["Enums"]["booking_bucket"][]
          shop_name: string
          slug: string | null
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          active?: boolean
          area: string
          commission_pct?: number
          created_at?: string
          distance_km?: number | null
          earliest_slot?: string | null
          full_address: string
          id?: string
          jobs_completed?: number
          lat?: number | null
          lng?: number | null
          mechanic_id?: string | null
          owner_first_name: string
          owner_last_name: string
          phone: string
          rating?: number
          service_buckets?: Database["public"]["Enums"]["booking_bucket"][]
          shop_name: string
          slug?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          active?: boolean
          area?: string
          commission_pct?: number
          created_at?: string
          distance_km?: number | null
          earliest_slot?: string | null
          full_address?: string
          id?: string
          jobs_completed?: number
          lat?: number | null
          lng?: number | null
          mechanic_id?: string | null
          owner_first_name?: string
          owner_last_name?: string
          phone?: string
          rating?: number
          service_buckets?: Database["public"]["Enums"]["booking_bucket"][]
          shop_name?: string
          slug?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garages_mechanic_id_fkey"
            columns: ["mechanic_id"]
            isOneToOne: false
            referencedRelation: "mechanics"
            referencedColumns: ["id"]
          },
        ]
      }
      mechanics: {
        Row: {
          address: string | null
          area: string | null
          area_source: string | null
          business_profile: Json | null
          call_log: Json | null
          coverage_areas: string[] | null
          detailed_services: string[] | null
          email: string | null
          id: string
          last_updated_at: string
          lat: number | null
          lng: number | null
          name: string
          next_follow_up_at: string | null
          next_follow_up_note: string | null
          notes: string | null
          onboarding_status: string
          opening_hours: string | null
          osm_rating: number | null
          osm_type: string | null
          outreach_outcome: string | null
          phones: string[]
          pricing: Json | null
          raw_tags: Json | null
          reverse_geocode: Json | null
          review_count: number | null
          scraped_at: string | null
          services: string[]
          shop_name: string | null
          source: string | null
          source_id: string | null
          tags: string[] | null
          website: string | null
        }
        Insert: {
          address?: string | null
          area?: string | null
          area_source?: string | null
          business_profile?: Json | null
          call_log?: Json | null
          coverage_areas?: string[] | null
          detailed_services?: string[] | null
          email?: string | null
          id: string
          last_updated_at?: string
          lat?: number | null
          lng?: number | null
          name: string
          next_follow_up_at?: string | null
          next_follow_up_note?: string | null
          notes?: string | null
          onboarding_status?: string
          opening_hours?: string | null
          osm_rating?: number | null
          osm_type?: string | null
          outreach_outcome?: string | null
          phones?: string[]
          pricing?: Json | null
          raw_tags?: Json | null
          reverse_geocode?: Json | null
          review_count?: number | null
          scraped_at?: string | null
          services?: string[]
          shop_name?: string | null
          source?: string | null
          source_id?: string | null
          tags?: string[] | null
          website?: string | null
        }
        Update: {
          address?: string | null
          area?: string | null
          area_source?: string | null
          business_profile?: Json | null
          call_log?: Json | null
          coverage_areas?: string[] | null
          detailed_services?: string[] | null
          email?: string | null
          id?: string
          last_updated_at?: string
          lat?: number | null
          lng?: number | null
          name?: string
          next_follow_up_at?: string | null
          next_follow_up_note?: string | null
          notes?: string | null
          onboarding_status?: string
          opening_hours?: string | null
          osm_rating?: number | null
          osm_type?: string | null
          outreach_outcome?: string | null
          phones?: string[]
          pricing?: Json | null
          raw_tags?: Json | null
          reverse_geocode?: Json | null
          review_count?: number | null
          scraped_at?: string | null
          services?: string[]
          shop_name?: string | null
          source?: string | null
          source_id?: string | null
          tags?: string[] | null
          website?: string | null
        }
        Relationships: []
      }
      notifications_outbox: {
        Row: {
          body: string | null
          booking_id: string | null
          channel: Database["public"]["Enums"]["notif_channel"]
          created_at: string
          delivered_at: string | null
          direction: Database["public"]["Enums"]["notif_direction"]
          from_phone: string | null
          id: string
          provider: string | null
          provider_message_id: string | null
          raw_payload: Json | null
          read_at: string | null
          sent_at: string | null
          state: Database["public"]["Enums"]["notif_state"]
          state_detail: string | null
          template_name: string | null
          to_phone: string | null
          variables: Json | null
        }
        Insert: {
          body?: string | null
          booking_id?: string | null
          channel: Database["public"]["Enums"]["notif_channel"]
          created_at?: string
          delivered_at?: string | null
          direction: Database["public"]["Enums"]["notif_direction"]
          from_phone?: string | null
          id?: string
          provider?: string | null
          provider_message_id?: string | null
          raw_payload?: Json | null
          read_at?: string | null
          sent_at?: string | null
          state?: Database["public"]["Enums"]["notif_state"]
          state_detail?: string | null
          template_name?: string | null
          to_phone?: string | null
          variables?: Json | null
        }
        Update: {
          body?: string | null
          booking_id?: string | null
          channel?: Database["public"]["Enums"]["notif_channel"]
          created_at?: string
          delivered_at?: string | null
          direction?: Database["public"]["Enums"]["notif_direction"]
          from_phone?: string | null
          id?: string
          provider?: string | null
          provider_message_id?: string | null
          raw_payload?: Json | null
          read_at?: string | null
          sent_at?: string | null
          state?: Database["public"]["Enums"]["notif_state"]
          state_detail?: string | null
          template_name?: string | null
          to_phone?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_outbox_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_users: {
        Row: {
          active: boolean
          created_at: string
          email: string
          id: string
          invite_accepted_at: string | null
          invite_token: string | null
          invited_by: string | null
          last_login_at: string | null
          role: Database["public"]["Enums"]["ops_role"]
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          id?: string
          invite_accepted_at?: string | null
          invite_token?: string | null
          invited_by?: string | null
          last_login_at?: string | null
          role?: Database["public"]["Enums"]["ops_role"]
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          id?: string
          invite_accepted_at?: string | null
          invite_token?: string | null
          invited_by?: string | null
          last_login_at?: string | null
          role?: Database["public"]["Enums"]["ops_role"]
        }
        Relationships: [
          {
            foreignKeyName: "ops_users_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "ops_users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          captured_at: string | null
          created_at: string
          id: string
          mode: Database["public"]["Enums"]["payment_mode"]
          raw_payload: Json | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount: number
          booking_id: string
          captured_at?: string | null
          created_at?: string
          id?: string
          mode: Database["public"]["Enums"]["payment_mode"]
          raw_payload?: Json | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number
          booking_id?: string
          captured_at?: string | null
          created_at?: string
          id?: string
          mode?: Database["public"]["Enums"]["payment_mode"]
          raw_payload?: Json | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          first_name: string | null
          id: string
          language: string | null
          last_seen_at: string | null
          loyalty_points: number
          phone: string
          referral_code: string | null
          referred_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          id?: string
          language?: string | null
          last_seen_at?: string | null
          loyalty_points?: number
          phone: string
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_name?: string | null
          id?: string
          language?: string | null
          last_seen_at?: string | null
          loyalty_points?: number
          phone?: string
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          id: string
          note: string | null
          set_by_actor: string | null
          source: Database["public"]["Enums"]["quote_source"]
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          id?: string
          note?: string | null
          set_by_actor?: string | null
          source: Database["public"]["Enums"]["quote_source"]
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          id?: string
          note?: string | null
          set_by_actor?: string | null
          source?: Database["public"]["Enums"]["quote_source"]
        }
        Relationships: [
          {
            foreignKeyName: "quotes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string
          garage_id: string
          id: string
          profile_id: string
          score: number
          target: Database["public"]["Enums"]["rating_target"]
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string
          garage_id: string
          id?: string
          profile_id: string
          score: number
          target?: Database["public"]["Enums"]["rating_target"]
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string
          garage_id?: string
          id?: string
          profile_id?: string
          score?: number
          target?: Database["public"]["Enums"]["rating_target"]
        }
        Relationships: [
          {
            foreignKeyName: "ratings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_garage_id_fkey"
            columns: ["garage_id"]
            isOneToOne: false
            referencedRelation: "garages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          booking_id: string | null
          code: string
          created_at: string
          id: string
          referee_id: string | null
          referrer_id: string
          reward_amount: number
          rewarded_at: string | null
          state: Database["public"]["Enums"]["referral_state"]
        }
        Insert: {
          booking_id?: string | null
          code: string
          created_at?: string
          id?: string
          referee_id?: string | null
          referrer_id: string
          reward_amount?: number
          rewarded_at?: string | null
          state?: Database["public"]["Enums"]["referral_state"]
        }
        Update: {
          booking_id?: string | null
          code?: string
          created_at?: string
          id?: string
          referee_id?: string | null
          referrer_id?: string
          reward_amount?: number
          rewarded_at?: string | null
          state?: Database["public"]["Enums"]["referral_state"]
        }
        Relationships: [
          {
            foreignKeyName: "referrals_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          base_price: number
          blurb: string | null
          bucket: Database["public"]["Enums"]["booking_bucket"]
          display_order: number
          duration_label: string | null
          id: string
          is_quoted: boolean
          name: string
        }
        Insert: {
          active?: boolean
          base_price: number
          blurb?: string | null
          bucket: Database["public"]["Enums"]["booking_bucket"]
          display_order?: number
          duration_label?: string | null
          id: string
          is_quoted?: boolean
          name: string
        }
        Update: {
          active?: boolean
          base_price?: number
          blurb?: string | null
          bucket?: Database["public"]["Enums"]["booking_bucket"]
          display_order?: number
          duration_label?: string | null
          id?: string
          is_quoted?: boolean
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      actor_role: "customer" | "garage" | "ops" | "system" | "bot"
      booking_bucket: "detailing" | "repairs" | "denting"
      booking_status:
        | "queued_for_call"
        | "quoted"
        | "awaiting_garage"
        | "assigned"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "declined_by_garage"
      garage_response: "accept" | "decline"
      notif_channel: "whatsapp" | "sms" | "email"
      notif_direction: "outbound" | "inbound"
      notif_state: "queued" | "sent" | "delivered" | "read" | "failed"
      ops_role: "ops" | "admin"
      payment_mode: "upi" | "cash"
      payment_status:
        | "pending"
        | "authorized"
        | "captured"
        | "refunded"
        | "failed"
      quote_source: "catalog_fixed" | "ops_manual" | "ops_adjusted"
      rating_target: "garage" | "platform"
      referral_state: "pending" | "rewarded" | "expired"
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
    Enums: {
      actor_role: ["customer", "garage", "ops", "system", "bot"],
      booking_bucket: ["detailing", "repairs", "denting"],
      booking_status: [
        "queued_for_call",
        "quoted",
        "awaiting_garage",
        "assigned",
        "in_progress",
        "completed",
        "cancelled",
        "declined_by_garage",
      ],
      garage_response: ["accept", "decline"],
      notif_channel: ["whatsapp", "sms", "email"],
      notif_direction: ["outbound", "inbound"],
      notif_state: ["queued", "sent", "delivered", "read", "failed"],
      ops_role: ["ops", "admin"],
      payment_mode: ["upi", "cash"],
      payment_status: [
        "pending",
        "authorized",
        "captured",
        "refunded",
        "failed",
      ],
      quote_source: ["catalog_fixed", "ops_manual", "ops_adjusted"],
      rating_target: ["garage", "platform"],
      referral_state: ["pending", "rewarded", "expired"],
    },
  },
} as const
