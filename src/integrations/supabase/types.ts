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
      automation_runs: {
        Row: {
          automation_id: string
          detail: string | null
          executed_at: string
          id: string
          lead_id: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          automation_id: string
          detail?: string | null
          executed_at?: string
          id?: string
          lead_id?: string | null
          status?: string
          workspace_id: string
        }
        Update: {
          automation_id?: string
          detail?: string | null
          executed_at?: string
          id?: string
          lead_id?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          action_config: Json
          action_type: string
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          last_run_at: string | null
          name: string
          run_count: number
          template_id: string | null
          trigger_config: Json
          trigger_type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          name: string
          run_count?: number
          template_id?: string | null
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          name?: string
          run_count?: number
          template_id?: string | null
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          delivered_at: string | null
          error: string | null
          id: string
          lead_id: string | null
          meta_message_id: string | null
          name: string | null
          phone: string
          reachable: boolean | null
          read_at: string | null
          reason: string | null
          replied_at: string | null
          sent_at: string | null
          status: string
          variables: Json
          workspace_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          id?: string
          lead_id?: string | null
          meta_message_id?: string | null
          name?: string | null
          phone: string
          reachable?: boolean | null
          read_at?: string | null
          reason?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: string
          variables?: Json
          workspace_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          id?: string
          lead_id?: string | null
          meta_message_id?: string | null
          name?: string | null
          phone?: string
          reachable?: boolean | null
          read_at?: string | null
          reason?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: string
          variables?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          body_text: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          delivered_count: number
          failed_count: number
          id: string
          max_delay_sec: number
          media_urls: Json
          min_delay_sec: number
          mode: string
          name: string
          progress: Json
          read_count: number
          replied_count: number
          scheduled_at: string | null
          sent_count: number
          skipped_count: number
          started_at: string | null
          status: string
          template_id: string | null
          total_count: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          body_text?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delivered_count?: number
          failed_count?: number
          id?: string
          max_delay_sec?: number
          media_urls?: Json
          min_delay_sec?: number
          mode?: string
          name: string
          progress?: Json
          read_count?: number
          replied_count?: number
          scheduled_at?: string | null
          sent_count?: number
          skipped_count?: number
          started_at?: string | null
          status?: string
          template_id?: string | null
          total_count?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          body_text?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delivered_count?: number
          failed_count?: number
          id?: string
          max_delay_sec?: number
          media_urls?: Json
          min_delay_sec?: number
          mode?: string
          name?: string
          progress?: Json
          read_count?: number
          replied_count?: number
          scheduled_at?: string | null
          sent_count?: number
          skipped_count?: number
          started_at?: string | null
          status?: string
          template_id?: string | null
          total_count?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount_paise: number
          created_at: string
          id: string
          kind: string
          msgs: number
          notes: string | null
          pack_id: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          amount_paise?: number
          created_at?: string
          id?: string
          kind: string
          msgs: number
          notes?: string | null
          pack_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          id?: string
          kind?: string
          msgs?: number
          notes?: string | null
          pack_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_entries: {
        Row: {
          amount: number
          campaign_id: string | null
          category: string | null
          cost: number
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          lead_id: string | null
          notes: string | null
          type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount?: number
          campaign_id?: string | null
          category?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          type: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          campaign_id?: string | null
          category?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_entries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          source: string
          status: string
          tags: string[]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          source?: string
          status?: string
          tags?: string[]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          source?: string
          status?: string
          tags?: string[]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      message_credits: {
        Row: {
          balance: number
          lifetime_purchased: number
          lifetime_used: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          balance?: number
          lifetime_purchased?: number
          lifetime_used?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          balance?: number
          lifetime_purchased?: number
          lifetime_used?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_credits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_workspace_id: string | null
          address: string | null
          allowed_modules: string[]
          business_category: string | null
          business_type: string | null
          country: string | null
          created_at: string
          currency: string | null
          email: string | null
          full_name: string | null
          gst_number: string | null
          id: string
          is_staff: boolean
          language: string | null
          logo_url: string | null
          notification_sound_enabled: boolean
          onboarding_completed: boolean | null
          owner_id: string | null
          phone: string | null
          price_list_url: string | null
          purpose: string | null
          referral_source: string | null
          role: string | null
          services_concept: string | null
          store_name: string | null
          subscription_status: string | null
          tagline: string | null
          trial_end_date: string | null
          trial_start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_workspace_id?: string | null
          address?: string | null
          allowed_modules?: string[]
          business_category?: string | null
          business_type?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          full_name?: string | null
          gst_number?: string | null
          id?: string
          is_staff?: boolean
          language?: string | null
          logo_url?: string | null
          notification_sound_enabled?: boolean
          onboarding_completed?: boolean | null
          owner_id?: string | null
          phone?: string | null
          price_list_url?: string | null
          purpose?: string | null
          referral_source?: string | null
          role?: string | null
          services_concept?: string | null
          store_name?: string | null
          subscription_status?: string | null
          tagline?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_workspace_id?: string | null
          address?: string | null
          allowed_modules?: string[]
          business_category?: string | null
          business_type?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          full_name?: string | null
          gst_number?: string | null
          id?: string
          is_staff?: boolean
          language?: string | null
          logo_url?: string | null
          notification_sound_enabled?: boolean
          onboarding_completed?: boolean | null
          owner_id?: string | null
          phone?: string | null
          price_list_url?: string | null
          purpose?: string | null
          referral_source?: string | null
          role?: string | null
          services_concept?: string | null
          store_name?: string | null
          subscription_status?: string | null
          tagline?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      super_admins: {
        Row: {
          created_at: string | null
          id: string
          password_hash: string
          session_token: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          password_hash: string
          session_token?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          id?: string
          password_hash?: string
          session_token?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          body: string
          buttons: Json | null
          carousel_cards: Json | null
          category: string
          created_at: string
          created_by: string | null
          footer: string | null
          header: string | null
          header_media_handle: string | null
          header_media_url: string | null
          header_type: string
          id: string
          language: string
          meta_template_id: string | null
          name: string
          rejection_reason: string | null
          status: string
          synced_at: string | null
          updated_at: string
          variables: Json
          workspace_id: string
        }
        Insert: {
          body: string
          buttons?: Json | null
          carousel_cards?: Json | null
          category?: string
          created_at?: string
          created_by?: string | null
          footer?: string | null
          header?: string | null
          header_media_handle?: string | null
          header_media_url?: string | null
          header_type?: string
          id?: string
          language?: string
          meta_template_id?: string | null
          name: string
          rejection_reason?: string | null
          status?: string
          synced_at?: string | null
          updated_at?: string
          variables?: Json
          workspace_id: string
        }
        Update: {
          body?: string
          buttons?: Json | null
          carousel_cards?: Json | null
          category?: string
          created_at?: string
          created_by?: string | null
          footer?: string | null
          header?: string | null
          header_media_handle?: string | null
          header_media_url?: string | null
          header_type?: string
          id?: string
          language?: string
          meta_template_id?: string | null
          name?: string
          rejection_reason?: string | null
          status?: string
          synced_at?: string | null
          updated_at?: string
          variables?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_conversations: {
        Row: {
          assigned_to: string | null
          contact_name: string | null
          contact_phone: string
          created_at: string
          id: string
          last_message_at: string | null
          last_message_direction: string | null
          last_message_text: string | null
          lead_id: string | null
          status: string
          unread_count: number
          updated_at: string
          window_expires_at: string | null
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          contact_name?: string | null
          contact_phone: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_direction?: string | null
          last_message_text?: string | null
          lead_id?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
          window_expires_at?: string | null
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          contact_name?: string | null
          contact_phone?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_direction?: string | null
          last_message_text?: string | null
          lead_id?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
          window_expires_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_messages: {
        Row: {
          body: string | null
          conversation_id: string
          created_at: string
          direction: string
          error: string | null
          from_phone: string | null
          id: string
          media_url: string | null
          message_type: string
          sent_by: string | null
          status: string
          template_name: string | null
          to_phone: string | null
          wa_message_id: string | null
          workspace_id: string
        }
        Insert: {
          body?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          error?: string | null
          from_phone?: string | null
          id?: string
          media_url?: string | null
          message_type?: string
          sent_by?: string | null
          status?: string
          template_name?: string | null
          to_phone?: string | null
          wa_message_id?: string | null
          workspace_id: string
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          error?: string | null
          from_phone?: string | null
          id?: string
          media_url?: string | null
          message_type?: string
          sent_by?: string | null
          status?: string
          template_name?: string | null
          to_phone?: string | null
          wa_message_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_type: string | null
          from_phone: string | null
          id: string
          payload: Json | null
          phone_number_id: string | null
          status: string | null
          summary: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type?: string | null
          from_phone?: string | null
          id?: string
          payload?: Json | null
          phone_number_id?: string | null
          status?: string | null
          summary?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string | null
          from_phone?: string | null
          id?: string
          payload?: Json | null
          phone_number_id?: string | null
          status?: string | null
          summary?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_webhook_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_credentials: {
        Row: {
          access_token: string | null
          app_secret: string | null
          business_phone: string | null
          connected_at: string | null
          connection_type: string
          created_at: string
          last_analytics_sync: string | null
          last_error: string | null
          phone_number_id: string | null
          status: string
          updated_at: string
          verified: boolean
          verified_at: string | null
          waba_id: string | null
          webhook_verify_token: string | null
          workspace_id: string
        }
        Insert: {
          access_token?: string | null
          app_secret?: string | null
          business_phone?: string | null
          connected_at?: string | null
          connection_type?: string
          created_at?: string
          last_analytics_sync?: string | null
          last_error?: string | null
          phone_number_id?: string | null
          status?: string
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
          waba_id?: string | null
          webhook_verify_token?: string | null
          workspace_id: string
        }
        Update: {
          access_token?: string | null
          app_secret?: string | null
          business_phone?: string | null
          connected_at?: string | null
          connection_type?: string
          created_at?: string
          last_analytics_sync?: string | null
          last_error?: string | null
          phone_number_id?: string | null
          status?: string
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
          waba_id?: string | null
          webhook_verify_token?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_credentials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          plan_tier: string
          updated_at: string
          whatsapp_mode: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          owner_id: string
          plan_tier?: string
          updated_at?: string
          whatsapp_mode?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          plan_tier?: string
          updated_at?: string
          whatsapp_mode?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_workspace_id: { Args: never; Returns: string }
      ensure_personal_workspace: {
        Args: { _email: string; _uid: string }
        Returns: string
      }
      is_workspace_member: {
        Args: { _uid: string; _ws: string }
        Returns: boolean
      }
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
