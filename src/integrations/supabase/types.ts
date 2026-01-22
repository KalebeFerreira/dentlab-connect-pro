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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_agent_settings: {
        Row: {
          agent_name: string
          agent_personality: string | null
          auto_reply_outside_hours: boolean | null
          created_at: string
          evolution_api_url: string | null
          evolution_instance_name: string | null
          id: string
          is_whatsapp_enabled: boolean | null
          outside_hours_message: string | null
          updated_at: string
          user_id: string
          welcome_message: string | null
          work_on_weekends: boolean | null
          working_hours_end: string | null
          working_hours_start: string | null
        }
        Insert: {
          agent_name?: string
          agent_personality?: string | null
          auto_reply_outside_hours?: boolean | null
          created_at?: string
          evolution_api_url?: string | null
          evolution_instance_name?: string | null
          id?: string
          is_whatsapp_enabled?: boolean | null
          outside_hours_message?: string | null
          updated_at?: string
          user_id: string
          welcome_message?: string | null
          work_on_weekends?: boolean | null
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Update: {
          agent_name?: string
          agent_personality?: string | null
          auto_reply_outside_hours?: boolean | null
          created_at?: string
          evolution_api_url?: string | null
          evolution_instance_name?: string | null
          id?: string
          is_whatsapp_enabled?: boolean | null
          outside_hours_message?: string | null
          updated_at?: string
          user_id?: string
          welcome_message?: string | null
          work_on_weekends?: boolean | null
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appointment_date: string
          created_at: string
          dentist_id: string | null
          dentist_payment: number | null
          duration_minutes: number
          id: string
          notes: string | null
          patient_id: string
          procedure_type: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
          whatsapp_confirmed: boolean | null
          whatsapp_sent: boolean | null
        }
        Insert: {
          appointment_date: string
          created_at?: string
          dentist_id?: string | null
          dentist_payment?: number | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          patient_id: string
          procedure_type?: string | null
          status?: string
          type: string
          updated_at?: string
          user_id: string
          whatsapp_confirmed?: boolean | null
          whatsapp_sent?: boolean | null
        }
        Update: {
          appointment_date?: string
          created_at?: string
          dentist_id?: string | null
          dentist_payment?: number | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          patient_id?: string
          procedure_type?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
          whatsapp_confirmed?: boolean | null
          whatsapp_sent?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_dentist_id_fkey"
            columns: ["dentist_id"]
            isOneToOne: false
            referencedRelation: "dentists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      automatic_report_schedules: {
        Row: {
          client_email: string | null
          client_name: string
          client_phone: string | null
          created_at: string
          day_of_month: number
          id: string
          is_active: boolean
          last_sent_at: string | null
          report_format: string | null
          send_via_email: boolean
          send_via_whatsapp: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          created_at?: string
          day_of_month?: number
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          report_format?: string | null
          send_via_email?: boolean
          send_via_whatsapp?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          created_at?: string
          day_of_month?: number
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          report_format?: string | null
          send_via_email?: boolean
          send_via_whatsapp?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      campaign_media: {
        Row: {
          campaign_id: string
          caption: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          media_type: string
          sort_order: number | null
          user_id: string
        }
        Insert: {
          campaign_id: string
          caption?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          media_type?: string
          sort_order?: number | null
          user_id: string
        }
        Update: {
          campaign_id?: string
          caption?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          media_type?: string
          sort_order?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_media_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_templates: {
        Row: {
          category: string
          created_at: string
          default_days: number
          default_reason: string
          default_text: string
          id: string
          is_active: boolean
          template_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          default_days?: number
          default_reason: string
          default_text: string
          id?: string
          is_active?: boolean
          template_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          default_days?: number
          default_reason?: string
          default_text?: string
          id?: string
          is_active?: boolean
          template_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      company_info: {
        Row: {
          company_name: string
          cpf_cnpj: string
          created_at: string
          email: string
          id: string
          logo_url: string | null
          phone: string
          signature_position: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name: string
          cpf_cnpj: string
          created_at?: string
          email: string
          id?: string
          logo_url?: string | null
          phone: string
          signature_position?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string
          cpf_cnpj?: string
          created_at?: string
          email?: string
          id?: string
          logo_url?: string | null
          phone?: string
          signature_position?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          created_at: string
          delivered_at: string | null
          delivery_address: string
          delivery_fee: number
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_person_id: string | null
          distance_km: number | null
          id: string
          notes: string | null
          order_id: string | null
          picked_up_at: string | null
          pickup_address: string
          pickup_lat: number | null
          pickup_lng: number | null
          recipient_name: string
          recipient_phone: string
          scheduled_time: string | null
          status: string
          tracking_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          delivery_address: string
          delivery_fee: number
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_person_id?: string | null
          distance_km?: number | null
          id?: string
          notes?: string | null
          order_id?: string | null
          picked_up_at?: string | null
          pickup_address: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          recipient_name: string
          recipient_phone: string
          scheduled_time?: string | null
          status?: string
          tracking_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          delivery_address?: string
          delivery_fee?: number
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_person_id?: string | null
          distance_km?: number | null
          id?: string
          notes?: string | null
          order_id?: string | null
          picked_up_at?: string | null
          pickup_address?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          recipient_name?: string
          recipient_phone?: string
          scheduled_time?: string | null
          status?: string
          tracking_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_delivery_person_id_fkey"
            columns: ["delivery_person_id"]
            isOneToOne: false
            referencedRelation: "delivery_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_persons: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          license_plate: string | null
          name: string
          phone: string
          rating: number | null
          total_deliveries: number | null
          updated_at: string
          user_id: string
          vehicle_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          license_plate?: string | null
          name: string
          phone: string
          rating?: number | null
          total_deliveries?: number | null
          updated_at?: string
          user_id: string
          vehicle_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          license_plate?: string | null
          name?: string
          phone?: string
          rating?: number | null
          total_deliveries?: number | null
          updated_at?: string
          user_id?: string
          vehicle_type?: string
        }
        Relationships: []
      }
      delivery_tracking: {
        Row: {
          created_at: string
          delivery_id: string
          id: string
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          status: string
        }
        Insert: {
          created_at?: string
          delivery_id: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          status: string
        }
        Update: {
          created_at?: string
          delivery_id?: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_tracking_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      dentists: {
        Row: {
          auth_enabled: boolean | null
          created_at: string
          cro: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          specialty: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_enabled?: boolean | null
          created_at?: string
          cro?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          specialty?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_enabled?: boolean | null
          created_at?: string
          cro?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          specialty?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      document_numbers: {
        Row: {
          created_at: string
          document_type: string
          id: string
          last_number: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          document_type: string
          id?: string
          last_number?: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          document_type?: string
          id?: string
          last_number?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      financial_scanned_documents: {
        Row: {
          amount: number | null
          created_at: string
          description: string | null
          document_date: string | null
          document_number: string | null
          file_name: string | null
          file_type: string | null
          id: string
          image_url: string
          transaction_id: string | null
          transaction_type: string | null
          user_id: string
          vendor_name: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          description?: string | null
          document_date?: string | null
          document_number?: string | null
          file_name?: string | null
          file_type?: string | null
          id?: string
          image_url: string
          transaction_id?: string | null
          transaction_type?: string | null
          user_id: string
          vendor_name?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          description?: string | null
          document_date?: string | null
          document_number?: string | null
          file_name?: string | null
          file_type?: string | null
          id?: string
          image_url?: string
          transaction_id?: string | null
          transaction_type?: string | null
          user_id?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_scanned_documents_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          month: number | null
          order_id: string | null
          service_id: string | null
          status: string
          transaction_type: string
          updated_at: string
          user_id: string
          year: number | null
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          month?: number | null
          order_id?: string | null
          service_id?: string | null
          status?: string
          transaction_type: string
          updated_at?: string
          user_id: string
          year?: number | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          month?: number | null
          order_id?: string | null
          service_id?: string | null
          status?: string
          transaction_type?: string
          updated_at?: string
          user_id?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      image_generation_usage: {
        Row: {
          count: number
          created_at: string | null
          id: string
          month: number
          updated_at: string | null
          user_id: string
          year: number
        }
        Insert: {
          count?: number
          created_at?: string | null
          id?: string
          month: number
          updated_at?: string | null
          user_id: string
          year: number
        }
        Update: {
          count?: number
          created_at?: string | null
          id?: string
          month?: number
          updated_at?: string | null
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      laboratory_documents: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          laboratory_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          laboratory_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          laboratory_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "laboratory_documents_laboratory_id_fkey"
            columns: ["laboratory_id"]
            isOneToOne: false
            referencedRelation: "laboratory_info"
            referencedColumns: ["id"]
          },
        ]
      }
      laboratory_info: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          description: string | null
          email: string
          id: string
          is_public: boolean | null
          lab_name: string
          logo_url: string | null
          state: string | null
          updated_at: string
          user_id: string
          whatsapp: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          email: string
          id?: string
          is_public?: boolean | null
          lab_name: string
          logo_url?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
          whatsapp: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          email?: string
          id?: string
          is_public?: boolean | null
          lab_name?: string
          logo_url?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      marketing_campaigns: {
        Row: {
          budget: number | null
          campaign_type: string
          clicks: number | null
          conversions: number | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          impressions: number | null
          spent: number | null
          start_date: string | null
          status: string
          target_audience: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          budget?: number | null
          campaign_type?: string
          clicks?: number | null
          conversions?: number | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          impressions?: number | null
          spent?: number | null
          start_date?: string | null
          status?: string
          target_audience?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          budget?: number | null
          campaign_type?: string
          clicks?: number | null
          conversions?: number | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          impressions?: number | null
          spent?: number | null
          start_date?: string | null
          status?: string
          target_audience?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      message_history: {
        Row: {
          appointment_id: string | null
          created_at: string
          id: string
          message_content: string
          message_type: string
          patient_id: string
          sent_at: string
          status: string
          user_id: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          message_content: string
          message_type: string
          patient_id: string
          sent_at?: string
          status?: string
          user_id: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          message_content?: string
          message_type?: string
          patient_id?: string
          sent_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_history_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_history_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          message_content: string
          template_name: string
          template_type: string
          updated_at: string
          user_id: string
          variables: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          message_content: string
          template_name: string
          template_type: string
          updated_at?: string
          user_id: string
          variables?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          message_content?: string
          template_name?: string
          template_type?: string
          updated_at?: string
          user_id?: string
          variables?: Json | null
        }
        Relationships: []
      }
      order_files: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          order_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          order_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          order_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_files_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_message_history: {
        Row: {
          created_at: string
          id: string
          message_content: string
          message_type: string
          order_id: string
          recipient: string | null
          sent_at: string
          subject: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_content: string
          message_type: string
          order_id: string
          recipient?: string | null
          sent_at?: string
          subject?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_content?: string
          message_type?: string
          order_id?: string
          recipient?: string | null
          sent_at?: string
          subject?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_message_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number | null
          clinic_name: string
          color: string | null
          created_at: string
          custom_color: string | null
          delivery_date: string | null
          dentist_name: string
          entry_date: string | null
          id: string
          laboratory_id: string | null
          observations: string | null
          os_number: string | null
          patient_name: string
          signature_url: string | null
          status: string
          teeth_numbers: string
          updated_at: string
          user_id: string
          work_name: string | null
          work_type: string
        }
        Insert: {
          amount?: number | null
          clinic_name: string
          color?: string | null
          created_at?: string
          custom_color?: string | null
          delivery_date?: string | null
          dentist_name: string
          entry_date?: string | null
          id?: string
          laboratory_id?: string | null
          observations?: string | null
          os_number?: string | null
          patient_name: string
          signature_url?: string | null
          status?: string
          teeth_numbers: string
          updated_at?: string
          user_id: string
          work_name?: string | null
          work_type: string
        }
        Update: {
          amount?: number | null
          clinic_name?: string
          color?: string | null
          created_at?: string
          custom_color?: string | null
          delivery_date?: string | null
          dentist_name?: string
          entry_date?: string | null
          id?: string
          laboratory_id?: string | null
          observations?: string | null
          os_number?: string | null
          patient_name?: string
          signature_url?: string | null
          status?: string
          teeth_numbers?: string
          updated_at?: string
          user_id?: string
          work_name?: string | null
          work_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_laboratory_id_fkey"
            columns: ["laboratory_id"]
            isOneToOne: false
            referencedRelation: "laboratory_info"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          birth_date: string | null
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pdf_generation_usage: {
        Row: {
          count: number
          created_at: string | null
          id: string
          month: number
          updated_at: string | null
          user_id: string
          year: number
        }
        Insert: {
          count?: number
          created_at?: string | null
          id?: string
          month: number
          updated_at?: string | null
          user_id: string
          year: number
        }
        Update: {
          count?: number
          created_at?: string | null
          id?: string
          month?: number
          updated_at?: string | null
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      price_tables: {
        Row: {
          created_at: string
          id: string
          items: Json
          notes: string | null
          table_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          notes?: string | null
          table_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          notes?: string | null
          table_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          favorite_laboratory_id: string | null
          id: string
          name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          favorite_laboratory_id?: string | null
          id?: string
          name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          favorite_laboratory_id?: string | null
          id?: string
          name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_favorite_laboratory_id_fkey"
            columns: ["favorite_laboratory_id"]
            isOneToOne: false
            referencedRelation: "laboratory_info"
            referencedColumns: ["id"]
          },
        ]
      }
      report_history: {
        Row: {
          channel: string
          client_name: string
          created_at: string
          id: string
          month: string
          recipient: string
          sent_at: string
          services_count: number
          total_value: number
          user_id: string
        }
        Insert: {
          channel: string
          client_name: string
          created_at?: string
          id?: string
          month: string
          recipient: string
          sent_at?: string
          services_count: number
          total_value: number
          user_id: string
        }
        Update: {
          channel?: string
          client_name?: string
          created_at?: string
          id?: string
          month?: string
          recipient?: string
          sent_at?: string
          services_count?: number
          total_value?: number
          user_id?: string
        }
        Relationships: []
      }
      scanned_documents: {
        Row: {
          clinic_name: string | null
          created_at: string
          file_name: string | null
          file_type: string | null
          id: string
          image_url: string
          patient_name: string | null
          service_id: string | null
          service_name: string | null
          service_value: number | null
          user_id: string
        }
        Insert: {
          clinic_name?: string | null
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          id?: string
          image_url: string
          patient_name?: string | null
          service_id?: string | null
          service_name?: string | null
          service_value?: number | null
          user_id: string
        }
        Update: {
          clinic_name?: string | null
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          id?: string
          image_url?: string
          patient_name?: string | null
          service_id?: string | null
          service_name?: string | null
          service_value?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scanned_documents_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          client_name: string | null
          color: string | null
          created_at: string
          id: string
          patient_name: string | null
          service_date: string
          service_name: string
          service_value: number
          status: string
          updated_at: string
          user_id: string
          work_type: string | null
        }
        Insert: {
          client_name?: string | null
          color?: string | null
          created_at?: string
          id?: string
          patient_name?: string | null
          service_date?: string
          service_name: string
          service_value: number
          status?: string
          updated_at?: string
          user_id: string
          work_type?: string | null
        }
        Update: {
          client_name?: string | null
          color?: string | null
          created_at?: string
          id?: string
          patient_name?: string | null
          service_date?: string
          service_name?: string
          service_value?: number
          status?: string
          updated_at?: string
          user_id?: string
          work_type?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_name: string
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_name?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_name?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          last_message_at: string
          patient_id: string | null
          patient_name: string | null
          phone_number: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_message_at?: string
          patient_id?: string | null
          patient_name?: string | null
          phone_number: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_message_at?: string
          patient_id?: string | null
          patient_name?: string | null
          phone_number?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          direction: string
          evolution_message_id: string | null
          id: string
          is_from_ai: boolean | null
          message_type: string
          status: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          direction: string
          evolution_message_id?: string | null
          id?: string
          is_from_ai?: boolean | null
          message_type?: string
          status?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          evolution_message_id?: string | null
          id?: string
          is_from_ai?: boolean | null
          message_type?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_tracking_code: { Args: never; Returns: string }
      get_monthly_image_usage: { Args: { p_user_id: string }; Returns: number }
      get_monthly_pdf_usage: { Args: { p_user_id: string }; Returns: number }
      get_next_document_number: {
        Args: { p_document_type: string; p_user_id: string }
        Returns: string
      }
      has_active_subscription: { Args: { p_user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_image_usage: { Args: { p_user_id: string }; Returns: number }
      increment_pdf_usage: { Args: { p_user_id: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "clinic" | "laboratory" | "dentist"
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
      app_role: ["admin", "clinic", "laboratory", "dentist"],
    },
  },
} as const
