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
      active_sessions: {
        Row: {
          created_at: string
          device_name: string | null
          id: string
          ip_address: string | null
          last_active_at: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_name?: string | null
          id?: string
          ip_address?: string | null
          last_active_at?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_name?: string | null
          id?: string
          ip_address?: string | null
          last_active_at?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          branch_id: string | null
          clock_in: string
          clock_out: string | null
          created_at: string
          hours_worked: number | null
          id: string
          notes: string | null
          overtime_hours: number | null
          status: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          hours_worked?: number | null
          id?: string
          notes?: string | null
          overtime_hours?: number | null
          status?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          hours_worked?: number | null
          id?: string
          notes?: string | null
          overtime_hours?: number | null
          status?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          record_id: string | null
          table_name: string | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          code: string | null
          created_at: string
          drug_license: string | null
          email: string | null
          fssai_number: string | null
          gst_number: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          receipt_footer: string | null
          receipt_header: string | null
          tagline: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          code?: string | null
          created_at?: string
          drug_license?: string | null
          email?: string | null
          fssai_number?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          receipt_footer?: string | null
          receipt_header?: string | null
          tagline?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string | null
          created_at?: string
          drug_license?: string | null
          email?: string | null
          fssai_number?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          receipt_footer?: string | null
          receipt_header?: string | null
          tagline?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number | null
          tenant_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number | null
          tenant_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_ledger: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          customer_id: string
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          amount?: number
          balance_after?: number
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          tenant_id: string
          type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          credit_limit: number | null
          email: string | null
          gst_number: string | null
          id: string
          name: string
          outstanding: number | null
          phone: string | null
          reward_points: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          credit_limit?: number | null
          email?: string | null
          gst_number?: string | null
          id?: string
          name: string
          outstanding?: number | null
          phone?: string | null
          reward_points?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          credit_limit?: number | null
          email?: string | null
          gst_number?: string | null
          id?: string
          name?: string
          outstanding?: number | null
          phone?: string | null
          reward_points?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          assigned_user_id: string | null
          branch_id: string | null
          created_at: string
          device_identifier: string | null
          id: string
          last_active_at: string | null
          name: string
          status: Database["public"]["Enums"]["device_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          branch_id?: string | null
          created_at?: string
          device_identifier?: string | null
          id?: string
          last_active_at?: string | null
          name: string
          status?: Database["public"]["Enums"]["device_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          branch_id?: string | null
          created_at?: string
          device_identifier?: string | null
          id?: string
          last_active_at?: string | null
          name?: string
          status?: Database["public"]["Enums"]["device_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          branch_id: string | null
          category: Database["public"]["Enums"]["expense_type"]
          created_at: string
          description: string
          expense_date: string | null
          id: string
          paid_to: string | null
          payment_mode: Database["public"]["Enums"]["payment_mode"] | null
          tenant_id: string
        }
        Insert: {
          amount?: number
          branch_id?: string | null
          category?: Database["public"]["Enums"]["expense_type"]
          created_at?: string
          description: string
          expense_date?: string | null
          id?: string
          paid_to?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"] | null
          tenant_id: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          category?: Database["public"]["Enums"]["expense_type"]
          created_at?: string
          description?: string
          expense_date?: string | null
          id?: string
          paid_to?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"] | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gst_rates: {
        Row: {
          created_at: string
          hsn_code: string | null
          id: string
          name: string
          rate: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          hsn_code?: string | null
          id?: string
          name: string
          rate?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          hsn_code?: string | null
          id?: string
          name?: string
          rate?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gst_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      item_batches: {
        Row: {
          batch_number: string | null
          branch_id: string | null
          created_at: string
          expiry_date: string | null
          id: string
          is_active: boolean
          item_id: string
          mrp: number | null
          purchase_price: number | null
          quantity_in: number
          quantity_out: number
          quantity_remaining: number
          quantity_sold: number
          selling_price: number | null
          tenant_id: string
        }
        Insert: {
          batch_number?: string | null
          branch_id?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          is_active?: boolean
          item_id: string
          mrp?: number | null
          purchase_price?: number | null
          quantity_in?: number
          quantity_out?: number
          quantity_remaining?: number
          quantity_sold?: number
          selling_price?: number | null
          tenant_id: string
        }
        Update: {
          batch_number?: string | null
          branch_id?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          is_active?: boolean
          item_id?: string
          mrp?: number | null
          purchase_price?: number | null
          quantity_in?: number
          quantity_out?: number
          quantity_remaining?: number
          quantity_sold?: number
          selling_price?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_batches_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_batches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          barcode: string | null
          batch_number: string | null
          branch_id: string | null
          category_id: string | null
          color: string | null
          composition: string | null
          cost_price: number | null
          created_at: string
          expiry_date: string | null
          gst_rate: number | null
          hsn_code: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_schedule_h: boolean
          is_weighable: boolean | null
          low_stock_threshold: number | null
          manufacturer: string | null
          material: string | null
          mrp: number
          name: string
          price: number
          rack_location: string | null
          size: string | null
          sku: string | null
          stock: number
          supplier_id: string | null
          tenant_id: string
          unit: string | null
          updated_at: string
          weight_per_unit: number | null
        }
        Insert: {
          barcode?: string | null
          batch_number?: string | null
          branch_id?: string | null
          category_id?: string | null
          color?: string | null
          composition?: string | null
          cost_price?: number | null
          created_at?: string
          expiry_date?: string | null
          gst_rate?: number | null
          hsn_code?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_schedule_h?: boolean
          is_weighable?: boolean | null
          low_stock_threshold?: number | null
          manufacturer?: string | null
          material?: string | null
          mrp?: number
          name: string
          price?: number
          rack_location?: string | null
          size?: string | null
          sku?: string | null
          stock?: number
          supplier_id?: string | null
          tenant_id: string
          unit?: string | null
          updated_at?: string
          weight_per_unit?: number | null
        }
        Update: {
          barcode?: string | null
          batch_number?: string | null
          branch_id?: string | null
          category_id?: string | null
          color?: string | null
          composition?: string | null
          cost_price?: number | null
          created_at?: string
          expiry_date?: string | null
          gst_rate?: number | null
          hsn_code?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_schedule_h?: boolean
          is_weighable?: boolean | null
          low_stock_threshold?: number | null
          manufacturer?: string | null
          material?: string | null
          mrp?: number
          name?: string
          price?: number
          rack_location?: string | null
          size?: string | null
          sku?: string | null
          stock?: number
          supplier_id?: string | null
          tenant_id?: string
          unit?: string | null
          updated_at?: string
          weight_per_unit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          code: string
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number | null
          tenant_id: string
        }
        Insert: {
          code: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number | null
          tenant_id: string
        }
        Update: {
          code?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string
          customer_id: string | null
          id: string
          notes: string | null
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          purchase_id: string | null
          reference_number: string | null
          sale_id: string | null
          supplier_id: string | null
          tenant_id: string
        }
        Insert: {
          amount?: number
          branch_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          purchase_id?: string | null
          reference_number?: string | null
          sale_id?: string | null
          supplier_id?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          purchase_id?: string | null
          reference_number?: string | null
          sale_id?: string | null
          supplier_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          branch_id: string | null
          created_at: string
          customer_id: string | null
          doctor_name: string | null
          file_url: string | null
          id: string
          notes: string | null
          prescription_date: string | null
          sale_id: string | null
          tenant_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          customer_id?: string | null
          doctor_name?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          prescription_date?: string | null
          sale_id?: string | null
          tenant_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          customer_id?: string | null
          doctor_name?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          prescription_date?: string | null
          sale_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          branch_id: string | null
          created_at: string
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          id: string
          item_id: string | null
          item_name: string
          purchase_id: string
          purchase_unit: string
          quantity: number
          tenant_id: string | null
          total: number
          unit_price: number
        }
        Insert: {
          id?: string
          item_id?: string | null
          item_name: string
          purchase_id: string
          purchase_unit?: string
          quantity?: number
          tenant_id?: string | null
          total?: number
          unit_price?: number
        }
        Update: {
          id?: string
          item_id?: string | null
          item_name?: string
          purchase_id?: string
          purchase_unit?: string
          quantity?: number
          tenant_id?: string | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
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
      purchase_return_items: {
        Row: {
          id: string
          item_id: string | null
          item_name: string
          quantity: number
          reason: string | null
          return_id: string
          total: number
          unit_price: number
        }
        Insert: {
          id?: string
          item_id?: string | null
          item_name: string
          quantity?: number
          reason?: string | null
          return_id: string
          total?: number
          unit_price?: number
        }
        Update: {
          id?: string
          item_id?: string | null
          item_name?: string
          quantity?: number
          reason?: string | null
          return_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: []
      }
      purchase_returns: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          purchase_id: string | null
          return_date: string | null
          status: string
          supplier_id: string | null
          tenant_id: string
          total_amount: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          purchase_id?: string | null
          return_date?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id: string
          total_amount?: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          purchase_id?: string | null
          return_date?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id?: string
          total_amount?: number
        }
        Relationships: []
      }
      purchases: {
        Row: {
          branch_id: string | null
          created_at: string
          grand_total: number
          id: string
          invoice_number: string | null
          notes: string | null
          purchase_date: string | null
          status: Database["public"]["Enums"]["purchase_status"]
          subtotal: number
          supplier_id: string | null
          tax_total: number | null
          tenant_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          grand_total?: number
          id?: string
          invoice_number?: string | null
          notes?: string | null
          purchase_date?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          subtotal?: number
          supplier_id?: string | null
          tax_total?: number | null
          tenant_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          grand_total?: number
          id?: string
          invoice_number?: string | null
          notes?: string | null
          purchase_date?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          subtotal?: number
          supplier_id?: string | null
          tax_total?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          batch_id: string | null
          batch_number: string | null
          discount: number | null
          expiry_date: string | null
          id: string
          item_id: string | null
          item_name: string
          quantity: number
          sale_id: string
          tax_amount: number | null
          total: number
          unit_price: number
        }
        Insert: {
          batch_id?: string | null
          batch_number?: string | null
          discount?: number | null
          expiry_date?: string | null
          id?: string
          item_id?: string | null
          item_name: string
          quantity?: number
          sale_id: string
          tax_amount?: number | null
          total?: number
          unit_price?: number
        }
        Update: {
          batch_id?: string | null
          batch_number?: string | null
          discount?: number | null
          expiry_date?: string | null
          id?: string
          item_id?: string | null
          item_name?: string
          quantity?: number
          sale_id?: string
          tax_amount?: number | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "item_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
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
          amount_paid: number | null
          branch_id: string | null
          cashier_id: string | null
          change_amount: number | null
          cost_total: number | null
          created_at: string
          customer_id: string | null
          device_id: string | null
          discount: number | null
          doctor_name: string | null
          grand_total: number
          id: string
          invoice_number: string
          notes: string | null
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          reward_points_earned: number | null
          reward_points_used: number | null
          rx_image_url: string | null
          rx_required: boolean
          status: Database["public"]["Enums"]["sale_status"]
          subtotal: number
          tax_total: number | null
          tenant_id: string
        }
        Insert: {
          amount_paid?: number | null
          branch_id?: string | null
          cashier_id?: string | null
          change_amount?: number | null
          cost_total?: number | null
          created_at?: string
          customer_id?: string | null
          device_id?: string | null
          discount?: number | null
          doctor_name?: string | null
          grand_total?: number
          id?: string
          invoice_number: string
          notes?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          reward_points_earned?: number | null
          reward_points_used?: number | null
          rx_image_url?: string | null
          rx_required?: boolean
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          tax_total?: number | null
          tenant_id: string
        }
        Update: {
          amount_paid?: number | null
          branch_id?: string | null
          cashier_id?: string | null
          change_amount?: number | null
          cost_total?: number | null
          created_at?: string
          customer_id?: string | null
          device_id?: string | null
          discount?: number | null
          doctor_name?: string | null
          grand_total?: number
          id?: string
          invoice_number?: string
          notes?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          reward_points_earned?: number | null
          reward_points_used?: number | null
          rx_image_url?: string | null
          rx_required?: boolean
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          tax_total?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          branch_id: string | null
          closed_at: string | null
          counted_cash: number | null
          created_at: string
          difference: number | null
          expected_cash: number | null
          id: string
          opened_at: string
          starting_cash: number
          status: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          closed_at?: string | null
          counted_cash?: number | null
          created_at?: string
          difference?: number | null
          expected_cash?: number | null
          id?: string
          opened_at?: string
          starting_cash?: number
          status?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          closed_at?: string | null
          counted_cash?: number | null
          created_at?: string
          difference?: number | null
          expected_cash?: number | null
          id?: string
          opened_at?: string
          starting_cash?: number
          status?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shortage_book: {
        Row: {
          branch_id: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          item_name: string
          notes: string | null
          priority: string | null
          requested_quantity: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          item_name: string
          notes?: string | null
          priority?: string | null
          requested_quantity?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          item_name?: string
          notes?: string | null
          priority?: string | null
          requested_quantity?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shortage_book_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shortage_book_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfer_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          quantity: number
          transfer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          quantity?: number
          transfer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          quantity?: number
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          created_at: string
          from_branch_id: string | null
          id: string
          notes: string | null
          reference_number: string | null
          status: string
          tenant_id: string
          to_branch_id: string | null
          transferred_by: string | null
        }
        Insert: {
          created_at?: string
          from_branch_id?: string | null
          id?: string
          notes?: string | null
          reference_number?: string | null
          status?: string
          tenant_id: string
          to_branch_id?: string | null
          transferred_by?: string | null
        }
        Update: {
          created_at?: string
          from_branch_id?: string | null
          id?: string
          notes?: string | null
          reference_number?: string | null
          status?: string
          tenant_id?: string
          to_branch_id?: string | null
          transferred_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_from_branch_id_fkey"
            columns: ["from_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_branch_id_fkey"
            columns: ["to_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_return_items: {
        Row: {
          created_at: string
          id: string
          item_id: string | null
          quantity: number
          return_id: string
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_id?: string | null
          quantity?: number
          return_id: string
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string | null
          quantity?: number
          return_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_return_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "supplier_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_returns: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          notes: string | null
          return_number: string | null
          returned_by: string | null
          status: string
          supplier_id: string | null
          tenant_id: string
          total_amount: number
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          return_number?: string | null
          returned_by?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id: string
          total_amount?: number
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          return_number?: string | null
          returned_by?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_returns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_returns_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_returns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          gst_number: string | null
          id: string
          name: string
          outstanding: number | null
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          name: string
          outstanding?: number | null
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          name?: string
          outstanding?: number | null
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      tenant_settings: {
        Row: {
          created_at: string
          id: string
          loyalty_enabled: boolean
          points_per_rupee: number
          receipt_footer: string | null
          receipt_header: string | null
          receipt_logo_url: string | null
          receipt_terms: string | null
          rupees_per_point: number
          settings: Json
          tenant_id: string
          updated_at: string
          z_report_email: string | null
          z_report_enabled: boolean
          z_report_time: string | null
          z_report_timezone: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          loyalty_enabled?: boolean
          points_per_rupee?: number
          receipt_footer?: string | null
          receipt_header?: string | null
          receipt_logo_url?: string | null
          receipt_terms?: string | null
          rupees_per_point?: number
          settings?: Json
          tenant_id: string
          updated_at?: string
          z_report_email?: string | null
          z_report_enabled?: boolean
          z_report_time?: string | null
          z_report_timezone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          loyalty_enabled?: boolean
          points_per_rupee?: number
          receipt_footer?: string | null
          receipt_header?: string | null
          receipt_logo_url?: string | null
          receipt_terms?: string | null
          rupees_per_point?: number
          settings?: Json
          tenant_id?: string
          updated_at?: string
          z_report_email?: string | null
          z_report_enabled?: boolean
          z_report_time?: string | null
          z_report_timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          gst_number: string | null
          id: string
          industry: Database["public"]["Enums"]["industry_type"]
          is_active: boolean
          logo_url: string | null
          max_branches: number
          max_devices: number
          max_items: number
          max_sessions: number
          max_users: number
          name: string
          owner_id: string | null
          phone: string | null
          subscription: Database["public"]["Enums"]["subscription_plan"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          industry?: Database["public"]["Enums"]["industry_type"]
          is_active?: boolean
          logo_url?: string | null
          max_branches?: number
          max_devices?: number
          max_items?: number
          max_sessions?: number
          max_users?: number
          name: string
          owner_id?: string | null
          phone?: string | null
          subscription?: Database["public"]["Enums"]["subscription_plan"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          industry?: Database["public"]["Enums"]["industry_type"]
          is_active?: boolean
          logo_url?: string | null
          max_branches?: number
          max_devices?: number
          max_items?: number
          max_sessions?: number
          max_users?: number
          name?: string
          owner_id?: string | null
          phone?: string | null
          subscription?: Database["public"]["Enums"]["subscription_plan"]
          updated_at?: string
        }
        Relationships: []
      }
      user_page_access: {
        Row: {
          created_at: string
          id: string
          pages: string[]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pages?: string[]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pages?: string[]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_page_access_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_tenant_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_batch_sold: {
        Args: { p_batch_id: string; p_qty: number }
        Returns: undefined
      }
      is_tenant_active: { Args: never; Returns: boolean }
      update_customer_reward_points: {
        Args: {
          p_customer_id: string
          p_points_earned: number
          p_points_used: number
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "manager" | "cashier" | "staff"
      device_status: "active" | "inactive" | "blocked"
      expense_type: "rent" | "salary" | "utility" | "transport" | "other"
      industry_type: "grocery" | "textile" | "medical" | "fruit" | "custom"
      payment_mode: "cash" | "card" | "upi" | "credit" | "split"
      purchase_status: "pending" | "received" | "partial" | "cancelled"
      sale_status: "completed" | "held" | "cancelled" | "refunded"
      subscription_plan: "free" | "starter" | "business" | "enterprise"
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
      app_role: ["super_admin", "admin", "manager", "cashier", "staff"],
      device_status: ["active", "inactive", "blocked"],
      expense_type: ["rent", "salary", "utility", "transport", "other"],
      industry_type: ["grocery", "textile", "medical", "fruit", "custom"],
      payment_mode: ["cash", "card", "upi", "credit", "split"],
      purchase_status: ["pending", "received", "partial", "cancelled"],
      sale_status: ["completed", "held", "cancelled", "refunded"],
      subscription_plan: ["free", "starter", "business", "enterprise"],
    },
  },
} as const
