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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      affiliate_applications: {
        Row: {
          admin_notes: string | null
          created_at: string
          email: string
          followers_count: string | null
          id: string
          name: string
          phone: string | null
          platform: string | null
          processed_at: string | null
          social_media: string | null
          status: string
          why_join: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          email: string
          followers_count?: string | null
          id?: string
          name: string
          phone?: string | null
          platform?: string | null
          processed_at?: string | null
          social_media?: string | null
          status?: string
          why_join?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          email?: string
          followers_count?: string | null
          id?: string
          name?: string
          phone?: string | null
          platform?: string | null
          processed_at?: string | null
          social_media?: string | null
          status?: string
          why_join?: string | null
        }
        Relationships: []
      }
      affiliate_orders: {
        Row: {
          affiliate_id: string
          commission_amount: number
          created_at: string
          customer_discount: number
          id: string
          order_id: string | null
          order_total: number
          paid_at: string | null
          shopify_order_id: string | null
          status: string
        }
        Insert: {
          affiliate_id: string
          commission_amount: number
          created_at?: string
          customer_discount?: number
          id?: string
          order_id?: string | null
          order_total: number
          paid_at?: string | null
          shopify_order_id?: string | null
          status?: string
        }
        Update: {
          affiliate_id?: string
          commission_amount?: number
          created_at?: string
          customer_discount?: number
          id?: string
          order_id?: string | null
          order_total?: number
          paid_at?: string | null
          shopify_order_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_orders_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_payout_requests: {
        Row: {
          affiliate_id: string
          amount: number
          created_at: string
          id: string
          notes: string | null
          payout_type: string
          processed_at: string | null
          status: string
        }
        Insert: {
          affiliate_id: string
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          payout_type?: string
          processed_at?: string | null
          status?: string
        }
        Update: {
          affiliate_id?: string
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payout_type?: string
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_payout_requests_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_payouts: {
        Row: {
          affiliate_id: string
          amount: number
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          payout_method: string
          payout_reference: string | null
          status: string
        }
        Insert: {
          affiliate_id: string
          amount: number
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          payout_method: string
          payout_reference?: string | null
          status?: string
        }
        Update: {
          affiliate_id?: string
          amount?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          payout_method?: string
          payout_reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_payouts_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          auto_payout: boolean | null
          code: string
          commission_percent: number
          created_at: string
          email: string
          id: string
          is_active: boolean
          min_payout_amount: number | null
          name: string
          notes: string | null
          paid_earnings: number
          payout_details: Json | null
          payout_method: string | null
          pending_earnings: number
          total_earnings: number
          total_orders: number
          total_sales: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          auto_payout?: boolean | null
          code: string
          commission_percent?: number
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          min_payout_amount?: number | null
          name: string
          notes?: string | null
          paid_earnings?: number
          payout_details?: Json | null
          payout_method?: string | null
          pending_earnings?: number
          total_earnings?: number
          total_orders?: number
          total_sales?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          auto_payout?: boolean | null
          code?: string
          commission_percent?: number
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          min_payout_amount?: number | null
          name?: string
          notes?: string | null
          paid_earnings?: number
          payout_details?: Json | null
          payout_method?: string | null
          pending_earnings?: number
          total_earnings?: number
          total_orders?: number
          total_sales?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bundle_items: {
        Row: {
          bundle_id: string
          created_at: string
          id: string
          quantity: number
          shopify_product_id: string
          shopify_variant_id: string | null
        }
        Insert: {
          bundle_id: string
          created_at?: string
          id?: string
          quantity?: number
          shopify_product_id: string
          shopify_variant_id?: string | null
        }
        Update: {
          bundle_id?: string
          created_at?: string
          id?: string
          quantity?: number
          shopify_product_id?: string
          shopify_variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_pricing: {
        Row: {
          created_at: string
          description: string | null
          discount_percent: number
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_percent: number
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      bundle_products: {
        Row: {
          bundle_id: string
          id: string
          shopify_product_id: string
          shopify_variant_id: string | null
        }
        Insert: {
          bundle_id: string
          id?: string
          shopify_product_id: string
          shopify_variant_id?: string | null
        }
        Update: {
          bundle_id?: string
          id?: string
          shopify_product_id?: string
          shopify_variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bundle_products_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundle_pricing"
            referencedColumns: ["id"]
          },
        ]
      }
      bundles: {
        Row: {
          created_at: string
          description: string | null
          description_en: string | null
          discount_percent: number
          display_order: number
          id: string
          is_active: boolean
          name: string
          name_en: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          description_en?: string | null
          discount_percent?: number
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          name_en?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          description_en?: string | null
          discount_percent?: number
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          name_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      donation_projects: {
        Row: {
          created_at: string
          current_amount: number
          description: string | null
          description_en: string | null
          families_helped: number
          goal_amount: number
          id: string
          is_active: boolean
          name: string
          name_en: string | null
          trees_planted: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_amount?: number
          description?: string | null
          description_en?: string | null
          families_helped?: number
          goal_amount?: number
          id?: string
          is_active?: boolean
          name: string
          name_en?: string | null
          trees_planted?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_amount?: number
          description?: string | null
          description_en?: string | null
          families_helped?: number
          goal_amount?: number
          id?: string
          is_active?: boolean
          name?: string
          name_en?: string | null
          trees_planted?: number
          updated_at?: string
        }
        Relationships: []
      }
      donations: {
        Row: {
          amount: number
          created_at: string
          id: string
          is_anonymous: boolean
          order_id: string | null
          purpose: string
          source: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          is_anonymous?: boolean
          order_id?: string | null
          purpose?: string
          source?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          is_anonymous?: boolean
          order_id?: string | null
          purpose?: string
          source?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          benefits_en: string[]
          benefits_sv: string[]
          created_at: string
          cta_text_en: string
          cta_text_sv: string
          footer_en: string
          footer_sv: string
          greeting_en: string
          greeting_sv: string
          id: string
          intro_en: string
          intro_sv: string
          is_active: boolean
          subject_en: string
          subject_sv: string
          template_type: string
          updated_at: string
        }
        Insert: {
          benefits_en?: string[]
          benefits_sv?: string[]
          created_at?: string
          cta_text_en: string
          cta_text_sv: string
          footer_en: string
          footer_sv: string
          greeting_en: string
          greeting_sv: string
          id?: string
          intro_en: string
          intro_sv: string
          is_active?: boolean
          subject_en: string
          subject_sv: string
          template_type: string
          updated_at?: string
        }
        Update: {
          benefits_en?: string[]
          benefits_sv?: string[]
          created_at?: string
          cta_text_en?: string
          cta_text_sv?: string
          footer_en?: string
          footer_sv?: string
          greeting_en?: string
          greeting_sv?: string
          id?: string
          intro_en?: string
          intro_sv?: string
          is_active?: boolean
          subject_en?: string
          subject_sv?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      influencer_products: {
        Row: {
          id: string
          influencer_id: string
          order_id: string | null
          product_title: string
          received_at: string
          shopify_product_id: string
          shopify_variant_id: string | null
        }
        Insert: {
          id?: string
          influencer_id: string
          order_id?: string | null
          product_title: string
          received_at?: string
          shopify_product_id: string
          shopify_variant_id?: string | null
        }
        Update: {
          id?: string
          influencer_id?: string
          order_id?: string | null
          product_title?: string
          received_at?: string
          shopify_product_id?: string
          shopify_variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "influencer_products_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_products_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      influencers: {
        Row: {
          code: string
          created_at: string
          email: string
          id: string
          is_active: boolean
          max_products: number
          name: string
          notes: string | null
          products_used: number
          updated_at: string
          user_id: string | null
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          max_products?: number
          name: string
          notes?: string | null
          products_used?: number
          updated_at?: string
          user_id?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          max_products?: number
          name?: string
          notes?: string | null
          products_used?: number
          updated_at?: string
          user_id?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      interest_logs: {
        Row: {
          category: string | null
          created_at: string
          email: string | null
          id: string
          interest_type: string
          message: string | null
          session_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interest_type: string
          message?: string | null
          session_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interest_type?: string
          message?: string | null
          session_id?: string | null
        }
        Relationships: []
      }
      legal_document_versions: {
        Row: {
          content_en: string
          content_sv: string
          created_at: string
          created_by: string | null
          document_id: string
          id: string
          title_en: string
          title_sv: string
          version: number
        }
        Insert: {
          content_en: string
          content_sv: string
          created_at?: string
          created_by?: string | null
          document_id: string
          id?: string
          title_en: string
          title_sv: string
          version: number
        }
        Update: {
          content_en?: string
          content_sv?: string
          created_at?: string
          created_by?: string | null
          document_id?: string
          id?: string
          title_en?: string
          title_sv?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "legal_document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          content_en: string
          content_sv: string
          created_at: string
          document_type: string
          id: string
          is_active: boolean
          title_en: string
          title_sv: string
          updated_at: string
          version: number
        }
        Insert: {
          content_en: string
          content_sv: string
          created_at?: string
          document_type: string
          id?: string
          is_active?: boolean
          title_en: string
          title_sv: string
          updated_at?: string
          version?: number
        }
        Update: {
          content_en?: string
          content_sv?: string
          created_at?: string
          document_type?: string
          id?: string
          is_active?: boolean
          title_en?: string
          title_sv?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      member_prices: {
        Row: {
          created_at: string
          id: string
          member_price: number
          shopify_product_id: string
          shopify_variant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_price: number
          shopify_product_id: string
          shopify_variant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_price?: number
          shopify_product_id?: string
          shopify_variant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          currency: string
          estimated_delivery: string | null
          id: string
          items: Json
          notes: string | null
          order_email: string
          shipping_address: Json | null
          shopify_order_id: string | null
          shopify_order_number: string | null
          status: string
          status_history: Json
          total_amount: number
          tracking_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          estimated_delivery?: string | null
          id?: string
          items?: Json
          notes?: string | null
          order_email: string
          shipping_address?: Json | null
          shopify_order_id?: string | null
          shopify_order_number?: string | null
          status?: string
          status_history?: Json
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          estimated_delivery?: string | null
          id?: string
          items?: Json
          notes?: string | null
          order_email?: string
          shipping_address?: Json | null
          shopify_order_id?: string | null
          shopify_order_number?: string | null
          status?: string
          status_history?: Json
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_sales: {
        Row: {
          created_at: string
          id: string
          last_sale_at: string | null
          product_title: string
          shopify_product_id: string
          total_quantity_sold: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_sale_at?: string | null
          product_title: string
          shopify_product_id: string
          total_quantity_sold?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_sale_at?: string | null
          product_title?: string
          shopify_product_id?: string
          total_quantity_sold?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          is_member: boolean
          member_since: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_member?: boolean
          member_since?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_member?: boolean
          member_since?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      review_rewards: {
        Row: {
          created_at: string
          discount_code: string
          discount_percent: number
          expires_at: string
          id: string
          is_used: boolean
          review_id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          discount_code: string
          discount_percent?: number
          expires_at?: string
          id?: string
          is_used?: boolean
          review_id: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          discount_code?: string
          discount_percent?: number
          expires_at?: string
          id?: string
          is_used?: boolean
          review_id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_rewards_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          admin_response: string | null
          admin_response_at: string | null
          comment: string
          created_at: string
          id: string
          is_approved: boolean
          is_verified_purchase: boolean
          product_title: string
          rating: number
          shopify_product_handle: string
          shopify_product_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          admin_response_at?: string | null
          comment: string
          created_at?: string
          id?: string
          is_approved?: boolean
          is_verified_purchase?: boolean
          product_title: string
          rating: number
          shopify_product_handle: string
          shopify_product_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          admin_response_at?: string | null
          comment?: string
          created_at?: string
          id?: string
          is_approved?: boolean
          is_verified_purchase?: boolean
          product_title?: string
          rating?: number
          shopify_product_handle?: string
          shopify_product_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      search_logs: {
        Row: {
          created_at: string
          id: string
          results_count: number
          search_term: string
          session_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          results_count?: number
          search_term: string
          session_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          results_count?: number
          search_term?: string
          session_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      volume_discounts: {
        Row: {
          created_at: string
          discount_percent: number
          id: string
          is_global: boolean
          min_quantity: number
          shopify_product_id: string | null
        }
        Insert: {
          created_at?: string
          discount_percent: number
          id?: string
          is_global?: boolean
          min_quantity: number
          shopify_product_id?: string | null
        }
        Update: {
          created_at?: string
          discount_percent?: number
          id?: string
          is_global?: boolean
          min_quantity?: number
          shopify_product_id?: string | null
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          shopify_product_handle: string
          shopify_product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          shopify_product_handle: string
          shopify_product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          shopify_product_handle?: string
          shopify_product_id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      validate_affiliate_code: {
        Args: { p_code: string }
        Returns: {
          affiliate_id: string
          affiliate_name: string
          commission_percent: number
          customer_discount: number
          is_valid: boolean
          message: string
        }[]
      }
      validate_influencer_code: {
        Args: { p_code: string; p_email: string }
        Returns: {
          influencer_id: string
          influencer_name: string
          is_valid: boolean
          message: string
          products_remaining: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
