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
      access_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          created_at: string
          detail: string | null
          id: string
          permission_changes: Json | null
          role_after: string[] | null
          role_before: string[] | null
          source: string
          target_email: string | null
          target_user_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          permission_changes?: Json | null
          role_after?: string[] | null
          role_before?: string[] | null
          source?: string
          target_email?: string | null
          target_user_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          permission_changes?: Json | null
          role_after?: string[] | null
          role_before?: string[] | null
          source?: string
          target_email?: string | null
          target_user_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          category: string
          created_at: string
          details: Json | null
          id: string
          log_type: string
          message: string
          order_id: string | null
          user_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          details?: Json | null
          id?: string
          log_type?: string
          message: string
          order_id?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          details?: Json | null
          id?: string
          log_type?: string
          message?: string
          order_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
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
      ai_chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_read_log: {
        Row: {
          action_type: string
          affected_components: string[] | null
          ai_suggestion: string | null
          created_at: string
          endpoints: string[] | null
          file_paths: string[] | null
          id: string
          linked_bug_id: string | null
          linked_scan_id: string | null
          linked_work_item_id: string | null
          metadata: Json | null
          result: string
          summary: string | null
          target_ids: string[] | null
          target_type: string
          triggered_by: string | null
          verified_at: string | null
          verified_by: string | null
          verify_note: string | null
          verify_status: string | null
        }
        Insert: {
          action_type?: string
          affected_components?: string[] | null
          ai_suggestion?: string | null
          created_at?: string
          endpoints?: string[] | null
          file_paths?: string[] | null
          id?: string
          linked_bug_id?: string | null
          linked_scan_id?: string | null
          linked_work_item_id?: string | null
          metadata?: Json | null
          result?: string
          summary?: string | null
          target_ids?: string[] | null
          target_type: string
          triggered_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
          verify_note?: string | null
          verify_status?: string | null
        }
        Update: {
          action_type?: string
          affected_components?: string[] | null
          ai_suggestion?: string | null
          created_at?: string
          endpoints?: string[] | null
          file_paths?: string[] | null
          id?: string
          linked_bug_id?: string | null
          linked_scan_id?: string | null
          linked_work_item_id?: string | null
          metadata?: Json | null
          result?: string
          summary?: string | null
          target_ids?: string[] | null
          target_type?: string
          triggered_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
          verify_note?: string | null
          verify_status?: string | null
        }
        Relationships: []
      }
      scan_results: {
        Row: {
          created_at: string
          executive_summary: string | null
          id: string
          issues_count: number | null
          overall_score: number | null
          overall_status: string | null
          results: Json
          scan_type: string
          scanned_by: string | null
          tasks_created: number | null
        }
        Insert: {
          created_at?: string
          executive_summary?: string | null
          id?: string
          issues_count?: number | null
          overall_score?: number | null
          overall_status?: string | null
          results?: Json
          scan_type?: string
          scanned_by?: string | null
          tasks_created?: number | null
        }
        Update: {
          created_at?: string
          executive_summary?: string | null
          id?: string
          issues_count?: number | null
          overall_score?: number | null
          overall_status?: string | null
          results?: Json
          scan_type?: string
          scanned_by?: string | null
          tasks_created?: number | null
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      automation_logs: {
        Row: {
          action_type: string
          created_at: string
          details: Json | null
          id: string
          reason: string
          target_id: string
          target_type: string
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: Json | null
          id?: string
          reason: string
          target_id: string
          target_type: string
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: Json | null
          id?: string
          reason?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          rule_key: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          rule_key: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          rule_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      bug_reports: {
        Row: {
          ai_actionable_fix: Json | null
          ai_approved: boolean | null
          ai_category: string | null
          ai_clean_prompt: string | null
          ai_processed_at: string | null
          ai_repro_steps: string | null
          ai_severity: string | null
          ai_summary: string | null
          ai_tags: string[] | null
          created_at: string
          description: string
          id: string
          page_url: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          resolved_by_change_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          ai_actionable_fix?: Json | null
          ai_approved?: boolean | null
          ai_category?: string | null
          ai_clean_prompt?: string | null
          ai_processed_at?: string | null
          ai_repro_steps?: string | null
          ai_severity?: string | null
          ai_summary?: string | null
          ai_tags?: string[] | null
          created_at?: string
          description: string
          id?: string
          page_url: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_by_change_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          ai_actionable_fix?: Json | null
          ai_approved?: boolean | null
          ai_category?: string | null
          ai_clean_prompt?: string | null
          ai_processed_at?: string | null
          ai_repro_steps?: string | null
          ai_severity?: string | null
          ai_summary?: string | null
          ai_tags?: string[] | null
          created_at?: string
          description?: string
          id?: string
          page_url?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_by_change_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bug_reports_resolved_by_change_id_fkey"
            columns: ["resolved_by_change_id"]
            isOneToOne: false
            referencedRelation: "change_log"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_items: {
        Row: {
          bundle_id: string
          created_at: string
          id: string
          quantity: number
          product_id: string
          variant_id: string | null
        }
        Insert: {
          bundle_id: string
          created_at?: string
          id?: string
          quantity?: number
          product_id: string
          variant_id?: string | null
        }
        Update: {
          bundle_id?: string
          created_at?: string
          id?: string
          quantity?: number
          product_id?: string
          variant_id?: string | null
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
          product_id: string
          variant_id: string | null
        }
        Insert: {
          bundle_id: string
          id?: string
          product_id: string
          variant_id?: string | null
        }
        Update: {
          bundle_id?: string
          id?: string
          product_id?: string
          variant_id?: string | null
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
          first_purchase_discount: number | null
          id: string
          is_active: boolean
          max_uses_per_user: number | null
          min_level: number | null
          name: string
          name_en: string | null
          repeat_discount: number | null
          requirement_type: string
          requires_account: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          description_en?: string | null
          discount_percent?: number
          display_order?: number
          first_purchase_discount?: number | null
          id?: string
          is_active?: boolean
          max_uses_per_user?: number | null
          min_level?: number | null
          name: string
          name_en?: string | null
          repeat_discount?: number | null
          requirement_type?: string
          requires_account?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          description_en?: string | null
          discount_percent?: number
          display_order?: number
          first_purchase_discount?: number | null
          id?: string
          is_active?: boolean
          max_uses_per_user?: number | null
          min_level?: number | null
          name?: string
          name_en?: string | null
          repeat_discount?: number | null
          requirement_type?: string
          requires_account?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      business_accounts: {
        Row: {
          admin_notes: string | null
          company_address: string | null
          company_name: string
          contact_person: string | null
          created_at: string
          id: string
          org_number: string
          status: string
          updated_at: string
          user_id: string
          vat_number: string | null
        }
        Insert: {
          admin_notes?: string | null
          company_address?: string | null
          company_name: string
          contact_person?: string | null
          created_at?: string
          id?: string
          org_number: string
          status?: string
          updated_at?: string
          user_id: string
          vat_number?: string | null
        }
        Update: {
          admin_notes?: string | null
          company_address?: string | null
          company_name?: string
          contact_person?: string | null
          created_at?: string
          id?: string
          org_number?: string
          status?: string
          updated_at?: string
          user_id?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          display_order: number
          icon: string | null
          id: string
          is_visible: boolean
          name_en: string | null
          name_sv: string
          parent_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_visible?: boolean
          name_en?: string | null
          name_sv: string
          parent_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_visible?: boolean
          name_en?: string | null
          name_sv?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      change_log: {
        Row: {
          affected_components: string[] | null
          bug_report_id: string | null
          change_type: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          metadata: Json | null
          prompt_queue_id: string | null
          scan_id: string | null
          source: string
          work_item_id: string | null
        }
        Insert: {
          affected_components?: string[] | null
          bug_report_id?: string | null
          change_type?: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          metadata?: Json | null
          prompt_queue_id?: string | null
          scan_id?: string | null
          source?: string
          work_item_id?: string | null
        }
        Update: {
          affected_components?: string[] | null
          bug_report_id?: string | null
          change_type?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          metadata?: Json | null
          prompt_queue_id?: string | null
          scan_id?: string | null
          source?: string
          work_item_id?: string | null
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
          anonymous_id: string | null
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
          anonymous_id?: string | null
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
          anonymous_id?: string | null
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
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
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      feedback_surveys: {
        Row: {
          comments: string | null
          created_at: string
          delivery_rating: number | null
          id: string
          order_id: string | null
          overall_satisfaction: number
          packaging_rating: number | null
          user_id: string
          would_recommend: boolean | null
        }
        Insert: {
          comments?: string | null
          created_at?: string
          delivery_rating?: number | null
          id?: string
          order_id?: string | null
          overall_satisfaction: number
          packaging_rating?: number | null
          user_id: string
          would_recommend?: boolean | null
        }
        Update: {
          comments?: string | null
          created_at?: string
          delivery_rating?: number | null
          id?: string
          order_id?: string | null
          overall_satisfaction?: number
          packaging_rating?: number | null
          user_id?: string
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_surveys_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      functional_failure_memory: {
        Row: {
          action_type: string
          component: string
          created_at: string
          entity_type: string
          fail_reason: string | null
          failed_step: string
          first_seen_at: string
          id: string
          is_resolved: boolean
          last_retest_passed: boolean | null
          last_scan_retest_at: string | null
          last_seen_at: string
          occurrence_count: number
          pattern_key: string
          resolved_at: string | null
          severity: string
        }
        Insert: {
          action_type: string
          component: string
          created_at?: string
          entity_type: string
          fail_reason?: string | null
          failed_step: string
          first_seen_at?: string
          id?: string
          is_resolved?: boolean
          last_retest_passed?: boolean | null
          last_scan_retest_at?: string | null
          last_seen_at?: string
          occurrence_count?: number
          pattern_key: string
          resolved_at?: string | null
          severity?: string
        }
        Update: {
          action_type?: string
          component?: string
          created_at?: string
          entity_type?: string
          fail_reason?: string | null
          failed_step?: string
          first_seen_at?: string
          id?: string
          is_resolved?: boolean
          last_retest_passed?: boolean | null
          last_scan_retest_at?: string | null
          last_seen_at?: string
          occurrence_count?: number
          pattern_key?: string
          resolved_at?: string | null
          severity?: string
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
          product_id: string
          variant_id: string | null
        }
        Insert: {
          id?: string
          influencer_id: string
          order_id?: string | null
          product_title: string
          received_at?: string
          product_id: string
          variant_id?: string | null
        }
        Update: {
          id?: string
          influencer_id?: string
          order_id?: string | null
          product_title?: string
          received_at?: string
          product_id?: string
          variant_id?: string | null
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
          product_id: string
          variant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_price: number
          product_id: string
          variant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_price?: number
          product_id?: string
          variant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          related_id: string | null
          related_type: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          related_id?: string | null
          related_type?: string | null
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          related_id?: string | null
          related_type?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_incidents: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string | null
          escalated_at: string | null
          id: string
          order_id: string
          priority: string
          reported_by: string | null
          resolution: string | null
          resolved_at: string | null
          sla_deadline: string | null
          sla_status: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          escalated_at?: string | null
          id?: string
          order_id: string
          priority?: string
          reported_by?: string | null
          resolution?: string | null
          resolved_at?: string | null
          sla_deadline?: string | null
          sla_status?: string
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          escalated_at?: string | null
          id?: string
          order_id?: string
          priority?: string
          reported_by?: string | null
          resolution?: string | null
          resolved_at?: string | null
          sla_deadline?: string | null
          sla_status?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_incidents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          currency: string
          deleted_at: string | null
          delivered_at: string | null
          delivery_method: string
          delivery_status: string
          estimated_delivery: string | null
          fulfillment_status: string
          id: string
          items: Json
          notes: string | null
          order_email: string
          order_number: string | null
          packed_at: string | null
          packed_by: string | null
          payment_intent_id: string | null
          payment_method: string | null
          payment_status: string
          receipt_url: string | null
          refund_amount: number | null
          refund_status: string | null
          refunded_at: string | null
          review_reminder_sent: boolean
          shipped_at: string | null
          shipped_by: string | null
          shipping_address: Json | null
          shipping_method: string | null
          shopify_order_id: string | null
          external_order_number: string | null
          status: string
          status_history: Json
          stripe_session_id: string | null
          total_amount: number
          tracking_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          deleted_at?: string | null
          delivered_at?: string | null
          delivery_method?: string
          delivery_status?: string
          estimated_delivery?: string | null
          fulfillment_status?: string
          id?: string
          items?: Json
          notes?: string | null
          order_email: string
          order_number?: string | null
          packed_at?: string | null
          packed_by?: string | null
          payment_intent_id?: string | null
          payment_method?: string | null
          payment_status?: string
          receipt_url?: string | null
          refund_amount?: number | null
          refund_status?: string | null
          refunded_at?: string | null
          review_reminder_sent?: boolean
          shipped_at?: string | null
          shipped_by?: string | null
          shipping_address?: Json | null
          shipping_method?: string | null
          shopify_order_id?: string | null
          external_order_number?: string | null
          status?: string
          status_history?: Json
          stripe_session_id?: string | null
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          deleted_at?: string | null
          delivered_at?: string | null
          delivery_method?: string
          delivery_status?: string
          estimated_delivery?: string | null
          fulfillment_status?: string
          id?: string
          items?: Json
          notes?: string | null
          order_email?: string
          order_number?: string | null
          packed_at?: string | null
          packed_by?: string | null
          payment_intent_id?: string | null
          payment_method?: string | null
          payment_status?: string
          receipt_url?: string | null
          refund_amount?: number | null
          refund_status?: string | null
          refunded_at?: string | null
          review_reminder_sent?: boolean
          shipped_at?: string | null
          shipped_by?: string | null
          shipping_address?: Json | null
          shipping_method?: string | null
          shopify_order_id?: string | null
          external_order_number?: string | null
          status?: string
          status_history?: Json
          stripe_session_id?: string | null
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      page_sections: {
        Row: {
          content_en: string | null
          content_sv: string | null
          created_at: string
          display_order: number
          icon: string | null
          id: string
          is_visible: boolean
          page: string
          section_key: string
          title_en: string | null
          title_sv: string | null
          updated_at: string
        }
        Insert: {
          content_en?: string | null
          content_sv?: string | null
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_visible?: boolean
          page: string
          section_key: string
          title_en?: string | null
          title_sv?: string | null
          updated_at?: string
        }
        Update: {
          content_en?: string | null
          content_sv?: string | null
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_visible?: boolean
          page?: string
          section_key?: string
          title_en?: string | null
          title_sv?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          product_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          product_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_ingredients: {
        Row: {
          created_at: string
          display_order: number
          id: string
          ingredient_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          ingredient_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          ingredient_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "recipe_ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sales: {
        Row: {
          created_at: string
          id: string
          last_sale_at: string | null
          product_title: string
          product_id: string
          total_quantity_sold: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_sale_at?: string | null
          product_title: string
          product_id: string
          total_quantity_sold?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_sale_at?: string | null
          product_title?: string
          product_id?: string
          total_quantity_sold?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_tag_relations: {
        Row: {
          created_at: string
          id: string
          product_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_tag_relations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tag_relations_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "product_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tags: {
        Row: {
          color: string | null
          created_at: string
          display_order: number | null
          id: string
          is_searchable: boolean
          name_en: string | null
          name_sv: string
          slug: string
          tag_type: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          is_searchable?: boolean
          name_en?: string | null
          name_sv: string
          slug: string
          tag_type?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          is_searchable?: boolean
          name_en?: string | null
          name_sv?: string
          slug?: string
          tag_type?: string
        }
        Relationships: []
      }
      product_translation_cache: {
        Row: {
          created_at: string
          id: string
          language_code: string
          product_id: string
          translated_fields: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          language_code: string
          product_id: string
          translated_fields?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          language_code?: string
          product_id?: string
          translated_fields?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_translation_cache_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_translations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          language_code: string
          product_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          language_code: string
          product_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          language_code?: string
          product_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          price: number
          product_id: string
          size: string
          sku: string | null
          stock: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          price: number
          product_id: string
          size: string
          sku?: string | null
          stock?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          price?: number
          product_id?: string
          size?: string
          sku?: string | null
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allow_overselling: boolean
          badge: string | null
          category: string | null
          certifications: string[] | null
          created_at: string
          currency: string
          description_en: string | null
          description_sv: string | null
          display_order: number | null
          dosage_en: string | null
          dosage_sv: string | null
          effects_en: string | null
          effects_sv: string | null
          extended_description_en: string | null
          extended_description_sv: string | null
          feeling_en: string | null
          feeling_sv: string | null
          handle: string | null
          hook_en: string | null
          hook_sv: string | null
          id: string
          image_urls: string[] | null
          ingredients_en: string | null
          ingredients_sv: string | null
          is_concentrate: boolean
          is_sellable: boolean
          is_visible: boolean
          last_sold_at: string | null
          low_stock_threshold: number
          meta_description: string | null
          meta_keywords: string | null
          meta_title: string | null
          original_price: number | null
          price: number
          recipe_en: string | null
          recipe_sv: string | null
          reserved_stock: number
          restock_amount: number
          safety_en: string | null
          safety_sv: string | null
          specifications: Json | null
          status: string
          stock: number
          storage_en: string | null
          storage_sv: string | null
          tags: string[] | null
          title_en: string | null
          title_sv: string
          units_sold_30d: number
          units_sold_7d: number
          updated_at: string
          usage_en: string | null
          usage_sv: string | null
          variants_en: string | null
          variants_sv: string | null
          vendor: string | null
          weight_grams: number | null
        }
        Insert: {
          allow_overselling?: boolean
          badge?: string | null
          category?: string | null
          certifications?: string[] | null
          created_at?: string
          currency?: string
          description_en?: string | null
          description_sv?: string | null
          display_order?: number | null
          dosage_en?: string | null
          dosage_sv?: string | null
          effects_en?: string | null
          effects_sv?: string | null
          extended_description_en?: string | null
          extended_description_sv?: string | null
          feeling_en?: string | null
          feeling_sv?: string | null
          handle?: string | null
          hook_en?: string | null
          hook_sv?: string | null
          id?: string
          image_urls?: string[] | null
          ingredients_en?: string | null
          ingredients_sv?: string | null
          is_concentrate?: boolean
          is_sellable?: boolean
          is_visible?: boolean
          last_sold_at?: string | null
          low_stock_threshold?: number
          meta_description?: string | null
          meta_keywords?: string | null
          meta_title?: string | null
          original_price?: number | null
          price?: number
          recipe_en?: string | null
          recipe_sv?: string | null
          reserved_stock?: number
          restock_amount?: number
          safety_en?: string | null
          safety_sv?: string | null
          specifications?: Json | null
          status?: string
          stock?: number
          storage_en?: string | null
          storage_sv?: string | null
          tags?: string[] | null
          title_en?: string | null
          title_sv: string
          units_sold_30d?: number
          units_sold_7d?: number
          updated_at?: string
          usage_en?: string | null
          usage_sv?: string | null
          variants_en?: string | null
          variants_sv?: string | null
          vendor?: string | null
          weight_grams?: number | null
        }
        Update: {
          allow_overselling?: boolean
          badge?: string | null
          category?: string | null
          certifications?: string[] | null
          created_at?: string
          currency?: string
          description_en?: string | null
          description_sv?: string | null
          display_order?: number | null
          dosage_en?: string | null
          dosage_sv?: string | null
          effects_en?: string | null
          effects_sv?: string | null
          extended_description_en?: string | null
          extended_description_sv?: string | null
          feeling_en?: string | null
          feeling_sv?: string | null
          handle?: string | null
          hook_en?: string | null
          hook_sv?: string | null
          id?: string
          image_urls?: string[] | null
          ingredients_en?: string | null
          ingredients_sv?: string | null
          is_concentrate?: boolean
          is_sellable?: boolean
          is_visible?: boolean
          last_sold_at?: string | null
          low_stock_threshold?: number
          meta_description?: string | null
          meta_keywords?: string | null
          meta_title?: string | null
          original_price?: number | null
          price?: number
          recipe_en?: string | null
          recipe_sv?: string | null
          reserved_stock?: number
          restock_amount?: number
          safety_en?: string | null
          safety_sv?: string | null
          specifications?: Json | null
          status?: string
          stock?: number
          storage_en?: string | null
          storage_sv?: string | null
          tags?: string[] | null
          title_en?: string | null
          title_sv?: string
          units_sold_30d?: number
          units_sold_7d?: number
          updated_at?: string
          usage_en?: string | null
          usage_sv?: string | null
          variants_en?: string | null
          variants_sv?: string | null
          vendor?: string | null
          weight_grams?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          city: string | null
          country: string | null
          created_at: string
          first_name: string | null
          full_name: string | null
          id: string
          is_member: boolean
          last_name: string | null
          level: number
          member_since: string | null
          phone: string | null
          referral_code: string | null
          trust_score: number
          updated_at: string
          user_id: string
          username: string | null
          xp: number
          zip: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          first_name?: string | null
          full_name?: string | null
          id?: string
          is_member?: boolean
          last_name?: string | null
          level?: number
          member_since?: string | null
          phone?: string | null
          referral_code?: string | null
          trust_score?: number
          updated_at?: string
          user_id: string
          username?: string | null
          xp?: number
          zip?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          first_name?: string | null
          full_name?: string | null
          id?: string
          is_member?: boolean
          last_name?: string | null
          level?: number
          member_since?: string | null
          phone?: string | null
          referral_code?: string | null
          trust_score?: number
          updated_at?: string
          user_id?: string
          username?: string | null
          xp?: number
          zip?: string | null
        }
        Relationships: []
      }
      prompt_queue: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          goal: string | null
          id: string
          implementation: string
          priority: string
          source_id: string | null
          source_type: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          goal?: string | null
          id?: string
          implementation: string
          priority?: string
          source_id?: string | null
          source_type?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          goal?: string | null
          id?: string
          implementation?: string
          priority?: string
          source_id?: string | null
          source_type?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          benefits_en: string[] | null
          benefits_sv: string[] | null
          category: string
          created_at: string
          description_en: string | null
          description_sv: string | null
          display_order: number
          id: string
          is_active: boolean
          is_searchable: boolean
          name_en: string | null
          name_sv: string
          risks_en: string[] | null
          risks_sv: string[] | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          benefits_en?: string[] | null
          benefits_sv?: string[] | null
          category?: string
          created_at?: string
          description_en?: string | null
          description_sv?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_searchable?: boolean
          name_en?: string | null
          name_sv: string
          risks_en?: string[] | null
          risks_sv?: string[] | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          benefits_en?: string[] | null
          benefits_sv?: string[] | null
          category?: string
          created_at?: string
          description_en?: string | null
          description_sv?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_searchable?: boolean
          name_en?: string | null
          name_sv?: string
          risks_en?: string[] | null
          risks_sv?: string[] | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recipe_template_slots: {
        Row: {
          allow_multiple: boolean
          created_at: string
          display_order: number
          fixed_ingredient_id: string | null
          id: string
          ingredient_category: string | null
          is_required: boolean
          label_en: string | null
          label_sv: string
          slot_type: string
          template_id: string
        }
        Insert: {
          allow_multiple?: boolean
          created_at?: string
          display_order?: number
          fixed_ingredient_id?: string | null
          id?: string
          ingredient_category?: string | null
          is_required?: boolean
          label_en?: string | null
          label_sv: string
          slot_type?: string
          template_id: string
        }
        Update: {
          allow_multiple?: boolean
          created_at?: string
          display_order?: number
          fixed_ingredient_id?: string | null
          id?: string
          ingredient_category?: string | null
          is_required?: boolean
          label_en?: string | null
          label_sv?: string
          slot_type?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_template_slots_fixed_ingredient_id_fkey"
            columns: ["fixed_ingredient_id"]
            isOneToOne: false
            referencedRelation: "recipe_ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_template_slots_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "recipe_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_templates: {
        Row: {
          created_at: string
          description_en: string | null
          description_sv: string | null
          display_order: number
          id: string
          is_active: boolean
          name_en: string | null
          name_sv: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_en?: string | null
          description_sv?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name_en?: string | null
          name_sv: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_en?: string | null
          description_sv?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name_en?: string | null
          name_sv?: string
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          converted_at: string | null
          created_at: string
          id: string
          order_id: string | null
          referral_code: string
          referred_email: string | null
          referred_user_id: string | null
          referrer_id: string
          reward_granted: boolean
          status: string
        }
        Insert: {
          converted_at?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          referral_code: string
          referred_email?: string | null
          referred_user_id?: string | null
          referrer_id: string
          reward_granted?: boolean
          status?: string
        }
        Update: {
          converted_at?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          referral_code?: string
          referred_email?: string | null
          referred_user_id?: string | null
          referrer_id?: string
          reward_granted?: boolean
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_requests: {
        Row: {
          admin_notes: string | null
          approved_by: string | null
          created_at: string
          id: string
          order_id: string
          processed_at: string | null
          reason: string
          refund_amount: number | null
          requested_by: string
          status: string
          stripe_refund_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          order_id: string
          processed_at?: string | null
          reason: string
          refund_amount?: number | null
          requested_by: string
          status?: string
          stripe_refund_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          order_id?: string
          processed_at?: string | null
          reason?: string
          refund_amount?: number | null
          requested_by?: string
          status?: string
          stripe_refund_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
          is_auto_review: boolean
          is_verified_purchase: boolean
          product_title: string
          rating: number
          product_handle: string
          product_id: string
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
          is_auto_review?: boolean
          is_verified_purchase?: boolean
          product_title: string
          rating: number
          product_handle: string
          product_id: string
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
          is_auto_review?: boolean
          is_verified_purchase?: boolean
          product_title?: string
          rating?: number
          product_handle?: string
          product_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      role_module_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_read: boolean
          can_update: boolean
          created_at: string
          id: string
          module: string
          role: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_read?: boolean
          can_update?: boolean
          created_at?: string
          id?: string
          module: string
          role: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_read?: boolean
          can_update?: boolean
          created_at?: string
          id?: string
          module?: string
          role?: string
        }
        Relationships: []
      }
      role_templates: {
        Row: {
          created_at: string
          created_by: string | null
          default_modules: string[]
          description_sv: string | null
          id: string
          is_locked: boolean
          name_sv: string
          role_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_modules?: string[]
          description_sv?: string | null
          id?: string
          is_locked?: boolean
          name_sv: string
          role_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_modules?: string[]
          description_sv?: string | null
          id?: string
          is_locked?: boolean
          name_sv?: string
          role_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      root_cause_memory: {
        Row: {
          affected_system: string
          bug_report_id: string | null
          change_log_id: string | null
          created_at: string
          created_by: string | null
          first_seen_at: string
          fix_applied: string
          id: string
          last_seen_at: string
          pattern_key: string
          recurrence_count: number
          root_cause: string
          severity: string
          work_item_id: string | null
        }
        Insert: {
          affected_system: string
          bug_report_id?: string | null
          change_log_id?: string | null
          created_at?: string
          created_by?: string | null
          first_seen_at?: string
          fix_applied: string
          id?: string
          last_seen_at?: string
          pattern_key: string
          recurrence_count?: number
          root_cause: string
          severity?: string
          work_item_id?: string | null
        }
        Update: {
          affected_system?: string
          bug_report_id?: string | null
          change_log_id?: string | null
          created_at?: string
          created_by?: string | null
          first_seen_at?: string
          fix_applied?: string
          id?: string
          last_seen_at?: string
          pattern_key?: string
          recurrence_count?: number
          root_cause?: string
          severity?: string
          work_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "root_cause_memory_bug_report_id_fkey"
            columns: ["bug_report_id"]
            isOneToOne: false
            referencedRelation: "bug_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "root_cause_memory_change_log_id_fkey"
            columns: ["change_log_id"]
            isOneToOne: false
            referencedRelation: "change_log"
            referencedColumns: ["id"]
          },
        ]
      }
      runtime_traces: {
        Row: {
          created_at: string
          endpoint: string | null
          error_message: string | null
          function_name: string
          id: string
          payload_snapshot: Json | null
          request_trace_id: string | null
          source: string
        }
        Insert: {
          created_at?: string
          endpoint?: string | null
          error_message?: string | null
          function_name: string
          id?: string
          payload_snapshot?: Json | null
          request_trace_id?: string | null
          source?: string
        }
        Update: {
          created_at?: string
          endpoint?: string | null
          error_message?: string | null
          function_name?: string
          id?: string
          payload_snapshot?: Json | null
          request_trace_id?: string | null
          source?: string
        }
        Relationships: []
      }
      scan_dismissals: {
        Row: {
          created_at: string
          dismissed_by: string
          dismissed_severity: string | null
          escalated_at: string | null
          escalation_note: string | null
          id: string
          issue_key: string
          issue_title: string
          reason: string
          scan_type: string
        }
        Insert: {
          created_at?: string
          dismissed_by: string
          dismissed_severity?: string | null
          escalated_at?: string | null
          escalation_note?: string | null
          id?: string
          issue_key: string
          issue_title: string
          reason?: string
          scan_type?: string
        }
        Update: {
          created_at?: string
          dismissed_by?: string
          dismissed_severity?: string | null
          escalated_at?: string | null
          escalation_note?: string | null
          id?: string
          issue_key?: string
          issue_title?: string
          reason?: string
          scan_type?: string
        }
        Relationships: []
      }
      scan_focus_memory: {
        Row: {
          created_at: string
          first_seen_at: string
          focus_key: string
          focus_type: string
          id: string
          issue_count: number
          label: string
          last_seen_at: string
          metadata: Json | null
          related_scan_types: string[]
          scan_count: number
          severity: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_seen_at?: string
          focus_key: string
          focus_type?: string
          id?: string
          issue_count?: number
          label: string
          last_seen_at?: string
          metadata?: Json | null
          related_scan_types?: string[]
          scan_count?: number
          severity?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_seen_at?: string
          focus_key?: string
          focus_type?: string
          id?: string
          issue_count?: number
          label?: string
          last_seen_at?: string
          metadata?: Json | null
          related_scan_types?: string[]
          scan_count?: number
          severity?: string
          updated_at?: string
        }
        Relationships: []
      }
      scan_runs: {
        Row: {
          completed_at: string | null
          coverage_score: number | null
          created_at: string | null
          current_step: number | null
          current_step_label: string | null
          error_message: string | null
          executive_summary: string | null
          high_risk_areas: Json | null
          id: string
          iteration: number
          iteration_results: Json | null
          max_iterations: number
          pattern_discoveries: Json | null
          scan_mode: string | null
          started_at: string | null
          started_by: string | null
          status: string
          steps_results: Json | null
          system_health_score: number | null
          system_stage: string | null
          target_area: string | null
          total_new_issues: number | null
          total_steps: number | null
          unified_result: Json | null
          verification_for: string | null
          work_items_created: number | null
        }
        Insert: {
          completed_at?: string | null
          coverage_score?: number | null
          created_at?: string | null
          current_step?: number | null
          current_step_label?: string | null
          error_message?: string | null
          executive_summary?: string | null
          high_risk_areas?: Json | null
          id?: string
          iteration?: number
          iteration_results?: Json | null
          max_iterations?: number
          pattern_discoveries?: Json | null
          scan_mode?: string | null
          started_at?: string | null
          started_by?: string | null
          status?: string
          steps_results?: Json | null
          system_health_score?: number | null
          system_stage?: string | null
          target_area?: string | null
          total_new_issues?: number | null
          total_steps?: number | null
          unified_result?: Json | null
          verification_for?: string | null
          work_items_created?: number | null
        }
        Update: {
          completed_at?: string | null
          coverage_score?: number | null
          created_at?: string | null
          current_step?: number | null
          current_step_label?: string | null
          error_message?: string | null
          executive_summary?: string | null
          high_risk_areas?: Json | null
          id?: string
          iteration?: number
          iteration_results?: Json | null
          max_iterations?: number
          pattern_discoveries?: Json | null
          scan_mode?: string | null
          started_at?: string | null
          started_by?: string | null
          status?: string
          steps_results?: Json | null
          system_health_score?: number | null
          system_stage?: string | null
          target_area?: string | null
          total_new_issues?: number | null
          total_steps?: number | null
          unified_result?: Json | null
          verification_for?: string | null
          work_items_created?: number | null
        }
        Relationships: []
      }
      scan_snapshots: {
        Row: {
          blind_scanners_count: number
          coverage_total: number | null
          coverage_unique_targets: number | null
          created_at: string
          dead_scanners_count: number
          diagnosis_summary: string | null
          high_attention_count: number
          id: string
          payload: Json | null
          scan_confidence_score: number | null
          total_created: number
          total_detected: number
          total_filtered: number
          total_scanners: number
          total_skipped: number
        }
        Insert: {
          blind_scanners_count?: number
          coverage_total?: number | null
          coverage_unique_targets?: number | null
          created_at?: string
          dead_scanners_count?: number
          diagnosis_summary?: string | null
          high_attention_count?: number
          id?: string
          payload?: Json | null
          scan_confidence_score?: number | null
          total_created?: number
          total_detected?: number
          total_filtered?: number
          total_scanners?: number
          total_skipped?: number
        }
        Update: {
          blind_scanners_count?: number
          coverage_total?: number | null
          coverage_unique_targets?: number | null
          created_at?: string
          dead_scanners_count?: number
          diagnosis_summary?: string | null
          high_attention_count?: number
          id?: string
          payload?: Json | null
          scan_confidence_score?: number | null
          total_created?: number
          total_detected?: number
          total_filtered?: number
          total_scanners?: number
          total_skipped?: number
        }
        Relationships: []
      }
      search_logs: {
        Row: {
          created_at: string
          id: string
          matched_ingredient_id: string | null
          matched_product_id: string | null
          results_count: number
          search_term: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          matched_ingredient_id?: string | null
          matched_product_id?: string | null
          results_count?: number
          search_term: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          matched_ingredient_id?: string | null
          matched_product_id?: string | null
          results_count?: number
          search_term?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_logs_matched_ingredient_id_fkey"
            columns: ["matched_ingredient_id"]
            isOneToOne: false
            referencedRelation: "recipe_ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_logs_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_carriers: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_international: boolean
          is_selected: boolean
          logo_url: string | null
          name: string
          notes: string | null
          pricing_url: string | null
          supports_express: boolean
          supports_home_delivery: boolean
          supports_parcel_lockers: boolean
          supports_pickup_points: boolean
          tracking_url_template: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_international?: boolean
          is_selected?: boolean
          logo_url?: string | null
          name: string
          notes?: string | null
          pricing_url?: string | null
          supports_express?: boolean
          supports_home_delivery?: boolean
          supports_parcel_lockers?: boolean
          supports_pickup_points?: boolean
          tracking_url_template?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_international?: boolean
          is_selected?: boolean
          logo_url?: string | null
          name?: string
          notes?: string | null
          pricing_url?: string | null
          supports_express?: boolean
          supports_home_delivery?: boolean
          supports_parcel_lockers?: boolean
          supports_pickup_points?: boolean
          tracking_url_template?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      shipping_extras: {
        Row: {
          created_at: string
          description_en: string | null
          description_sv: string | null
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
          title_en: string | null
          title_sv: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_en?: string | null
          description_sv?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          title_en?: string | null
          title_sv: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_en?: string | null
          description_sv?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          title_en?: string | null
          title_sv?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_updates: {
        Row: {
          created_at: string
          created_by: string | null
          description_en: string | null
          description_sv: string | null
          id: string
          image_url: string | null
          is_published: boolean
          related_category: string | null
          related_product_id: string | null
          title_en: string | null
          title_sv: string
          update_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description_en?: string | null
          description_sv?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          related_category?: string | null
          related_product_id?: string | null
          title_en?: string | null
          title_sv: string
          update_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description_en?: string | null
          description_sv?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          related_category?: string | null
          related_product_id?: string | null
          title_en?: string | null
          title_sv?: string
          update_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_performance: {
        Row: {
          avg_completion_seconds: number
          id: string
          points: number
          sla_hits: number
          sla_misses: number
          tasks_active: number
          tasks_completed: number
          total_completion_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_completion_seconds?: number
          id?: string
          points?: number
          sla_hits?: number
          sla_misses?: number
          tasks_active?: number
          tasks_completed?: number
          total_completion_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_completion_seconds?: number
          id?: string
          points?: number
          sla_hits?: number
          sla_misses?: number
          tasks_active?: number
          tasks_completed?: number
          total_completion_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_permissions: {
        Row: {
          allowed_modules: string[]
          created_at: string
          granted_by: string | null
          id: string
          notes: string | null
          skill_categories: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_modules?: string[]
          created_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          skill_categories?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_modules?: string[]
          created_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          skill_categories?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_tasks: {
        Row: {
          assigned_to: string | null
          claimed_at: string | null
          claimed_by: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          priority: string
          related_incident_id: string | null
          related_order_id: string | null
          status: string
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: string
          related_incident_id?: string | null
          related_order_id?: string | null
          status?: string
          task_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: string
          related_incident_id?: string | null
          related_order_id?: string | null
          status?: string
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_tasks_related_incident_id_fkey"
            columns: ["related_incident_id"]
            isOneToOne: false
            referencedRelation: "order_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_tasks_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          id: string
          key: string
          text_value: string | null
          updated_at: string
          value: boolean
        }
        Insert: {
          id?: string
          key: string
          text_value?: string | null
          updated_at?: string
          value?: boolean
        }
        Update: {
          id?: string
          key?: string
          text_value?: string | null
          updated_at?: string
          value?: boolean
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_expectations: {
        Row: {
          created_at: string
          entity_name: string
          entity_type: string
          id: string
          required: boolean
        }
        Insert: {
          created_at?: string
          entity_name: string
          entity_type: string
          id?: string
          required?: boolean
        }
        Update: {
          created_at?: string
          entity_name?: string
          entity_type?: string
          id?: string
          required?: boolean
        }
        Relationships: []
      }
      system_history: {
        Row: {
          ai_review_at: string | null
          ai_review_result: Json | null
          ai_review_status: string | null
          archived_at: string | null
          assigned_to: string | null
          claimed_by: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          item_type: string
          priority: string
          related_order_id: string | null
          resolution_notes: string | null
          snapshot_data: Json | null
          source_id: string | null
          source_type: string | null
          title: string
          work_item_created_at: string | null
          work_item_id: string
        }
        Insert: {
          ai_review_at?: string | null
          ai_review_result?: Json | null
          ai_review_status?: string | null
          archived_at?: string | null
          assigned_to?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          item_type?: string
          priority?: string
          related_order_id?: string | null
          resolution_notes?: string | null
          snapshot_data?: Json | null
          source_id?: string | null
          source_type?: string | null
          title: string
          work_item_created_at?: string | null
          work_item_id: string
        }
        Update: {
          ai_review_at?: string | null
          ai_review_result?: Json | null
          ai_review_status?: string | null
          archived_at?: string | null
          assigned_to?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          item_type?: string
          priority?: string
          related_order_id?: string | null
          resolution_notes?: string | null
          snapshot_data?: Json | null
          source_id?: string | null
          source_type?: string | null
          title?: string
          work_item_created_at?: string | null
          work_item_id?: string
        }
        Relationships: []
      }
      system_observability_log: {
        Row: {
          bug_id: string | null
          component: string | null
          created_at: string
          details: Json | null
          duration_ms: number | null
          endpoint: string | null
          error_code: string | null
          event_type: string
          id: string
          message: string
          scan_id: string | null
          severity: string
          source: string
          stack_trace: string | null
          trace_id: string | null
          user_id: string | null
          work_item_id: string | null
        }
        Insert: {
          bug_id?: string | null
          component?: string | null
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          endpoint?: string | null
          error_code?: string | null
          event_type?: string
          id?: string
          message: string
          scan_id?: string | null
          severity?: string
          source?: string
          stack_trace?: string | null
          trace_id?: string | null
          user_id?: string | null
          work_item_id?: string | null
        }
        Update: {
          bug_id?: string | null
          component?: string | null
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          endpoint?: string | null
          error_code?: string | null
          event_type?: string
          id?: string
          message?: string
          scan_id?: string | null
          severity?: string
          source?: string
          stack_trace?: string | null
          trace_id?: string | null
          user_id?: string | null
          work_item_id?: string | null
        }
        Relationships: []
      }
      system_structure_map: {
        Row: {
          created_at: string
          entity_name: string
          entity_type: string
          id: string
          last_seen_at: string
          scan_count: number
          source_path: string | null
        }
        Insert: {
          created_at?: string
          entity_name: string
          entity_type: string
          id?: string
          last_seen_at?: string
          scan_count?: number
          source_path?: string | null
        }
        Update: {
          created_at?: string
          entity_name?: string
          entity_type?: string
          id?: string
          last_seen_at?: string
          scan_count?: number
          source_path?: string | null
        }
        Relationships: []
      }
      timeline_entries: {
        Row: {
          created_at: string
          description_en: string | null
          description_sv: string | null
          display_order: number
          id: string
          is_visible: boolean
          title_en: string | null
          title_sv: string
          updated_at: string
          year: string
        }
        Insert: {
          created_at?: string
          description_en?: string | null
          description_sv?: string | null
          display_order?: number
          id?: string
          is_visible?: boolean
          title_en?: string | null
          title_sv: string
          updated_at?: string
          year: string
        }
        Update: {
          created_at?: string
          description_en?: string | null
          description_sv?: string | null
          display_order?: number
          id?: string
          is_visible?: boolean
          title_en?: string | null
          title_sv?: string
          updated_at?: string
          year?: string
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
          excluded_product_ids: string[] | null
          first_purchase_discount: number | null
          id: string
          is_global: boolean
          label: string | null
          max_uses_per_user: number | null
          min_level: number | null
          min_quantity: number
          repeat_discount: number | null
          requirement_type: string
          requires_account: boolean
          product_id: string | null
          stackable: boolean | null
        }
        Insert: {
          created_at?: string
          discount_percent: number
          excluded_product_ids?: string[] | null
          first_purchase_discount?: number | null
          id?: string
          is_global?: boolean
          label?: string | null
          max_uses_per_user?: number | null
          min_level?: number | null
          min_quantity: number
          repeat_discount?: number | null
          requirement_type?: string
          requires_account?: boolean
          product_id?: string | null
          stackable?: boolean | null
        }
        Update: {
          created_at?: string
          discount_percent?: number
          excluded_product_ids?: string[] | null
          first_purchase_discount?: number | null
          id?: string
          is_global?: boolean
          label?: string | null
          max_uses_per_user?: number | null
          min_level?: number | null
          min_quantity?: number
          repeat_discount?: number | null
          requirement_type?: string
          requires_account?: boolean
          product_id?: string | null
          stackable?: boolean | null
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          product_handle: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_handle: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_handle?: string
          product_id?: string
          user_id?: string
        }
        Relationships: []
      }
      work_item_history: {
        Row: {
          action: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          work_item_id: string
        }
        Insert: {
          action?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          work_item_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_item_history_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      work_items: {
        Row: {
          ai_assigned: boolean | null
          ai_category: string | null
          ai_confidence: string | null
          ai_detected: boolean | null
          ai_overrides: Json | null
          pre_verify_at: string | null
          pre_verify_result: Json | null
          pre_verify_status: string | null
          ai_resolution_notes: string | null
          ai_review_at: string | null
          ai_review_result: Json | null
          ai_review_status: string | null
          ai_root_causes: Json | null
          ai_type_classification: string | null
          ai_type_reason: string | null
          assigned_to: string | null
          blocks: string[] | null
          claimed_at: string | null
          claimed_by: string | null
          completed_at: string | null
          conflict_flag: boolean | null
          created_at: string
          created_by: string | null
          depends_on: string[] | null
          description: string | null
          due_at: string | null
          duplicate_of: string | null
          execution_order: number | null
          first_seen_at: string | null
          human_custom_cause: string | null
          human_custom_fix: string | null
          human_selected_cause: string | null
          id: string
          ignored: boolean | null
          ignored_at: string | null
          ignored_reason: string | null
          issue_fingerprint: string | null
          item_type: string
          last_seen_at: string | null
          occurrence_count: number | null
          orchestrator_result: Json | null
          priority: string
          related_incident_id: string | null
          related_order_id: string | null
          resolution_notes: string | null
          runtime_trace_id: string | null
          source_component: string | null
          source_file: string | null
          source_id: string | null
          source_path: string | null
          source_type: string | null
          status: string
          title: string
          updated_at: string
          verification_scans_checked: number | null
          verification_status: string | null
          verified_at: string | null
        }
        Insert: {
          ai_assigned?: boolean | null
          ai_category?: string | null
          ai_confidence?: string | null
          ai_detected?: boolean | null
          ai_overrides?: Json | null
          pre_verify_at?: string | null
          pre_verify_result?: Json | null
          pre_verify_status?: string | null
          ai_resolution_notes?: string | null
          ai_review_at?: string | null
          ai_review_result?: Json | null
          ai_review_status?: string | null
          ai_root_causes?: Json | null
          ai_type_classification?: string | null
          ai_type_reason?: string | null
          assigned_to?: string | null
          blocks?: string[] | null
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          conflict_flag?: boolean | null
          created_at?: string
          created_by?: string | null
          depends_on?: string[] | null
          description?: string | null
          due_at?: string | null
          duplicate_of?: string | null
          execution_order?: number | null
          first_seen_at?: string | null
          human_custom_cause?: string | null
          human_custom_fix?: string | null
          human_selected_cause?: string | null
          id?: string
          ignored?: boolean | null
          ignored_at?: string | null
          ignored_reason?: string | null
          issue_fingerprint?: string | null
          item_type?: string
          last_seen_at?: string | null
          occurrence_count?: number | null
          orchestrator_result?: Json | null
          priority?: string
          related_incident_id?: string | null
          related_order_id?: string | null
          resolution_notes?: string | null
          runtime_trace_id?: string | null
          source_component?: string | null
          source_file?: string | null
          source_id?: string | null
          source_path?: string | null
          source_type?: string | null
          status?: string
          title: string
          updated_at?: string
          verification_scans_checked?: number | null
          verification_status?: string | null
          verified_at?: string | null
        }
        Update: {
          ai_assigned?: boolean | null
          ai_category?: string | null
          ai_confidence?: string | null
          ai_detected?: boolean | null
          ai_overrides?: Json | null
          pre_verify_at?: string | null
          pre_verify_result?: Json | null
          pre_verify_status?: string | null
          ai_resolution_notes?: string | null
          ai_review_at?: string | null
          ai_review_result?: Json | null
          ai_review_status?: string | null
          ai_root_causes?: Json | null
          ai_type_classification?: string | null
          ai_type_reason?: string | null
          assigned_to?: string | null
          blocks?: string[] | null
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          conflict_flag?: boolean | null
          created_at?: string
          created_by?: string | null
          depends_on?: string[] | null
          description?: string | null
          due_at?: string | null
          duplicate_of?: string | null
          execution_order?: number | null
          first_seen_at?: string | null
          human_custom_cause?: string | null
          human_custom_fix?: string | null
          human_selected_cause?: string | null
          id?: string
          ignored?: boolean | null
          ignored_at?: string | null
          ignored_reason?: string | null
          issue_fingerprint?: string | null
          item_type?: string
          last_seen_at?: string | null
          occurrence_count?: number | null
          orchestrator_result?: Json | null
          priority?: string
          related_incident_id?: string | null
          related_order_id?: string | null
          resolution_notes?: string | null
          runtime_trace_id?: string | null
          source_component?: string | null
          source_file?: string | null
          source_id?: string | null
          source_path?: string | null
          source_type?: string | null
          status?: string
          title?: string
          updated_at?: string
          verification_scans_checked?: number | null
          verification_status?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_items_related_incident_id_fkey"
            columns: ["related_incident_id"]
            isOneToOne: false
            referencedRelation: "order_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_runtime_trace_id_fkey"
            columns: ["runtime_trace_id"]
            isOneToOne: false
            referencedRelation: "runtime_traces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      profiles_limited: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          id: string | null
          is_member: boolean | null
          level: number | null
          member_since: string | null
          trust_score: number | null
          user_id: string | null
          username: string | null
          xp: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string | null
          is_member?: boolean | null
          level?: number | null
          member_since?: string | null
          trust_score?: number | null
          user_id?: string | null
          username?: string | null
          xp?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string | null
          is_member?: boolean | null
          level?: number | null
          member_since?: string | null
          trust_score?: number | null
          user_id?: string | null
          username?: string | null
          xp?: number | null
        }
        Relationships: []
      }
      profiles_shipping: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          first_name: string | null
          last_name: string | null
          phone: string | null
          user_id: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          user_id?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          user_id?: string | null
          zip?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_user_xp: {
        Args: { p_reason?: string; p_user_id: string; p_xp: number }
        Returns: undefined
      }
      admin_search_users: {
        Args: { p_query: string }
        Returns: {
          avatar_url: string
          email: string
          phone: string
          user_created_at: string
          user_id: string
          username: string
        }[]
      }
      auto_assign_task: { Args: { p_task_type: string }; Returns: string }
      auto_assign_work_item: { Args: { p_item_type: string }; Returns: string }
      calculate_level: { Args: { p_xp: number }; Returns: number }
      check_review_eligibility: {
        Args: { p_product_id: string; p_user_id: string }
        Returns: {
          already_reviewed: boolean
          can_review: boolean
          is_verified_purchase: boolean
          message: string
        }[]
      }
      cleanup_old_observability_logs: { Args: never; Returns: number }
      cleanup_orphan_work_items: { Args: never; Returns: Json }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      generate_random_username: { Args: never; Returns: string }
      get_dashboard_stats:
        | { Args: { p_from: string; p_to: string }; Returns: Json }
        | { Args: { p_from: string; p_to: string }; Returns: Json }
      get_order_shipping_profiles: {
        Args: { p_order_ids: string[] }
        Returns: {
          address: string
          city: string
          country: string
          first_name: string
          last_name: string
          phone: string
          user_id: string
          zip: string
        }[]
      }
      get_support_profile: {
        Args: { p_user_id: string }
        Returns: {
          city: string
          country: string
          created_at: string
          first_name: string
          is_member: boolean
          level: number
          user_id: string
          username: string
        }[]
      }
      has_module_permission: {
        Args: { _action?: string; _module: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_structure_map_scan: {
        Args: { p_entity_name: string; p_entity_type: string }
        Returns: undefined
      }
      increment_work_item_occurrence: {
        Args: { p_work_item_id: string }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_founder: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      log_activity: {
        Args: {
          p_category: string
          p_details?: Json
          p_log_type: string
          p_message: string
          p_order_id?: string
        }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: undefined
      }
      normalize_phone: { Args: { p_phone: string }; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      read_emails: {
        Args: {
          batch_size?: number
          queue_name: string
          visibility_timeout?: number
        }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
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
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "founder"
        | "it"
        | "support"
        | "affiliate"
        | "donor"
        | "manager"
        | "marketing"
        | "finance"
        | "warehouse"
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
      app_role: [
        "admin",
        "moderator",
        "user",
        "founder",
        "it",
        "support",
        "affiliate",
        "donor",
        "manager",
        "marketing",
        "finance",
        "warehouse",
      ],
    },
  },
} as const
