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
      ak_collections: {
        Row: {
          created_at: string | null
          description: Json
          id: string
          slug: string
          title: Json
          year: number | null
        }
        Insert: {
          created_at?: string | null
          description?: Json
          id?: string
          slug: string
          title?: Json
          year?: number | null
        }
        Update: {
          created_at?: string | null
          description?: Json
          id?: string
          slug?: string
          title?: Json
          year?: number | null
        }
        Relationships: []
      }
      ak_inquiries: {
        Row: {
          created_at: string | null
          email: string
          id: string
          message: string
          name: string
          status: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          message: string
          name: string
          status?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          message?: string
          name?: string
          status?: string
        }
        Relationships: []
      }
      ak_product_images: {
        Row: {
          id: string
          image_url: string
          media_type: string
          position: number
          product_id: string
        }
        Insert: {
          id?: string
          image_url: string
          media_type?: string
          position?: number
          product_id: string
        }
        Update: {
          id?: string
          image_url?: string
          media_type?: string
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "ak_products"
            referencedColumns: ["id"]
          },
        ]
      }
      ak_products: {
        Row: {
          collection_id: string | null
          created_at: string | null
          description: Json
          external_link: string | null
          id: string
          price: number | null
          slug: string
          status: string
          title: Json
        }
        Insert: {
          collection_id?: string | null
          created_at?: string | null
          description?: Json
          external_link?: string | null
          id?: string
          price?: number | null
          slug: string
          status?: string
          title?: Json
        }
        Update: {
          collection_id?: string | null
          created_at?: string | null
          description?: Json
          external_link?: string | null
          id?: string
          price?: number | null
          slug?: string
          status?: string
          title?: Json
        }
        Relationships: [
          {
            foreignKeyName: "products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "ak_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string | null
          id: number
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          name: string
        }
        Update: {
          created_at?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          id: number
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          name: string
        }
        Update: {
          created_at?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      cl_clients: {
        Row: {
          address: string | null
          archived_at: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          nif: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          nif: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          nif?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cl_clients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "cl_users"
            referencedColumns: ["id"]
          },
        ]
      }
      cl_gastos: {
        Row: {
          base_imponible_cents: number
          categoria: string
          created_at: string | null
          deducible_percent: number
          descripcion: string
          fecha: string
          id: string
          importe_cents: number
          iva_rate: number
          iva_soportado_cents: number
          justificacion: string | null
          user_id: string | null
        }
        Insert: {
          base_imponible_cents: number
          categoria: string
          created_at?: string | null
          deducible_percent?: number
          descripcion: string
          fecha: string
          id?: string
          importe_cents: number
          iva_rate?: number
          iva_soportado_cents: number
          justificacion?: string | null
          user_id?: string | null
        }
        Update: {
          base_imponible_cents?: number
          categoria?: string
          created_at?: string | null
          deducible_percent?: number
          descripcion?: string
          fecha?: string
          id?: string
          importe_cents?: number
          iva_rate?: number
          iva_soportado_cents?: number
          justificacion?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cl_gastos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "cl_users"
            referencedColumns: ["id"]
          },
        ]
      }
      cl_invoice_items: {
        Row: {
          description: string
          id: string
          invoice_id: string
          iva_rate: number
          quantity: number
          total_cents: number
          unit_price_cents: number
        }
        Insert: {
          description: string
          id?: string
          invoice_id: string
          iva_rate: number
          quantity: number
          total_cents: number
          unit_price_cents: number
        }
        Update: {
          description?: string
          id?: string
          invoice_id?: string
          iva_rate?: number
          quantity?: number
          total_cents?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "cl_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "cl_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      cl_invoice_sequences: {
        Row: {
          current_val: number | null
          user_id: string
          year: number
        }
        Insert: {
          current_val?: number | null
          user_id: string
          year: number
        }
        Update: {
          current_val?: number | null
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "cl_invoice_sequences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "cl_users"
            referencedColumns: ["id"]
          },
        ]
      }
      cl_invoices: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          invoice_number: string
          irpf_retention_cents: number | null
          issue_date: string
          iva_quota_cents: number
          motivo_rectificacion: string | null
          original_invoice_id: string | null
          rectificative: boolean
          status: string | null
          taxable_base_cents: number
          total_cents: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          invoice_number: string
          irpf_retention_cents?: number | null
          issue_date?: string
          iva_quota_cents?: number
          motivo_rectificacion?: string | null
          original_invoice_id?: string | null
          rectificative?: boolean
          status?: string | null
          taxable_base_cents?: number
          total_cents?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          invoice_number?: string
          irpf_retention_cents?: number | null
          issue_date?: string
          iva_quota_cents?: number
          motivo_rectificacion?: string | null
          original_invoice_id?: string | null
          rectificative?: boolean
          status?: string | null
          taxable_base_cents?: number
          total_cents?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cl_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "cl_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cl_invoices_original_invoice_id_fkey"
            columns: ["original_invoice_id"]
            isOneToOne: false
            referencedRelation: "cl_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cl_invoices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "cl_users"
            referencedColumns: ["id"]
          },
        ]
      }
      cl_quarterly_declarations: {
        Row: {
          created_at: string
          declared_at: string
          id: string
          notes: string | null
          quarter: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          declared_at?: string
          id?: string
          notes?: string | null
          quarter: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          declared_at?: string
          id?: string
          notes?: string | null
          quarter?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      cl_services: {
        Row: {
          created_at: string | null
          description: string
          id: string
          iva_rate: number
          price_cents: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          iva_rate: number
          price_cents: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          iva_rate?: number
          price_cents?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cl_services_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "cl_users"
            referencedColumns: ["id"]
          },
        ]
      }
      cl_users: {
        Row: {
          created_at: string | null
          fiscal_address: string | null
          id: string
          logo_url: string | null
          name: string | null
          nif: string | null
          plan: string
          plan_expires_at: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          fiscal_address?: string | null
          id: string
          logo_url?: string | null
          name?: string | null
          nif?: string | null
          plan?: string
          plan_expires_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          fiscal_address?: string | null
          id?: string
          logo_url?: string | null
          name?: string | null
          nif?: string | null
          plan?: string
          plan_expires_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: number
          name: string
          number: string
          phone: string | null
          type: Database["public"]["Enums"]["client_doc_type"]
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: number
          name: string
          number: string
          phone?: string | null
          type: Database["public"]["Enums"]["client_doc_type"]
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: number
          name?: string
          number?: string
          phone?: string | null
          type?: Database["public"]["Enums"]["client_doc_type"]
        }
        Relationships: []
      }
      crm_campaign_prospects: {
        Row: {
          campaign_id: string
          opened_at: string | null
          prospect_id: string
          replied_at: string | null
          sent_at: string | null
        }
        Insert: {
          campaign_id: string
          opened_at?: string | null
          prospect_id: string
          replied_at?: string | null
          sent_at?: string | null
        }
        Update: {
          campaign_id?: string
          opened_at?: string | null
          prospect_id?: string
          replied_at?: string | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_campaign_prospects_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_campaign_prospects_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "crm_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_campaigns: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
          prospect_filter: Json | null
          status: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
          prospect_filter?: Json | null
          status?: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          prospect_filter?: Json | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "crm_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          email: string | null
          full_name: string
          id: string
          is_primary: boolean
          phone: string | null
          prospect_id: string
          role: string | null
        }
        Insert: {
          email?: string | null
          full_name: string
          id?: string
          is_primary?: boolean
          phone?: string | null
          prospect_id: string
          role?: string | null
        }
        Update: {
          email?: string | null
          full_name?: string
          id?: string
          is_primary?: boolean
          phone?: string | null
          prospect_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "crm_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          budget: number | null
          created_at: string
          decision_maker: string | null
          expected_close_date: string | null
          id: string
          monthly_cards_estimate: number | null
          org_id: string
          prospect_id: string
          stage: string
          updated_at: string
          value: number | null
        }
        Insert: {
          budget?: number | null
          created_at?: string
          decision_maker?: string | null
          expected_close_date?: string | null
          id?: string
          monthly_cards_estimate?: number | null
          org_id: string
          prospect_id: string
          stage?: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          budget?: number | null
          created_at?: string
          decision_maker?: string | null
          expected_close_date?: string | null
          id?: string
          monthly_cards_estimate?: number | null
          org_id?: string
          prospect_id?: string
          stage?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "crm_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "crm_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_interactions: {
        Row: {
          contact_id: string | null
          created_at: string
          id: string
          next_action_date: string | null
          notes: string | null
          outcome: string | null
          prospect_id: string
          type: string
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          id?: string
          next_action_date?: string | null
          notes?: string | null
          outcome?: string | null
          prospect_id: string
          type: string
          user_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          id?: string
          next_action_date?: string | null
          notes?: string | null
          outcome?: string | null
          prospect_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_interactions_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "crm_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_org_members: {
        Row: {
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "crm_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          plan: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan?: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan?: string
          slug?: string
        }
        Relationships: []
      }
      crm_prospects: {
        Row: {
          category: string | null
          city: string | null
          created_at: string
          email: string | null
          google_maps_url: string | null
          google_rating: number | null
          id: string
          instagram: string | null
          name: string
          org_id: string
          phone: string | null
          source: string
          status: string
          updated_at: string
          website: string | null
          zone: string | null
        }
        Insert: {
          category?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          google_maps_url?: string | null
          google_rating?: number | null
          id?: string
          instagram?: string | null
          name: string
          org_id: string
          phone?: string | null
          source?: string
          status?: string
          updated_at?: string
          website?: string | null
          zone?: string | null
        }
        Update: {
          category?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          google_maps_url?: string | null
          google_rating?: number | null
          id?: string
          instagram?: string | null
          name?: string
          org_id?: string
          phone?: string | null
          source?: string
          status?: string
          updated_at?: string
          website?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_prospects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "crm_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_event_participants: {
        Row: {
          event_id: string | null
          id: string
          joined_at: string | null
          left_at: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          event_id?: string | null
          id?: string
          joined_at?: string | null
          left_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          event_id?: string | null
          id?: string
          joined_at?: string | null
          left_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "cs_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_event_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "cs_users"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_events: {
        Row: {
          address: string | null
          category: string | null
          city: string | null
          country: string | null
          created_at: string | null
          creator_id: string | null
          current_participants: number | null
          description: string | null
          ends_at: string | null
          id: string
          is_locked: boolean | null
          last_activity_at: string | null
          location: unknown
          location_name: string | null
          max_participants: number | null
          starts_at: string
          status: string | null
          title: string
          updated_at: string | null
          visibility_radius_km: number | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          creator_id?: string | null
          current_participants?: number | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_locked?: boolean | null
          last_activity_at?: string | null
          location?: unknown
          location_name?: string | null
          max_participants?: number | null
          starts_at: string
          status?: string | null
          title: string
          updated_at?: string | null
          visibility_radius_km?: number | null
        }
        Update: {
          address?: string | null
          category?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          creator_id?: string | null
          current_participants?: number | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_locked?: boolean | null
          last_activity_at?: string | null
          location?: unknown
          location_name?: string | null
          max_participants?: number | null
          starts_at?: string
          status?: string | null
          title?: string
          updated_at?: string | null
          visibility_radius_km?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_events_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "cs_users"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_message_photos: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          event_id: string | null
          height: number | null
          id: string
          is_deleted: boolean | null
          message_id: string | null
          mime_type: string | null
          s3_key: string
          s3_url: string
          size_bytes: number | null
          uploader_id: string | null
          width: number | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          event_id?: string | null
          height?: number | null
          id?: string
          is_deleted?: boolean | null
          message_id?: string | null
          mime_type?: string | null
          s3_key: string
          s3_url: string
          size_bytes?: number | null
          uploader_id?: string | null
          width?: number | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          event_id?: string | null
          height?: number | null
          id?: string
          is_deleted?: boolean | null
          message_id?: string | null
          mime_type?: string | null
          s3_key?: string
          s3_url?: string
          size_bytes?: number | null
          uploader_id?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_message_photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "cs_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_message_photos_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "cs_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_message_photos_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "cs_users"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_messages: {
        Row: {
          content: string | null
          created_at: string | null
          deleted_at: string | null
          event_id: string | null
          id: string
          is_deleted: boolean | null
          sender_id: string | null
          type: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          deleted_at?: string | null
          event_id?: string | null
          id?: string
          is_deleted?: boolean | null
          sender_id?: string | null
          type?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          deleted_at?: string | null
          event_id?: string | null
          id?: string
          is_deleted?: boolean | null
          sender_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "cs_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "cs_users"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_user_reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          event_id: string | null
          id: string
          rating: number | null
          reviewed_id: string | null
          reviewer_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          rating?: number | null
          reviewed_id?: string | null
          reviewer_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          rating?: number | null
          reviewed_id?: string | null
          reviewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_user_reviews_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "cs_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_user_reviews_reviewed_id_fkey"
            columns: ["reviewed_id"]
            isOneToOne: false
            referencedRelation: "cs_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_user_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "cs_users"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_users: {
        Row: {
          age: number | null
          avatar_url: string | null
          avg_rating: number | null
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          full_name: string | null
          gender: string | null
          id: string
          interests: string | null
          is_online: boolean | null
          languages: string[] | null
          last_seen_at: string | null
          location_sharing: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          age?: number | null
          avatar_url?: string | null
          avg_rating?: number | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          gender?: string | null
          id: string
          interests?: string | null
          is_online?: boolean | null
          languages?: string[] | null
          last_seen_at?: string | null
          location_sharing?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          age?: number | null
          avatar_url?: string | null
          avg_rating?: number | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          gender?: string | null
          id?: string
          interests?: string | null
          is_online?: boolean | null
          languages?: string[] | null
          last_seen_at?: string | null
          location_sharing?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      document_sequences: {
        Row: {
          current_number: number
          doc_type: Database["public"]["Enums"]["sale_doc_type"]
          id: number
          is_active: boolean
          is_automatic: boolean
          series: string
        }
        Insert: {
          current_number?: number
          doc_type: Database["public"]["Enums"]["sale_doc_type"]
          id?: number
          is_active?: boolean
          is_automatic?: boolean
          series: string
        }
        Update: {
          current_number?: number
          doc_type?: Database["public"]["Enums"]["sale_doc_type"]
          id?: number
          is_active?: boolean
          is_automatic?: boolean
          series?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string | null
          date: string
          description: string | null
          id: string
          image_url: string | null
          location_name: string | null
          location_url: string | null
          price: number | null
          telegram_bot_link: string | null
          title: string
          type: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          description?: string | null
          id?: string
          image_url?: string | null
          location_name?: string | null
          location_url?: string | null
          price?: number | null
          telegram_bot_link?: string | null
          title: string
          type?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          image_url?: string | null
          location_name?: string | null
          location_url?: string | null
          price?: number | null
          telegram_bot_link?: string | null
          title?: string
          type?: string | null
        }
        Relationships: []
      }
      gallery: {
        Row: {
          caption: string | null
          created_at: string | null
          event_id: string | null
          id: string
          image_url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          image_url: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          image_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string | null
          document_ref: string | null
          id: number
          product_id: number | null
          quantity: number
          reason: Database["public"]["Enums"]["movement_reason"]
          type: Database["public"]["Enums"]["movement_type"]
          unit_cost: number
          user_id: string | null
          warehouse_id: number | null
        }
        Insert: {
          created_at?: string | null
          document_ref?: string | null
          id?: number
          product_id?: number | null
          quantity: number
          reason: Database["public"]["Enums"]["movement_reason"]
          type: Database["public"]["Enums"]["movement_type"]
          unit_cost?: number
          user_id?: string | null
          warehouse_id?: number | null
        }
        Update: {
          created_at?: string | null
          document_ref?: string | null
          id?: number
          product_id?: number | null
          quantity?: number
          reason?: Database["public"]["Enums"]["movement_reason"]
          type?: Database["public"]["Enums"]["movement_type"]
          unit_cost?: number
          user_id?: string | null
          warehouse_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      kleiner_cart_items: {
        Row: {
          actualizado_en: string
          cantidad: number
          cart_id: string
          created_at: string
          id: string
          product_id: number
          volumen_ml: number
        }
        Insert: {
          actualizado_en?: string
          cantidad: number
          cart_id: string
          created_at?: string
          id?: string
          product_id: number
          volumen_ml: number
        }
        Update: {
          actualizado_en?: string
          cantidad?: number
          cart_id?: string
          created_at?: string
          id?: string
          product_id?: number
          volumen_ml?: number
        }
        Relationships: [
          {
            foreignKeyName: "kleiner_cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "kleiner_cart_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kleiner_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kleiner_products"
            referencedColumns: ["id"]
          },
        ]
      }
      kleiner_cart_sessions: {
        Row: {
          activo: boolean
          actualizado_en: string
          created_at: string
          id: string
          usuario_id: string
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          created_at?: string
          id?: string
          usuario_id: string
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          created_at?: string
          id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kleiner_cart_sessions_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "kleiner_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kleiner_categories: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          id: number
          imagen_url: string | null
          nombre: string
          orden: number
          slug: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: number
          imagen_url?: string | null
          nombre: string
          orden?: number
          slug: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: number
          imagen_url?: string | null
          nombre?: string
          orden?: number
          slug?: string
        }
        Relationships: []
      }
      kleiner_chat_logs: {
        Row: {
          audio_url: string | null
          content: string
          created_at: string
          id: string
          metadata: Json | null
          origen: string
          role: string
          session_id: string
          tool_calls: Json | null
          usuario_id: string | null
        }
        Insert: {
          audio_url?: string | null
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          origen?: string
          role: string
          session_id: string
          tool_calls?: Json | null
          usuario_id?: string | null
        }
        Update: {
          audio_url?: string | null
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          origen?: string
          role?: string
          session_id?: string
          tool_calls?: Json | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kleiner_chat_logs_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "kleiner_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kleiner_distritos: {
        Row: {
          created_at: string
          disponible: boolean
          id: number
          nombre: string
          tarifa_envio: number
          tiempo_estimado: string | null
        }
        Insert: {
          created_at?: string
          disponible?: boolean
          id?: number
          nombre: string
          tarifa_envio: number
          tiempo_estimado?: string | null
        }
        Update: {
          created_at?: string
          disponible?: boolean
          id?: number
          nombre?: string
          tarifa_envio?: number
          tiempo_estimado?: string | null
        }
        Relationships: []
      }
      kleiner_order_items: {
        Row: {
          cantidad: number
          created_at: string
          id: number
          order_id: number
          precio_unitario: number
          product_id: number
          subtotal: number
        }
        Insert: {
          cantidad: number
          created_at?: string
          id?: number
          order_id: number
          precio_unitario: number
          product_id: number
          subtotal: number
        }
        Update: {
          cantidad?: number
          created_at?: string
          id?: number
          order_id?: number
          precio_unitario?: number
          product_id?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "kleiner_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "kleiner_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kleiner_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kleiner_products"
            referencedColumns: ["id"]
          },
        ]
      }
      kleiner_orders: {
        Row: {
          actualizado_en: string
          codigo_pedido: string
          creado_en: string
          culqi_charge_id: string | null
          descuento: number
          direccion_envio: string
          distrito_id: number | null
          estado: string
          estado_delivery: string | null
          id: number
          metodo_pago: string | null
          notas: string | null
          origen: string
          pagado_en: string | null
          pago_estado: string
          pago_metadata: Json | null
          repartidor_asignado: string | null
          subtotal: number
          tarifa_envio: number
          total: number
          tracking_delivery: Json | null
          usuario_id: string
        }
        Insert: {
          actualizado_en?: string
          codigo_pedido: string
          creado_en?: string
          culqi_charge_id?: string | null
          descuento?: number
          direccion_envio: string
          distrito_id?: number | null
          estado?: string
          estado_delivery?: string | null
          id?: number
          metodo_pago?: string | null
          notas?: string | null
          origen?: string
          pagado_en?: string | null
          pago_estado?: string
          pago_metadata?: Json | null
          repartidor_asignado?: string | null
          subtotal: number
          tarifa_envio: number
          total: number
          tracking_delivery?: Json | null
          usuario_id: string
        }
        Update: {
          actualizado_en?: string
          codigo_pedido?: string
          creado_en?: string
          culqi_charge_id?: string | null
          descuento?: number
          direccion_envio?: string
          distrito_id?: number | null
          estado?: string
          estado_delivery?: string | null
          id?: number
          metodo_pago?: string | null
          notas?: string | null
          origen?: string
          pagado_en?: string | null
          pago_estado?: string
          pago_metadata?: Json | null
          repartidor_asignado?: string | null
          subtotal?: number
          tarifa_envio?: number
          total?: number
          tracking_delivery?: Json | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kleiner_orders_distrito_id_fkey"
            columns: ["distrito_id"]
            isOneToOne: false
            referencedRelation: "kleiner_distritos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kleiner_orders_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "kleiner_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kleiner_products: {
        Row: {
          activo: boolean
          actualizado_en: string
          categoria_id: number | null
          created_at: string
          descripcion: string | null
          descripcion_corta: string | null
          destacado: boolean
          embedding: string | null
          graduacion: number | null
          id: number
          imagen_url: string | null
          imagen_urls: string[] | null
          nombre: string
          precio: number
          precio_oferta: number | null
          sabor: string | null
          slug: string
          stock: number
          volumen_ml: number | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          categoria_id?: number | null
          created_at?: string
          descripcion?: string | null
          descripcion_corta?: string | null
          destacado?: boolean
          embedding?: string | null
          graduacion?: number | null
          id?: number
          imagen_url?: string | null
          imagen_urls?: string[] | null
          nombre: string
          precio: number
          precio_oferta?: number | null
          sabor?: string | null
          slug: string
          stock?: number
          volumen_ml?: number | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          categoria_id?: number | null
          created_at?: string
          descripcion?: string | null
          descripcion_corta?: string | null
          destacado?: boolean
          embedding?: string | null
          graduacion?: number | null
          id?: number
          imagen_url?: string | null
          imagen_urls?: string[] | null
          nombre?: string
          precio?: number
          precio_oferta?: number | null
          sabor?: string | null
          slug?: string
          stock?: number
          volumen_ml?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kleiner_products_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "kleiner_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      kleiner_profiles: {
        Row: {
          actualizado_en: string
          apellido: string
          creado_en: string
          direccion: string | null
          distrito_id: number | null
          email: string
          id: string
          nombre: string
          role: string
          telefono: string | null
        }
        Insert: {
          actualizado_en?: string
          apellido?: string
          creado_en?: string
          direccion?: string | null
          distrito_id?: number | null
          email: string
          id?: string
          nombre?: string
          role?: string
          telefono?: string | null
        }
        Update: {
          actualizado_en?: string
          apellido?: string
          creado_en?: string
          direccion?: string | null
          distrito_id?: number | null
          email?: string
          id?: string
          nombre?: string
          role?: string
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kleiner_profiles_distrito_id_fkey"
            columns: ["distrito_id"]
            isOneToOne: false
            referencedRelation: "kleiner_distritos"
            referencedColumns: ["id"]
          },
        ]
      }
      kleiner_tts_cache: {
        Row: {
          char_count: number | null
          created_at: string
          hit_count: number
          r2_url: string
          text_content: string | null
          text_hash: string
        }
        Insert: {
          char_count?: number | null
          created_at?: string
          hit_count?: number
          r2_url: string
          text_content?: string | null
          text_hash: string
        }
        Update: {
          char_count?: number | null
          created_at?: string
          hit_count?: number
          r2_url?: string
          text_content?: string | null
          text_hash?: string
        }
        Relationships: []
      }
      kushpa_cart_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          quantity: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          quantity?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kushpa_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kushpa_products"
            referencedColumns: ["id"]
          },
        ]
      }
      kushpa_categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      kushpa_order_items: {
        Row: {
          created_at: string | null
          id: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "kushpa_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "kushpa_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kushpa_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kushpa_products"
            referencedColumns: ["id"]
          },
        ]
      }
      kushpa_orders: {
        Row: {
          created_at: string | null
          currency: string
          id: string
          shipping_address: string | null
          status: string
          stripe_payment_intent_id: string | null
          total: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string
          id?: string
          shipping_address?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          total: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string
          id?: string
          shipping_address?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          total?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      kushpa_product_categories: {
        Row: {
          category_id: string
          product_id: string
        }
        Insert: {
          category_id: string
          product_id: string
        }
        Update: {
          category_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kushpa_product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "kushpa_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kushpa_product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kushpa_products"
            referencedColumns: ["id"]
          },
        ]
      }
      kushpa_products: {
        Row: {
          brand: string
          created_at: string | null
          discount_price: number | null
          id: string
          image_url: string
          is_active: boolean | null
          regular_price: number
          slug: string
          stock: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          brand: string
          created_at?: string | null
          discount_price?: number | null
          id?: string
          image_url: string
          is_active?: boolean | null
          regular_price: number
          slug: string
          stock?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          brand?: string
          created_at?: string | null
          discount_price?: number | null
          id?: string
          image_url?: string
          is_active?: boolean | null
          regular_price?: number
          slug?: string
          stock?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      kushpa_profiles: {
        Row: {
          address: string | null
          created_at: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      lena_page_sections: {
        Row: {
          body_en: string
          body_es: string
          published: boolean | null
          section_key: string
          title_en: string
          title_es: string
          updated_at: string | null
        }
        Insert: {
          body_en?: string
          body_es?: string
          published?: boolean | null
          section_key: string
          title_en?: string
          title_es?: string
          updated_at?: string | null
        }
        Update: {
          body_en?: string
          body_es?: string
          published?: boolean | null
          section_key?: string
          title_en?: string
          title_es?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lena_schedule_sessions: {
        Row: {
          club: string
          day_en: string
          day_es: string
          id: number
          level: string
          location: string
          sort_order: number | null
          time: string
        }
        Insert: {
          club: string
          day_en: string
          day_es: string
          id?: number
          level?: string
          location?: string
          sort_order?: number | null
          time: string
        }
        Update: {
          club?: string
          day_en?: string
          day_es?: string
          id?: number
          level?: string
          location?: string
          sort_order?: number | null
          time?: string
        }
        Relationships: []
      }
      lena_testimonials: {
        Row: {
          country_en: string
          country_es: string
          flag: string
          id: number
          name: string
          sort_order: number | null
          text_en: string
          text_es: string
        }
        Insert: {
          country_en?: string
          country_es?: string
          flag?: string
          id?: number
          name: string
          sort_order?: number | null
          text_en: string
          text_es: string
        }
        Update: {
          country_en?: string
          country_es?: string
          flag?: string
          id?: number
          name?: string
          sort_order?: number | null
          text_en?: string
          text_es?: string
        }
        Relationships: []
      }
      lena_words: {
        Row: {
          cyrillic: string
          emoji: string
          id: number
          phonetic: string
          sort_order: number | null
          translation_en: string
          translation_es: string
        }
        Insert: {
          cyrillic: string
          emoji?: string
          id?: number
          phonetic: string
          sort_order?: number | null
          translation_en: string
          translation_es: string
        }
        Update: {
          cyrillic?: string
          emoji?: string
          id?: number
          phonetic?: string
          sort_order?: number | null
          translation_en?: string
          translation_es?: string
        }
        Relationships: []
      }
      nutri_antropometria: {
        Row: {
          cadera: number | null
          cintura: number | null
          created_at: string
          fecha: string
          id: string
          notas: string | null
          paciente_id: string
          peso: number | null
          porcentaje_grasa: number | null
          updated_at: string
        }
        Insert: {
          cadera?: number | null
          cintura?: number | null
          created_at?: string
          fecha: string
          id?: string
          notas?: string | null
          paciente_id: string
          peso?: number | null
          porcentaje_grasa?: number | null
          updated_at?: string
        }
        Update: {
          cadera?: number | null
          cintura?: number | null
          created_at?: string
          fecha?: string
          id?: string
          notas?: string | null
          paciente_id?: string
          peso?: number | null
          porcentaje_grasa?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutri_antropometria_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "nutri_perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nutri_blog_posts: {
        Row: {
          contenido_markdown: string
          created_at: string
          id: string
          imagen_url: string | null
          published: boolean
          published_at: string | null
          slug: string
          tags: string[] | null
          titulo: string
          updated_at: string
        }
        Insert: {
          contenido_markdown?: string
          created_at?: string
          id?: string
          imagen_url?: string | null
          published?: boolean
          published_at?: string | null
          slug: string
          tags?: string[] | null
          titulo: string
          updated_at?: string
        }
        Update: {
          contenido_markdown?: string
          created_at?: string
          id?: string
          imagen_url?: string | null
          published?: boolean
          published_at?: string | null
          slug?: string
          tags?: string[] | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      nutri_citas: {
        Row: {
          created_at: string
          email_paciente_enviado: boolean
          email_profesional_enviado: boolean
          estado: string
          fecha_fin: string
          fecha_inicio: string
          id: string
          notas: string | null
          paciente_email: string
          paciente_id: string | null
          paciente_nombre: string
          paciente_telefono: string
          profesional_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_paciente_enviado?: boolean
          email_profesional_enviado?: boolean
          estado?: string
          fecha_fin: string
          fecha_inicio: string
          id?: string
          notas?: string | null
          paciente_email: string
          paciente_id?: string | null
          paciente_nombre: string
          paciente_telefono: string
          profesional_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_paciente_enviado?: boolean
          email_profesional_enviado?: boolean
          estado?: string
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          notas?: string | null
          paciente_email?: string
          paciente_id?: string | null
          paciente_nombre?: string
          paciente_telefono?: string
          profesional_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutri_citas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "nutri_perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutri_citas_profesional_id_fkey"
            columns: ["profesional_id"]
            isOneToOne: false
            referencedRelation: "nutri_profesional_config"
            referencedColumns: ["id"]
          },
        ]
      }
      nutri_disponibilidad_semanal: {
        Row: {
          activo: boolean
          created_at: string
          dia_semana: number
          hora_fin: string
          hora_inicio: string
          id: string
          profesional_id: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          dia_semana: number
          hora_fin: string
          hora_inicio: string
          id?: string
          profesional_id: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          dia_semana?: number
          hora_fin?: string
          hora_inicio?: string
          id?: string
          profesional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutri_disponibilidad_semanal_profesional_id_fkey"
            columns: ["profesional_id"]
            isOneToOne: false
            referencedRelation: "nutri_profesional_config"
            referencedColumns: ["id"]
          },
        ]
      }
      nutri_fotos: {
        Row: {
          activo: boolean
          created_at: string
          created_by: string | null
          descripcion: string | null
          id: string
          paciente_id: string
          r2_key: string
          titulo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          paciente_id: string
          r2_key: string
          titulo: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          paciente_id?: string
          r2_key?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutri_fotos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "nutri_perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutri_fotos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "nutri_perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nutri_perfiles: {
        Row: {
          created_at: string
          email: string | null
          fecha_nacimiento: string | null
          foto_url: string | null
          historia_clinica: string | null
          id: string
          nombre: string
          rol: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          fecha_nacimiento?: string | null
          foto_url?: string | null
          historia_clinica?: string | null
          id: string
          nombre?: string
          rol?: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          fecha_nacimiento?: string | null
          foto_url?: string | null
          historia_clinica?: string | null
          id?: string
          nombre?: string
          rol?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      nutri_planes: {
        Row: {
          activo: boolean
          created_at: string
          created_by: string | null
          descripcion: string | null
          file_url: string | null
          id: string
          paciente_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          file_url?: string | null
          id?: string
          paciente_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          file_url?: string | null
          id?: string
          paciente_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutri_planes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "nutri_perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutri_planes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "nutri_perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nutri_productos: {
        Row: {
          categoria: string
          created_at: string
          descripcion: string | null
          descripcion_larga: string | null
          id: string
          imagen_url: string | null
          mostrar_en_tienda: boolean
          nombre: string
          orden: number
          precio: number
          slug: string
          updated_at: string
        }
        Insert: {
          categoria: string
          created_at?: string
          descripcion?: string | null
          descripcion_larga?: string | null
          id?: string
          imagen_url?: string | null
          mostrar_en_tienda?: boolean
          nombre: string
          orden?: number
          precio: number
          slug: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          created_at?: string
          descripcion?: string | null
          descripcion_larga?: string | null
          id?: string
          imagen_url?: string | null
          mostrar_en_tienda?: boolean
          nombre?: string
          orden?: number
          precio?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      nutri_profesional_config: {
        Row: {
          created_at: string
          duracion_cita_minutos: number
          email_notificacion: string
          id: string
          nombre: string
          titulo: string
          updated_at: string
          zona_horaria: string
        }
        Insert: {
          created_at?: string
          duracion_cita_minutos?: number
          email_notificacion: string
          id?: string
          nombre?: string
          titulo?: string
          updated_at?: string
          zona_horaria?: string
        }
        Update: {
          created_at?: string
          duracion_cita_minutos?: number
          email_notificacion?: string
          id?: string
          nombre?: string
          titulo?: string
          updated_at?: string
          zona_horaria?: string
        }
        Relationships: []
      }
      productos: {
        Row: {
          brand_id: number | null
          category_id: number | null
          created_at: string | null
          description: string | null
          id: number
          name: string
          sku: string
          unit_id: number | null
          updated_at: string | null
        }
        Insert: {
          brand_id?: number | null
          category_id?: number | null
          created_at?: string | null
          description?: string | null
          id?: number
          name: string
          sku: string
          unit_id?: number | null
          updated_at?: string | null
        }
        Update: {
          brand_id?: number | null
          category_id?: number | null
          created_at?: string | null
          description?: string | null
          id?: number
          name?: string
          sku?: string
          unit_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "productos_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      ptovta_cajas: {
        Row: {
          created_at: string | null
          empresa_id: string
          estado: string
          fecha_apertura: string
          fecha_cierre: string | null
          id: string
          monto_final: number | null
          monto_inicial: number
          notas: string | null
          usuario_id: string
        }
        Insert: {
          created_at?: string | null
          empresa_id: string
          estado?: string
          fecha_apertura?: string
          fecha_cierre?: string | null
          id?: string
          monto_final?: number | null
          monto_inicial?: number
          notas?: string | null
          usuario_id: string
        }
        Update: {
          created_at?: string | null
          empresa_id?: string
          estado?: string
          fecha_apertura?: string
          fecha_cierre?: string | null
          id?: string
          monto_final?: number | null
          monto_inicial?: number
          notas?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ptovta_cajas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ptovta_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ptovta_cajas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "ptovta_perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ptovta_categorias: {
        Row: {
          activo: boolean
          created_at: string | null
          empresa_id: string
          id: string
          nombre: string
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string | null
          empresa_id: string
          id?: string
          nombre: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string | null
          empresa_id?: string
          id?: string
          nombre?: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ptovta_categorias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ptovta_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ptovta_categorias_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "ptovta_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      ptovta_clientes: {
        Row: {
          activo: boolean
          created_at: string | null
          direccion: string | null
          email: string | null
          empresa_id: string
          id: string
          limite_credito: number
          nombre: string
          nro_documento: string | null
          saldo_deudor: number
          telefono: string | null
          tiene_credito: boolean
          tipo_cliente: string
          tipo_documento: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string | null
          direccion?: string | null
          email?: string | null
          empresa_id: string
          id?: string
          limite_credito?: number
          nombre: string
          nro_documento?: string | null
          saldo_deudor?: number
          telefono?: string | null
          tiene_credito?: boolean
          tipo_cliente?: string
          tipo_documento?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string | null
          direccion?: string | null
          email?: string | null
          empresa_id?: string
          id?: string
          limite_credito?: number
          nombre?: string
          nro_documento?: string | null
          saldo_deudor?: number
          telefono?: string | null
          tiene_credito?: boolean
          tipo_cliente?: string
          tipo_documento?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ptovta_clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ptovta_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ptovta_compra_items: {
        Row: {
          cantidad: number
          compra_id: string
          created_at: string
          id: string
          precio_unitario: number
          producto_id: string
          subtotal: number
        }
        Insert: {
          cantidad: number
          compra_id: string
          created_at?: string
          id?: string
          precio_unitario: number
          producto_id: string
          subtotal: number
        }
        Update: {
          cantidad?: number
          compra_id?: string
          created_at?: string
          id?: string
          precio_unitario?: number
          producto_id?: string
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "ptovta_compra_items_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "ptovta_compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ptovta_compra_items_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "ptovta_productos"
            referencedColumns: ["id"]
          },
        ]
      }
      ptovta_compras: {
        Row: {
          created_at: string
          empresa_id: string
          estado_pago: string
          fecha_compra: string
          id: string
          igv: number | null
          monto_pagado: number
          notas: string | null
          nro_documento: string | null
          proveedor_id: string | null
          subtotal: number | null
          total: number
          updated_at: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          estado_pago?: string
          fecha_compra?: string
          id?: string
          igv?: number | null
          monto_pagado?: number
          notas?: string | null
          nro_documento?: string | null
          proveedor_id?: string | null
          subtotal?: number | null
          total: number
          updated_at?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          estado_pago?: string
          fecha_compra?: string
          id?: string
          igv?: number | null
          monto_pagado?: number
          notas?: string | null
          nro_documento?: string | null
          proveedor_id?: string | null
          subtotal?: number | null
          total?: number
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ptovta_compras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ptovta_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ptovta_compras_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "ptovta_proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ptovta_compras_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "ptovta_perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ptovta_empresas: {
        Row: {
          created_at: string | null
          direccion: string | null
          email: string | null
          id: string
          logo_url: string | null
          nombre_comercial: string | null
          nubefact_modo: string | null
          nubefact_token: string | null
          razon_social: string
          ruc: string
          serie_boleta: string | null
          serie_factura: string | null
          serie_nc_boleta: string | null
          serie_nc_factura: string | null
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          nombre_comercial?: string | null
          nubefact_modo?: string | null
          nubefact_token?: string | null
          razon_social: string
          ruc: string
          serie_boleta?: string | null
          serie_factura?: string | null
          serie_nc_boleta?: string | null
          serie_nc_factura?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          nombre_comercial?: string | null
          nubefact_modo?: string | null
          nubefact_token?: string | null
          razon_social?: string
          ruc?: string
          serie_boleta?: string | null
          serie_factura?: string | null
          serie_nc_boleta?: string | null
          serie_nc_factura?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ptovta_kardex: {
        Row: {
          cantidad: number
          created_at: string
          empresa_id: string
          id: string
          motivo: string
          notas: string | null
          producto_id: string
          referencia_id: string | null
          stock_anterior: number
          stock_nuevo: number
          tipo: string
          usuario_id: string | null
        }
        Insert: {
          cantidad: number
          created_at?: string
          empresa_id: string
          id?: string
          motivo: string
          notas?: string | null
          producto_id: string
          referencia_id?: string | null
          stock_anterior: number
          stock_nuevo: number
          tipo: string
          usuario_id?: string | null
        }
        Update: {
          cantidad?: number
          created_at?: string
          empresa_id?: string
          id?: string
          motivo?: string
          notas?: string | null
          producto_id?: string
          referencia_id?: string | null
          stock_anterior?: number
          stock_nuevo?: number
          tipo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ptovta_kardex_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ptovta_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ptovta_kardex_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "ptovta_productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ptovta_kardex_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "ptovta_perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ptovta_movimientos_caja: {
        Row: {
          caja_id: string
          concepto: string
          created_at: string | null
          id: string
          metodo_pago: string
          monto: number
          referencia_id: string | null
          tipo: string
        }
        Insert: {
          caja_id: string
          concepto: string
          created_at?: string | null
          id?: string
          metodo_pago?: string
          monto: number
          referencia_id?: string | null
          tipo: string
        }
        Update: {
          caja_id?: string
          concepto?: string
          created_at?: string | null
          id?: string
          metodo_pago?: string
          monto?: number
          referencia_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ptovta_movimientos_caja_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "ptovta_cajas"
            referencedColumns: ["id"]
          },
        ]
      }
      ptovta_perfiles: {
        Row: {
          activo: boolean | null
          created_at: string | null
          empresa_id: string | null
          id: string
          nombre: string
          rol: string
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          empresa_id?: string | null
          id: string
          nombre: string
          rol?: string
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          nombre?: string
          rol?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ptovta_perfiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ptovta_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ptovta_productos: {
        Row: {
          activo: boolean
          afecto_igv: boolean
          categoria_id: string | null
          codigo: string | null
          codigo_sunat: string | null
          created_at: string | null
          descripcion: string | null
          empresa_id: string
          foto_url: string | null
          id: string
          nombre: string
          precio_compra: number
          precio_mayorista: number
          precio_minorista: number
          stock_actual: number
          stock_minimo: number | null
          unidad_medida_id: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean
          afecto_igv?: boolean
          categoria_id?: string | null
          codigo?: string | null
          codigo_sunat?: string | null
          created_at?: string | null
          descripcion?: string | null
          empresa_id: string
          foto_url?: string | null
          id?: string
          nombre: string
          precio_compra?: number
          precio_mayorista?: number
          precio_minorista?: number
          stock_actual?: number
          stock_minimo?: number | null
          unidad_medida_id?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean
          afecto_igv?: boolean
          categoria_id?: string | null
          codigo?: string | null
          codigo_sunat?: string | null
          created_at?: string | null
          descripcion?: string | null
          empresa_id?: string
          foto_url?: string | null
          id?: string
          nombre?: string
          precio_compra?: number
          precio_mayorista?: number
          precio_minorista?: number
          stock_actual?: number
          stock_minimo?: number | null
          unidad_medida_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ptovta_productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "ptovta_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ptovta_productos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ptovta_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ptovta_productos_unidad_medida_id_fkey"
            columns: ["unidad_medida_id"]
            isOneToOne: false
            referencedRelation: "ptovta_unidades_medida"
            referencedColumns: ["id"]
          },
        ]
      }
      ptovta_proveedores: {
        Row: {
          activo: boolean
          contacto: string | null
          created_at: string
          direccion: string | null
          email: string | null
          empresa_id: string
          id: string
          nombre: string
          ruc: string | null
          saldo_deudor: number
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          contacto?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          empresa_id: string
          id?: string
          nombre: string
          ruc?: string | null
          saldo_deudor?: number
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          contacto?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          empresa_id?: string
          id?: string
          nombre?: string
          ruc?: string | null
          saldo_deudor?: number
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ptovta_proveedores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ptovta_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ptovta_unidades_medida: {
        Row: {
          created_at: string | null
          empresa_id: string
          id: string
          nombre: string
          permite_decimal: boolean
          simbolo: string
        }
        Insert: {
          created_at?: string | null
          empresa_id: string
          id?: string
          nombre: string
          permite_decimal?: boolean
          simbolo: string
        }
        Update: {
          created_at?: string | null
          empresa_id?: string
          id?: string
          nombre?: string
          permite_decimal?: boolean
          simbolo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ptovta_unidades_medida_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ptovta_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ptovta_venta_items: {
        Row: {
          cantidad: number
          created_at: string
          descuento: number
          id: string
          igv: number
          precio_unitario: number
          producto_codigo: string | null
          producto_id: string
          producto_nombre: string
          subtotal: number
          total: number
          venta_id: string
        }
        Insert: {
          cantidad: number
          created_at?: string
          descuento?: number
          id?: string
          igv?: number
          precio_unitario: number
          producto_codigo?: string | null
          producto_id: string
          producto_nombre: string
          subtotal: number
          total: number
          venta_id: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          descuento?: number
          id?: string
          igv?: number
          precio_unitario?: number
          producto_codigo?: string | null
          producto_id?: string
          producto_nombre?: string
          subtotal?: number
          total?: number
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ptovta_venta_items_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "ptovta_productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ptovta_venta_items_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ptovta_ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      ptovta_venta_pagos: {
        Row: {
          created_at: string
          id: string
          metodo_pago: string
          monto: number
          referencia: string | null
          venta_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metodo_pago: string
          monto: number
          referencia?: string | null
          venta_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metodo_pago?: string
          monto?: number
          referencia?: string | null
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ptovta_venta_pagos_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ptovta_ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      ptovta_ventas: {
        Row: {
          caja_id: string | null
          cliente_id: string | null
          correlativo: number | null
          created_at: string
          descuento_total: number
          empresa_id: string
          estado: string
          fecha_emision: string
          id: string
          igv: number
          nota_motivo: string | null
          nubefact_id: string | null
          numero_completo: string | null
          pdf_url: string | null
          referencia_venta_id: string | null
          serie: string | null
          subtotal: number
          sunat_cdr: string | null
          sunat_estado: string | null
          sunat_hash: string | null
          tipo_comprobante: string
          tipo_venta: string
          total: number
          updated_at: string
          usuario_id: string
          xml_url: string | null
        }
        Insert: {
          caja_id?: string | null
          cliente_id?: string | null
          correlativo?: number | null
          created_at?: string
          descuento_total?: number
          empresa_id: string
          estado?: string
          fecha_emision?: string
          id?: string
          igv?: number
          nota_motivo?: string | null
          nubefact_id?: string | null
          numero_completo?: string | null
          pdf_url?: string | null
          referencia_venta_id?: string | null
          serie?: string | null
          subtotal: number
          sunat_cdr?: string | null
          sunat_estado?: string | null
          sunat_hash?: string | null
          tipo_comprobante: string
          tipo_venta?: string
          total: number
          updated_at?: string
          usuario_id: string
          xml_url?: string | null
        }
        Update: {
          caja_id?: string | null
          cliente_id?: string | null
          correlativo?: number | null
          created_at?: string
          descuento_total?: number
          empresa_id?: string
          estado?: string
          fecha_emision?: string
          id?: string
          igv?: number
          nota_motivo?: string | null
          nubefact_id?: string | null
          numero_completo?: string | null
          pdf_url?: string | null
          referencia_venta_id?: string | null
          serie?: string | null
          subtotal?: number
          sunat_cdr?: string | null
          sunat_estado?: string | null
          sunat_hash?: string | null
          tipo_comprobante?: string
          tipo_venta?: string
          total?: number
          updated_at?: string
          usuario_id?: string
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ptovta_ventas_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "ptovta_cajas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ptovta_ventas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "ptovta_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ptovta_ventas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ptovta_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ptovta_ventas_referencia_venta_id_fkey"
            columns: ["referencia_venta_id"]
            isOneToOne: false
            referencedRelation: "ptovta_ventas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ptovta_ventas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "ptovta_perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_auditoria_devoluciones: {
        Row: {
          created_at: string
          devolucion_id: string
          empresa_id: string
          evento: string
          id: string
          metadata: Json
          motivo: string | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          devolucion_id: string
          empresa_id: string
          evento: string
          id?: string
          metadata?: Json
          motivo?: string | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          devolucion_id?: string
          empresa_id?: string
          evento?: string
          id?: string
          metadata?: Json
          motivo?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ra_auditoria_devoluciones_devolucion_id_fkey"
            columns: ["devolucion_id"]
            isOneToOne: false
            referencedRelation: "ra_devoluciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_auditoria_devoluciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ra_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_auditoria_estado_pago_compras: {
        Row: {
          actor_tipo: string
          compra_id: string
          created_at: string
          empresa_id: string
          estado_anterior: Database["public"]["Enums"]["ra_estado_pago_compra"]
          estado_nuevo: Database["public"]["Enums"]["ra_estado_pago_compra"]
          id: string
          motivo: string
          operation_id: string
          request_hash: string
          usuario_id: string | null
        }
        Insert: {
          actor_tipo: string
          compra_id: string
          created_at?: string
          empresa_id: string
          estado_anterior: Database["public"]["Enums"]["ra_estado_pago_compra"]
          estado_nuevo: Database["public"]["Enums"]["ra_estado_pago_compra"]
          id?: string
          motivo: string
          operation_id: string
          request_hash: string
          usuario_id?: string | null
        }
        Update: {
          actor_tipo?: string
          compra_id?: string
          created_at?: string
          empresa_id?: string
          estado_anterior?: Database["public"]["Enums"]["ra_estado_pago_compra"]
          estado_nuevo?: Database["public"]["Enums"]["ra_estado_pago_compra"]
          id?: string
          motivo?: string
          operation_id?: string
          request_hash?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ra_auditoria_estado_pago_compras_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "ra_compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_auditoria_estado_pago_compras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ra_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_cajas: {
        Row: {
          empresa_id: string
          estado: Database["public"]["Enums"]["ra_estado_caja"]
          fecha_apertura: string
          fecha_cierre: string | null
          id: string
          monto_final: number | null
          monto_inicial: number
          notas: string | null
          operation_id: string | null
          request_hash: string | null
          sucursal_id: string
          usuario_id: string
        }
        Insert: {
          empresa_id: string
          estado?: Database["public"]["Enums"]["ra_estado_caja"]
          fecha_apertura?: string
          fecha_cierre?: string | null
          id?: string
          monto_final?: number | null
          monto_inicial?: number
          notas?: string | null
          operation_id?: string | null
          request_hash?: string | null
          sucursal_id: string
          usuario_id: string
        }
        Update: {
          empresa_id?: string
          estado?: Database["public"]["Enums"]["ra_estado_caja"]
          fecha_apertura?: string
          fecha_cierre?: string | null
          id?: string
          monto_final?: number | null
          monto_inicial?: number
          notas?: string | null
          operation_id?: string | null
          request_hash?: string | null
          sucursal_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ra_cajas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ra_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_cajas_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "ra_sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_catalogo_repuestos: {
        Row: {
          activo: boolean
          categoria_id: string
          codigo_oem: string | null
          codigos_alternos: string | null
          created_at: string
          descripcion: string | null
          id: string
          imagen_url: string | null
          marca_auto_id: string | null
          marca_repuesto_id: string | null
          nombre: string
          tipo_repuesto_id: string | null
          tipo_vehiculo: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          categoria_id: string
          codigo_oem?: string | null
          codigos_alternos?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          marca_auto_id?: string | null
          marca_repuesto_id?: string | null
          nombre: string
          tipo_repuesto_id?: string | null
          tipo_vehiculo?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          categoria_id?: string
          codigo_oem?: string | null
          codigos_alternos?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          marca_auto_id?: string | null
          marca_repuesto_id?: string | null
          nombre?: string
          tipo_repuesto_id?: string | null
          tipo_vehiculo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ra_catalogo_repuestos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "ra_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_catalogo_repuestos_marca_auto_id_fkey"
            columns: ["marca_auto_id"]
            isOneToOne: false
            referencedRelation: "ra_marcas_auto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_catalogo_repuestos_marca_repuesto_id_fkey"
            columns: ["marca_repuesto_id"]
            isOneToOne: false
            referencedRelation: "ra_marcas_repuesto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_catalogo_repuestos_tipo_repuesto_id_fkey"
            columns: ["tipo_repuesto_id"]
            isOneToOne: false
            referencedRelation: "ra_tipos_repuesto"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_categorias: {
        Row: {
          activo: boolean
          id: string
          nombre: string
          orden: number
          parent_id: string | null
          slug: string
        }
        Insert: {
          activo?: boolean
          id?: string
          nombre: string
          orden?: number
          parent_id?: string | null
          slug: string
        }
        Update: {
          activo?: boolean
          id?: string
          nombre?: string
          orden?: number
          parent_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "ra_categorias_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "ra_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_chatbot_logs: {
        Row: {
          cantidad_resultados: number
          created_at: string
          filtros: Json | null
          id: string
          pregunta_usuario: string
          respuesta_bot: string
          search_term: string | null
        }
        Insert: {
          cantidad_resultados?: number
          created_at?: string
          filtros?: Json | null
          id?: string
          pregunta_usuario: string
          respuesta_bot: string
          search_term?: string | null
        }
        Update: {
          cantidad_resultados?: number
          created_at?: string
          filtros?: Json | null
          id?: string
          pregunta_usuario?: string
          respuesta_bot?: string
          search_term?: string | null
        }
        Relationships: []
      }
      ra_clientes: {
        Row: {
          activo: boolean
          created_at: string
          direccion: string | null
          email: string | null
          empresa_id: string
          id: string
          limite_credito: number
          nombre: string
          nro_documento: string | null
          saldo_deudor: number
          telefono: string | null
          tiene_credito: boolean
          tipo_cliente: Database["public"]["Enums"]["ra_tipo_cliente"]
          tipo_documento:
            | Database["public"]["Enums"]["ra_tipo_documento"]
            | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          direccion?: string | null
          email?: string | null
          empresa_id: string
          id?: string
          limite_credito?: number
          nombre: string
          nro_documento?: string | null
          saldo_deudor?: number
          telefono?: string | null
          tiene_credito?: boolean
          tipo_cliente?: Database["public"]["Enums"]["ra_tipo_cliente"]
          tipo_documento?:
            | Database["public"]["Enums"]["ra_tipo_documento"]
            | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          direccion?: string | null
          email?: string | null
          empresa_id?: string
          id?: string
          limite_credito?: number
          nombre?: string
          nro_documento?: string | null
          saldo_deudor?: number
          telefono?: string | null
          tiene_credito?: boolean
          tipo_cliente?: Database["public"]["Enums"]["ra_tipo_cliente"]
          tipo_documento?:
            | Database["public"]["Enums"]["ra_tipo_documento"]
            | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ra_clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ra_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_compatibilidades: {
        Row: {
          año_desde: number | null
          año_hasta: number | null
          catalogo_id: string
          id: string
          modelo_id: string
        }
        Insert: {
          año_desde?: number | null
          año_hasta?: number | null
          catalogo_id: string
          id?: string
          modelo_id: string
        }
        Update: {
          año_desde?: number | null
          año_hasta?: number | null
          catalogo_id?: string
          id?: string
          modelo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ra_compatibilidades_catalogo_id_fkey"
            columns: ["catalogo_id"]
            isOneToOne: false
            referencedRelation: "ra_catalogo_repuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_compatibilidades_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "ra_modelos_auto"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_compra_items: {
        Row: {
          cantidad: number
          catalogo_id: string
          compra_id: string
          created_at: string
          id: string
          nombre_producto: string
          precio_unitario: number
          subtotal: number
        }
        Insert: {
          cantidad: number
          catalogo_id: string
          compra_id: string
          created_at?: string
          id?: string
          nombre_producto: string
          precio_unitario: number
          subtotal: number
        }
        Update: {
          cantidad?: number
          catalogo_id?: string
          compra_id?: string
          created_at?: string
          id?: string
          nombre_producto?: string
          precio_unitario?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "ra_compra_items_catalogo_id_fkey"
            columns: ["catalogo_id"]
            isOneToOne: false
            referencedRelation: "ra_catalogo_repuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_compra_items_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "ra_compras"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_compras: {
        Row: {
          created_at: string
          empresa_id: string
          estado: Database["public"]["Enums"]["ra_estado_compra"]
          estado_pago: Database["public"]["Enums"]["ra_estado_pago_compra"]
          fecha_compra: string
          id: string
          igv: number
          moneda: string
          notas: string | null
          nro_doc_norm: string | null
          nro_documento: string | null
          operation_id: string | null
          orden_compra_id: string | null
          proveedor_id: string | null
          request_hash: string | null
          subtotal: number
          sucursal_id: string
          tipo_cambio: number | null
          tipo_documento: string
          total: number
          total_pen: number | null
          updated_at: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          estado?: Database["public"]["Enums"]["ra_estado_compra"]
          estado_pago?: Database["public"]["Enums"]["ra_estado_pago_compra"]
          fecha_compra?: string
          id?: string
          igv?: number
          moneda?: string
          notas?: string | null
          nro_doc_norm?: string | null
          nro_documento?: string | null
          operation_id?: string | null
          orden_compra_id?: string | null
          proveedor_id?: string | null
          request_hash?: string | null
          subtotal?: number
          sucursal_id: string
          tipo_cambio?: number | null
          tipo_documento?: string
          total?: number
          total_pen?: number | null
          updated_at?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          estado?: Database["public"]["Enums"]["ra_estado_compra"]
          estado_pago?: Database["public"]["Enums"]["ra_estado_pago_compra"]
          fecha_compra?: string
          id?: string
          igv?: number
          moneda?: string
          notas?: string | null
          nro_doc_norm?: string | null
          nro_documento?: string | null
          operation_id?: string | null
          orden_compra_id?: string | null
          proveedor_id?: string | null
          request_hash?: string | null
          subtotal?: number
          sucursal_id?: string
          tipo_cambio?: number | null
          tipo_documento?: string
          total?: number
          total_pen?: number | null
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ra_compras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ra_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_compras_orden_compra_id_fkey"
            columns: ["orden_compra_id"]
            isOneToOne: false
            referencedRelation: "ra_ordenes_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_compras_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "ra_proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_compras_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "ra_sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_cuenta_corriente_movimientos: {
        Row: {
          caja_id: string | null
          cliente_id: string
          created_at: string
          devolucion_id: string | null
          empresa_id: string
          fecha: string
          fecha_vencimiento: string | null
          id: string
          metodo_pago: Database["public"]["Enums"]["ra_metodo_pago"] | null
          moneda_cobro: string | null
          monto: number
          operation_id: string | null
          origen: string | null
          referencia: string | null
          request_hash: string | null
          result_snapshot: Json | null
          sucursal_id: string | null
          tipo: Database["public"]["Enums"]["ra_cc_tipo_movimiento"]
          tipo_cambio_cobro: number | null
          usuario_id: string
          venta_id: string
        }
        Insert: {
          caja_id?: string | null
          cliente_id: string
          created_at?: string
          devolucion_id?: string | null
          empresa_id: string
          fecha?: string
          fecha_vencimiento?: string | null
          id?: string
          metodo_pago?: Database["public"]["Enums"]["ra_metodo_pago"] | null
          moneda_cobro?: string | null
          monto: number
          operation_id?: string | null
          origen?: string | null
          referencia?: string | null
          request_hash?: string | null
          result_snapshot?: Json | null
          sucursal_id?: string | null
          tipo: Database["public"]["Enums"]["ra_cc_tipo_movimiento"]
          tipo_cambio_cobro?: number | null
          usuario_id: string
          venta_id: string
        }
        Update: {
          caja_id?: string | null
          cliente_id?: string
          created_at?: string
          devolucion_id?: string | null
          empresa_id?: string
          fecha?: string
          fecha_vencimiento?: string | null
          id?: string
          metodo_pago?: Database["public"]["Enums"]["ra_metodo_pago"] | null
          moneda_cobro?: string | null
          monto?: number
          operation_id?: string | null
          origen?: string | null
          referencia?: string | null
          request_hash?: string | null
          result_snapshot?: Json | null
          sucursal_id?: string | null
          tipo?: Database["public"]["Enums"]["ra_cc_tipo_movimiento"]
          tipo_cambio_cobro?: number | null
          usuario_id?: string
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ra_cuenta_corriente_movimientos_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "ra_cajas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_cuenta_corriente_movimientos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "ra_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_cuenta_corriente_movimientos_devolucion_id_fkey"
            columns: ["devolucion_id"]
            isOneToOne: false
            referencedRelation: "ra_devoluciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_cuenta_corriente_movimientos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ra_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_cuenta_corriente_movimientos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "ra_sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_cuenta_corriente_movimientos_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ra_ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_cuentas_por_pagar_movimientos: {
        Row: {
          caja_id: string | null
          compra_id: string
          created_at: string
          empresa_id: string
          fecha: string
          id: string
          metodo_pago: Database["public"]["Enums"]["ra_metodo_pago"] | null
          monto: number
          operation_id: string | null
          proveedor_id: string
          referencia: string | null
          request_hash: string | null
          result_snapshot: Json | null
          sucursal_id: string | null
          tipo: Database["public"]["Enums"]["ra_cxp_tipo_movimiento"]
          usuario_id: string
        }
        Insert: {
          caja_id?: string | null
          compra_id: string
          created_at?: string
          empresa_id: string
          fecha?: string
          id?: string
          metodo_pago?: Database["public"]["Enums"]["ra_metodo_pago"] | null
          monto: number
          operation_id?: string | null
          proveedor_id: string
          referencia?: string | null
          request_hash?: string | null
          result_snapshot?: Json | null
          sucursal_id?: string | null
          tipo: Database["public"]["Enums"]["ra_cxp_tipo_movimiento"]
          usuario_id: string
        }
        Update: {
          caja_id?: string | null
          compra_id?: string
          created_at?: string
          empresa_id?: string
          fecha?: string
          id?: string
          metodo_pago?: Database["public"]["Enums"]["ra_metodo_pago"] | null
          monto?: number
          operation_id?: string | null
          proveedor_id?: string
          referencia?: string | null
          request_hash?: string | null
          result_snapshot?: Json | null
          sucursal_id?: string | null
          tipo?: Database["public"]["Enums"]["ra_cxp_tipo_movimiento"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ra_cuentas_por_pagar_movimientos_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "ra_cajas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_cuentas_por_pagar_movimientos_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "ra_compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_cuentas_por_pagar_movimientos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ra_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_cuentas_por_pagar_movimientos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "ra_proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_cuentas_por_pagar_movimientos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "ra_sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_devolucion_items: {
        Row: {
          cantidad: number
          catalogo_id: string
          created_at: string
          devolucion_id: string
          id: string
          importe: number
          reingresa_stock: boolean
          venta_item_id: string
        }
        Insert: {
          cantidad: number
          catalogo_id: string
          created_at?: string
          devolucion_id: string
          id?: string
          importe: number
          reingresa_stock?: boolean
          venta_item_id: string
        }
        Update: {
          cantidad?: number
          catalogo_id?: string
          created_at?: string
          devolucion_id?: string
          id?: string
          importe?: number
          reingresa_stock?: boolean
          venta_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ra_devolucion_items_catalogo_id_fkey"
            columns: ["catalogo_id"]
            isOneToOne: false
            referencedRelation: "ra_catalogo_repuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_devolucion_items_devolucion_id_fkey"
            columns: ["devolucion_id"]
            isOneToOne: false
            referencedRelation: "ra_devoluciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_devolucion_items_venta_item_id_fkey"
            columns: ["venta_item_id"]
            isOneToOne: false
            referencedRelation: "ra_venta_items"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_devolucion_liquidaciones: {
        Row: {
          created_at: string
          devolucion_id: string
          id: string
          metodo_pago: Database["public"]["Enums"]["ra_metodo_pago"]
          monto: number
          movimiento_caja_id: string | null
          movimiento_cuenta_corriente_id: string | null
          referencia: string | null
        }
        Insert: {
          created_at?: string
          devolucion_id: string
          id?: string
          metodo_pago: Database["public"]["Enums"]["ra_metodo_pago"]
          monto: number
          movimiento_caja_id?: string | null
          movimiento_cuenta_corriente_id?: string | null
          referencia?: string | null
        }
        Update: {
          created_at?: string
          devolucion_id?: string
          id?: string
          metodo_pago?: Database["public"]["Enums"]["ra_metodo_pago"]
          monto?: number
          movimiento_caja_id?: string | null
          movimiento_cuenta_corriente_id?: string | null
          referencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ra_devolucion_liquidaciones_devolucion_id_fkey"
            columns: ["devolucion_id"]
            isOneToOne: false
            referencedRelation: "ra_devoluciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_devolucion_liquidaciones_movimiento_caja_id_fkey"
            columns: ["movimiento_caja_id"]
            isOneToOne: false
            referencedRelation: "ra_movimientos_caja"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_devolucion_liquidaciones_movimiento_cuenta_corriente_id_fkey"
            columns: ["movimiento_cuenta_corriente_id"]
            isOneToOne: false
            referencedRelation: "ra_cuenta_corriente_movimientos"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_devoluciones: {
        Row: {
          approved_at: string | null
          aprobacion_operation_id: string | null
          aprobacion_request_hash: string | null
          aprobador_id: string | null
          condicion_declarada: string | null
          created_at: string
          empresa_id: string
          estado: Database["public"]["Enums"]["ra_estado_devolucion"]
          id: string
          liquidador_id: string | null
          liquidated_at: string | null
          motivo: string
          operation_id: string | null
          received_at: string | null
          recepcion_observacion: string | null
          recepcion_operation_id: string | null
          recepcion_operativa_at: string | null
          recepcion_operativa_por: string | null
          recepcion_recibido: boolean | null
          recepcion_request_hash: string | null
          receptor_id: string | null
          rechazo_motivo: string | null
          rechazo_operation_id: string | null
          rechazo_request_hash: string | null
          reingreso_aprobado: boolean | null
          reingreso_override_motivo: string | null
          request_hash: string | null
          result_snapshot: Json | null
          solicitante_id: string
          solicitud_operation_id: string
          solicitud_request_hash: string
          sucursal_id: string
          updated_at: string
          venta_created_at: string
          venta_id: string
        }
        Insert: {
          approved_at?: string | null
          aprobacion_operation_id?: string | null
          aprobacion_request_hash?: string | null
          aprobador_id?: string | null
          condicion_declarada?: string | null
          created_at?: string
          empresa_id: string
          estado?: Database["public"]["Enums"]["ra_estado_devolucion"]
          id?: string
          liquidador_id?: string | null
          liquidated_at?: string | null
          motivo: string
          operation_id?: string | null
          received_at?: string | null
          recepcion_observacion?: string | null
          recepcion_operation_id?: string | null
          recepcion_operativa_at?: string | null
          recepcion_operativa_por?: string | null
          recepcion_recibido?: boolean | null
          recepcion_request_hash?: string | null
          receptor_id?: string | null
          rechazo_motivo?: string | null
          rechazo_operation_id?: string | null
          rechazo_request_hash?: string | null
          reingreso_aprobado?: boolean | null
          reingreso_override_motivo?: string | null
          request_hash?: string | null
          result_snapshot?: Json | null
          solicitante_id: string
          solicitud_operation_id: string
          solicitud_request_hash: string
          sucursal_id: string
          updated_at?: string
          venta_created_at: string
          venta_id: string
        }
        Update: {
          approved_at?: string | null
          aprobacion_operation_id?: string | null
          aprobacion_request_hash?: string | null
          aprobador_id?: string | null
          condicion_declarada?: string | null
          created_at?: string
          empresa_id?: string
          estado?: Database["public"]["Enums"]["ra_estado_devolucion"]
          id?: string
          liquidador_id?: string | null
          liquidated_at?: string | null
          motivo?: string
          operation_id?: string | null
          received_at?: string | null
          recepcion_observacion?: string | null
          recepcion_operation_id?: string | null
          recepcion_operativa_at?: string | null
          recepcion_operativa_por?: string | null
          recepcion_recibido?: boolean | null
          recepcion_request_hash?: string | null
          receptor_id?: string | null
          rechazo_motivo?: string | null
          rechazo_operation_id?: string | null
          rechazo_request_hash?: string | null
          reingreso_aprobado?: boolean | null
          reingreso_override_motivo?: string | null
          request_hash?: string | null
          result_snapshot?: Json | null
          solicitante_id?: string
          solicitud_operation_id?: string
          solicitud_request_hash?: string
          sucursal_id?: string
          updated_at?: string
          venta_created_at?: string
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ra_devoluciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ra_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_devoluciones_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "ra_sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_devoluciones_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ra_ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_empresas: {
        Row: {
          activo: boolean
          created_at: string
          direccion: string | null
          email: string | null
          id: string
          logo_url: string | null
          nombre: string
          razon_social: string | null
          ruc: string | null
          serie_boleta: string | null
          serie_factura: string | null
          serie_ticket: string | null
          slug: string
          telefono: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          nombre: string
          razon_social?: string | null
          ruc?: string | null
          serie_boleta?: string | null
          serie_factura?: string | null
          serie_ticket?: string | null
          slug: string
          telefono?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          nombre?: string
          razon_social?: string | null
          ruc?: string | null
          serie_boleta?: string | null
          serie_factura?: string | null
          serie_ticket?: string | null
          slug?: string
          telefono?: string | null
        }
        Relationships: []
      }
      ra_guia_items: {
        Row: {
          cantidad: number
          catalogo_id: string
          created_at: string
          guia_id: string
          id: string
          nombre_producto: string
        }
        Insert: {
          cantidad: number
          catalogo_id: string
          created_at?: string
          guia_id: string
          id?: string
          nombre_producto: string
        }
        Update: {
          cantidad?: number
          catalogo_id?: string
          created_at?: string
          guia_id?: string
          id?: string
          nombre_producto?: string
        }
        Relationships: [
          {
            foreignKeyName: "ra_guia_items_catalogo_id_fkey"
            columns: ["catalogo_id"]
            isOneToOne: false
            referencedRelation: "ra_catalogo_repuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_guia_items_guia_id_fkey"
            columns: ["guia_id"]
            isOneToOne: false
            referencedRelation: "ra_guias_remision"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_guias_remision: {
        Row: {
          correlativo: number | null
          created_at: string
          empresa_id: string
          estado: Database["public"]["Enums"]["ra_estado_guia"]
          fecha_emision: string | null
          fecha_recepcion: string | null
          id: string
          notas: string | null
          serie: string | null
          sucursal_destino_id: string
          sucursal_origen_id: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          correlativo?: number | null
          created_at?: string
          empresa_id: string
          estado?: Database["public"]["Enums"]["ra_estado_guia"]
          fecha_emision?: string | null
          fecha_recepcion?: string | null
          id?: string
          notas?: string | null
          serie?: string | null
          sucursal_destino_id: string
          sucursal_origen_id: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          correlativo?: number | null
          created_at?: string
          empresa_id?: string
          estado?: Database["public"]["Enums"]["ra_estado_guia"]
          fecha_emision?: string | null
          fecha_recepcion?: string | null
          id?: string
          notas?: string | null
          serie?: string | null
          sucursal_destino_id?: string
          sucursal_origen_id?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ra_guias_remision_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ra_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_guias_remision_sucursal_destino_id_fkey"
            columns: ["sucursal_destino_id"]
            isOneToOne: false
            referencedRelation: "ra_sucursales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_guias_remision_sucursal_origen_id_fkey"
            columns: ["sucursal_origen_id"]
            isOneToOne: false
            referencedRelation: "ra_sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_kardex: {
        Row: {
          cantidad: number
          catalogo_id: string
          created_at: string
          empresa_id: string
          id: string
          motivo: Database["public"]["Enums"]["ra_motivo_kardex"]
          notas: string | null
          referencia_id: string | null
          stock_anterior: number
          stock_nuevo: number
          sucursal_id: string
          tipo: Database["public"]["Enums"]["ra_tipo_kardex"]
          usuario_id: string | null
        }
        Insert: {
          cantidad: number
          catalogo_id: string
          created_at?: string
          empresa_id: string
          id?: string
          motivo: Database["public"]["Enums"]["ra_motivo_kardex"]
          notas?: string | null
          referencia_id?: string | null
          stock_anterior: number
          stock_nuevo: number
          sucursal_id: string
          tipo: Database["public"]["Enums"]["ra_tipo_kardex"]
          usuario_id?: string | null
        }
        Update: {
          cantidad?: number
          catalogo_id?: string
          created_at?: string
          empresa_id?: string
          id?: string
          motivo?: Database["public"]["Enums"]["ra_motivo_kardex"]
          notas?: string | null
          referencia_id?: string | null
          stock_anterior?: number
          stock_nuevo?: number
          sucursal_id?: string
          tipo?: Database["public"]["Enums"]["ra_tipo_kardex"]
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ra_kardex_catalogo_id_fkey"
            columns: ["catalogo_id"]
            isOneToOne: false
            referencedRelation: "ra_catalogo_repuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_kardex_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ra_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_kardex_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "ra_sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_liquidaciones: {
        Row: {
          caja_id: string
          conteo_credito: number
          conteo_efectivo: number
          conteo_tarjeta: number
          conteo_transferencia: number
          conteo_yape: number
          created_at: string
          diff_credito: number | null
          diff_efectivo: number | null
          diff_tarjeta: number | null
          diff_transferencia: number | null
          diff_yape: number | null
          empresa_id: string
          estado_revision: string
          id: string
          motivo_revision: string | null
          notas: string | null
          operation_id: string | null
          request_hash: string | null
          review_operation_id: string | null
          review_request_hash: string | null
          review_result_snapshot: Json | null
          revisado_at: string | null
          revisado_por: string | null
          sistema_credito: number
          sistema_efectivo: number
          sistema_tarjeta: number
          sistema_transferencia: number
          sistema_yape: number
          usuario_id: string
        }
        Insert: {
          caja_id: string
          conteo_credito?: number
          conteo_efectivo?: number
          conteo_tarjeta?: number
          conteo_transferencia?: number
          conteo_yape?: number
          created_at?: string
          diff_credito?: number | null
          diff_efectivo?: number | null
          diff_tarjeta?: number | null
          diff_transferencia?: number | null
          diff_yape?: number | null
          empresa_id: string
          estado_revision?: string
          id?: string
          motivo_revision?: string | null
          notas?: string | null
          operation_id?: string | null
          request_hash?: string | null
          review_operation_id?: string | null
          review_request_hash?: string | null
          review_result_snapshot?: Json | null
          revisado_at?: string | null
          revisado_por?: string | null
          sistema_credito?: number
          sistema_efectivo?: number
          sistema_tarjeta?: number
          sistema_transferencia?: number
          sistema_yape?: number
          usuario_id: string
        }
        Update: {
          caja_id?: string
          conteo_credito?: number
          conteo_efectivo?: number
          conteo_tarjeta?: number
          conteo_transferencia?: number
          conteo_yape?: number
          created_at?: string
          diff_credito?: number | null
          diff_efectivo?: number | null
          diff_tarjeta?: number | null
          diff_transferencia?: number | null
          diff_yape?: number | null
          empresa_id?: string
          estado_revision?: string
          id?: string
          motivo_revision?: string | null
          notas?: string | null
          operation_id?: string | null
          request_hash?: string | null
          review_operation_id?: string | null
          review_request_hash?: string | null
          review_result_snapshot?: Json | null
          revisado_at?: string | null
          revisado_por?: string | null
          sistema_credito?: number
          sistema_efectivo?: number
          sistema_tarjeta?: number
          sistema_transferencia?: number
          sistema_yape?: number
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ra_liquidaciones_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "ra_cajas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_liquidaciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ra_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_marcas_auto: {
        Row: {
          activo: boolean
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      ra_marcas_repuesto: {
        Row: {
          activo: boolean
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      ra_modelos_auto: {
        Row: {
          activo: boolean
          año_desde: number | null
          año_hasta: number | null
          cc: string | null
          id: string
          imagen_url: string | null
          marca_id: string
          motor: string | null
          nombre: string
          slug: string
          tagline: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean
          año_desde?: number | null
          año_hasta?: number | null
          cc?: string | null
          id?: string
          imagen_url?: string | null
          marca_id: string
          motor?: string | null
          nombre: string
          slug: string
          tagline?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean
          año_desde?: number | null
          año_hasta?: number | null
          cc?: string | null
          id?: string
          imagen_url?: string | null
          marca_id?: string
          motor?: string | null
          nombre?: string
          slug?: string
          tagline?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ra_modelos_auto_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "ra_marcas_auto"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_movimientos_caja: {
        Row: {
          caja_id: string
          concepto: string
          created_at: string
          devolucion_id: string | null
          id: string
          metodo_pago: Database["public"]["Enums"]["ra_metodo_pago"]
          monto: number
          notas: string | null
          operation_id: string | null
          origen: string | null
          referencia_id: string | null
          request_hash: string | null
          tipo: Database["public"]["Enums"]["ra_tipo_movimiento"]
          usuario_id: string | null
        }
        Insert: {
          caja_id: string
          concepto: string
          created_at?: string
          devolucion_id?: string | null
          id?: string
          metodo_pago?: Database["public"]["Enums"]["ra_metodo_pago"]
          monto: number
          notas?: string | null
          operation_id?: string | null
          origen?: string | null
          referencia_id?: string | null
          request_hash?: string | null
          tipo: Database["public"]["Enums"]["ra_tipo_movimiento"]
          usuario_id?: string | null
        }
        Update: {
          caja_id?: string
          concepto?: string
          created_at?: string
          devolucion_id?: string | null
          id?: string
          metodo_pago?: Database["public"]["Enums"]["ra_metodo_pago"]
          monto?: number
          notas?: string | null
          operation_id?: string | null
          origen?: string | null
          referencia_id?: string | null
          request_hash?: string | null
          tipo?: Database["public"]["Enums"]["ra_tipo_movimiento"]
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ra_movimientos_caja_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "ra_cajas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_movimientos_caja_devolucion_id_fkey"
            columns: ["devolucion_id"]
            isOneToOne: false
            referencedRelation: "ra_devoluciones"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_orden_compra_items: {
        Row: {
          cantidad: number
          cantidad_recibida: number
          catalogo_id: string
          created_at: string
          id: string
          nombre_producto: string
          orden_compra_id: string
          precio_unitario: number
          subtotal: number
        }
        Insert: {
          cantidad: number
          cantidad_recibida?: number
          catalogo_id: string
          created_at?: string
          id?: string
          nombre_producto: string
          orden_compra_id: string
          precio_unitario: number
          subtotal: number
        }
        Update: {
          cantidad?: number
          cantidad_recibida?: number
          catalogo_id?: string
          created_at?: string
          id?: string
          nombre_producto?: string
          orden_compra_id?: string
          precio_unitario?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "ra_orden_compra_items_catalogo_id_fkey"
            columns: ["catalogo_id"]
            isOneToOne: false
            referencedRelation: "ra_catalogo_repuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_orden_compra_items_orden_compra_id_fkey"
            columns: ["orden_compra_id"]
            isOneToOne: false
            referencedRelation: "ra_ordenes_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_ordenes_compra: {
        Row: {
          created_at: string
          empresa_id: string
          estado: Database["public"]["Enums"]["ra_estado_orden_compra"]
          fecha: string
          id: string
          notas: string | null
          proveedor_id: string | null
          referencia: string | null
          sucursal_id: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          estado?: Database["public"]["Enums"]["ra_estado_orden_compra"]
          fecha?: string
          id?: string
          notas?: string | null
          proveedor_id?: string | null
          referencia?: string | null
          sucursal_id: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          estado?: Database["public"]["Enums"]["ra_estado_orden_compra"]
          fecha?: string
          id?: string
          notas?: string | null
          proveedor_id?: string | null
          referencia?: string | null
          sucursal_id?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ra_ordenes_compra_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ra_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_ordenes_compra_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "ra_proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_ordenes_compra_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "ra_sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_perfiles: {
        Row: {
          activo: boolean
          empresa_id: string | null
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["ra_rol"]
          sucursal_id: string | null
        }
        Insert: {
          activo?: boolean
          empresa_id?: string | null
          id: string
          nombre: string
          rol?: Database["public"]["Enums"]["ra_rol"]
          sucursal_id?: string | null
        }
        Update: {
          activo?: boolean
          empresa_id?: string | null
          id?: string
          nombre?: string
          rol?: Database["public"]["Enums"]["ra_rol"]
          sucursal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ra_perfiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ra_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_perfiles_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "ra_sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_productos: {
        Row: {
          activo: boolean
          catalogo_id: string
          codigo_interno: string | null
          empresa_id: string
          id: string
          moneda: string
          precio_compra: number | null
          precio_venta: number | null
          precio_venta_dolar: number | null
          stock_actual: number
          stock_minimo: number
          sucursal_id: string
        }
        Insert: {
          activo?: boolean
          catalogo_id: string
          codigo_interno?: string | null
          empresa_id: string
          id?: string
          moneda?: string
          precio_compra?: number | null
          precio_venta?: number | null
          precio_venta_dolar?: number | null
          stock_actual?: number
          stock_minimo?: number
          sucursal_id: string
        }
        Update: {
          activo?: boolean
          catalogo_id?: string
          codigo_interno?: string | null
          empresa_id?: string
          id?: string
          moneda?: string
          precio_compra?: number | null
          precio_venta?: number | null
          precio_venta_dolar?: number | null
          stock_actual?: number
          stock_minimo?: number
          sucursal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ra_productos_catalogo_id_fkey"
            columns: ["catalogo_id"]
            isOneToOne: false
            referencedRelation: "ra_catalogo_repuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_productos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ra_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_productos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "ra_sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_proveedores: {
        Row: {
          activo: boolean
          contacto: string | null
          created_at: string
          direccion: string | null
          email: string | null
          empresa_id: string
          id: string
          nombre: string
          notas: string | null
          ruc: string | null
          saldo_deudor: number
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          contacto?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          empresa_id: string
          id?: string
          nombre: string
          notas?: string | null
          ruc?: string | null
          saldo_deudor?: number
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          contacto?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          empresa_id?: string
          id?: string
          nombre?: string
          notas?: string | null
          ruc?: string | null
          saldo_deudor?: number
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ra_proveedores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ra_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_series_documento: {
        Row: {
          activo: boolean
          created_at: string
          empresa_id: string
          es_predeterminada: boolean
          id: string
          serie: string
          siguiente_correlativo: number
          sucursal_id: string
          tipo_documento: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          empresa_id: string
          es_predeterminada?: boolean
          id?: string
          serie: string
          siguiente_correlativo: number
          sucursal_id: string
          tipo_documento: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          empresa_id?: string
          es_predeterminada?: boolean
          id?: string
          serie?: string
          siguiente_correlativo?: number
          sucursal_id?: string
          tipo_documento?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ra_series_documento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ra_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_series_documento_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "ra_sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_sinonimos_busqueda: {
        Row: {
          id: string
          palabra: string
          sinonimo: string
        }
        Insert: {
          id?: string
          palabra: string
          sinonimo: string
        }
        Update: {
          id?: string
          palabra?: string
          sinonimo?: string
        }
        Relationships: []
      }
      ra_sucursales: {
        Row: {
          activo: boolean
          created_at: string
          direccion: string | null
          empresa_id: string
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          direccion?: string | null
          empresa_id: string
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          direccion?: string | null
          empresa_id?: string
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "ra_sucursales_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ra_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_sunat_nota_credito_outbox: {
        Row: {
          attempt_count: number
          completed_at: string | null
          correlativo: number
          created_at: string
          devolucion_id: string
          document_key: string
          empresa_id: string
          error_code: string | null
          error_message: string | null
          external_id: string | null
          http_status: number | null
          id: string
          last_attempt_at: string | null
          lease_expires_at: string | null
          lease_token: string | null
          motivo_codigo: string
          motivo_descripcion: string
          next_attempt_at: string
          request_payload: Json
          response_payload: Json | null
          serie: string
          status: string
          tipo_referenciado: Database["public"]["Enums"]["ra_tipo_comprobante"]
          updated_at: string
          venta_id: string
          worker_id: string | null
        }
        Insert: {
          attempt_count?: number
          completed_at?: string | null
          correlativo: number
          created_at?: string
          devolucion_id: string
          document_key: string
          empresa_id: string
          error_code?: string | null
          error_message?: string | null
          external_id?: string | null
          http_status?: number | null
          id?: string
          last_attempt_at?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          motivo_codigo: string
          motivo_descripcion: string
          next_attempt_at?: string
          request_payload: Json
          response_payload?: Json | null
          serie: string
          status?: string
          tipo_referenciado: Database["public"]["Enums"]["ra_tipo_comprobante"]
          updated_at?: string
          venta_id: string
          worker_id?: string | null
        }
        Update: {
          attempt_count?: number
          completed_at?: string | null
          correlativo?: number
          created_at?: string
          devolucion_id?: string
          document_key?: string
          empresa_id?: string
          error_code?: string | null
          error_message?: string | null
          external_id?: string | null
          http_status?: number | null
          id?: string
          last_attempt_at?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          motivo_codigo?: string
          motivo_descripcion?: string
          next_attempt_at?: string
          request_payload?: Json
          response_payload?: Json | null
          serie?: string
          status?: string
          tipo_referenciado?: Database["public"]["Enums"]["ra_tipo_comprobante"]
          updated_at?: string
          venta_id?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ra_sunat_nota_credito_outbox_devolucion_id_fkey"
            columns: ["devolucion_id"]
            isOneToOne: true
            referencedRelation: "ra_devoluciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_sunat_nota_credito_outbox_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ra_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_sunat_nota_credito_outbox_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ra_ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_sunat_outbox: {
        Row: {
          attempt_count: number
          completed_at: string | null
          correlativo: number
          created_at: string
          document_key: string
          empresa_id: string
          error_code: string | null
          error_message: string | null
          external_id: string | null
          http_status: number | null
          id: string
          last_attempt_at: string | null
          lease_expires_at: string | null
          lease_token: string | null
          next_attempt_at: string
          request_payload: Json
          response_payload: Json | null
          serie: string
          status: string
          tipo_comprobante: Database["public"]["Enums"]["ra_tipo_comprobante"]
          updated_at: string
          venta_id: string
          worker_id: string | null
        }
        Insert: {
          attempt_count?: number
          completed_at?: string | null
          correlativo: number
          created_at?: string
          document_key: string
          empresa_id: string
          error_code?: string | null
          error_message?: string | null
          external_id?: string | null
          http_status?: number | null
          id?: string
          last_attempt_at?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          next_attempt_at?: string
          request_payload: Json
          response_payload?: Json | null
          serie: string
          status?: string
          tipo_comprobante: Database["public"]["Enums"]["ra_tipo_comprobante"]
          updated_at?: string
          venta_id: string
          worker_id?: string | null
        }
        Update: {
          attempt_count?: number
          completed_at?: string | null
          correlativo?: number
          created_at?: string
          document_key?: string
          empresa_id?: string
          error_code?: string | null
          error_message?: string | null
          external_id?: string | null
          http_status?: number | null
          id?: string
          last_attempt_at?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          next_attempt_at?: string
          request_payload?: Json
          response_payload?: Json | null
          serie?: string
          status?: string
          tipo_comprobante?: Database["public"]["Enums"]["ra_tipo_comprobante"]
          updated_at?: string
          venta_id?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ra_sunat_outbox_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ra_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_sunat_outbox_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: true
            referencedRelation: "ra_ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_tipos_repuesto: {
        Row: {
          activo: boolean
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      ra_venta_items: {
        Row: {
          cantidad: number
          catalogo_id: string
          codigo_oem: string | null
          created_at: string
          descuento: number
          id: string
          nombre_producto: string
          precio_unitario: number
          subtotal: number
          venta_id: string
        }
        Insert: {
          cantidad: number
          catalogo_id: string
          codigo_oem?: string | null
          created_at?: string
          descuento?: number
          id?: string
          nombre_producto: string
          precio_unitario: number
          subtotal: number
          venta_id: string
        }
        Update: {
          cantidad?: number
          catalogo_id?: string
          codigo_oem?: string | null
          created_at?: string
          descuento?: number
          id?: string
          nombre_producto?: string
          precio_unitario?: number
          subtotal?: number
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ra_venta_items_catalogo_id_fkey"
            columns: ["catalogo_id"]
            isOneToOne: false
            referencedRelation: "ra_catalogo_repuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_venta_items_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ra_ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_venta_pagos: {
        Row: {
          created_at: string
          id: string
          metodo_pago: Database["public"]["Enums"]["ra_metodo_pago"]
          monto: number
          referencia: string | null
          venta_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metodo_pago: Database["public"]["Enums"]["ra_metodo_pago"]
          monto: number
          referencia?: string | null
          venta_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metodo_pago?: Database["public"]["Enums"]["ra_metodo_pago"]
          monto?: number
          referencia?: string | null
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ra_venta_pagos_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ra_ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      ra_ventas: {
        Row: {
          caja_id: string | null
          cliente_id: string | null
          correlativo: number | null
          created_at: string
          credit_limit_exceeded: boolean | null
          empresa_id: string
          estado: Database["public"]["Enums"]["ra_estado_venta"]
          fecha_emision: string | null
          id: string
          id_externo: string | null
          igv: number
          moneda: string
          numero_completo: string | null
          numero_placa: string | null
          operation_id: string | null
          pdf_url: string | null
          request_hash: string | null
          serie: string | null
          subtotal: number
          sucursal_id: string
          sunat_estado: string | null
          sunat_hash: string | null
          tipo_cambio: number | null
          tipo_comprobante: Database["public"]["Enums"]["ra_tipo_comprobante"]
          tipo_venta: Database["public"]["Enums"]["ra_tipo_cliente"]
          total: number
          updated_at: string
          usuario_id: string
          xml_url: string | null
        }
        Insert: {
          caja_id?: string | null
          cliente_id?: string | null
          correlativo?: number | null
          created_at?: string
          credit_limit_exceeded?: boolean | null
          empresa_id: string
          estado?: Database["public"]["Enums"]["ra_estado_venta"]
          fecha_emision?: string | null
          id?: string
          id_externo?: string | null
          igv?: number
          moneda?: string
          numero_completo?: string | null
          numero_placa?: string | null
          operation_id?: string | null
          pdf_url?: string | null
          request_hash?: string | null
          serie?: string | null
          subtotal: number
          sucursal_id: string
          sunat_estado?: string | null
          sunat_hash?: string | null
          tipo_cambio?: number | null
          tipo_comprobante?: Database["public"]["Enums"]["ra_tipo_comprobante"]
          tipo_venta?: Database["public"]["Enums"]["ra_tipo_cliente"]
          total: number
          updated_at?: string
          usuario_id: string
          xml_url?: string | null
        }
        Update: {
          caja_id?: string | null
          cliente_id?: string | null
          correlativo?: number | null
          created_at?: string
          credit_limit_exceeded?: boolean | null
          empresa_id?: string
          estado?: Database["public"]["Enums"]["ra_estado_venta"]
          fecha_emision?: string | null
          id?: string
          id_externo?: string | null
          igv?: number
          moneda?: string
          numero_completo?: string | null
          numero_placa?: string | null
          operation_id?: string | null
          pdf_url?: string | null
          request_hash?: string | null
          serie?: string | null
          subtotal?: number
          sucursal_id?: string
          sunat_estado?: string | null
          sunat_hash?: string | null
          tipo_cambio?: number | null
          tipo_comprobante?: Database["public"]["Enums"]["ra_tipo_comprobante"]
          tipo_venta?: Database["public"]["Enums"]["ra_tipo_cliente"]
          total?: number
          updated_at?: string
          usuario_id?: string
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ra_ventas_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "ra_cajas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_ventas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "ra_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_ventas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "ra_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ra_ventas_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "ra_sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      re_adjustment_records: {
        Row: {
          adjustment_type: string
          branch_id: string
          created_at: string
          created_by: string
          id: string
          notes: string
          product_id: string
          quantity: number
          unit_cost: number | null
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          adjustment_type: string
          branch_id: string
          created_at?: string
          created_by: string
          id?: string
          notes: string
          product_id: string
          quantity: number
          unit_cost?: number | null
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          adjustment_type?: string
          branch_id?: string
          created_at?: string
          created_by?: string
          id?: string
          notes?: string
          product_id?: string
          quantity?: number
          unit_cost?: number | null
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_adjustment_records_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "re_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_adjustment_records_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "re_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_adjustment_records_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "re_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      re_branch_document_series: {
        Row: {
          active: boolean
          branch_id: string
          created_at: string
          document_type: Database["public"]["Enums"]["re_document_series_type"]
          id: string
          is_primary: boolean
          serie: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          branch_id: string
          created_at?: string
          document_type: Database["public"]["Enums"]["re_document_series_type"]
          id?: string
          is_primary?: boolean
          serie: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          branch_id?: string
          created_at?: string
          document_type?: Database["public"]["Enums"]["re_document_series_type"]
          id?: string
          is_primary?: boolean
          serie?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_branch_document_series_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "re_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      re_branches: {
        Row: {
          active: boolean
          address: string | null
          boleta_serie: string | null
          company_id: string
          created_at: string
          factura_serie: string | null
          gre_serie: string | null
          id: string
          name: string
          region: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          boleta_serie?: string | null
          company_id: string
          created_at?: string
          factura_serie?: string | null
          gre_serie?: string | null
          id?: string
          name: string
          region: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          boleta_serie?: string | null
          company_id?: string
          created_at?: string
          factura_serie?: string | null
          gre_serie?: string | null
          id?: string
          name?: string
          region?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "re_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      re_brands: {
        Row: {
          active: boolean
          category_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_brands_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "re_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      re_cancellation_audit_log: {
        Row: {
          branch_id: string
          document_id: string
          document_type: Database["public"]["Enums"]["re_cancellation_doc_type"]
          id: string
          motivo: string
          ose_confirmed_at: string | null
          ose_status: string | null
          requested_at: string
          user_id: string
        }
        Insert: {
          branch_id: string
          document_id: string
          document_type: Database["public"]["Enums"]["re_cancellation_doc_type"]
          id?: string
          motivo: string
          ose_confirmed_at?: string | null
          ose_status?: string | null
          requested_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string
          document_id?: string
          document_type?: Database["public"]["Enums"]["re_cancellation_doc_type"]
          id?: string
          motivo?: string
          ose_confirmed_at?: string | null
          ose_status?: string | null
          requested_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_cancellation_audit_log_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "re_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      re_categories: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      re_collection_items: {
        Row: {
          amount_applied: number
          collection_id: string
          created_at: string
          id: string
          invoice_id: string | null
          order_id: string
        }
        Insert: {
          amount_applied: number
          collection_id: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          order_id: string
        }
        Update: {
          amount_applied?: number
          collection_id?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "re_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_collection_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "re_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      re_collections: {
        Row: {
          branch_id: string
          collected_at: string
          created_at: string
          customer_id: string
          id: string
          parent_collection_id: string | null
          payment_method: Database["public"]["Enums"]["re_payment_method"]
          reference_number: string | null
          seller_id: string
          total_collected: number
        }
        Insert: {
          branch_id: string
          collected_at?: string
          created_at?: string
          customer_id: string
          id?: string
          parent_collection_id?: string | null
          payment_method: Database["public"]["Enums"]["re_payment_method"]
          reference_number?: string | null
          seller_id: string
          total_collected?: number
        }
        Update: {
          branch_id?: string
          collected_at?: string
          created_at?: string
          customer_id?: string
          id?: string
          parent_collection_id?: string | null
          payment_method?: Database["public"]["Enums"]["re_payment_method"]
          reference_number?: string | null
          seller_id?: string
          total_collected?: number
        }
        Relationships: [
          {
            foreignKeyName: "re_collections_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "re_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_collections_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "re_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_collections_parent_collection_id_fkey"
            columns: ["parent_collection_id"]
            isOneToOne: false
            referencedRelation: "re_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      re_companies: {
        Row: {
          address: string | null
          created_at: string
          id: string
          legal_name: string
          phone: string | null
          ruc: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          legal_name: string
          phone?: string | null
          ruc: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          legal_name?: string
          phone?: string | null
          ruc?: string
          updated_at?: string
        }
        Relationships: []
      }
      re_credit_note_items: {
        Row: {
          created_at: string
          credit_note_id: string
          id: string
          line_total: number
          product_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          credit_note_id: string
          id?: string
          line_total?: number
          product_id: string
          quantity: number
          unit_price: number
        }
        Update: {
          created_at?: string
          credit_note_id?: string
          id?: string
          line_total?: number
          product_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "re_credit_note_items_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "re_credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_credit_note_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "re_products"
            referencedColumns: ["id"]
          },
        ]
      }
      re_credit_notes: {
        Row: {
          branch_id: string
          correlativo: string
          created_at: string
          id: string
          igv_amount: number
          invoice_id: string
          issue_date: string
          order_id: string
          ose_response_code: string | null
          ose_response_message: string | null
          pdf_url: string | null
          reason: string
          serie: string
          subtotal: number
          sunat_status: Database["public"]["Enums"]["re_sunat_status"]
          total: number
          updated_at: string
          xml_content_url: string | null
        }
        Insert: {
          branch_id: string
          correlativo: string
          created_at?: string
          id?: string
          igv_amount?: number
          invoice_id: string
          issue_date: string
          order_id: string
          ose_response_code?: string | null
          ose_response_message?: string | null
          pdf_url?: string | null
          reason: string
          serie: string
          subtotal?: number
          sunat_status?: Database["public"]["Enums"]["re_sunat_status"]
          total?: number
          updated_at?: string
          xml_content_url?: string | null
        }
        Update: {
          branch_id?: string
          correlativo?: string
          created_at?: string
          id?: string
          igv_amount?: number
          invoice_id?: string
          issue_date?: string
          order_id?: string
          ose_response_code?: string | null
          ose_response_message?: string | null
          pdf_url?: string | null
          reason?: string
          serie?: string
          subtotal?: number
          sunat_status?: Database["public"]["Enums"]["re_sunat_status"]
          total?: number
          updated_at?: string
          xml_content_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "re_credit_notes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "re_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "re_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_credit_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "re_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      re_customer_addresses: {
        Row: {
          address_line: string
          coordinates: unknown
          created_at: string
          customer_id: string
          department: string
          district: string
          id: string
          is_primary: boolean
          province: string
          updated_at: string
        }
        Insert: {
          address_line: string
          coordinates?: unknown
          created_at?: string
          customer_id: string
          department: string
          district: string
          id?: string
          is_primary?: boolean
          province: string
          updated_at?: string
        }
        Update: {
          address_line?: string
          coordinates?: unknown
          created_at?: string
          customer_id?: string
          department?: string
          district?: string
          id?: string
          is_primary?: boolean
          province?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "re_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      re_customer_price_assignments: {
        Row: {
          active: boolean
          assigned_from: string
          assigned_until: string | null
          branch_id: string
          created_at: string
          customer_id: string
          id: string
          price_list_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          assigned_from: string
          assigned_until?: string | null
          branch_id: string
          created_at?: string
          customer_id: string
          id?: string
          price_list_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          assigned_from?: string
          assigned_until?: string | null
          branch_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          price_list_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_customer_price_assignments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "re_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_customer_price_assignments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "re_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_customer_price_assignments_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "re_price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      re_customers: {
        Row: {
          active: boolean
          branch_id: string
          created_at: string
          credit_limit: number | null
          id: string
          legal_name: string
          phone: string | null
          ruc_or_dni: string
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          branch_id: string
          created_at?: string
          credit_limit?: number | null
          id?: string
          legal_name: string
          phone?: string | null
          ruc_or_dni: string
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          branch_id?: string
          created_at?: string
          credit_limit?: number | null
          id?: string
          legal_name?: string
          phone?: string | null
          ruc_or_dni?: string
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_customers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "re_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      re_daily_settlements: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string
          created_at: string
          difference: number | null
          id: string
          seller_id: string
          settlement_date: string
          status: Database["public"]["Enums"]["re_settlement_status"]
          supervisor_notes: string | null
          total_collected_physical: number | null
          total_expected: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id: string
          created_at?: string
          difference?: number | null
          id?: string
          seller_id: string
          settlement_date: string
          status?: Database["public"]["Enums"]["re_settlement_status"]
          supervisor_notes?: string | null
          total_collected_physical?: number | null
          total_expected?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string
          created_at?: string
          difference?: number | null
          id?: string
          seller_id?: string
          settlement_date?: string
          status?: Database["public"]["Enums"]["re_settlement_status"]
          supervisor_notes?: string | null
          total_collected_physical?: number | null
          total_expected?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_daily_settlements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "re_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      re_discount_rules: {
        Row: {
          active: boolean
          created_at: string
          discount_pct: number
          id: string
          min_quantity: number
          price_list_id: string
          product_id: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          discount_pct: number
          id?: string
          min_quantity: number
          price_list_id: string
          product_id: string
          updated_at?: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          discount_pct?: number
          id?: string
          min_quantity?: number
          price_list_id?: string
          product_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "re_discount_rules_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "re_price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_discount_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "re_products"
            referencedColumns: ["id"]
          },
        ]
      }
      re_dispatch_manifests: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string
          id: string
          manifest_date: string
          status: Database["public"]["Enums"]["re_manifest_status"]
          total_volume_m3: number
          total_weight_kg: number
          updated_at: string
          vehicle_id: string | null
          warehouse_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by: string
          id?: string
          manifest_date: string
          status?: Database["public"]["Enums"]["re_manifest_status"]
          total_volume_m3?: number
          total_weight_kg?: number
          updated_at?: string
          vehicle_id?: string | null
          warehouse_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string
          id?: string
          manifest_date?: string
          status?: Database["public"]["Enums"]["re_manifest_status"]
          total_volume_m3?: number
          total_weight_kg?: number
          updated_at?: string
          vehicle_id?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_dispatch_manifests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "re_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_dispatch_manifests_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "re_vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_dispatch_manifests_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "re_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      re_inventory_movements: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          movement_date: string
          notes: string | null
          product_id: string
          quantity: number
          reason_code: Database["public"]["Enums"]["re_movement_reason"]
          reference_id: string
          reference_type: string
          type: Database["public"]["Enums"]["re_movement_type"]
          unit_cost: number
          user_id: string
          warehouse_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          movement_date: string
          notes?: string | null
          product_id: string
          quantity: number
          reason_code: Database["public"]["Enums"]["re_movement_reason"]
          reference_id: string
          reference_type: string
          type: Database["public"]["Enums"]["re_movement_type"]
          unit_cost?: number
          user_id: string
          warehouse_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          movement_date?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reason_code?: Database["public"]["Enums"]["re_movement_reason"]
          reference_id?: string
          reference_type?: string
          type?: Database["public"]["Enums"]["re_movement_type"]
          unit_cost?: number
          user_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_inventory_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "re_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "re_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_inventory_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "re_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      re_inventory_stock: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          product_id: string
          stock_actual: number
          stock_available: number | null
          stock_reserved: number
          updated_at: string
          warehouse_id: string
          weighted_avg_cost: number
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          product_id: string
          stock_actual?: number
          stock_available?: number | null
          stock_reserved?: number
          updated_at?: string
          warehouse_id: string
          weighted_avg_cost?: number
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          product_id?: string
          stock_actual?: number
          stock_available?: number | null
          stock_reserved?: number
          updated_at?: string
          warehouse_id?: string
          weighted_avg_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "re_inventory_stock_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "re_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_inventory_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "re_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_inventory_stock_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "re_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      re_invoice_items: {
        Row: {
          created_at: string
          discount_amount: number
          discount_pct: number
          id: string
          invoice_id: string
          is_bonus: boolean
          line_total: number
          product_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount_amount?: number
          discount_pct?: number
          id?: string
          invoice_id: string
          is_bonus?: boolean
          line_total?: number
          product_id: string
          quantity: number
          unit_price: number
        }
        Update: {
          created_at?: string
          discount_amount?: number
          discount_pct?: number
          id?: string
          invoice_id?: string
          is_bonus?: boolean
          line_total?: number
          product_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "re_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "re_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "re_products"
            referencedColumns: ["id"]
          },
        ]
      }
      re_invoices: {
        Row: {
          branch_id: string
          correlativo: string
          created_at: string
          customer_id: string
          doc_type: Database["public"]["Enums"]["re_doc_type"]
          id: string
          igv_amount: number
          issue_date: string
          order_id: string
          ose_response_code: string | null
          ose_response_message: string | null
          pdf_url: string | null
          serie: string
          subtotal: number
          sunat_status: Database["public"]["Enums"]["re_sunat_status"]
          total: number
          updated_at: string
          xml_content_url: string | null
        }
        Insert: {
          branch_id: string
          correlativo: string
          created_at?: string
          customer_id: string
          doc_type: Database["public"]["Enums"]["re_doc_type"]
          id?: string
          igv_amount?: number
          issue_date: string
          order_id: string
          ose_response_code?: string | null
          ose_response_message?: string | null
          pdf_url?: string | null
          serie: string
          subtotal?: number
          sunat_status?: Database["public"]["Enums"]["re_sunat_status"]
          total?: number
          updated_at?: string
          xml_content_url?: string | null
        }
        Update: {
          branch_id?: string
          correlativo?: string
          created_at?: string
          customer_id?: string
          doc_type?: Database["public"]["Enums"]["re_doc_type"]
          id?: string
          igv_amount?: number
          issue_date?: string
          order_id?: string
          ose_response_code?: string | null
          ose_response_message?: string | null
          pdf_url?: string | null
          serie?: string
          subtotal?: number
          sunat_status?: Database["public"]["Enums"]["re_sunat_status"]
          total?: number
          updated_at?: string
          xml_content_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "re_invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "re_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "re_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "re_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      re_manifest_orders: {
        Row: {
          arrival_time: string | null
          delivery_sequence: number
          delivery_status: Database["public"]["Enums"]["re_manifest_delivery_status"]
          departure_time: string | null
          manifest_id: string
          order_id: string
        }
        Insert: {
          arrival_time?: string | null
          delivery_sequence?: number
          delivery_status?: Database["public"]["Enums"]["re_manifest_delivery_status"]
          departure_time?: string | null
          manifest_id: string
          order_id: string
        }
        Update: {
          arrival_time?: string | null
          delivery_sequence?: number
          delivery_status?: Database["public"]["Enums"]["re_manifest_delivery_status"]
          departure_time?: string | null
          manifest_id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_manifest_orders_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "re_dispatch_manifests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_manifest_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "re_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      re_manifest_personnel: {
        Row: {
          manifest_id: string
          person_id: string
          role: Database["public"]["Enums"]["re_personnel_role"]
        }
        Insert: {
          manifest_id: string
          person_id: string
          role: Database["public"]["Enums"]["re_personnel_role"]
        }
        Update: {
          manifest_id?: string
          person_id?: string
          role?: Database["public"]["Enums"]["re_personnel_role"]
        }
        Relationships: [
          {
            foreignKeyName: "re_manifest_personnel_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "re_dispatch_manifests"
            referencedColumns: ["id"]
          },
        ]
      }
      re_order_items: {
        Row: {
          created_at: string
          discount_amount: number | null
          discount_pct: number
          id: string
          is_bonus: boolean
          line_total: number | null
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_amount?: number | null
          discount_pct?: number
          id?: string
          is_bonus?: boolean
          line_total?: number | null
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_amount?: number | null
          discount_pct?: number
          id?: string
          is_bonus?: boolean
          line_total?: number | null
          order_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "re_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "re_products"
            referencedColumns: ["id"]
          },
        ]
      }
      re_orders: {
        Row: {
          branch_id: string
          created_at: string
          customer_id: string
          delivery_address_id: string
          id: string
          notes: string | null
          payment_status: Database["public"]["Enums"]["re_payment_status"]
          sales_route_id: string | null
          seller_id: string
          status: Database["public"]["Enums"]["re_order_state"]
          total: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          customer_id: string
          delivery_address_id: string
          id?: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["re_payment_status"]
          sales_route_id?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["re_order_state"]
          total?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          customer_id?: string
          delivery_address_id?: string
          id?: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["re_payment_status"]
          sales_route_id?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["re_order_state"]
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "re_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "re_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_orders_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "re_customer_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_orders_sales_route_id_fkey"
            columns: ["sales_route_id"]
            isOneToOne: false
            referencedRelation: "re_sales_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      re_price_list_items: {
        Row: {
          created_at: string
          currency: string
          discount_pct: number | null
          id: string
          price_list_id: string
          product_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          discount_pct?: number | null
          id?: string
          price_list_id: string
          product_id: string
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          discount_pct?: number | null
          id?: string
          price_list_id?: string
          product_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_price_list_items_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "re_price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_price_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "re_products"
            referencedColumns: ["id"]
          },
        ]
      }
      re_price_lists: {
        Row: {
          active: boolean
          branch_id: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          branch_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          branch_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "re_price_lists_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "re_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      re_products: {
        Row: {
          active: boolean
          brand_id: string
          created_at: string
          id: string
          name: string
          sku: string
          unit_of_measure: string
          updated_at: string
          volume_m3: number | null
          weight_kg: number | null
        }
        Insert: {
          active?: boolean
          brand_id: string
          created_at?: string
          id?: string
          name: string
          sku: string
          unit_of_measure: string
          updated_at?: string
          volume_m3?: number | null
          weight_kg?: number | null
        }
        Update: {
          active?: boolean
          brand_id?: string
          created_at?: string
          id?: string
          name?: string
          sku?: string
          unit_of_measure?: string
          updated_at?: string
          volume_m3?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "re_products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "re_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      re_profiles: {
        Row: {
          active: boolean
          branch_id: string
          company_id: string
          created_at: string
          document_number: string
          document_type: string
          full_name: string
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          branch_id: string
          company_id: string
          created_at?: string
          document_number: string
          document_type?: string
          full_name: string
          id: string
          role: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          branch_id?: string
          company_id?: string
          created_at?: string
          document_number?: string
          document_type?: string
          full_name?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "re_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "re_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      re_promotion_rules: {
        Row: {
          active: boolean
          bonus_product_id: string | null
          bonus_quantity: number
          branch_id: string
          created_at: string
          id: string
          min_quantity: number
          name: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          bonus_product_id?: string | null
          bonus_quantity?: number
          branch_id: string
          created_at?: string
          id?: string
          min_quantity: number
          name: string
          updated_at?: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          bonus_product_id?: string | null
          bonus_quantity?: number
          branch_id?: string
          created_at?: string
          id?: string
          min_quantity?: number
          name?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "re_promotion_rules_bonus_product_id_fkey"
            columns: ["bonus_product_id"]
            isOneToOne: false
            referencedRelation: "re_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_promotion_rules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "re_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      re_remission_guides: {
        Row: {
          branch_id: string
          correlativo: string
          created_at: string
          id: string
          manifest_id: string
          ose_response_code: string | null
          ose_response_message: string | null
          pdf_url: string | null
          serie: string
          sunat_status: Database["public"]["Enums"]["re_sunat_status"]
          updated_at: string
          xml_content_url: string | null
        }
        Insert: {
          branch_id: string
          correlativo: string
          created_at?: string
          id?: string
          manifest_id: string
          ose_response_code?: string | null
          ose_response_message?: string | null
          pdf_url?: string | null
          serie: string
          sunat_status?: Database["public"]["Enums"]["re_sunat_status"]
          updated_at?: string
          xml_content_url?: string | null
        }
        Update: {
          branch_id?: string
          correlativo?: string
          created_at?: string
          id?: string
          manifest_id?: string
          ose_response_code?: string | null
          ose_response_message?: string | null
          pdf_url?: string | null
          serie?: string
          sunat_status?: Database["public"]["Enums"]["re_sunat_status"]
          updated_at?: string
          xml_content_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "re_remission_guides_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "re_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_remission_guides_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "re_dispatch_manifests"
            referencedColumns: ["id"]
          },
        ]
      }
      re_sales_routes: {
        Row: {
          active: boolean
          branch_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          branch_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          branch_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_sales_routes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "re_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      re_stock_transfers: {
        Row: {
          confirmed_by: string | null
          created_at: string
          from_branch_id: string
          from_warehouse_id: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          requested_by: string
          status: Database["public"]["Enums"]["re_transfer_status"]
          to_branch_id: string
          to_warehouse_id: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          confirmed_by?: string | null
          created_at?: string
          from_branch_id: string
          from_warehouse_id: string
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          requested_by: string
          status?: Database["public"]["Enums"]["re_transfer_status"]
          to_branch_id: string
          to_warehouse_id: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          confirmed_by?: string | null
          created_at?: string
          from_branch_id?: string
          from_warehouse_id?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          requested_by?: string
          status?: Database["public"]["Enums"]["re_transfer_status"]
          to_branch_id?: string
          to_warehouse_id?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_stock_transfers_from_branch_id_fkey"
            columns: ["from_branch_id"]
            isOneToOne: false
            referencedRelation: "re_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_stock_transfers_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "re_warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_stock_transfers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "re_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_stock_transfers_to_branch_id_fkey"
            columns: ["to_branch_id"]
            isOneToOne: false
            referencedRelation: "re_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_stock_transfers_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "re_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      re_vehicles: {
        Row: {
          active: boolean
          branch_id: string
          capacity_kg: number | null
          capacity_m3: number | null
          created_at: string
          id: string
          plate_number: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          branch_id: string
          capacity_kg?: number | null
          capacity_m3?: number | null
          created_at?: string
          id?: string
          plate_number: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          branch_id?: string
          capacity_kg?: number | null
          capacity_m3?: number | null
          created_at?: string
          id?: string
          plate_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_vehicles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "re_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      re_warehouses: {
        Row: {
          active: boolean
          branch_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          branch_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          branch_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_warehouses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "re_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      rl_categorias: {
        Row: {
          activo: boolean
          created_at: string
          descripcion_generica: string | null
          id: string
          nombre: string
          orden: number
          parent_id: string | null
          slug: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion_generica?: string | null
          id?: string
          nombre: string
          orden?: number
          parent_id?: string | null
          slug: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion_generica?: string | null
          id?: string
          nombre?: string
          orden?: number
          parent_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "rl_categorias_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "rl_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      rl_compatibilidades: {
        Row: {
          id: string
          marca_camion_id: string
          producto_id: string
        }
        Insert: {
          id?: string
          marca_camion_id: string
          producto_id: string
        }
        Update: {
          id?: string
          marca_camion_id?: string
          producto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rl_compatibilidades_marca_camion_id_fkey"
            columns: ["marca_camion_id"]
            isOneToOne: false
            referencedRelation: "rl_marcas_camion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rl_compatibilidades_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "rl_productos"
            referencedColumns: ["id"]
          },
        ]
      }
      rl_marcas_camion: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          intro_texto: string | null
          logo_url: string | null
          meta_description: string | null
          meta_title: string | null
          nombre: string
          orden: number
          slug: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          intro_texto?: string | null
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          nombre: string
          orden?: number
          slug: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          intro_texto?: string | null
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          nombre?: string
          orden?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      rl_marcas_repuesto: {
        Row: {
          activo: boolean
          id: string
          nombre: string
          slug: string
        }
        Insert: {
          activo?: boolean
          id?: string
          nombre: string
          slug: string
        }
        Update: {
          activo?: boolean
          id?: string
          nombre?: string
          slug?: string
        }
        Relationships: []
      }
      rl_producto_imagenes: {
        Row: {
          id: string
          orden: number
          producto_id: string
          url: string
        }
        Insert: {
          id?: string
          orden?: number
          producto_id: string
          url: string
        }
        Update: {
          id?: string
          orden?: number
          producto_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "rl_producto_imagenes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "rl_productos"
            referencedColumns: ["id"]
          },
        ]
      }
      rl_productos: {
        Row: {
          activo: boolean
          categoria_id: string | null
          codigo_interno: string | null
          codigo_oem: string | null
          created_at: string
          descripcion: string | null
          id: string
          imagen_url: string | null
          marca_repuesto_id: string | null
          nombre: string
          precio_interno: number | null
          slug: string
          stock_estado: Database["public"]["Enums"]["rl_stock_estado"]
          updated_at: string
        }
        Insert: {
          activo?: boolean
          categoria_id?: string | null
          codigo_interno?: string | null
          codigo_oem?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          marca_repuesto_id?: string | null
          nombre: string
          precio_interno?: number | null
          slug: string
          stock_estado?: Database["public"]["Enums"]["rl_stock_estado"]
          updated_at?: string
        }
        Update: {
          activo?: boolean
          categoria_id?: string | null
          codigo_interno?: string | null
          codigo_oem?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          marca_repuesto_id?: string | null
          nombre?: string
          precio_interno?: number | null
          slug?: string
          stock_estado?: Database["public"]["Enums"]["rl_stock_estado"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rl_productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "rl_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rl_productos_marca_repuesto_id_fkey"
            columns: ["marca_repuesto_id"]
            isOneToOne: false
            referencedRelation: "rl_marcas_repuesto"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_header: {
        Row: {
          client_id: number
          created_at: string | null
          doc_type: Database["public"]["Enums"]["sale_doc_type"]
          id: number
          number: string
          series: string
          status: Database["public"]["Enums"]["sale_status"]
          subtotal: number
          tax_total: number
          total: number
          warehouse_id: number
        }
        Insert: {
          client_id: number
          created_at?: string | null
          doc_type: Database["public"]["Enums"]["sale_doc_type"]
          id?: number
          number: string
          series: string
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          warehouse_id: number
        }
        Update: {
          client_id?: number
          created_at?: string | null
          doc_type?: Database["public"]["Enums"]["sale_doc_type"]
          id?: number
          number?: string
          series?: string
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          warehouse_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_header_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_header_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_items: {
        Row: {
          id: number
          product_id: number
          quantity: number
          sale_id: number
          total_line: number
          unit_price: number
        }
        Insert: {
          id?: number
          product_id: number
          quantity: number
          sale_id: number
          total_line: number
          unit_price: number
        }
        Update: {
          id?: number
          product_id?: number
          quantity?: number
          sale_id?: number
          total_line?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales_header"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_levels: {
        Row: {
          current_stock: number | null
          product_id: number
          warehouse_id: number
        }
        Insert: {
          current_stock?: number | null
          product_id: number
          warehouse_id: number
        }
        Update: {
          current_stock?: number | null
          product_id?: number
          warehouse_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_levels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_levels_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      tume_case_transitions: {
        Row: {
          actor_id: string | null
          case_id: string
          created_at: string
          from_task_type:
            | Database["public"]["Enums"]["tume_task_type_enum"]
            | null
          id: string
          reason: string | null
          to_task_type:
            | Database["public"]["Enums"]["tume_task_type_enum"]
            | null
        }
        Insert: {
          actor_id?: string | null
          case_id: string
          created_at?: string
          from_task_type?:
            | Database["public"]["Enums"]["tume_task_type_enum"]
            | null
          id?: string
          reason?: string | null
          to_task_type?:
            | Database["public"]["Enums"]["tume_task_type_enum"]
            | null
        }
        Update: {
          actor_id?: string | null
          case_id?: string
          created_at?: string
          from_task_type?:
            | Database["public"]["Enums"]["tume_task_type_enum"]
            | null
          id?: string
          reason?: string | null
          to_task_type?:
            | Database["public"]["Enums"]["tume_task_type_enum"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "tume_case_transitions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "tume_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tume_case_transitions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "tume_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      tume_cases: {
        Row: {
          awarded_at: string | null
          budget_usd: number | null
          client_id: string | null
          code: string
          created_at: string
          created_by: string | null
          current_task_type: Database["public"]["Enums"]["tume_task_type_enum"]
          delivery_due_at: string | null
          description: string | null
          enviado_at: string | null
          id: string
          is_express: boolean
          outcome: Database["public"]["Enums"]["tume_case_outcome_enum"] | null
          quoted_amount_usd: number | null
          requested_at: string
          stage: Database["public"]["Enums"]["tume_case_stage_enum"]
          title: string
          type: Database["public"]["Enums"]["tume_case_type_enum"]
          updated_at: string
        }
        Insert: {
          awarded_at?: string | null
          budget_usd?: number | null
          client_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          current_task_type?: Database["public"]["Enums"]["tume_task_type_enum"]
          delivery_due_at?: string | null
          description?: string | null
          enviado_at?: string | null
          id?: string
          is_express?: boolean
          outcome?: Database["public"]["Enums"]["tume_case_outcome_enum"] | null
          quoted_amount_usd?: number | null
          requested_at?: string
          stage?: Database["public"]["Enums"]["tume_case_stage_enum"]
          title: string
          type: Database["public"]["Enums"]["tume_case_type_enum"]
          updated_at?: string
        }
        Update: {
          awarded_at?: string | null
          budget_usd?: number | null
          client_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          current_task_type?: Database["public"]["Enums"]["tume_task_type_enum"]
          delivery_due_at?: string | null
          description?: string | null
          enviado_at?: string | null
          id?: string
          is_express?: boolean
          outcome?: Database["public"]["Enums"]["tume_case_outcome_enum"] | null
          quoted_amount_usd?: number | null
          requested_at?: string
          stage?: Database["public"]["Enums"]["tume_case_stage_enum"]
          title?: string
          type?: Database["public"]["Enums"]["tume_case_type_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tume_cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "tume_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tume_cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "tume_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tume_clients: {
        Row: {
          created_at: string
          id: string
          name: string
          ruc: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          ruc?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          ruc?: string | null
        }
        Relationships: []
      }
      tume_profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["tume_role_enum"]
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["tume_role_enum"]
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["tume_role_enum"]
        }
        Relationships: []
      }
      tume_tasks: {
        Row: {
          assigned_role: Database["public"]["Enums"]["tume_role_enum"]
          assigned_user_id: string | null
          case_id: string
          completed_at: string | null
          created_at: string
          id: string
          outcome: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["tume_task_status_enum"]
          task_type: Database["public"]["Enums"]["tume_task_type_enum"]
        }
        Insert: {
          assigned_role: Database["public"]["Enums"]["tume_role_enum"]
          assigned_user_id?: string | null
          case_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          outcome?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["tume_task_status_enum"]
          task_type: Database["public"]["Enums"]["tume_task_type_enum"]
        }
        Update: {
          assigned_role?: Database["public"]["Enums"]["tume_role_enum"]
          assigned_user_id?: string | null
          case_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          outcome?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["tume_task_status_enum"]
          task_type?: Database["public"]["Enums"]["tume_task_type_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "tume_tasks_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "tume_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tume_tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "tume_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      uniks_ajustes_stock: {
        Row: {
          created_at: string | null
          fecha: string
          id: string
          motivo: string | null
          producto_id: string
          stock_anterior: number
          stock_nuevo: number
        }
        Insert: {
          created_at?: string | null
          fecha?: string
          id?: string
          motivo?: string | null
          producto_id: string
          stock_anterior: number
          stock_nuevo: number
        }
        Update: {
          created_at?: string | null
          fecha?: string
          id?: string
          motivo?: string | null
          producto_id?: string
          stock_anterior?: number
          stock_nuevo?: number
        }
        Relationships: [
          {
            foreignKeyName: "uniks_ajustes_stock_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "uniks_productos"
            referencedColumns: ["id"]
          },
        ]
      }
      uniks_blog_posts: {
        Row: {
          contenido: string
          created_at: string
          id: string
          imagen_url: string | null
          publicado: boolean
          resumen: string | null
          slug: string
          titulo: string
          updated_at: string
        }
        Insert: {
          contenido: string
          created_at?: string
          id?: string
          imagen_url?: string | null
          publicado?: boolean
          resumen?: string | null
          slug: string
          titulo: string
          updated_at?: string
        }
        Update: {
          contenido?: string
          created_at?: string
          id?: string
          imagen_url?: string | null
          publicado?: boolean
          resumen?: string | null
          slug?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      uniks_clientes: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          nombre: string
          notas: string | null
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          nombre: string
          notas?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          nombre?: string
          notas?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      uniks_compra_items: {
        Row: {
          cantidad: number
          compra_id: string
          created_at: string | null
          id: string
          precio_unitario: number
          producto_id: string
          subtotal: number
        }
        Insert: {
          cantidad: number
          compra_id: string
          created_at?: string | null
          id?: string
          precio_unitario: number
          producto_id: string
          subtotal: number
        }
        Update: {
          cantidad?: number
          compra_id?: string
          created_at?: string | null
          id?: string
          precio_unitario?: number
          producto_id?: string
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "uniks_compra_items_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "uniks_compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uniks_compra_items_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "uniks_productos"
            referencedColumns: ["id"]
          },
        ]
      }
      uniks_compras: {
        Row: {
          created_at: string | null
          fecha: string
          id: string
          metodo_pago: Database["public"]["Enums"]["gasto_metodo_pago"]
          notas: string | null
          numero_comprobante: string | null
          proveedor_id: string | null
          tipo_comprobante: Database["public"]["Enums"]["gasto_tipo_comprobante"]
          total: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          fecha: string
          id?: string
          metodo_pago: Database["public"]["Enums"]["gasto_metodo_pago"]
          notas?: string | null
          numero_comprobante?: string | null
          proveedor_id?: string | null
          tipo_comprobante: Database["public"]["Enums"]["gasto_tipo_comprobante"]
          total: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          fecha?: string
          id?: string
          metodo_pago?: Database["public"]["Enums"]["gasto_metodo_pago"]
          notas?: string | null
          numero_comprobante?: string | null
          proveedor_id?: string | null
          tipo_comprobante?: Database["public"]["Enums"]["gasto_tipo_comprobante"]
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uniks_compras_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "uniks_proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      uniks_control_items: {
        Row: {
          costo_unitario: number | null
          created_at: string
          id: string
          producto_id: string
          sesion_id: string
          stock_anterior: number
          stock_contado: number | null
        }
        Insert: {
          costo_unitario?: number | null
          created_at?: string
          id?: string
          producto_id: string
          sesion_id: string
          stock_anterior?: number
          stock_contado?: number | null
        }
        Update: {
          costo_unitario?: number | null
          created_at?: string
          id?: string
          producto_id?: string
          sesion_id?: string
          stock_anterior?: number
          stock_contado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "uniks_control_items_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "uniks_productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uniks_control_items_sesion_id_fkey"
            columns: ["sesion_id"]
            isOneToOne: false
            referencedRelation: "uniks_control_sesiones"
            referencedColumns: ["id"]
          },
        ]
      }
      uniks_control_sesiones: {
        Row: {
          created_at: string
          estado: string
          fecha_fin: string
          fecha_inicio: string
          id: string
          notas: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          estado?: string
          fecha_fin: string
          fecha_inicio: string
          id?: string
          notas?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          estado?: string
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          notas?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      uniks_gastos: {
        Row: {
          categoria: Database["public"]["Enums"]["gasto_categoria"]
          created_at: string | null
          descripcion: string | null
          fecha: string | null
          id: string
          metodo_pago: Database["public"]["Enums"]["gasto_metodo_pago"]
          monto: number
          numero_comprobante: string | null
          numero_operacion: string | null
          proveedor_id: string | null
          proveedor_nombre: string | null
          tipo_comprobante:
            | Database["public"]["Enums"]["gasto_tipo_comprobante"]
            | null
          updated_at: string | null
        }
        Insert: {
          categoria: Database["public"]["Enums"]["gasto_categoria"]
          created_at?: string | null
          descripcion?: string | null
          fecha?: string | null
          id?: string
          metodo_pago: Database["public"]["Enums"]["gasto_metodo_pago"]
          monto: number
          numero_comprobante?: string | null
          numero_operacion?: string | null
          proveedor_id?: string | null
          proveedor_nombre?: string | null
          tipo_comprobante?:
            | Database["public"]["Enums"]["gasto_tipo_comprobante"]
            | null
          updated_at?: string | null
        }
        Update: {
          categoria?: Database["public"]["Enums"]["gasto_categoria"]
          created_at?: string | null
          descripcion?: string | null
          fecha?: string | null
          id?: string
          metodo_pago?: Database["public"]["Enums"]["gasto_metodo_pago"]
          monto?: number
          numero_comprobante?: string | null
          numero_operacion?: string | null
          proveedor_id?: string | null
          proveedor_nombre?: string | null
          tipo_comprobante?:
            | Database["public"]["Enums"]["gasto_tipo_comprobante"]
            | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uniks_gastos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "uniks_proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      uniks_pago_servicios: {
        Row: {
          created_at: string | null
          id: string
          pago_id: string
          precio_aplicado: number
          servicio_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          pago_id: string
          precio_aplicado: number
          servicio_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          pago_id?: string
          precio_aplicado?: number
          servicio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uniks_pago_servicios_pago_id_fkey"
            columns: ["pago_id"]
            isOneToOne: false
            referencedRelation: "uniks_pagos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uniks_pago_servicios_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "uniks_servicios"
            referencedColumns: ["id"]
          },
        ]
      }
      uniks_pagos: {
        Row: {
          cliente_id: string | null
          cliente_nombre: string | null
          created_at: string
          descripcion: string | null
          fecha: string
          id: string
          metodo_pago: string
          monto_total: number
          numero_operacion: string | null
        }
        Insert: {
          cliente_id?: string | null
          cliente_nombre?: string | null
          created_at?: string
          descripcion?: string | null
          fecha?: string
          id?: string
          metodo_pago: string
          monto_total: number
          numero_operacion?: string | null
        }
        Update: {
          cliente_id?: string | null
          cliente_nombre?: string | null
          created_at?: string
          descripcion?: string | null
          fecha?: string
          id?: string
          metodo_pago?: string
          monto_total?: number
          numero_operacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uniks_pagos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "uniks_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      uniks_productos: {
        Row: {
          codigo: string | null
          created_at: string
          descripcion: string | null
          fecha_caducidad: string | null
          id: string
          imagen_url_r2: string | null
          mostrar_en_tienda: boolean
          nombre: string
          precio: number
          precio_costo: number | null
          precio_publico: number | null
          stock: number
          stock_minimo: number
          updated_at: string
        }
        Insert: {
          codigo?: string | null
          created_at?: string
          descripcion?: string | null
          fecha_caducidad?: string | null
          id?: string
          imagen_url_r2?: string | null
          mostrar_en_tienda?: boolean
          nombre: string
          precio: number
          precio_costo?: number | null
          precio_publico?: number | null
          stock?: number
          stock_minimo?: number
          updated_at?: string
        }
        Update: {
          codigo?: string | null
          created_at?: string
          descripcion?: string | null
          fecha_caducidad?: string | null
          id?: string
          imagen_url_r2?: string | null
          mostrar_en_tienda?: boolean
          nombre?: string
          precio?: number
          precio_costo?: number | null
          precio_publico?: number | null
          stock?: number
          stock_minimo?: number
          updated_at?: string
        }
        Relationships: []
      }
      uniks_proveedores: {
        Row: {
          created_at: string | null
          id: string
          nombre: string
          notas: string | null
          ruc: string | null
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nombre: string
          notas?: string | null
          ruc?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nombre?: string
          notas?: string | null
          ruc?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      uniks_servicios: {
        Row: {
          created_at: string
          duracion: number
          id: string
          nombre: string
          precio: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          duracion: number
          id?: string
          nombre: string
          precio: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          duracion?: number
          id?: string
          nombre?: string
          precio?: number
          updated_at?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          abbreviation: string
          id: number
          name: string
        }
        Insert: {
          abbreviation: string
          id?: number
          name: string
        }
        Update: {
          abbreviation?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          id: number
          is_active: boolean | null
          location: string | null
          name: string
        }
        Insert: {
          id?: number
          is_active?: boolean | null
          location?: string | null
          name: string
        }
        Update: {
          id?: number
          is_active?: boolean | null
          location?: string | null
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_producto_stock: {
        Args: { p_delta: number; p_producto_id: string }
        Returns: undefined
      }
      agregar_item_carrito: {
        Args: {
          p_cantidad: number
          p_product_id: number
          p_usuario_id: string
          p_volumen_ml: number
        }
        Returns: {
          out_cart_id: string
          out_total_items: number
        }[]
      }
      close_control_sesion: {
        Args: { p_sesion_id: string }
        Returns: undefined
      }
      crm_current_org_id: { Args: never; Returns: string }
      decrementar_stock_seguro: {
        Args: { p_cantidad: number; p_product_id: number }
        Returns: {
          exitoso: boolean
          mensaje: string
          stock_restante: number
        }[]
      }
      generate_invoice_number: { Args: { p_user_id: string }; Returns: string }
      get_ajustes_en_periodo: {
        Args: { p_fin: string; p_inicio: string; p_producto_id: string }
        Returns: number
      }
      get_compras_en_periodo: {
        Args: { p_fin: string; p_inicio: string; p_producto_id: string }
        Returns: number
      }
      get_mas_vendidos: {
        Args: { p_empresa_id: string; p_limit?: number }
        Returns: {
          afecto_igv: boolean
          codigo: string
          foto_url: string
          nombre: string
          precio_mayorista: number
          precio_minorista: number
          producto_id: string
          stock_actual: number
          total_vendido: number
        }[]
      }
      get_my_rol: { Args: never; Returns: string }
      get_nearby_events: {
        Args: { radius_km?: number; user_lat: number; user_lng: number }
        Returns: {
          address: string
          category: string
          city: string
          country: string
          created_at: string
          creator_avatar_url: string
          creator_avg_rating: number
          creator_id: string
          creator_username: string
          current_participants: number
          description: string
          distance_km: number
          ends_at: string
          id: string
          is_locked: boolean
          lat: number
          lng: number
          location_hidden: boolean
          location_name: string
          max_participants: number
          starts_at: string
          status: string
          title: string
          updated_at: string
          visibility_radius_km: number
        }[]
      }
      get_user_id_by_email: { Args: { user_email: string }; Returns: string }
      lock_inactive_events: {
        Args: { inactivity_hours?: number }
        Returns: {
          event_id: string
          s3_keys: string[]
        }[]
      }
      ptovta_get_current_empresa_id: { Args: never; Returns: string }
      ra_abrir_caja_v1: {
        Args: {
          p_monto_inicial: number
          p_notas?: string
          p_operation_id: string
          p_sucursal_id: string
        }
        Returns: Json
      }
      ra_anular_compra: { Args: { p_compra_id: string }; Returns: undefined }
      ra_anular_orden_compra: {
        Args: { p_orden_compra_id: string }
        Returns: undefined
      }
      ra_aprobar_devolucion_v1: {
        Args: {
          p_devolucion_id: string
          p_operation_id: string
          p_reingreso_aprobado: boolean
          p_reingreso_override_motivo?: string
        }
        Returns: Json
      }
      ra_aprobar_devolucion_v1_059: {
        Args: {
          p_devolucion_id: string
          p_operation_id: string
          p_reingreso_aprobado: boolean
          p_reingreso_override_motivo?: string
        }
        Returns: Json
      }
      ra_avanzar_estado_guia: {
        Args: {
          p_guia_id: string
          p_nuevo_estado: Database["public"]["Enums"]["ra_estado_guia"]
        }
        Returns: Json
      }
      ra_cerrar_caja_v1: {
        Args: {
          p_caja_id: string
          p_efectivo_contado: number
          p_notas?: string
          p_operation_id: string
        }
        Returns: Json
      }
      ra_chatbot_buscar: {
        Args: {
          p_marca_repuesto?: string
          p_tipo_repuesto?: string
          p_tipo_vehiculo?: string
          q: string
        }
        Returns: {
          codigo_oem: string
          codigos_alternos: string
          marca_repuesto: string
          modelos: string
          nombre: string
          precio_venta: number
          precio_venta_dolar: number
          stock_actual: number
          tipo_repuesto: string
        }[]
      }
      ra_claim_sunat_nota_credito_outbox_for_devolucion: {
        Args: {
          p_devolucion_id: string
          p_force_retry?: boolean
          p_lease_seconds?: number
          p_worker_id: string
        }
        Returns: {
          attempt_count: number
          completed_at: string | null
          correlativo: number
          created_at: string
          devolucion_id: string
          document_key: string
          empresa_id: string
          error_code: string | null
          error_message: string | null
          external_id: string | null
          http_status: number | null
          id: string
          last_attempt_at: string | null
          lease_expires_at: string | null
          lease_token: string | null
          motivo_codigo: string
          motivo_descripcion: string
          next_attempt_at: string
          request_payload: Json
          response_payload: Json | null
          serie: string
          status: string
          tipo_referenciado: Database["public"]["Enums"]["ra_tipo_comprobante"]
          updated_at: string
          venta_id: string
          worker_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "ra_sunat_nota_credito_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      ra_claim_sunat_outbox: {
        Args: {
          p_lease_seconds?: number
          p_limit?: number
          p_worker_id: string
        }
        Returns: {
          attempt_count: number
          completed_at: string | null
          correlativo: number
          created_at: string
          document_key: string
          empresa_id: string
          error_code: string | null
          error_message: string | null
          external_id: string | null
          http_status: number | null
          id: string
          last_attempt_at: string | null
          lease_expires_at: string | null
          lease_token: string | null
          next_attempt_at: string
          request_payload: Json
          response_payload: Json | null
          serie: string
          status: string
          tipo_comprobante: Database["public"]["Enums"]["ra_tipo_comprobante"]
          updated_at: string
          venta_id: string
          worker_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "ra_sunat_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      ra_claim_sunat_outbox_for_venta: {
        Args: {
          p_lease_seconds?: number
          p_venta_id: string
          p_worker_id: string
        }
        Returns: {
          attempt_count: number
          completed_at: string | null
          correlativo: number
          created_at: string
          document_key: string
          empresa_id: string
          error_code: string | null
          error_message: string | null
          external_id: string | null
          http_status: number | null
          id: string
          last_attempt_at: string | null
          lease_expires_at: string | null
          lease_token: string | null
          next_attempt_at: string
          request_payload: Json
          response_payload: Json | null
          serie: string
          status: string
          tipo_comprobante: Database["public"]["Enums"]["ra_tipo_comprobante"]
          updated_at: string
          venta_id: string
          worker_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "ra_sunat_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      ra_clasificacion_bulk_upsert: {
        Args: { items: Json }
        Returns: {
          actualizados: number
          marcas_creadas: number
          tipos_creados: number
        }[]
      }
      ra_confirmar_compra: {
        Args: {
          p_abono_inicial?: Json
          p_items: Json
          p_moneda?: string
          p_notas: string
          p_nro_documento: string
          p_operation_id: string
          p_orden_compra_id?: string
          p_proveedor_id: string
          p_sucursal_id: string
          p_tipo_cambio?: number
          p_tipo_documento?: string
        }
        Returns: Json
      }
      ra_confirmar_orden_compra: {
        Args: { p_orden_compra_id: string }
        Returns: undefined
      }
      ra_confirmar_venta: {
        Args: {
          p_cliente_id: string
          p_fecha_vencimiento: string
          p_items: Json
          p_moneda: string
          p_numero_placa?: string
          p_operation_id: string
          p_pagos: Json
          p_sucursal_id: string
          p_tipo_cambio: number
          p_tipo_comprobante: Database["public"]["Enums"]["ra_tipo_comprobante"]
        }
        Returns: Json
      }
      ra_confirmar_venta_v1: {
        Args: {
          p_cliente_id: string
          p_fecha_vencimiento: string
          p_items: Json
          p_moneda: string
          p_numero_placa?: string
          p_operation_id: string
          p_pagos: Json
          p_sucursal_id: string
          p_tipo_cambio: number
          p_tipo_comprobante: Database["public"]["Enums"]["ra_tipo_comprobante"]
        }
        Returns: Json
      }
      ra_contar_stock_bajo: {
        Args: { p_empresa_id: string; p_sucursal_id?: string }
        Returns: number
      }
      ra_crear_guia: {
        Args: {
          p_items: Json
          p_notas: string
          p_sucursal_destino_id: string
          p_sucursal_origen_id: string
        }
        Returns: Json
      }
      ra_empresa_id: { Args: never; Returns: string }
      ra_error_compra: {
        Args: { p_codigo: string; p_detalle?: string }
        Returns: undefined
      }
      ra_estado_pago_proyectado: {
        Args: { p_compra_id: string; p_total: number }
        Returns: Database["public"]["Enums"]["ra_estado_pago_compra"]
      }
      ra_finish_sunat_nota_credito_outbox: {
        Args: {
          p_error_code?: string
          p_error_message?: string
          p_external_id?: string
          p_http_status?: number
          p_job_id: string
          p_lease_token: string
          p_outcome: string
          p_response_payload?: Json
        }
        Returns: boolean
      }
      ra_finish_sunat_outbox: {
        Args: {
          p_error_code?: string
          p_error_message?: string
          p_external_id?: string
          p_http_status?: number
          p_job_id: string
          p_lease_token: string
          p_outcome: string
          p_response_payload?: Json
        }
        Returns: boolean
      }
      ra_liquidar_devolucion_v1: {
        Args: {
          p_devolucion_id: string
          p_operation_id: string
          p_referencias?: Json
        }
        Returns: Json
      }
      ra_liquidar_devolucion_v1_059: {
        Args: {
          p_devolucion_id: string
          p_operation_id: string
          p_referencias?: Json
        }
        Returns: Json
      }
      ra_obtener_preview_serie_guia: {
        Args: { p_sucursal_id: string }
        Returns: Json
      }
      ra_obtener_resultado_compra: {
        Args: { p_operation_id: string }
        Returns: Json
      }
      ra_obtener_resultado_venta: {
        Args: { p_operation_id: string }
        Returns: Json
      }
      ra_preflight_compras_duplicadas: { Args: never; Returns: undefined }
      ra_preflight_estado_pago_divergencias: {
        Args: never
        Returns: {
          almacenado: string
          compra_id: string
          proyectado: string
        }[]
      }
      ra_recalcular_estado_pago: {
        Args: { p_compra_id: string; p_motivo: string; p_operation_id: string }
        Returns: Json
      }
      ra_rechazar_devolucion_v1: {
        Args: {
          p_devolucion_id: string
          p_motivo: string
          p_operation_id: string
        }
        Returns: Json
      }
      ra_recibir_guia: { Args: { p_guia_id: string }; Returns: Json }
      ra_registrar_cargo_compra: {
        Args: { p_compra_id: string }
        Returns: {
          movimiento_id: string
          saldo_deudor_nuevo: number
        }[]
      }
      ra_registrar_cargo_credito: {
        Args: { p_fecha_vencimiento: string; p_venta_id: string }
        Returns: {
          limite_excedido: boolean
          movimiento_id: string
          saldo_deudor_nuevo: number
        }[]
      }
      ra_registrar_cobro: {
        Args: {
          p_fecha: string
          p_metodo_pago: Database["public"]["Enums"]["ra_metodo_pago"]
          p_moneda_cobro: string
          p_monto: number
          p_referencia?: string
          p_tipo_cambio_cobro?: number
          p_venta_id: string
        }
        Returns: {
          movimiento_id: string
          saldo_deudor_nuevo: number
          saldo_venta_nuevo: number
        }[]
      }
      ra_registrar_cobro_v2: {
        Args: {
          p_fecha: string
          p_metodo_pago: Database["public"]["Enums"]["ra_metodo_pago"]
          p_moneda_cobro: string
          p_monto: number
          p_operation_id: string
          p_referencia?: string
          p_sucursal_id: string
          p_tipo_cambio_cobro?: number
          p_venta_id: string
        }
        Returns: Json
      }
      ra_registrar_compra: {
        Args: {
          p_empresa_id: string
          p_items: Json
          p_moneda?: string
          p_notas: string
          p_nro_documento: string
          p_orden_compra_id?: string
          p_proveedor_id: string
          p_sucursal_id: string
          p_tipo_cambio?: number
        }
        Returns: string
      }
      ra_registrar_movimiento_caja_v1: {
        Args: {
          p_concepto: string
          p_monto: number
          p_notas?: string
          p_operation_id: string
          p_sucursal_id: string
          p_tipo: string
        }
        Returns: Json
      }
      ra_registrar_pago_proveedor: {
        Args: {
          p_compra_id: string
          p_fecha: string
          p_metodo_pago: Database["public"]["Enums"]["ra_metodo_pago"]
          p_monto: number
          p_referencia?: string
        }
        Returns: {
          movimiento_id: string
          saldo_compra_nuevo: number
          saldo_deudor_nuevo: number
        }[]
      }
      ra_registrar_pago_proveedor_v2: {
        Args: {
          p_compra_id: string
          p_fecha: string
          p_metodo_pago: Database["public"]["Enums"]["ra_metodo_pago"]
          p_monto: number
          p_operation_id: string
          p_referencia?: string
          p_sucursal_id: string
        }
        Returns: Json
      }
      ra_registrar_recepcion_devolucion_v1: {
        Args: {
          p_condicion_declarada: string
          p_devolucion_id: string
          p_observacion?: string
          p_operation_id: string
          p_recibido: boolean
        }
        Returns: Json
      }
      ra_registrar_recepcion_devolucion_v1_059: {
        Args: {
          p_condicion_declarada: string
          p_devolucion_id: string
          p_observacion?: string
          p_operation_id: string
          p_recibido: boolean
        }
        Returns: Json
      }
      ra_revisar_liquidacion_v1: {
        Args: {
          p_decision: string
          p_liquidacion_id: string
          p_motivo: string
          p_operation_id: string
        }
        Returns: Json
      }
      ra_siguiente_correlativo: {
        Args: { p_empresa_id: string; p_serie: string }
        Returns: number
      }
      ra_solicitar_devolucion_v1: {
        Args: {
          p_items: Json
          p_motivo: string
          p_operation_id: string
          p_venta_id: string
        }
        Returns: Json
      }
      ra_solicitar_devolucion_v1_055: {
        Args: {
          p_items: Json
          p_motivo: string
          p_operation_id: string
          p_venta_id: string
        }
        Returns: Json
      }
      ra_sync_estado_pago_compras: {
        Args: { p_ids: string[] }
        Returns: undefined
      }
      ra_venta_resultado: {
        Args: { p_replayed?: boolean; p_venta_id: string }
        Returns: Json
      }
      re_auth_branch_id: { Args: never; Returns: string }
      re_auth_company_id: { Args: never; Returns: string }
      re_auth_role: { Args: never; Returns: string }
      re_create_reversal: {
        Args: { p_original_collection_id: string; p_reason: string }
        Returns: string
      }
      re_generate_credit_note_for_order: {
        Args: { p_order_id: string; p_returned_items: Json }
        Returns: string
      }
      re_generate_gre_for_manifest: {
        Args: { p_manifest_id: string }
        Returns: string
      }
      re_generate_invoice_for_order: {
        Args: { p_order_id: string }
        Returns: string
      }
      re_is_admin: { Args: never; Returns: boolean }
      re_is_supervisor_or_above: { Args: never; Returns: boolean }
      re_is_valid_transition: {
        Args: {
          p_from_state: Database["public"]["Enums"]["re_order_state"]
          p_to_state: Database["public"]["Enums"]["re_order_state"]
        }
        Returns: boolean
      }
      re_manifest_add_order: {
        Args: { p_manifest_id: string; p_order_id: string }
        Returns: string
      }
      re_manifest_remove_order: {
        Args: { p_manifest_id: string; p_order_id: string }
        Returns: string
      }
      re_recompute_manifest_totals: {
        Args: { p_manifest_id: string }
        Returns: undefined
      }
      re_register_collection: {
        Args: {
          p_branch_id: string
          p_customer_id: string
          p_items: Json
          p_payment_method: string
          p_reference_number: string
          p_seller_id: string
          p_total_collected: number
        }
        Returns: string
      }
      re_transition_manifest_status: {
        Args: {
          p_manifest_id: string
          p_to_state: Database["public"]["Enums"]["re_manifest_status"]
          p_user_id: string
        }
        Returns: string
      }
      re_transition_order_state: {
        Args: {
          p_order_id: string
          p_returned_items?: Json
          p_to_state: Database["public"]["Enums"]["re_order_state"]
          p_user_id: string
        }
        Returns: string
      }
      rl_chatbot_buscar: {
        Args: {
          p_categoria?: string
          p_limit?: number
          p_marca_camion?: string
          q: string
        }
        Returns: {
          categoria: string
          codigo_interno: string
          codigo_oem: string
          descripcion: string
          id: string
          imagen_url: string
          marca_repuesto: string
          marcas_camion: string
          nombre: string
          slug: string
          stock_estado: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      tume_apply_transition:
        | {
            Args: {
              p_actor_id: string
              p_case_id: string
              p_next_outcome: Database["public"]["Enums"]["tume_case_outcome_enum"]
              p_next_role: Database["public"]["Enums"]["tume_role_enum"]
              p_next_stage: Database["public"]["Enums"]["tume_case_stage_enum"]
              p_next_task_type: Database["public"]["Enums"]["tume_task_type_enum"]
              p_reason?: string
            }
            Returns: {
              awarded_at: string | null
              budget_usd: number | null
              client_id: string | null
              code: string
              created_at: string
              created_by: string | null
              current_task_type: Database["public"]["Enums"]["tume_task_type_enum"]
              delivery_due_at: string | null
              description: string | null
              enviado_at: string | null
              id: string
              is_express: boolean
              outcome:
                | Database["public"]["Enums"]["tume_case_outcome_enum"]
                | null
              quoted_amount_usd: number | null
              requested_at: string
              stage: Database["public"]["Enums"]["tume_case_stage_enum"]
              title: string
              type: Database["public"]["Enums"]["tume_case_type_enum"]
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "tume_cases"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_actor_id: string
              p_case_id: string
              p_next_outcome: Database["public"]["Enums"]["tume_case_outcome_enum"]
              p_next_role: Database["public"]["Enums"]["tume_role_enum"]
              p_next_stage: Database["public"]["Enums"]["tume_case_stage_enum"]
              p_next_task_type: Database["public"]["Enums"]["tume_task_type_enum"]
              p_quoted_amount_usd?: number
              p_reason?: string
            }
            Returns: {
              awarded_at: string | null
              budget_usd: number | null
              client_id: string | null
              code: string
              created_at: string
              created_by: string | null
              current_task_type: Database["public"]["Enums"]["tume_task_type_enum"]
              delivery_due_at: string | null
              description: string | null
              enviado_at: string | null
              id: string
              is_express: boolean
              outcome:
                | Database["public"]["Enums"]["tume_case_outcome_enum"]
                | null
              quoted_amount_usd: number | null
              requested_at: string
              stage: Database["public"]["Enums"]["tume_case_stage_enum"]
              title: string
              type: Database["public"]["Enums"]["tume_case_type_enum"]
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "tume_cases"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      tume_complete_final_task: {
        Args: { p_actor_id: string; p_case_id: string; p_reason?: string }
        Returns: {
          awarded_at: string | null
          budget_usd: number | null
          client_id: string | null
          code: string
          created_at: string
          created_by: string | null
          current_task_type: Database["public"]["Enums"]["tume_task_type_enum"]
          delivery_due_at: string | null
          description: string | null
          enviado_at: string | null
          id: string
          is_express: boolean
          outcome: Database["public"]["Enums"]["tume_case_outcome_enum"] | null
          quoted_amount_usd: number | null
          requested_at: string
          stage: Database["public"]["Enums"]["tume_case_stage_enum"]
          title: string
          type: Database["public"]["Enums"]["tume_case_type_enum"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tume_cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      tume_create_case: {
        Args: {
          p_actor_id: string
          p_budget_usd: number
          p_client_id: string
          p_code: string
          p_delivery_due_at: string
          p_description: string
          p_is_express: boolean
          p_title: string
          p_type: Database["public"]["Enums"]["tume_case_type_enum"]
        }
        Returns: {
          awarded_at: string | null
          budget_usd: number | null
          client_id: string | null
          code: string
          created_at: string
          created_by: string | null
          current_task_type: Database["public"]["Enums"]["tume_task_type_enum"]
          delivery_due_at: string | null
          description: string | null
          enviado_at: string | null
          id: string
          is_express: boolean
          outcome: Database["public"]["Enums"]["tume_case_outcome_enum"] | null
          quoted_amount_usd: number | null
          requested_at: string
          stage: Database["public"]["Enums"]["tume_case_stage_enum"]
          title: string
          type: Database["public"]["Enums"]["tume_case_type_enum"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tume_cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      client_doc_type: "DNI" | "RUC" | "Otros"
      gasto_categoria:
        | "insumos"
        | "servicios"
        | "alquiler"
        | "marketing"
        | "otros"
      gasto_metodo_pago: "efectivo" | "transferencia" | "yape"
      gasto_tipo_comprobante:
        | "factura"
        | "boleta"
        | "ticket"
        | "sin_comprobante"
      movement_reason:
        | "PURCHASE"
        | "SALE"
        | "ADJUSTMENT"
        | "INVENTORY_COUNT"
        | "INITIAL_LOAD"
        | "TRANSFER"
      movement_type: "IN" | "OUT"
      ra_cc_tipo_movimiento: "cargo" | "abono"
      ra_cxp_tipo_movimiento: "cargo" | "abono"
      ra_estado_caja: "abierta" | "cerrada"
      ra_estado_compra: "confirmada" | "anulada"
      ra_estado_devolucion:
        | "solicitada"
        | "recibida"
        | "aprobada"
        | "liquidada"
        | "rechazada"
      ra_estado_guia: "borrador" | "emitida" | "en_transito" | "recibida"
      ra_estado_orden_compra: "borrador" | "confirmada" | "recibida" | "anulada"
      ra_estado_pago_compra: "pendiente" | "parcial" | "pagado"
      ra_estado_venta: "pendiente" | "completada" | "anulada" | "error_sunat"
      ra_metodo_pago:
        | "efectivo"
        | "yape"
        | "tarjeta"
        | "transferencia"
        | "credito"
      ra_motivo_kardex:
        | "venta"
        | "compra"
        | "ajuste_manual"
        | "devolucion"
        | "merma"
        | "traslado"
      ra_rol: "superadmin" | "administrador" | "vendedor" | "lectura"
      ra_tipo_cliente: "mayorista" | "minorista"
      ra_tipo_comprobante: "ticket" | "boleta" | "factura"
      ra_tipo_documento: "DNI" | "RUC" | "CE" | "PASAPORTE"
      ra_tipo_kardex: "entrada" | "salida" | "ajuste"
      ra_tipo_movimiento: "ingreso" | "egreso"
      re_cancellation_doc_type:
        | "invoice"
        | "credit_note"
        | "remission_guide"
        | "collection"
      re_doc_type: "FACTURA" | "BOLETA"
      re_document_series_type: "GRE" | "FACTURA" | "BOLETA" | "NOTA_CREDITO"
      re_manifest_delivery_status:
        | "PENDING"
        | "DELIVERED"
        | "PARTIAL"
        | "REJECTED"
      re_manifest_status: "DRAFT" | "CONFIRMED" | "EN_ROUTE" | "CLOSED"
      re_movement_reason:
        | "PURCHASE"
        | "TRANSFER_IN"
        | "SALES_RETURN"
        | "ADJUSTMENT_IN"
        | "INITIAL_STOCK"
        | "SALE"
        | "TRANSFER_OUT"
        | "DAMAGE_EXPIRED"
        | "DAMAGE_BROKEN"
        | "DAMAGE_LOST"
        | "ADJUSTMENT_OUT"
      re_movement_type: "IN" | "OUT"
      re_order_state:
        | "DRAFT"
        | "PENDING"
        | "APPROVED"
        | "PROGRAMMED"
        | "EN_ROUTE"
        | "DELIVERED"
        | "PARTIAL"
        | "REJECTED"
        | "CANCELLED"
      re_payment_method: "EFECTIVO" | "YAPE" | "PLIN" | "TRANSFERENCIA"
      re_payment_status: "PENDING" | "PARTIAL" | "PAID"
      re_personnel_role: "DRIVER" | "ASSISTANT"
      re_settlement_status: "PENDING" | "APPROVED" | "DISCREPANCY"
      re_sunat_status:
        | "PENDIENTE"
        | "ENVIADO"
        | "ACEPTADO"
        | "RECHAZADO"
        | "FAILED"
        | "WAITING_FOR_INVOICE"
        | "ANULACION_PENDIENTE"
        | "ANULADO"
      re_transfer_status: "PENDING" | "IN_TRANSIT" | "CONFIRMED" | "CANCELLED"
      rl_stock_estado: "disponible" | "agotado" | "a_confirmar"
      sale_doc_type: "Factura" | "Boleta"
      sale_status: "Paid" | "Annulled"
      tume_case_outcome_enum:
        | "en_proceso"
        | "adjudicado"
        | "desestimado"
        | "no_adjudicado"
      tume_case_stage_enum: "solicitud" | "revision" | "cotizacion" | "cerrado"
      tume_case_type_enum: "servicio" | "bien"
      tume_role_enum:
        | "gerente_comercial"
        | "lider_cotizador"
        | "gerente_tecnico"
        | "cotizador"
      tume_task_status_enum: "pending" | "in_progress" | "done" | "skipped"
      tume_task_type_enum:
        | "recibir_solicitud"
        | "distribuir_solicitud"
        | "revisar_solicitud"
        | "revisar_tdr"
        | "consultar_gerencia_tecnica"
        | "solicitar_informacion"
        | "solicitar_visita_tecnica"
        | "evaluar_gerencia_tecnica"
        | "cotizar"
        | "revisar_cotizacion_lider"
        | "revisar_cotizacion_gerencia"
        | "enviar_cliente"
        | "enviar_no_cotizar"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      client_doc_type: ["DNI", "RUC", "Otros"],
      gasto_categoria: [
        "insumos",
        "servicios",
        "alquiler",
        "marketing",
        "otros",
      ],
      gasto_metodo_pago: ["efectivo", "transferencia", "yape"],
      gasto_tipo_comprobante: [
        "factura",
        "boleta",
        "ticket",
        "sin_comprobante",
      ],
      movement_reason: [
        "PURCHASE",
        "SALE",
        "ADJUSTMENT",
        "INVENTORY_COUNT",
        "INITIAL_LOAD",
        "TRANSFER",
      ],
      movement_type: ["IN", "OUT"],
      ra_cc_tipo_movimiento: ["cargo", "abono"],
      ra_cxp_tipo_movimiento: ["cargo", "abono"],
      ra_estado_caja: ["abierta", "cerrada"],
      ra_estado_compra: ["confirmada", "anulada"],
      ra_estado_devolucion: [
        "solicitada",
        "recibida",
        "aprobada",
        "liquidada",
        "rechazada",
      ],
      ra_estado_guia: ["borrador", "emitida", "en_transito", "recibida"],
      ra_estado_orden_compra: ["borrador", "confirmada", "recibida", "anulada"],
      ra_estado_pago_compra: ["pendiente", "parcial", "pagado"],
      ra_estado_venta: ["pendiente", "completada", "anulada", "error_sunat"],
      ra_metodo_pago: [
        "efectivo",
        "yape",
        "tarjeta",
        "transferencia",
        "credito",
      ],
      ra_motivo_kardex: [
        "venta",
        "compra",
        "ajuste_manual",
        "devolucion",
        "merma",
        "traslado",
      ],
      ra_rol: ["superadmin", "administrador", "vendedor", "lectura"],
      ra_tipo_cliente: ["mayorista", "minorista"],
      ra_tipo_comprobante: ["ticket", "boleta", "factura"],
      ra_tipo_documento: ["DNI", "RUC", "CE", "PASAPORTE"],
      ra_tipo_kardex: ["entrada", "salida", "ajuste"],
      ra_tipo_movimiento: ["ingreso", "egreso"],
      re_cancellation_doc_type: [
        "invoice",
        "credit_note",
        "remission_guide",
        "collection",
      ],
      re_doc_type: ["FACTURA", "BOLETA"],
      re_document_series_type: ["GRE", "FACTURA", "BOLETA", "NOTA_CREDITO"],
      re_manifest_delivery_status: [
        "PENDING",
        "DELIVERED",
        "PARTIAL",
        "REJECTED",
      ],
      re_manifest_status: ["DRAFT", "CONFIRMED", "EN_ROUTE", "CLOSED"],
      re_movement_reason: [
        "PURCHASE",
        "TRANSFER_IN",
        "SALES_RETURN",
        "ADJUSTMENT_IN",
        "INITIAL_STOCK",
        "SALE",
        "TRANSFER_OUT",
        "DAMAGE_EXPIRED",
        "DAMAGE_BROKEN",
        "DAMAGE_LOST",
        "ADJUSTMENT_OUT",
      ],
      re_movement_type: ["IN", "OUT"],
      re_order_state: [
        "DRAFT",
        "PENDING",
        "APPROVED",
        "PROGRAMMED",
        "EN_ROUTE",
        "DELIVERED",
        "PARTIAL",
        "REJECTED",
        "CANCELLED",
      ],
      re_payment_method: ["EFECTIVO", "YAPE", "PLIN", "TRANSFERENCIA"],
      re_payment_status: ["PENDING", "PARTIAL", "PAID"],
      re_personnel_role: ["DRIVER", "ASSISTANT"],
      re_settlement_status: ["PENDING", "APPROVED", "DISCREPANCY"],
      re_sunat_status: [
        "PENDIENTE",
        "ENVIADO",
        "ACEPTADO",
        "RECHAZADO",
        "FAILED",
        "WAITING_FOR_INVOICE",
        "ANULACION_PENDIENTE",
        "ANULADO",
      ],
      re_transfer_status: ["PENDING", "IN_TRANSIT", "CONFIRMED", "CANCELLED"],
      rl_stock_estado: ["disponible", "agotado", "a_confirmar"],
      sale_doc_type: ["Factura", "Boleta"],
      sale_status: ["Paid", "Annulled"],
      tume_case_outcome_enum: [
        "en_proceso",
        "adjudicado",
        "desestimado",
        "no_adjudicado",
      ],
      tume_case_stage_enum: ["solicitud", "revision", "cotizacion", "cerrado"],
      tume_case_type_enum: ["servicio", "bien"],
      tume_role_enum: [
        "gerente_comercial",
        "lider_cotizador",
        "gerente_tecnico",
        "cotizador",
      ],
      tume_task_status_enum: ["pending", "in_progress", "done", "skipped"],
      tume_task_type_enum: [
        "recibir_solicitud",
        "distribuir_solicitud",
        "revisar_solicitud",
        "revisar_tdr",
        "consultar_gerencia_tecnica",
        "solicitar_informacion",
        "solicitar_visita_tecnica",
        "evaluar_gerencia_tecnica",
        "cotizar",
        "revisar_cotizacion_lider",
        "revisar_cotizacion_gerencia",
        "enviar_cliente",
        "enviar_no_cotizar",
      ],
    },
  },
} as const
