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
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          created_at: string
          customer_id: string | null
          employee_id: string | null
          id: string
          notes: string | null
          service_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          created_at?: string
          customer_id?: string | null
          employee_id?: string | null
          id?: string
          notes?: string | null
          service_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          created_at?: string
          customer_id?: string | null
          employee_id?: string | null
          id?: string
          notes?: string | null
          service_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          company: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          industry: string | null
          name: string
          notes: string | null
          risk_level: string | null
          total_outstanding: number | null
          total_paid: number | null
          trust_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          name: string
          notes?: string | null
          risk_level?: string | null
          total_outstanding?: number | null
          total_paid?: number | null
          trust_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          name?: string
          notes?: string | null
          risk_level?: string | null
          total_outstanding?: number | null
          total_paid?: number | null
          trust_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          last_purchase_date: string | null
          name: string
          phone: string | null
          total_purchases: number
          total_visits: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          last_purchase_date?: string | null
          name: string
          phone?: string | null
          total_purchases?: number
          total_visits?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          last_purchase_date?: string | null
          name?: string
          phone?: string | null
          total_purchases?: number
          total_visits?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          commission_percentage: number | null
          created_at: string
          id: string
          name: string
          phone: string | null
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          commission_percentage?: number | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          commission_percentage?: number | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          expense_date: string
          id: string
          name: string
          notes: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          expense_date?: string
          id?: string
          name: string
          notes?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          expense_date?: string
          id?: string
          name?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          advance_amount: number | null
          amount: number
          client_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          invoice_number: string
          payment_terms: string | null
          risk_warning: string | null
          status: string | null
          suggested_advance_percent: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          advance_amount?: number | null
          amount: number
          client_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          payment_terms?: string | null
          risk_warning?: string | null
          status?: string | null
          suggested_advance_percent?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          advance_amount?: number | null
          amount?: number
          client_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          payment_terms?: string | null
          risk_warning?: string | null
          status?: string | null
          suggested_advance_percent?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_history: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          days_late: number | null
          due_date: string | null
          id: string
          invoice_id: string | null
          payment_date: string | null
          status: string | null
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          days_late?: number | null
          due_date?: string | null
          id?: string
          invoice_id?: string | null
          payment_date?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          days_late?: number | null
          due_date?: string | null
          id?: string
          invoice_id?: string | null
          payment_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_history_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sizes: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          size: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          size: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          size?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_sizes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          brand: string
          category: string
          color: string | null
          created_at: string
          gender: string
          id: string
          image_url: string | null
          model_name: string
          purchase_price: number
          rack_location: string | null
          selling_price: number
          supplier_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          barcode?: string | null
          brand: string
          category?: string
          color?: string | null
          created_at?: string
          gender?: string
          id?: string
          image_url?: string | null
          model_name: string
          purchase_price?: number
          rack_location?: string | null
          selling_price?: number
          supplier_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          barcode?: string | null
          brand?: string
          category?: string
          color?: string | null
          created_at?: string
          gender?: string
          id?: string
          image_url?: string | null
          model_name?: string
          purchase_price?: number
          rack_location?: string | null
          selling_price?: number
          supplier_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          business_type: string | null
          country: string | null
          created_at: string
          currency: string | null
          email: string | null
          full_name: string | null
          id: string
          language: string | null
          logo_url: string | null
          notification_sound_enabled: boolean
          onboarding_completed: boolean | null
          phone: string | null
          price_list_url: string | null
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
          address?: string | null
          business_type?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          language?: string | null
          logo_url?: string | null
          notification_sound_enabled?: boolean
          onboarding_completed?: boolean | null
          phone?: string | null
          price_list_url?: string | null
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
          address?: string | null
          business_type?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          language?: string | null
          logo_url?: string | null
          notification_sound_enabled?: boolean
          onboarding_completed?: boolean | null
          phone?: string | null
          price_list_url?: string | null
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
      purchase_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          product_size_id: string | null
          purchase_id: string
          purchase_price: number
          quantity: number
          size: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          product_size_id?: string | null
          purchase_id: string
          purchase_price?: number
          quantity?: number
          size: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          product_size_id?: string | null
          purchase_id?: string
          purchase_price?: number
          quantity?: number
          size?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_product_size_id_fkey"
            columns: ["product_size_id"]
            isOneToOne: false
            referencedRelation: "product_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          id: string
          purchase_date: string
          supplier_id: string | null
          total_amount: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          purchase_date?: string
          supplier_id?: string | null
          total_amount?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          purchase_date?: string
          supplier_id?: string | null
          total_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          created_at: string
          id: string
          product_id: string
          product_size_id: string
          quantity: number
          reason: string | null
          sale_id: string
          sale_item_id: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          product_size_id: string
          quantity?: number
          reason?: string | null
          sale_id: string
          sale_item_id: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          product_size_id?: string
          quantity?: number
          reason?: string | null
          sale_id?: string
          sale_item_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "returns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_product_size_id_fkey"
            columns: ["product_size_id"]
            isOneToOne: false
            referencedRelation: "product_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          product_name: string
          product_size_id: string
          quantity: number
          sale_id: string
          selling_price: number
          size: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          product_name: string
          product_size_id: string
          quantity?: number
          sale_id: string
          selling_price?: number
          size: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          product_name?: string
          product_size_id?: string
          quantity?: number
          sale_id?: string
          selling_price?: number
          size?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_size_id_fkey"
            columns: ["product_size_id"]
            isOneToOne: false
            referencedRelation: "product_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_phone: string | null
          discount_amount: number | null
          discount_type: string | null
          id: string
          invoice_number: string
          payment_method: string
          total_amount: number
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_phone?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          id?: string
          invoice_number: string
          payment_method?: string
          total_amount?: number
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_phone?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          id?: string
          invoice_number?: string
          payment_method?: string
          total_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_invoice_items: {
        Row: {
          created_at: string
          employee_id: string | null
          id: string
          invoice_id: string
          price: number
          quantity: number
          service_id: string | null
          service_name: string
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          id?: string
          invoice_id: string
          price?: number
          quantity?: number
          service_id?: string | null
          service_name?: string
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          id?: string
          invoice_id?: string
          price?: number
          quantity?: number
          service_id?: string | null
          service_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_invoice_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "salon_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_invoice_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_invoices: {
        Row: {
          created_at: string
          customer_id: string | null
          discount: number | null
          gst_type: string
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          payment_mode: string
          total_amount: number
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          discount?: number | null
          gst_type?: string
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          payment_mode?: string
          total_amount?: number
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          discount?: number | null
          gst_type?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          payment_mode?: string
          total_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: string
          created_at: string
          duration: number | null
          gst_applicable: boolean
          id: string
          name: string
          price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          duration?: number | null
          gst_applicable?: boolean
          id?: string
          name: string
          price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          duration?: number | null
          gst_applicable?: boolean
          id?: string
          name?: string
          price?: number
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
      suppliers: {
        Row: {
          address: string | null
          brands_supplied: string[] | null
          created_at: string
          id: string
          name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          brands_supplied?: string[] | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          brands_supplied?: string[] | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tn_agent_versions: {
        Row: {
          agent_id: string
          change_note: string | null
          created_at: string
          created_by: string | null
          id: string
          model: string | null
          system_prompt: string | null
          temperature: number | null
          tools: Json
          user_id: string
        }
        Insert: {
          agent_id: string
          change_note?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          model?: string | null
          system_prompt?: string | null
          temperature?: number | null
          tools?: Json
          user_id: string
        }
        Update: {
          agent_id?: string
          change_note?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          model?: string | null
          system_prompt?: string | null
          temperature?: number | null
          tools?: Json
          user_id?: string
        }
        Relationships: []
      }
      tn_ai_agents: {
        Row: {
          avatar: string | null
          created_at: string
          description: string | null
          greeting: string | null
          id: string
          is_active: boolean
          is_default: boolean
          knowledge: Json
          model: string
          name: string
          system_prompt: string
          temperature: number
          tools: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          description?: string | null
          greeting?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          knowledge?: Json
          model?: string
          name: string
          system_prompt?: string
          temperature?: number
          tools?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          description?: string | null
          greeting?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          knowledge?: Json
          model?: string
          name?: string
          system_prompt?: string
          temperature?: number
          tools?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tn_ai_credits: {
        Row: {
          created_at: string
          free_limit: number
          free_used: number
          id: string
          period_start: string
          purchased_balance: number
          total_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          free_limit?: number
          free_used?: number
          id?: string
          period_start?: string
          purchased_balance?: number
          total_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          free_limit?: number
          free_used?: number
          id?: string
          period_start?: string
          purchased_balance?: number
          total_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tn_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      tn_bookings: {
        Row: {
          addons: Json | null
          address: string | null
          advance_amount: number
          balance_amount: number
          booking_date: string | null
          booking_time: string | null
          created_at: string
          customer_id: string | null
          details: Json | null
          expected_hours: string | null
          flow_token: string | null
          id: string
          landmark: string | null
          name: string | null
          notes: string | null
          phone: string | null
          price: number
          service_code: string | null
          service_name: string | null
          source: string | null
          status: string
          status_history: Json
          transport_details: string | null
          transport_mode: string | null
          updated_at: string
          user_id: string
          wa_id: string
        }
        Insert: {
          addons?: Json | null
          address?: string | null
          advance_amount?: number
          balance_amount?: number
          booking_date?: string | null
          booking_time?: string | null
          created_at?: string
          customer_id?: string | null
          details?: Json | null
          expected_hours?: string | null
          flow_token?: string | null
          id?: string
          landmark?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          price?: number
          service_code?: string | null
          service_name?: string | null
          source?: string | null
          status?: string
          status_history?: Json
          transport_details?: string | null
          transport_mode?: string | null
          updated_at?: string
          user_id: string
          wa_id: string
        }
        Update: {
          addons?: Json | null
          address?: string | null
          advance_amount?: number
          balance_amount?: number
          booking_date?: string | null
          booking_time?: string | null
          created_at?: string
          customer_id?: string | null
          details?: Json | null
          expected_hours?: string | null
          flow_token?: string | null
          id?: string
          landmark?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          price?: number
          service_code?: string | null
          service_name?: string | null
          source?: string | null
          status?: string
          status_history?: Json
          transport_details?: string | null
          transport_mode?: string | null
          updated_at?: string
          user_id?: string
          wa_id?: string
        }
        Relationships: []
      }
      tn_campaigns: {
        Row: {
          audience_snapshot: Json
          created_at: string
          flow_id: string | null
          id: string
          name: string
          schedule_at: string | null
          stats: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audience_snapshot?: Json
          created_at?: string
          flow_id?: string | null
          id?: string
          name: string
          schedule_at?: string | null
          stats?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audience_snapshot?: Json
          created_at?: string
          flow_id?: string | null
          id?: string
          name?: string
          schedule_at?: string | null
          stats?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tn_campaigns_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "tn_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      tn_customers: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          language: string | null
          last_seen_at: string | null
          name: string | null
          updated_at: string
          user_id: string
          wa_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          language?: string | null
          last_seen_at?: string | null
          name?: string | null
          updated_at?: string
          user_id: string
          wa_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          language?: string | null
          last_seen_at?: string | null
          name?: string | null
          updated_at?: string
          user_id?: string
          wa_id?: string
        }
        Relationships: []
      }
      tn_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          expense_date: string
          id: string
          notes: string | null
          payment_method: string | null
          updated_at: string
          user_id: string
          vendor: string | null
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          updated_at?: string
          user_id: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          updated_at?: string
          user_id?: string
          vendor?: string | null
        }
        Relationships: []
      }
      tn_flow_events: {
        Row: {
          campaign_id: string | null
          created_at: string
          customer_id: string | null
          event_type: string
          id: string
          node_id: string | null
          payload: Json
          session_id: string | null
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          customer_id?: string | null
          event_type: string
          id?: string
          node_id?: string | null
          payload?: Json
          session_id?: string | null
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          customer_id?: string | null
          event_type?: string
          id?: string
          node_id?: string | null
          payload?: Json
          session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tn_flow_sessions: {
        Row: {
          current_step: string
          draft_booking: Json | null
          id: string
          updated_at: string
          user_id: string
          wa_id: string
        }
        Insert: {
          current_step?: string
          draft_booking?: Json | null
          id?: string
          updated_at?: string
          user_id: string
          wa_id: string
        }
        Update: {
          current_step?: string
          draft_booking?: Json | null
          id?: string
          updated_at?: string
          user_id?: string
          wa_id?: string
        }
        Relationships: []
      }
      tn_flow_templates: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          edges: Json
          id: string
          is_public: boolean
          name: string
          nodes: Json
          owner_id: string
          share_token: string | null
          tags: string[] | null
          updated_at: string
          uses_count: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          edges?: Json
          id?: string
          is_public?: boolean
          name: string
          nodes?: Json
          owner_id: string
          share_token?: string | null
          tags?: string[] | null
          updated_at?: string
          uses_count?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          edges?: Json
          id?: string
          is_public?: boolean
          name?: string
          nodes?: Json
          owner_id?: string
          share_token?: string | null
          tags?: string[] | null
          updated_at?: string
          uses_count?: number
        }
        Relationships: []
      }
      tn_flows: {
        Row: {
          audience_rules: Json
          created_at: string
          description: string | null
          edges: Json
          id: string
          name: string
          nodes: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audience_rules?: Json
          created_at?: string
          description?: string | null
          edges?: Json
          id?: string
          name: string
          nodes?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audience_rules?: Json
          created_at?: string
          description?: string | null
          edges?: Json
          id?: string
          name?: string
          nodes?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tn_messages: {
        Row: {
          created_at: string
          direction: string
          id: string
          payload: Json | null
          read_at: string | null
          type: string | null
          user_id: string
          wa_id: string
          wa_message_id: string | null
        }
        Insert: {
          created_at?: string
          direction: string
          id?: string
          payload?: Json | null
          read_at?: string | null
          type?: string | null
          user_id: string
          wa_id: string
          wa_message_id?: string | null
        }
        Update: {
          created_at?: string
          direction?: string
          id?: string
          payload?: Json | null
          read_at?: string | null
          type?: string | null
          user_id?: string
          wa_id?: string
          wa_message_id?: string | null
        }
        Relationships: []
      }
      tn_meta_flows: {
        Row: {
          categories: string[] | null
          created_at: string
          endpoint_uri: string | null
          id: string
          meta_id: string
          name: string
          preview: Json
          raw: Json
          status: string | null
          synced_at: string
          updated_at: string
          user_id: string
          validation_errors: Json
        }
        Insert: {
          categories?: string[] | null
          created_at?: string
          endpoint_uri?: string | null
          id?: string
          meta_id: string
          name: string
          preview?: Json
          raw?: Json
          status?: string | null
          synced_at?: string
          updated_at?: string
          user_id: string
          validation_errors?: Json
        }
        Update: {
          categories?: string[] | null
          created_at?: string
          endpoint_uri?: string | null
          id?: string
          meta_id?: string
          name?: string
          preview?: Json
          raw?: Json
          status?: string | null
          synced_at?: string
          updated_at?: string
          user_id?: string
          validation_errors?: Json
        }
        Relationships: []
      }
      tn_meta_templates: {
        Row: {
          category: string | null
          components: Json
          created_at: string
          id: string
          language: string | null
          meta_id: string
          name: string
          quality_rating: string | null
          raw: Json
          status: string | null
          synced_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          components?: Json
          created_at?: string
          id?: string
          language?: string | null
          meta_id: string
          name: string
          quality_rating?: string | null
          raw?: Json
          status?: string | null
          synced_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          components?: Json
          created_at?: string
          id?: string
          language?: string | null
          meta_id?: string
          name?: string
          quality_rating?: string | null
          raw?: Json
          status?: string | null
          synced_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tn_payments: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string
          id: string
          method: string
          screenshot_url: string | null
          status: string
          updated_at: string
          upi_ref: string | null
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          id?: string
          method?: string
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          upi_ref?: string | null
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          id?: string
          method?: string
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          upi_ref?: string | null
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      tn_permission_overrides: {
        Row: {
          action: string
          allowed: boolean
          created_at: string
          granted_by: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action: string
          allowed?: boolean
          created_at?: string
          granted_by?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: string
          allowed?: boolean
          created_at?: string
          granted_by?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tn_services: {
        Row: {
          active: boolean
          base_hours: number | null
          category: string
          code: string
          created_at: string
          id: string
          name_en: string
          name_ta: string | null
          price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          base_hours?: number | null
          category?: string
          code: string
          created_at?: string
          id?: string
          name_en: string
          name_ta?: string | null
          price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          base_hours?: number | null
          category?: string
          code?: string
          created_at?: string
          id?: string
          name_en?: string
          name_ta?: string | null
          price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tn_settings: {
        Row: {
          advance_amount: number
          business_name: string | null
          created_at: string
          flow_body: string | null
          flow_footer: string | null
          flow_header: string | null
          flow_json: Json | null
          greeting_template: string | null
          id: string
          meta_flow_cta: string | null
          meta_flow_id: string | null
          meta_phone_number_id: string | null
          meta_template_language: string | null
          meta_template_name: string | null
          meta_waba_id: string | null
          payee_name: string | null
          qr_image_url: string | null
          updated_at: string
          upi_id: string | null
          user_id: string
          verify_token_hint: string | null
        }
        Insert: {
          advance_amount?: number
          business_name?: string | null
          created_at?: string
          flow_body?: string | null
          flow_footer?: string | null
          flow_header?: string | null
          flow_json?: Json | null
          greeting_template?: string | null
          id?: string
          meta_flow_cta?: string | null
          meta_flow_id?: string | null
          meta_phone_number_id?: string | null
          meta_template_language?: string | null
          meta_template_name?: string | null
          meta_waba_id?: string | null
          payee_name?: string | null
          qr_image_url?: string | null
          updated_at?: string
          upi_id?: string | null
          user_id: string
          verify_token_hint?: string | null
        }
        Update: {
          advance_amount?: number
          business_name?: string | null
          created_at?: string
          flow_body?: string | null
          flow_footer?: string | null
          flow_header?: string | null
          flow_json?: Json | null
          greeting_template?: string | null
          id?: string
          meta_flow_cta?: string | null
          meta_flow_id?: string | null
          meta_phone_number_id?: string | null
          meta_template_language?: string | null
          meta_template_name?: string | null
          meta_waba_id?: string | null
          payee_name?: string | null
          qr_image_url?: string | null
          updated_at?: string
          upi_id?: string | null
          user_id?: string
          verify_token_hint?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      tn_consume_ai_credit: { Args: { _user_id: string }; Returns: Json }
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
