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
      activity_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          id: string
          ip_hash: string | null
          metadata: Json
          resource: string | null
          resource_id: string | null
          result: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          resource?: string | null
          resource_id?: string | null
          result?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          resource?: string | null
          resource_id?: string | null
          result?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      agent_actions: {
        Row: {
          action_type: string
          agent_name: string
          approved_at: string | null
          approved_by: string | null
          compiled_arabic_output: string | null
          correlation_id: string | null
          created_at: string
          error_message: string | null
          executed_at: string | null
          execution_status:
            | Database["public"]["Enums"]["action_execution_status"]
            | null
          id: string
          originating_agent:
            | Database["public"]["Enums"]["valid_agent_modes"]
            | null
          payload: Json
          priority_level: string | null
          recommendation_id: string | null
          result: Json | null
          status: string
          target_pipeline:
            | Database["public"]["Enums"]["action_target_pipeline"]
            | null
          updated_at: string
          updated_by_admin: string | null
        }
        Insert: {
          action_type: string
          agent_name: string
          approved_at?: string | null
          approved_by?: string | null
          compiled_arabic_output?: string | null
          correlation_id?: string | null
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          execution_status?:
            | Database["public"]["Enums"]["action_execution_status"]
            | null
          id?: string
          originating_agent?:
            | Database["public"]["Enums"]["valid_agent_modes"]
            | null
          payload?: Json
          priority_level?: string | null
          recommendation_id?: string | null
          result?: Json | null
          status?: string
          target_pipeline?:
            | Database["public"]["Enums"]["action_target_pipeline"]
            | null
          updated_at?: string
          updated_by_admin?: string | null
        }
        Update: {
          action_type?: string
          agent_name?: string
          approved_at?: string | null
          approved_by?: string | null
          compiled_arabic_output?: string | null
          correlation_id?: string | null
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          execution_status?:
            | Database["public"]["Enums"]["action_execution_status"]
            | null
          id?: string
          originating_agent?:
            | Database["public"]["Enums"]["valid_agent_modes"]
            | null
          payload?: Json
          priority_level?: string | null
          recommendation_id?: string | null
          result?: Json | null
          status?: string
          target_pipeline?:
            | Database["public"]["Enums"]["action_target_pipeline"]
            | null
          updated_at?: string
          updated_by_admin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_actions_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "agent_recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_approval_requests: {
        Row: {
          action_type: string
          agent_id: string
          ai_analysis: Json | null
          ai_analyzed_at: string | null
          ai_confidence: number | null
          ai_risk_score: number | null
          conversation_id: string | null
          correlation_id: string | null
          created_at: string
          customer_message: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          extracted_medicines: Json | null
          id: string
          is_valid: boolean | null
          missing_medicines: string[] | null
          payload: Json
          pharmacist_notes: string | null
          status: string
          submitted_by: string | null
          updated_at: string
          user_phone: string | null
        }
        Insert: {
          action_type: string
          agent_id?: string
          ai_analysis?: Json | null
          ai_analyzed_at?: string | null
          ai_confidence?: number | null
          ai_risk_score?: number | null
          conversation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          customer_message?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          extracted_medicines?: Json | null
          id?: string
          is_valid?: boolean | null
          missing_medicines?: string[] | null
          payload?: Json
          pharmacist_notes?: string | null
          status?: string
          submitted_by?: string | null
          updated_at?: string
          user_phone?: string | null
        }
        Update: {
          action_type?: string
          agent_id?: string
          ai_analysis?: Json | null
          ai_analyzed_at?: string | null
          ai_confidence?: number | null
          ai_risk_score?: number | null
          conversation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          customer_message?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          extracted_medicines?: Json | null
          id?: string
          is_valid?: boolean | null
          missing_medicines?: string[] | null
          payload?: Json
          pharmacist_notes?: string | null
          status?: string
          submitted_by?: string | null
          updated_at?: string
          user_phone?: string | null
        }
        Relationships: []
      }
      agent_decisions: {
        Row: {
          confidence_score: number | null
          context_ms: number | null
          context_snapshot: Json | null
          created_at: string
          decision_factors: Json | null
          decision_ms: number | null
          decision_summary: string | null
          expires_at: string
          fallback_reason: string | null
          fallback_used: boolean
          generation_ms: number | null
          id: number
          platform: string
          post_id: string | null
          product_breakdown: Json | null
          product_id: string | null
          product_score: number | null
          ranking_ms: number | null
          total_ms: number | null
          variants: Json
          winner_variant_id: string | null
        }
        Insert: {
          confidence_score?: number | null
          context_ms?: number | null
          context_snapshot?: Json | null
          created_at?: string
          decision_factors?: Json | null
          decision_ms?: number | null
          decision_summary?: string | null
          expires_at?: string
          fallback_reason?: string | null
          fallback_used?: boolean
          generation_ms?: number | null
          id?: number
          platform: string
          post_id?: string | null
          product_breakdown?: Json | null
          product_id?: string | null
          product_score?: number | null
          ranking_ms?: number | null
          total_ms?: number | null
          variants?: Json
          winner_variant_id?: string | null
        }
        Update: {
          confidence_score?: number | null
          context_ms?: number | null
          context_snapshot?: Json | null
          created_at?: string
          decision_factors?: Json | null
          decision_ms?: number | null
          decision_summary?: string | null
          expires_at?: string
          fallback_reason?: string | null
          fallback_used?: boolean
          generation_ms?: number | null
          id?: number
          platform?: string
          post_id?: string | null
          product_breakdown?: Json | null
          product_id?: string | null
          product_score?: number | null
          ranking_ms?: number | null
          total_ms?: number | null
          variants?: Json
          winner_variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_decisions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_decisions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_events: {
        Row: {
          correlation_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_name: string
          id: string
          last_error: string | null
          occurred_at: string
          payload: Json
          processed_at: string | null
          processed_by: string | null
          retry_count: number
          source: string
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_name: string
          id?: string
          last_error?: string | null
          occurred_at?: string
          payload?: Json
          processed_at?: string | null
          processed_by?: string | null
          retry_count?: number
          source?: string
        }
        Update: {
          correlation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_name?: string
          id?: string
          last_error?: string | null
          occurred_at?: string
          payload?: Json
          processed_at?: string | null
          processed_by?: string | null
          retry_count?: number
          source?: string
        }
        Relationships: []
      }
      agent_events_dlq: {
        Row: {
          correlation_id: string | null
          entity_id: string | null
          entity_type: string | null
          event_name: string
          failed_at: string
          id: string
          last_error: string | null
          occurred_at: string
          original_id: string
          payload: Json
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          retry_count: number
          source: string
        }
        Insert: {
          correlation_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_name: string
          failed_at?: string
          id?: string
          last_error?: string | null
          occurred_at: string
          original_id: string
          payload?: Json
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          retry_count: number
          source?: string
        }
        Update: {
          correlation_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_name?: string
          failed_at?: string
          id?: string
          last_error?: string | null
          occurred_at?: string
          original_id?: string
          payload?: Json
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          retry_count?: number
          source?: string
        }
        Relationships: []
      }
      agent_feedback_events: {
        Row: {
          comments: number
          expires_at: string
          external_id: string | null
          id: number
          likes: number
          platform: string
          post_id: string | null
          raw_payload: Json | null
          received_at: string
          shares: number
          views: number
        }
        Insert: {
          comments?: number
          expires_at?: string
          external_id?: string | null
          id?: number
          likes?: number
          platform: string
          post_id?: string | null
          raw_payload?: Json | null
          received_at?: string
          shares?: number
          views?: number
        }
        Update: {
          comments?: number
          expires_at?: string
          external_id?: string | null
          id?: number
          likes?: number
          platform?: string
          post_id?: string | null
          raw_payload?: Json | null
          received_at?: string
          shares?: number
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_feedback_events_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_kpis: {
        Row: {
          agent_name: string
          as_of: string
          created_at: string
          details: Json
          id: string
          metric: string
          score: number | null
        }
        Insert: {
          agent_name: string
          as_of?: string
          created_at?: string
          details?: Json
          id?: string
          metric: string
          score?: number | null
        }
        Update: {
          agent_name?: string
          as_of?: string
          created_at?: string
          details?: Json
          id?: string
          metric?: string
          score?: number | null
        }
        Relationships: []
      }
      agent_memory: {
        Row: {
          agent_id: string
          created_at: string
          decision: string
          id: string
          learned_lesson: string
          outcome: string
          situation: string
        }
        Insert: {
          agent_id?: string
          created_at?: string
          decision: string
          id?: string
          learned_lesson: string
          outcome: string
          situation: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          decision?: string
          id?: string
          learned_lesson?: string
          outcome?: string
          situation?: string
        }
        Relationships: []
      }
      agent_performance_insights: {
        Row: {
          avg_engagement: number | null
          computed_at: string
          id: number
          notes: string | null
          platform: string | null
          recommendations: Json
          sample_size: number
          top_tone: string | null
          top_variant_id: string | null
          window_days: number
        }
        Insert: {
          avg_engagement?: number | null
          computed_at?: string
          id?: number
          notes?: string | null
          platform?: string | null
          recommendations?: Json
          sample_size: number
          top_tone?: string | null
          top_variant_id?: string | null
          window_days?: number
        }
        Update: {
          avg_engagement?: number | null
          computed_at?: string
          id?: number
          notes?: string | null
          platform?: string | null
          recommendations?: Json
          sample_size?: number
          top_tone?: string | null
          top_variant_id?: string | null
          window_days?: number
        }
        Relationships: []
      }
      agent_recommendations: {
        Row: {
          agent_name: string
          category: string
          confidence: number | null
          created_at: string
          dedupe_key: string
          id: string
          impact_estimate: number | null
          payload: Json
          rationale: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          agent_name: string
          category: string
          confidence?: number | null
          created_at?: string
          dedupe_key?: string
          id?: string
          impact_estimate?: number | null
          payload?: Json
          rationale?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          agent_name?: string
          category?: string
          confidence?: number | null
          created_at?: string
          dedupe_key?: string
          id?: string
          impact_estimate?: number | null
          payload?: Json
          rationale?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          agent: Database["public"]["Enums"]["valid_agent_modes"]
          confidence: number | null
          correlation_id: string | null
          created_at: string
          details: Json
          execution_time_ms: number | null
          findings_count: number | null
          finished_at: string | null
          id: string
          impact_estimate: number | null
          kind: string
          recommendations_count: number | null
          started_at: string
          status: string
          summary: string | null
        }
        Insert: {
          agent: Database["public"]["Enums"]["valid_agent_modes"]
          confidence?: number | null
          correlation_id?: string | null
          created_at?: string
          details?: Json
          execution_time_ms?: number | null
          findings_count?: number | null
          finished_at?: string | null
          id?: string
          impact_estimate?: number | null
          kind: string
          recommendations_count?: number | null
          started_at?: string
          status?: string
          summary?: string | null
        }
        Update: {
          agent?: Database["public"]["Enums"]["valid_agent_modes"]
          confidence?: number | null
          correlation_id?: string | null
          created_at?: string
          details?: Json
          execution_time_ms?: number | null
          findings_count?: number | null
          finished_at?: string | null
          id?: string
          impact_estimate?: number | null
          kind?: string
          recommendations_count?: number | null
          started_at?: string
          status?: string
          summary?: string | null
        }
        Relationships: []
      }
      agent_weights: {
        Row: {
          created_at: string
          criterion: string
          description: string | null
          id: number
          updated_at: string
          updated_by: string | null
          weight: number
        }
        Insert: {
          created_at?: string
          criterion: string
          description?: string | null
          id?: number
          updated_at?: string
          updated_by?: string | null
          weight: number
        }
        Update: {
          created_at?: string
          criterion?: string
          description?: string | null
          id?: number
          updated_at?: string
          updated_by?: string | null
          weight?: number
        }
        Relationships: []
      }
      ai_actions: {
        Row: {
          agent_name: string
          approval_request_id: string | null
          created_at: string
          error_message: string | null
          id: string
          input: Json
          latency_ms: number | null
          output: Json | null
          requires_approval: boolean
          status: string
          tool_name: string
        }
        Insert: {
          agent_name: string
          approval_request_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input?: Json
          latency_ms?: number | null
          output?: Json | null
          requires_approval?: boolean
          status?: string
          tool_name: string
        }
        Update: {
          agent_name?: string
          approval_request_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input?: Json
          latency_ms?: number | null
          output?: Json | null
          requires_approval?: boolean
          status?: string
          tool_name?: string
        }
        Relationships: []
      }
      ai_agent_permissions: {
        Row: {
          agent_name: string
          created_at: string
          id: string
          permission: string
        }
        Insert: {
          agent_name: string
          created_at?: string
          id?: string
          permission: string
        }
        Update: {
          agent_name?: string
          created_at?: string
          id?: string
          permission?: string
        }
        Relationships: []
      }
      ai_agents: {
        Row: {
          capabilities: Json
          category: string
          code: string
          created_at: string
          enabled: boolean
          event_subscriptions: string[]
          health: string
          id: string
          last_dispatched_at: string | null
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          capabilities?: Json
          category: string
          code: string
          created_at?: string
          enabled?: boolean
          event_subscriptions?: string[]
          health?: string
          id?: string
          last_dispatched_at?: string | null
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          capabilities?: Json
          category?: string
          code?: string
          created_at?: string
          enabled?: boolean
          event_subscriptions?: string[]
          health?: string
          id?: string
          last_dispatched_at?: string | null
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_business_insights: {
        Row: {
          agent_name: string | null
          confidence: number
          created_at: string
          id: string
          insight_type: string
          metrics: Json
          recommendation: Json
          summary: string
        }
        Insert: {
          agent_name?: string | null
          confidence?: number
          created_at?: string
          id?: string
          insight_type: string
          metrics?: Json
          recommendation?: Json
          summary: string
        }
        Update: {
          agent_name?: string | null
          confidence?: number
          created_at?: string
          id?: string
          insight_type?: string
          metrics?: Json
          recommendation?: Json
          summary?: string
        }
        Relationships: []
      }
      ai_campaigns: {
        Row: {
          active: boolean
          content_type: string
          created_at: string
          description: string | null
          frequency: string
          id: string
          name: string
          post_id: string | null
          target_rules: Json
          updated_at: string
        }
        Insert: {
          active?: boolean
          content_type?: string
          created_at?: string
          description?: string | null
          frequency?: string
          id?: string
          name: string
          post_id?: string | null
          target_rules?: Json
          updated_at?: string
        }
        Update: {
          active?: boolean
          content_type?: string
          created_at?: string
          description?: string | null
          frequency?: string
          id?: string
          name?: string
          post_id?: string | null
          target_rules?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_campaigns_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "medical_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_decisions: {
        Row: {
          action: Json | null
          agent_name: string | null
          confidence: number | null
          created_at: string | null
          decision_type: string | null
          event_id: string | null
          id: string
          reasoning: Json | null
        }
        Insert: {
          action?: Json | null
          agent_name?: string | null
          confidence?: number | null
          created_at?: string | null
          decision_type?: string | null
          event_id?: string | null
          id?: string
          reasoning?: Json | null
        }
        Update: {
          action?: Json | null
          agent_name?: string | null
          confidence?: number | null
          created_at?: string | null
          decision_type?: string | null
          event_id?: string | null
          id?: string
          reasoning?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_decisions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "ai_events"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_events: {
        Row: {
          correlation_id: string | null
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          priority: string | null
          processed_at: string | null
          source: string
          source_event_id: string | null
          status: string | null
          target_agent: string | null
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          priority?: string | null
          processed_at?: string | null
          source: string
          source_event_id?: string | null
          status?: string | null
          target_agent?: string | null
        }
        Update: {
          correlation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          priority?: string | null
          processed_at?: string | null
          source?: string
          source_event_id?: string | null
          status?: string | null
          target_agent?: string | null
        }
        Relationships: []
      }
      ai_feedback: {
        Row: {
          created_at: string
          decision_id: string
          feedback: Json
          id: string
          rating: number
          submitted_by: string | null
        }
        Insert: {
          created_at?: string
          decision_id: string
          feedback?: Json
          id?: string
          rating: number
          submitted_by?: string | null
        }
        Update: {
          created_at?: string
          decision_id?: string
          feedback?: Json
          id?: string
          rating?: number
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_feedback_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "ai_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_memory: {
        Row: {
          agent_name: string
          context: Json
          created_at: string
          expires_at: string | null
          id: string
          importance: number
          memory_type: string
          updated_at: string
        }
        Insert: {
          agent_name: string
          context?: Json
          created_at?: string
          expires_at?: string | null
          id?: string
          importance?: number
          memory_type: string
          updated_at?: string
        }
        Update: {
          agent_name?: string
          context?: Json
          created_at?: string
          expires_at?: string | null
          id?: string
          importance?: number
          memory_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_neural_memory: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          importance: number
          memory_category: string
          metadata: Json
          model_version: string
          owner_id: string | null
          owner_type: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          importance?: number
          memory_category: string
          metadata?: Json
          model_version?: string
          owner_id?: string | null
          owner_type: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          importance?: number
          memory_category?: string
          metadata?: Json
          model_version?: string
          owner_id?: string | null
          owner_type?: string
        }
        Relationships: []
      }
      ai_neural_synaptic_log: {
        Row: {
          created_at: string
          decision_id: string | null
          dispatched_tools: string[]
          district: string | null
          execution_time_ms: number
          id: string
          is_safe: boolean | null
          payload_transmitted: Json
          session_id: string
          target_destination: string
          trigger_source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          decision_id?: string | null
          dispatched_tools?: string[]
          district?: string | null
          execution_time_ms: number
          id?: string
          is_safe?: boolean | null
          payload_transmitted: Json
          session_id?: string
          target_destination: string
          trigger_source: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          decision_id?: string | null
          dispatched_tools?: string[]
          district?: string | null
          execution_time_ms?: number
          id?: string
          is_safe?: boolean | null
          payload_transmitted?: Json
          session_id?: string
          target_destination?: string
          trigger_source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_safety_logs: {
        Row: {
          context: string | null
          created_at: string
          details: Json
          id: string
          kind: string
          user_id: string | null
        }
        Insert: {
          context?: string | null
          created_at?: string
          details?: Json
          id?: string
          kind: string
          user_id?: string | null
        }
        Update: {
          context?: string | null
          created_at?: string
          details?: Json
          id?: string
          kind?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_security_audit: {
        Row: {
          action: string
          actor: string | null
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          resource: string | null
          result: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          resource?: string | null
          result?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          resource?: string | null
          result?: string | null
        }
        Relationships: []
      }
      ai_security_events: {
        Row: {
          action_taken: string | null
          actor_id: string | null
          created_at: string
          details: Json
          event_type: string
          id: string
          resolved: boolean
          resolved_at: string | null
          risk_score: number
          severity: string
          source: string | null
        }
        Insert: {
          action_taken?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          risk_score?: number
          severity?: string
          source?: string | null
        }
        Update: {
          action_taken?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          risk_score?: number
          severity?: string
          source?: string | null
        }
        Relationships: []
      }
      ai_tool_events: {
        Row: {
          agent_id: string
          conversation_id: string | null
          correlation_id: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          input: Json
          output_summary: Json
          status: string
          tool_name: string
          user_phone: string | null
        }
        Insert: {
          agent_id?: string
          conversation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input?: Json
          output_summary?: Json
          status?: string
          tool_name: string
          user_phone?: string | null
        }
        Update: {
          agent_id?: string
          conversation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input?: Json
          output_summary?: Json
          status?: string
          tool_name?: string
          user_phone?: string | null
        }
        Relationships: []
      }
      ai_widget_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          meta: Json
          session_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          meta?: Json
          session_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          meta?: Json
          session_id?: string | null
        }
        Relationships: []
      }
      ai_world_health: {
        Row: {
          checked_at: string
          id: string
          metrics: Json
          status: string
          system_name: string
        }
        Insert: {
          checked_at?: string
          id?: string
          metrics?: Json
          status: string
          system_name: string
        }
        Update: {
          checked_at?: string
          id?: string
          metrics?: Json
          status?: string
          system_name?: string
        }
        Relationships: []
      }
      air_agents: {
        Row: {
          allowed_tools: string[]
          created_at: string
          description: string | null
          display_name: string
          is_active: boolean
          key: string
          max_tokens: number
          model: string
          prompt_key: string
          temperature: number
          updated_at: string
        }
        Insert: {
          allowed_tools?: string[]
          created_at?: string
          description?: string | null
          display_name: string
          is_active?: boolean
          key: string
          max_tokens?: number
          model?: string
          prompt_key: string
          temperature?: number
          updated_at?: string
        }
        Update: {
          allowed_tools?: string[]
          created_at?: string
          description?: string | null
          display_name?: string
          is_active?: boolean
          key?: string
          max_tokens?: number
          model?: string
          prompt_key?: string
          temperature?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "air_agents_prompt_key_fkey"
            columns: ["prompt_key"]
            isOneToOne: false
            referencedRelation: "air_prompts"
            referencedColumns: ["key"]
          },
        ]
      }
      air_budgets: {
        Row: {
          consumed_cost_cents: number
          consumed_tokens: number
          cost_limit_cents: number | null
          created_at: string
          id: string
          is_active: boolean
          latency_ms_limit: number | null
          organization_id: string
          period: string
          scope: string
          token_limit: number | null
          updated_at: string
          window_start: string
        }
        Insert: {
          consumed_cost_cents?: number
          consumed_tokens?: number
          cost_limit_cents?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          latency_ms_limit?: number | null
          organization_id: string
          period: string
          scope: string
          token_limit?: number | null
          updated_at?: string
          window_start?: string
        }
        Update: {
          consumed_cost_cents?: number
          consumed_tokens?: number
          cost_limit_cents?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          latency_ms_limit?: number | null
          organization_id?: string
          period?: string
          scope?: string
          token_limit?: number | null
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      air_capabilities: {
        Row: {
          agent_key: string
          allowed_domains: string[]
          can_approve: boolean
          can_call_tools: boolean
          can_execute: boolean
          can_learn: boolean
          can_read: boolean
          can_write: boolean
          created_at: string
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          agent_key: string
          allowed_domains?: string[]
          can_approve?: boolean
          can_call_tools?: boolean
          can_execute?: boolean
          can_learn?: boolean
          can_read?: boolean
          can_write?: boolean
          created_at?: string
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          agent_key?: string
          allowed_domains?: string[]
          can_approve?: boolean
          can_call_tools?: boolean
          can_execute?: boolean
          can_learn?: boolean
          can_read?: boolean
          can_write?: boolean
          created_at?: string
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      air_evaluations: {
        Row: {
          cost_cents: number | null
          created_at: string
          feedback: Json
          id: string
          latency_ms: number | null
          organization_id: string
          quality: number | null
          retries: number
          run_id: string
          success: boolean
        }
        Insert: {
          cost_cents?: number | null
          created_at?: string
          feedback?: Json
          id?: string
          latency_ms?: number | null
          organization_id: string
          quality?: number | null
          retries?: number
          run_id: string
          success?: boolean
        }
        Update: {
          cost_cents?: number | null
          created_at?: string
          feedback?: Json
          id?: string
          latency_ms?: number | null
          organization_id?: string
          quality?: number | null
          retries?: number
          run_id?: string
          success?: boolean
        }
        Relationships: []
      }
      air_hitl_approvals: {
        Row: {
          action_key: string
          agent_key: string
          correlation_id: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          organization_id: string
          payload: Json
          reason: string | null
          requested_by: string | null
          risk_level: string
          run_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action_key: string
          agent_key: string
          correlation_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          organization_id: string
          payload?: Json
          reason?: string | null
          requested_by?: string | null
          risk_level?: string
          run_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          action_key?: string
          agent_key?: string
          correlation_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          organization_id?: string
          payload?: Json
          reason?: string | null
          requested_by?: string | null
          risk_level?: string
          run_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      air_kernel_calls: {
        Row: {
          allowed: boolean
          correlation_id: string | null
          created_at: string
          decision: Json
          denied_reason: string | null
          from_agent: string | null
          id: string
          organization_id: string
          policy_key: string | null
          purpose: string
          to_agent: string
        }
        Insert: {
          allowed: boolean
          correlation_id?: string | null
          created_at?: string
          decision?: Json
          denied_reason?: string | null
          from_agent?: string | null
          id?: string
          organization_id: string
          policy_key?: string | null
          purpose: string
          to_agent: string
        }
        Update: {
          allowed?: boolean
          correlation_id?: string | null
          created_at?: string
          decision?: Json
          denied_reason?: string | null
          from_agent?: string | null
          id?: string
          organization_id?: string
          policy_key?: string | null
          purpose?: string
          to_agent?: string
        }
        Relationships: []
      }
      air_memory_layers: {
        Row: {
          agent_key: string
          content: string
          created_at: string
          expires_at: string | null
          id: string
          importance: number
          key: string | null
          layer: string
          organization_id: string
          scope_id: string | null
          scope_type: string
        }
        Insert: {
          agent_key: string
          content: string
          created_at?: string
          expires_at?: string | null
          id?: string
          importance?: number
          key?: string | null
          layer: string
          organization_id: string
          scope_id?: string | null
          scope_type?: string
        }
        Update: {
          agent_key?: string
          content?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          importance?: number
          key?: string | null
          layer?: string
          organization_id?: string
          scope_id?: string | null
          scope_type?: string
        }
        Relationships: []
      }
      air_policies: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key: string
          organization_id: string
          priority: number
          rule: Json
          subject: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          organization_id: string
          priority?: number
          rule: Json
          subject: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          organization_id?: string
          priority?: number
          rule?: Json
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      air_prompts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          description: string | null
          evaluation_score: number | null
          guardrails: Json
          key: string
          metadata: Json
          output_schema: Json | null
          rollback_version: number | null
          status: string
          system_prompt: string
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          evaluation_score?: number | null
          guardrails?: Json
          key: string
          metadata?: Json
          output_schema?: Json | null
          rollback_version?: number | null
          status?: string
          system_prompt: string
          updated_at?: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          evaluation_score?: number | null
          guardrails?: Json
          key?: string
          metadata?: Json
          output_schema?: Json | null
          rollback_version?: number | null
          status?: string
          system_prompt?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      air_runs: {
        Row: {
          actor_user_id: string
          agent_key: string
          completion_tokens: number | null
          correlation_id: string | null
          created_at: string
          error_message: string | null
          id: string
          input: string
          latency_ms: number | null
          metadata: Json
          model: string
          organization_id: string
          output: string | null
          prompt_tokens: number | null
          status: string
          tools_used: string[]
          total_tokens: number | null
        }
        Insert: {
          actor_user_id: string
          agent_key: string
          completion_tokens?: number | null
          correlation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input: string
          latency_ms?: number | null
          metadata?: Json
          model: string
          organization_id: string
          output?: string | null
          prompt_tokens?: number | null
          status?: string
          tools_used?: string[]
          total_tokens?: number | null
        }
        Update: {
          actor_user_id?: string
          agent_key?: string
          completion_tokens?: number | null
          correlation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input?: string
          latency_ms?: number | null
          metadata?: Json
          model?: string
          organization_id?: string
          output?: string | null
          prompt_tokens?: number | null
          status?: string
          tools_used?: string[]
          total_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "air_runs_agent_key_fkey"
            columns: ["agent_key"]
            isOneToOne: false
            referencedRelation: "air_agents"
            referencedColumns: ["key"]
          },
        ]
      }
      alert_dedupe: {
        Row: {
          alert_key: string
          count: number
          last_sent_at: string
        }
        Insert: {
          alert_key: string
          count?: number
          last_sent_at?: string
        }
        Update: {
          alert_key?: string
          count?: number
          last_sent_at?: string
        }
        Relationships: []
      }
      alert_settings: {
        Row: {
          enable_email: boolean
          enable_errors: boolean
          enable_growth: boolean
          enable_overdue: boolean
          enable_slack: boolean
          enable_sms: boolean
          enable_uptime: boolean
          enable_whatsapp: boolean
          errors_threshold: number
          growth_threshold_pct: number
          id: number
          overdue_orders_threshold: number
          updated_at: string
          updated_by: string | null
          uptime_threshold_pct: number
        }
        Insert: {
          enable_email?: boolean
          enable_errors?: boolean
          enable_growth?: boolean
          enable_overdue?: boolean
          enable_slack?: boolean
          enable_sms?: boolean
          enable_uptime?: boolean
          enable_whatsapp?: boolean
          errors_threshold?: number
          growth_threshold_pct?: number
          id?: number
          overdue_orders_threshold?: number
          updated_at?: string
          updated_by?: string | null
          uptime_threshold_pct?: number
        }
        Update: {
          enable_email?: boolean
          enable_errors?: boolean
          enable_growth?: boolean
          enable_overdue?: boolean
          enable_slack?: boolean
          enable_sms?: boolean
          enable_uptime?: boolean
          enable_whatsapp?: boolean
          errors_threshold?: number
          growth_threshold_pct?: number
          id?: number
          overdue_orders_threshold?: number
          updated_at?: string
          updated_by?: string | null
          uptime_threshold_pct?: number
        }
        Relationships: []
      }
      alert_subscribers: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          min_severity: string
          phone_e164: string
          receive_sms: boolean
          receive_whatsapp: boolean
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          min_severity?: string
          phone_e164: string
          receive_sms?: boolean
          receive_whatsapp?: boolean
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          min_severity?: string
          phone_e164?: string
          receive_sms?: boolean
          receive_whatsapp?: boolean
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          action: string
          actor_user_id: string
          branch_id: string | null
          correlation_id: string | null
          created_at: string
          id: string
          ip: string | null
          organization_id: string
          payload: Json
          resource_id: string | null
          resource_type: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          branch_id?: string | null
          correlation_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          organization_id: string
          payload?: Json
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          branch_id?: string | null
          correlation_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          organization_id?: string
          payload?: Json
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string
          correlation_id: string
          created_at: string
          id: string
          ip_address: unknown
          new_value: Json | null
          old_value: Json | null
          organization_id: string | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id: string
          correlation_id: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_value?: Json | null
          old_value?: Json | null
          organization_id?: string | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          correlation_id?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_value?: Json | null
          old_value?: Json | null
          organization_id?: string | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      backup_verification_runs: {
        Row: {
          checked: number
          correlation_id: string | null
          created_at: string
          failed: number
          freshness_ok: boolean
          id: string
          passed: number
          ran_at: string
          results: Json
          source: string
        }
        Insert: {
          checked?: number
          correlation_id?: string | null
          created_at?: string
          failed?: number
          freshness_ok?: boolean
          id?: string
          passed?: number
          ran_at?: string
          results?: Json
          source?: string
        }
        Update: {
          checked?: number
          correlation_id?: string | null
          created_at?: string
          failed?: number
          freshness_ok?: boolean
          id?: string
          passed?: number
          ran_at?: string
          results?: Json
          source?: string
        }
        Relationships: []
      }
      backups: {
        Row: {
          created_at: string
          id: string
          kind: string
          orders_count: number
          payload: Json
          rx_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          orders_count?: number
          payload: Json
          rx_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          orders_count?: number
          payload?: Json
          rx_count?: number
        }
        Relationships: []
      }
      billing_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          payload: Json
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: []
      }
      billing_invoices: {
        Row: {
          amount_yer: number
          created_at: string
          currency: string
          due_at: string | null
          external_ref: string | null
          id: string
          issued_at: string | null
          metadata: Json
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          status: Database["public"]["Enums"]["billing_invoice_status"]
          subscription_id: string
          updated_at: string
        }
        Insert: {
          amount_yer: number
          created_at?: string
          currency?: string
          due_at?: string | null
          external_ref?: string | null
          id?: string
          issued_at?: string | null
          metadata?: Json
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["billing_invoice_status"]
          subscription_id: string
          updated_at?: string
        }
        Update: {
          amount_yer?: number
          created_at?: string
          currency?: string
          due_at?: string | null
          external_ref?: string | null
          id?: string
          issued_at?: string | null
          metadata?: Json
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["billing_invoice_status"]
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_ledger: {
        Row: {
          amount_yer: number
          created_at: string
          created_by: string | null
          entry_type: Database["public"]["Enums"]["billing_ledger_entry"]
          id: string
          invoice_id: string | null
          notes: string | null
          subject_id: string | null
          subject_type: Database["public"]["Enums"]["billing_audience"] | null
        }
        Insert: {
          amount_yer: number
          created_at?: string
          created_by?: string | null
          entry_type: Database["public"]["Enums"]["billing_ledger_entry"]
          id?: string
          invoice_id?: string | null
          notes?: string | null
          subject_id?: string | null
          subject_type?: Database["public"]["Enums"]["billing_audience"] | null
        }
        Update: {
          amount_yer?: number
          created_at?: string
          created_by?: string | null
          entry_type?: Database["public"]["Enums"]["billing_ledger_entry"]
          id?: string
          invoice_id?: string | null
          notes?: string | null
          subject_id?: string | null
          subject_type?: Database["public"]["Enums"]["billing_audience"] | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_ledger_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_plans: {
        Row: {
          audience: Database["public"]["Enums"]["billing_audience"]
          code: string
          created_at: string
          description_ar: string | null
          features: Json
          id: string
          is_active: boolean
          name_ar: string
          name_en: string | null
          price_month_yer: number
          price_year_yer: number
          sort_order: number
          tier: Database["public"]["Enums"]["billing_tier"]
          updated_at: string
        }
        Insert: {
          audience: Database["public"]["Enums"]["billing_audience"]
          code: string
          created_at?: string
          description_ar?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          name_ar: string
          name_en?: string | null
          price_month_yer?: number
          price_year_yer?: number
          sort_order?: number
          tier: Database["public"]["Enums"]["billing_tier"]
          updated_at?: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["billing_audience"]
          code?: string
          created_at?: string
          description_ar?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string | null
          price_month_yer?: number
          price_year_yer?: number
          sort_order?: number
          tier?: Database["public"]["Enums"]["billing_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      billing_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          current_period_end: string | null
          id: string
          metadata: Json
          organization_id: string | null
          plan_id: string
          started_at: string
          status: Database["public"]["Enums"]["billing_sub_status"]
          subject_id: string
          subject_type: Database["public"]["Enums"]["billing_audience"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          current_period_end?: string | null
          id?: string
          metadata?: Json
          organization_id?: string | null
          plan_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["billing_sub_status"]
          subject_id: string
          subject_type: Database["public"]["Enums"]["billing_audience"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          current_period_end?: string | null
          id?: string
          metadata?: Json
          organization_id?: string | null
          plan_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["billing_sub_status"]
          subject_id?: string
          subject_type?: Database["public"]["Enums"]["billing_audience"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_inventory: {
        Row: {
          branch_id: string
          id: string
          product_id: string
          qty: number
          reorder_point: number
          reserved_qty: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          id?: string
          product_id: string
          qty?: number
          reorder_point?: number
          reserved_qty?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          id?: string
          product_id?: string
          qty?: number
          reorder_point?: number
          reserved_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_inventory_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_user_assignments: {
        Row: {
          assigned_by: string | null
          branch_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["branch_role"]
          status: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          branch_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["branch_role"]
          status?: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          branch_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["branch_role"]
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_user_assignments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          location: Json
          manager_user_id: string | null
          metadata: Json
          name: string
          organization_id: string | null
          phone: string | null
          type: Database["public"]["Enums"]["branch_type"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          location?: Json
          manager_user_id?: string | null
          metadata?: Json
          name: string
          organization_id?: string | null
          phone?: string | null
          type: Database["public"]["Enums"]["branch_type"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          location?: Json
          manager_user_id?: string | null
          metadata?: Json
          name?: string
          organization_id?: string | null
          phone?: string | null
          type?: Database["public"]["Enums"]["branch_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_items: {
        Row: {
          bundle_id: string
          created_at: string
          id: string
          product_legacy_id: number
          qty: number
        }
        Insert: {
          bundle_id: string
          created_at?: string
          id?: string
          product_legacy_id: number
          qty?: number
        }
        Update: {
          bundle_id?: string
          created_at?: string
          id?: string
          product_legacy_id?: number
          qty?: number
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
      bundles: {
        Row: {
          created_at: string
          description: string | null
          discount_percent: number
          fixed_price: number | null
          id: string
          image_url: string | null
          is_active: boolean
          kind: string
          name: string
          revenue: number
          sales_count: number
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_percent?: number
          fixed_price?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          kind?: string
          name: string
          revenue?: number
          sales_count?: number
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_percent?: number
          fixed_price?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          kind?: string
          name?: string
          revenue?: number
          sales_count?: number
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      campaign_deliveries: {
        Row: {
          campaign_id: string | null
          clicked_at: string | null
          error_message: string | null
          id: string
          opened_at: string | null
          post_id: string | null
          sent_at: string
          status: string
          subscription_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          clicked_at?: string | null
          error_message?: string | null
          id?: string
          opened_at?: string | null
          post_id?: string | null
          sent_at?: string
          status?: string
          subscription_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          clicked_at?: string | null
          error_message?: string | null
          id?: string
          opened_at?: string | null
          post_id?: string | null
          sent_at?: string
          status?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_deliveries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ai_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_deliveries_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "medical_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          banner_id: string | null
          condition_tag: string | null
          created_at: string
          description: string | null
          discount_code: string | null
          eligible_count: number
          id: string
          is_active: boolean
          name: string
          redemptions_count: number
          revenue: number
          slug: string
          updated_at: string
        }
        Insert: {
          banner_id?: string | null
          condition_tag?: string | null
          created_at?: string
          description?: string | null
          discount_code?: string | null
          eligible_count?: number
          id?: string
          is_active?: boolean
          name: string
          redemptions_count?: number
          revenue?: number
          slug: string
          updated_at?: string
        }
        Update: {
          banner_id?: string | null
          condition_tag?: string | null
          created_at?: string
          description?: string | null
          discount_code?: string | null
          eligible_count?: number
          id?: string
          is_active?: boolean
          name?: string
          redemptions_count?: number
          revenue?: number
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_banner_id_fkey"
            columns: ["banner_id"]
            isOneToOne: false
            referencedRelation: "marketing_banners"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          added_at: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          added_at?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_ai_signals: {
        Row: {
          confidence: number | null
          correlation_id: string | null
          created_at: string
          id: string
          organization_id: string | null
          payload: Json
          product_id: string | null
          signal_type: Database["public"]["Enums"]["catalog_ai_signal_type"]
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          correlation_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          payload?: Json
          product_id?: string | null
          signal_type: Database["public"]["Enums"]["catalog_ai_signal_type"]
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          correlation_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          payload?: Json
          product_id?: string | null
          signal_type?: Database["public"]["Enums"]["catalog_ai_signal_type"]
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_ai_signals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_ai_signals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_ai_signals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_barcodes: {
        Row: {
          barcode: string
          created_at: string
          id: string
          is_primary: boolean
          product_id: string
          symbology: string | null
          updated_at: string
        }
        Insert: {
          barcode: string
          created_at?: string
          id?: string
          is_primary?: boolean
          product_id: string
          symbology?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          product_id?: string
          symbology?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_barcodes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_barcodes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          organization_id: string | null
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          organization_id?: string | null
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          organization_id?: string | null
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "catalog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_import_jobs: {
        Row: {
          ambiguous_count: number
          committed_at: string | null
          created_at: string
          dry_run: boolean
          error: string | null
          id: string
          invalid_count: number
          matched_count: number
          new_count: number
          source_name: string
          status: Database["public"]["Enums"]["catalog_import_status"]
          total_rows: number
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          ambiguous_count?: number
          committed_at?: string | null
          created_at?: string
          dry_run?: boolean
          error?: string | null
          id?: string
          invalid_count?: number
          matched_count?: number
          new_count?: number
          source_name: string
          status?: Database["public"]["Enums"]["catalog_import_status"]
          total_rows?: number
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          ambiguous_count?: number
          committed_at?: string | null
          created_at?: string
          dry_run?: boolean
          error?: string | null
          id?: string
          invalid_count?: number
          matched_count?: number
          new_count?: number
          source_name?: string
          status?: Database["public"]["Enums"]["catalog_import_status"]
          total_rows?: number
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      catalog_import_rows: {
        Row: {
          applied: boolean
          candidate_ids: string[]
          confidence: number | null
          created_at: string
          decision: Database["public"]["Enums"]["catalog_import_decision"]
          id: string
          job_id: string
          matched_product_id: string | null
          payload: Json
          reason: string | null
          row_index: number
        }
        Insert: {
          applied?: boolean
          candidate_ids?: string[]
          confidence?: number | null
          created_at?: string
          decision: Database["public"]["Enums"]["catalog_import_decision"]
          id?: string
          job_id: string
          matched_product_id?: string | null
          payload: Json
          reason?: string | null
          row_index: number
        }
        Update: {
          applied?: boolean
          candidate_ids?: string[]
          confidence?: number | null
          created_at?: string
          decision?: Database["public"]["Enums"]["catalog_import_decision"]
          id?: string
          job_id?: string
          matched_product_id?: string | null
          payload?: Json
          reason?: string | null
          row_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalog_import_rows_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "catalog_import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_import_rows_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_import_rows_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_product_aliases: {
        Row: {
          alias: string
          alias_normalized: string
          confidence: number | null
          created_at: string
          id: string
          locale: string
          product_id: string
          source: Database["public"]["Enums"]["catalog_alias_source"]
          updated_at: string
        }
        Insert: {
          alias: string
          alias_normalized?: string
          confidence?: number | null
          created_at?: string
          id?: string
          locale?: string
          product_id: string
          source?: Database["public"]["Enums"]["catalog_alias_source"]
          updated_at?: string
        }
        Update: {
          alias?: string
          alias_normalized?: string
          confidence?: number | null
          created_at?: string
          id?: string
          locale?: string
          product_id?: string
          source?: Database["public"]["Enums"]["catalog_alias_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_product_aliases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_product_aliases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_product_media: {
        Row: {
          bytes: number | null
          checksum: string | null
          created_at: string
          height: number | null
          id: string
          kind: Database["public"]["Enums"]["catalog_media_kind"]
          metadata: Json
          mime: string | null
          product_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          sort_order: number
          status: Database["public"]["Enums"]["catalog_media_status"]
          storage_bucket: string
          storage_path: string
          updated_at: string
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          bytes?: number | null
          checksum?: string | null
          created_at?: string
          height?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["catalog_media_kind"]
          metadata?: Json
          mime?: string | null
          product_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["catalog_media_status"]
          storage_bucket?: string
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          bytes?: number | null
          checksum?: string | null
          created_at?: string
          height?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["catalog_media_kind"]
          metadata?: Json
          mime?: string | null
          product_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["catalog_media_status"]
          storage_bucket?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_products: {
        Row: {
          active_ingredients: Json
          agent_name: string | null
          barcode: string | null
          brand: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          description_ar: string | null
          description_en: string | null
          dosage_form: string | null
          generic_name: string | null
          id: string
          image_url: string | null
          is_public: boolean
          manufacturer: string | null
          manufacturer_country: string | null
          metadata: Json
          name_ar: string
          name_en: string | null
          organization_id: string | null
          owner_org_id: string | null
          pack_unit: string | null
          requires_prescription: boolean
          sbdma_official_price: number | null
          status: Database["public"]["Enums"]["catalog_status"]
          store_code: string | null
          strength: string | null
          supplier_name_text: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          active_ingredients?: Json
          agent_name?: string | null
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description_ar?: string | null
          description_en?: string | null
          dosage_form?: string | null
          generic_name?: string | null
          id?: string
          image_url?: string | null
          is_public?: boolean
          manufacturer?: string | null
          manufacturer_country?: string | null
          metadata?: Json
          name_ar: string
          name_en?: string | null
          organization_id?: string | null
          owner_org_id?: string | null
          pack_unit?: string | null
          requires_prescription?: boolean
          sbdma_official_price?: number | null
          status?: Database["public"]["Enums"]["catalog_status"]
          store_code?: string | null
          strength?: string | null
          supplier_name_text?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          active_ingredients?: Json
          agent_name?: string | null
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description_ar?: string | null
          description_en?: string | null
          dosage_form?: string | null
          generic_name?: string | null
          id?: string
          image_url?: string | null
          is_public?: boolean
          manufacturer?: string | null
          manufacturer_country?: string | null
          metadata?: Json
          name_ar?: string
          name_en?: string | null
          organization_id?: string | null
          owner_org_id?: string | null
          pack_unit?: string | null
          requires_prescription?: boolean
          sbdma_official_price?: number | null
          status?: Database["public"]["Enums"]["catalog_status"]
          store_code?: string | null
          strength?: string | null
          supplier_name_text?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "catalog_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_products_owner_org_id_fkey"
            columns: ["owner_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      confidence_calibration_log: {
        Row: {
          computed_at: string
          correlation: number | null
          drift: number | null
          id: number
          mean_confidence: number | null
          mean_engagement: number | null
          notes: string | null
          sample_size: number
          severity: string
          window_days: number
        }
        Insert: {
          computed_at?: string
          correlation?: number | null
          drift?: number | null
          id?: number
          mean_confidence?: number | null
          mean_engagement?: number | null
          notes?: string | null
          sample_size: number
          severity?: string
          window_days?: number
        }
        Update: {
          computed_at?: string
          correlation?: number | null
          drift?: number | null
          id?: number
          mean_confidence?: number | null
          mean_engagement?: number | null
          notes?: string | null
          sample_size?: number
          severity?: string
          window_days?: number
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_hash: string | null
          message: string
          name: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_hash?: string | null
          message: string
          name: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_hash?: string | null
          message?: string
          name?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      control_tower_audit_log: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          target_key: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          target_key?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          target_key?: string | null
        }
        Relationships: []
      }
      crm_campaign_events: {
        Row: {
          campaign_id: string
          channel: Database["public"]["Enums"]["crm_campaign_channel"] | null
          customer_id: string | null
          id: string
          kind: Database["public"]["Enums"]["crm_campaign_event_kind"]
          metadata: Json
          occurred_at: string
          organization_id: string
          provider_ref: string | null
          recipient_id: string | null
        }
        Insert: {
          campaign_id: string
          channel?: Database["public"]["Enums"]["crm_campaign_channel"] | null
          customer_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["crm_campaign_event_kind"]
          metadata?: Json
          occurred_at?: string
          organization_id: string
          provider_ref?: string | null
          recipient_id?: string | null
        }
        Update: {
          campaign_id?: string
          channel?: Database["public"]["Enums"]["crm_campaign_channel"] | null
          customer_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["crm_campaign_event_kind"]
          metadata?: Json
          occurred_at?: string
          organization_id?: string
          provider_ref?: string | null
          recipient_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_campaign_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_campaign_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_campaign_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_campaign_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "crm_campaign_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_campaign_recipients: {
        Row: {
          address: string | null
          campaign_id: string
          channel: Database["public"]["Enums"]["crm_campaign_channel"]
          created_at: string
          customer_id: string
          error: string | null
          id: string
          organization_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["crm_recipient_status"]
        }
        Insert: {
          address?: string | null
          campaign_id: string
          channel: Database["public"]["Enums"]["crm_campaign_channel"]
          created_at?: string
          customer_id: string
          error?: string | null
          id?: string
          organization_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["crm_recipient_status"]
        }
        Update: {
          address?: string | null
          campaign_id?: string
          channel?: Database["public"]["Enums"]["crm_campaign_channel"]
          created_at?: string
          customer_id?: string
          error?: string | null
          id?: string
          organization_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["crm_recipient_status"]
        }
        Relationships: [
          {
            foreignKeyName: "crm_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_campaign_recipients_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_campaign_recipients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_campaign_runs: {
        Row: {
          audience_size: number
          campaign_id: string
          error: string | null
          failed_count: number
          finished_at: string | null
          id: string
          metadata: Json
          organization_id: string
          sent_count: number
          started_at: string
          status: string
        }
        Insert: {
          audience_size?: number
          campaign_id: string
          error?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          sent_count?: number
          started_at?: string
          status?: string
        }
        Update: {
          audience_size?: number
          campaign_id?: string
          error?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          sent_count?: number
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_campaign_runs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_campaign_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_campaign_schedules: {
        Row: {
          campaign_id: string
          created_at: string
          executed_at: string | null
          id: string
          notes: string | null
          organization_id: string
          run_at: string
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          executed_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          run_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          executed_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          run_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_campaign_schedules_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_campaign_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_campaigns: {
        Row: {
          audience_size: number
          cancelled_at: string | null
          channel: Database["public"]["Enums"]["crm_campaign_channel"]
          code: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          delivered_count: number
          description: string | null
          failed_count: number
          id: string
          message_template: string
          metadata: Json
          name: string
          organization_id: string
          scheduled_at: string | null
          segment_id: string | null
          sent_count: number
          started_at: string | null
          status: Database["public"]["Enums"]["crm_campaign_status"]
          subject: string | null
          updated_at: string
        }
        Insert: {
          audience_size?: number
          cancelled_at?: string | null
          channel: Database["public"]["Enums"]["crm_campaign_channel"]
          code: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delivered_count?: number
          description?: string | null
          failed_count?: number
          id?: string
          message_template?: string
          metadata?: Json
          name: string
          organization_id: string
          scheduled_at?: string | null
          segment_id?: string | null
          sent_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["crm_campaign_status"]
          subject?: string | null
          updated_at?: string
        }
        Update: {
          audience_size?: number
          cancelled_at?: string | null
          channel?: Database["public"]["Enums"]["crm_campaign_channel"]
          code?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delivered_count?: number
          description?: string | null
          failed_count?: number
          id?: string
          message_template?: string
          metadata?: Json
          name?: string
          organization_id?: string
          scheduled_at?: string | null
          segment_id?: string | null
          sent_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["crm_campaign_status"]
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_campaigns_segment_fk"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "crm_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contact_preferences: {
        Row: {
          channel: Database["public"]["Enums"]["crm_campaign_channel"]
          created_at: string
          customer_id: string
          id: string
          opted_in: boolean
          organization_id: string
          updated_at: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["crm_campaign_channel"]
          created_at?: string
          customer_id: string
          id?: string
          opted_in?: boolean
          organization_id: string
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["crm_campaign_channel"]
          created_at?: string
          customer_id?: string
          id?: string
          opted_in?: boolean
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contact_preferences_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contact_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_coupon_codes: {
        Row: {
          branch_scope: string[] | null
          code: string
          coupon_id: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          organization_id: string
          usage_count: number
          usage_limit: number | null
        }
        Insert: {
          branch_scope?: string[] | null
          code: string
          coupon_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          usage_count?: number
          usage_limit?: number | null
        }
        Update: {
          branch_scope?: string[] | null
          code?: string
          coupon_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          usage_count?: number
          usage_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_coupon_codes_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "crm_coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_coupon_redemptions: {
        Row: {
          coupon_code_id: string
          coupon_id: string
          created_by: string | null
          customer_id: string | null
          discount_amount: number
          id: string
          order_ref: string | null
          organization_id: string
          redeemed_at: string
        }
        Insert: {
          coupon_code_id: string
          coupon_id: string
          created_by?: string | null
          customer_id?: string | null
          discount_amount?: number
          id?: string
          order_ref?: string | null
          organization_id: string
          redeemed_at?: string
        }
        Update: {
          coupon_code_id?: string
          coupon_id?: string
          created_by?: string | null
          customer_id?: string | null
          discount_amount?: number
          id?: string
          order_ref?: string | null
          organization_id?: string
          redeemed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_coupon_redemptions_coupon_code_id_fkey"
            columns: ["coupon_code_id"]
            isOneToOne: false
            referencedRelation: "crm_coupon_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "crm_coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_coupons: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          global_limit: number | null
          id: string
          max_discount: number | null
          min_spend: number | null
          mode: string
          name: string
          organization_id: string
          per_customer_limit: number | null
          promotion_id: string | null
          stackable: boolean
          starts_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          global_limit?: number | null
          id?: string
          max_discount?: number | null
          min_spend?: number | null
          mode?: string
          name: string
          organization_id: string
          per_customer_limit?: number | null
          promotion_id?: string | null
          stackable?: boolean
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          global_limit?: number | null
          id?: string
          max_discount?: number | null
          min_spend?: number | null
          mode?: string
          name?: string
          organization_id?: string
          per_customer_limit?: number | null
          promotion_id?: string | null
          stackable?: boolean
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_coupons_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "crm_promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_customer_addresses: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          customer_id: string
          id: string
          is_default: boolean
          kind: string
          line1: string
          line2: string | null
          organization_id: string
          postal_code: string | null
          region: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          customer_id: string
          id?: string
          is_default?: boolean
          kind?: string
          line1: string
          line2?: string | null
          organization_id: string
          postal_code?: string | null
          region?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          is_default?: boolean
          kind?: string
          line1?: string
          line2?: string | null
          organization_id?: string
          postal_code?: string | null
          region?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_customer_contacts: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          is_primary: boolean
          kind: string
          label: string | null
          organization_id: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          is_primary?: boolean
          kind: string
          label?: string | null
          organization_id: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          is_primary?: boolean
          kind?: string
          label?: string | null
          organization_id?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_customer_tags: {
        Row: {
          color: string | null
          created_at: string
          customer_id: string
          id: string
          organization_id: string
          tag: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          customer_id: string
          id?: string
          organization_id: string
          tag: string
        }
        Update: {
          color?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          organization_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_customer_tags_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_customers: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          merged_into_id: string | null
          metadata: Json
          notes: string | null
          organization_id: string
          patient_id: string | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          merged_into_id?: string | null
          metadata?: Json
          notes?: string | null
          organization_id: string
          patient_id?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          merged_into_id?: string | null
          metadata?: Json
          notes?: string | null
          organization_id?: string
          patient_id?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_customers_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_customers_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "hc_patients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_loyalty_accounts: {
        Row: {
          created_at: string
          current_tier_id: string | null
          customer_id: string
          id: string
          metadata: Json
          organization_id: string
          points_balance: number
          points_lifetime_earned: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_tier_id?: string | null
          customer_id: string
          id?: string
          metadata?: Json
          organization_id: string
          points_balance?: number
          points_lifetime_earned?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_tier_id?: string | null
          customer_id?: string
          id?: string
          metadata?: Json
          organization_id?: string
          points_balance?: number
          points_lifetime_earned?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_loyalty_accounts_current_tier_id_fkey"
            columns: ["current_tier_id"]
            isOneToOne: false
            referencedRelation: "crm_loyalty_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_loyalty_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_loyalty_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_loyalty_expirations: {
        Row: {
          account_id: string
          created_at: string
          customer_id: string
          id: string
          metadata: Json
          organization_id: string
          points: number
          processed_at: string | null
          scheduled_for: string
          transaction_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          customer_id: string
          id?: string
          metadata?: Json
          organization_id: string
          points: number
          processed_at?: string | null
          scheduled_for: string
          transaction_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          metadata?: Json
          organization_id?: string
          points?: number
          processed_at?: string | null
          scheduled_for?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_loyalty_expirations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "crm_loyalty_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_loyalty_expirations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_loyalty_expirations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_loyalty_expirations_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "crm_loyalty_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_loyalty_rules: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_active: boolean
          key: string
          kind: string
          name: string
          organization_id: string
          priority: number
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          kind: string
          name: string
          organization_id: string
          priority?: number
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          kind?: string
          name?: string
          organization_id?: string
          priority?: number
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_loyalty_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_loyalty_tiers: {
        Row: {
          code: string
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          min_lifetime_points: number
          multiplier: number
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          min_lifetime_points?: number
          multiplier?: number
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          min_lifetime_points?: number
          multiplier?: number
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_loyalty_tiers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_loyalty_transactions: {
        Row: {
          account_id: string
          correlation_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          kind: string
          metadata: Json
          organization_id: string
          points: number
          reason: string | null
          source_ref: string | null
        }
        Insert: {
          account_id: string
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          kind: string
          metadata?: Json
          organization_id: string
          points: number
          reason?: string | null
          source_ref?: string | null
        }
        Update: {
          account_id?: string
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          kind?: string
          metadata?: Json
          organization_id?: string
          points?: number
          reason?: string | null
          source_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_loyalty_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "crm_loyalty_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_loyalty_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_loyalty_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_promotion_eligibility: {
        Row: {
          created_at: string
          id: string
          kind: string
          organization_id: string
          promotion_id: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          organization_id: string
          promotion_id: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          organization_id?: string
          promotion_id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_promotion_eligibility_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "crm_promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_promotion_redemptions: {
        Row: {
          coupon_code_id: string | null
          created_by: string | null
          currency: string
          customer_id: string | null
          discount_amount: number
          id: string
          metadata: Json
          order_ref: string | null
          organization_id: string
          promotion_id: string
          redeemed_at: string
        }
        Insert: {
          coupon_code_id?: string | null
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          discount_amount?: number
          id?: string
          metadata?: Json
          order_ref?: string | null
          organization_id: string
          promotion_id: string
          redeemed_at?: string
        }
        Update: {
          coupon_code_id?: string | null
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          discount_amount?: number
          id?: string
          metadata?: Json
          order_ref?: string | null
          organization_id?: string
          promotion_id?: string
          redeemed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_promotion_redemptions_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "crm_promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_promotion_targets: {
        Row: {
          created_at: string
          entity_kind: string
          entity_ref: string
          id: string
          organization_id: string
          promotion_id: string
          target_kind: string
        }
        Insert: {
          created_at?: string
          entity_kind: string
          entity_ref: string
          id?: string
          organization_id: string
          promotion_id: string
          target_kind: string
        }
        Update: {
          created_at?: string
          entity_kind?: string
          entity_ref?: string
          id?: string
          organization_id?: string
          promotion_id?: string
          target_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_promotion_targets_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "crm_promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_promotions: {
        Row: {
          code: string
          config: Json
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          kind: string
          max_discount: number | null
          min_spend: number | null
          name: string
          organization_id: string
          per_customer_limit: number | null
          priority: number
          stackable: boolean
          starts_at: string | null
          status: string
          updated_at: string
          usage_count: number
          usage_limit: number | null
        }
        Insert: {
          code: string
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          kind: string
          max_discount?: number | null
          min_spend?: number | null
          name: string
          organization_id: string
          per_customer_limit?: number | null
          priority?: number
          stackable?: boolean
          starts_at?: string | null
          status?: string
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
        }
        Update: {
          code?: string
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          kind?: string
          max_discount?: number | null
          min_spend?: number | null
          name?: string
          organization_id?: string
          per_customer_limit?: number | null
          priority?: number
          stackable?: boolean
          starts_at?: string | null
          status?: string
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
        }
        Relationships: []
      }
      crm_reward_catalog: {
        Row: {
          code: string
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          metadata: Json
          name: string
          organization_id: string
          points_cost: number
          stock: number | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          organization_id: string
          points_cost: number
          stock?: number | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          organization_id?: string
          points_cost?: number
          stock?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_reward_catalog_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_reward_redemptions: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          metadata: Json
          organization_id: string
          points_spent: number
          reward_id: string
          status: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          metadata?: Json
          organization_id: string
          points_spent: number
          reward_id: string
          status?: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          metadata?: Json
          organization_id?: string
          points_spent?: number
          reward_id?: string
          status?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_reward_redemptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "crm_loyalty_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_reward_redemptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_reward_redemptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_reward_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "crm_reward_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_reward_redemptions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "crm_loyalty_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_segment_memberships: {
        Row: {
          added_at: string
          customer_id: string
          organization_id: string
          segment_id: string
        }
        Insert: {
          added_at?: string
          customer_id: string
          organization_id: string
          segment_id: string
        }
        Update: {
          added_at?: string
          customer_id?: string
          organization_id?: string
          segment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_segment_memberships_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_segment_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_segment_memberships_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "crm_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_segments: {
        Row: {
          code: string
          combinator: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_dynamic: boolean
          last_recalculated_at: string | null
          member_count: number
          name: string
          organization_id: string
          rules: Json
          updated_at: string
        }
        Insert: {
          code: string
          combinator?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_dynamic?: boolean
          last_recalculated_at?: string | null
          member_count?: number
          name: string
          organization_id: string
          rules?: Json
          updated_at?: string
        }
        Update: {
          code?: string
          combinator?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_dynamic?: boolean
          last_recalculated_at?: string | null
          member_count?: number
          name?: string
          organization_id?: string
          rules?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_segments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_sync_log: {
        Row: {
          attempts: number
          category: string
          created_at: string
          details: string | null
          error: string | null
          full_name: string | null
          id: string
          payload: Json
          phone: string | null
          source: string
          status: string
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          category: string
          created_at?: string
          details?: string | null
          error?: string | null
          full_name?: string | null
          id?: string
          payload?: Json
          phone?: string | null
          source: string
          status?: string
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          category?: string
          created_at?: string
          details?: string | null
          error?: string | null
          full_name?: string | null
          id?: string
          payload?: Json
          phone?: string | null
          source?: string
          status?: string
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      crm_unsubscribes: {
        Row: {
          channel: Database["public"]["Enums"]["crm_campaign_channel"]
          created_at: string
          customer_id: string
          id: string
          organization_id: string
          reason: string | null
        }
        Insert: {
          channel: Database["public"]["Enums"]["crm_campaign_channel"]
          created_at?: string
          customer_id: string
          id?: string
          organization_id: string
          reason?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["crm_campaign_channel"]
          created_at?: string
          customer_id?: string
          id?: string
          organization_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_unsubscribes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_unsubscribes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_channels: {
        Row: {
          channel: string
          created_at: string
          customer_id: string
          handle: string
          id: string
          phone_number: string | null
          preferences: Json
          updated_at: string
          verified: boolean
        }
        Insert: {
          channel: string
          created_at?: string
          customer_id: string
          handle: string
          id?: string
          phone_number?: string | null
          preferences?: Json
          updated_at?: string
          verified?: boolean
        }
        Update: {
          channel?: string
          created_at?: string
          customer_id?: string
          handle?: string
          id?: string
          phone_number?: string | null
          preferences?: Json
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      customer_notification_preferences: {
        Row: {
          created_at: string
          last_opt_in_at: string | null
          last_opt_out_at: string | null
          opt_out_token: string
          phone: string
          prescription_notifications_enabled: boolean
          updated_at: string
          whatsapp_enabled: boolean
        }
        Insert: {
          created_at?: string
          last_opt_in_at?: string | null
          last_opt_out_at?: string | null
          opt_out_token?: string
          phone: string
          prescription_notifications_enabled?: boolean
          updated_at?: string
          whatsapp_enabled?: boolean
        }
        Update: {
          created_at?: string
          last_opt_in_at?: string | null
          last_opt_out_at?: string | null
          opt_out_token?: string
          phone?: string
          prescription_notifications_enabled?: boolean
          updated_at?: string
          whatsapp_enabled?: boolean
        }
        Relationships: []
      }
      customer_profiles: {
        Row: {
          ai_insight: string | null
          ai_insight_at: string | null
          avg_order_value: number
          cancelled_count: number
          chronic_flags: Json
          days_between_orders: number | null
          dominant_category: string | null
          first_seen: string
          last_order_at: string | null
          name: string | null
          orders_count: number
          phone: string
          top_categories: Json
          total_spent: number
          updated_at: string
        }
        Insert: {
          ai_insight?: string | null
          ai_insight_at?: string | null
          avg_order_value?: number
          cancelled_count?: number
          chronic_flags?: Json
          days_between_orders?: number | null
          dominant_category?: string | null
          first_seen?: string
          last_order_at?: string | null
          name?: string | null
          orders_count?: number
          phone: string
          top_categories?: Json
          total_spent?: number
          updated_at?: string
        }
        Update: {
          ai_insight?: string | null
          ai_insight_at?: string | null
          avg_order_value?: number
          cancelled_count?: number
          chronic_flags?: Json
          days_between_orders?: number | null
          dominant_category?: string | null
          first_seen?: string
          last_order_at?: string | null
          name?: string | null
          orders_count?: number
          phone?: string
          top_categories?: Json
          total_spent?: number
          updated_at?: string
        }
        Relationships: []
      }
      customer_scores: {
        Row: {
          computed_at: string
          health_score: number
          phone: string
          risk_score: number
          segment: string
          value_score: number
        }
        Insert: {
          computed_at?: string
          health_score?: number
          phone: string
          risk_score?: number
          segment?: string
          value_score?: number
        }
        Update: {
          computed_at?: string
          health_score?: number
          phone?: string
          risk_score?: number
          segment?: string
          value_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_scores_phone_fkey"
            columns: ["phone"]
            isOneToOne: true
            referencedRelation: "customer_profiles"
            referencedColumns: ["phone"]
          },
        ]
      }
      demand_forecasts: {
        Row: {
          computed_at: string
          confidence: number
          expected_units: number
          horizon_days: number
          id: string
          method: string
          product_id: string
        }
        Insert: {
          computed_at?: string
          confidence?: number
          expected_units?: number
          horizon_days: number
          id?: string
          method?: string
          product_id: string
        }
        Update: {
          computed_at?: string
          confidence?: number
          expected_units?: number
          horizon_days?: number
          id?: string
          method?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_forecasts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          first_order_only: boolean
          id: string
          kind: string
          max_uses: number | null
          min_total: number
          starts_at: string
          uses: number
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          first_order_only?: boolean
          id?: string
          kind: string
          max_uses?: number | null
          min_total?: number
          starts_at?: string
          uses?: number
          value?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          first_order_only?: boolean
          id?: string
          kind?: string
          max_uses?: number | null
          min_total?: number
          starts_at?: string
          uses?: number
          value?: number
        }
        Relationships: []
      }
      discount_redemptions: {
        Row: {
          amount_off: number
          code_id: string
          customer_phone: string
          id: string
          order_id: string
          redeemed_at: string
        }
        Insert: {
          amount_off?: number
          code_id: string
          customer_phone: string
          id?: string
          order_id: string
          redeemed_at?: string
        }
        Update: {
          amount_off?: number
          code_id?: string
          customer_phone?: string
          id?: string
          order_id?: string
          redeemed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_redemptions_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      drug_interactions: {
        Row: {
          clinical_effect_ar: string | null
          created_at: string
          drug_a_id: string
          drug_b_id: string
          evidence_source: string | null
          id: string
          mechanism: string | null
          recommendation_ar: string | null
          severity: string
        }
        Insert: {
          clinical_effect_ar?: string | null
          created_at?: string
          drug_a_id: string
          drug_b_id: string
          evidence_source?: string | null
          id?: string
          mechanism?: string | null
          recommendation_ar?: string | null
          severity: string
        }
        Update: {
          clinical_effect_ar?: string | null
          created_at?: string
          drug_a_id?: string
          drug_b_id?: string
          evidence_source?: string | null
          id?: string
          mechanism?: string | null
          recommendation_ar?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "drug_interactions_drug_a_id_fkey"
            columns: ["drug_a_id"]
            isOneToOne: false
            referencedRelation: "medical_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drug_interactions_drug_b_id_fkey"
            columns: ["drug_b_id"]
            isOneToOne: false
            referencedRelation: "medical_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      email_delivery_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          payload: Json
          recipient_email: string
          ref_id: string | null
          ref_kind: string | null
          sent_at: string | null
          status: string
          subject: string | null
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          payload?: Json
          recipient_email: string
          ref_id?: string | null
          ref_kind?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          payload?: Json
          recipient_email?: string
          ref_id?: string | null
          ref_kind?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_name?: string
        }
        Relationships: []
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
      error_logs: {
        Row: {
          country: string | null
          extra: Json | null
          id: string
          level: string
          message: string
          occurred_at: string
          source: string
          stack: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          country?: string | null
          extra?: Json | null
          id?: string
          level?: string
          message: string
          occurred_at?: string
          source: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          country?: string | null
          extra?: Json | null
          id?: string
          level?: string
          message?: string
          occurred_at?: string
          source?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      error_logs_archive: {
        Row: {
          archived_at: string
          country: string | null
          extra: Json | null
          id: string
          level: string
          message: string
          occurred_at: string
          source: string
          stack: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          archived_at?: string
          country?: string | null
          extra?: Json | null
          id?: string
          level?: string
          message: string
          occurred_at?: string
          source: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          archived_at?: string
          country?: string | null
          extra?: Json | null
          id?: string
          level?: string
          message?: string
          occurred_at?: string
          source?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      event_consumer_schedule_log: {
        Row: {
          action: string
          actor_user_id: string | null
          batch: number | null
          correlation_id: string
          created_at: string
          error: string | null
          id: string
          job_id: number | null
          job_name: string | null
          schedule: string | null
          status: string
          url: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          batch?: number | null
          correlation_id: string
          created_at?: string
          error?: string | null
          id?: string
          job_id?: number | null
          job_name?: string | null
          schedule?: string | null
          status: string
          url?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          batch?: number | null
          correlation_id?: string
          created_at?: string
          error?: string | null
          id?: string
          job_id?: number | null
          job_name?: string | null
          schedule?: string | null
          status?: string
          url?: string | null
        }
        Relationships: []
      }
      executive_reports: {
        Row: {
          created_at: string
          day: string
          id: string
          payload: Json
        }
        Insert: {
          created_at?: string
          day: string
          id?: string
          payload: Json
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          payload?: Json
        }
        Relationships: []
      }
      family_health_accounts: {
        Row: {
          accepted_at: string | null
          access_level: string
          active: boolean
          created_at: string
          id: string
          invited_at: string
          member_patient_id: string
          owner_patient_id: string
          relationship: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          access_level?: string
          active?: boolean
          created_at?: string
          id?: string
          invited_at?: string
          member_patient_id: string
          owner_patient_id: string
          relationship: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          access_level?: string
          active?: boolean
          created_at?: string
          id?: string
          invited_at?: string
          member_patient_id?: string
          owner_patient_id?: string
          relationship?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_health_accounts_member_patient_id_fkey"
            columns: ["member_patient_id"]
            isOneToOne: false
            referencedRelation: "hc_patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_health_accounts_owner_patient_id_fkey"
            columns: ["owner_patient_id"]
            isOneToOne: false
            referencedRelation: "hc_patients"
            referencedColumns: ["id"]
          },
        ]
      }
      family_health_profiles: {
        Row: {
          allergies: string[]
          birth_date: string | null
          blood_type: string | null
          chronic_conditions: string[]
          created_at: string
          current_medicines: string[]
          display_name: string
          id: string
          is_default: boolean
          notes: string | null
          relation: string
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          allergies?: string[]
          birth_date?: string | null
          blood_type?: string | null
          chronic_conditions?: string[]
          created_at?: string
          current_medicines?: string[]
          display_name: string
          id?: string
          is_default?: boolean
          notes?: string | null
          relation?: string
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          allergies?: string[]
          birth_date?: string | null
          blood_type?: string | null
          chronic_conditions?: string[]
          created_at?: string
          current_medicines?: string[]
          display_name?: string
          id?: string
          is_default?: boolean
          notes?: string | null
          relation?: string
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      hc_appointments: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          doctor_id: string
          ends_at: string
          id: string
          location_id: string
          notes: string | null
          organization_id: string
          patient_id: string
          reason: string | null
          starts_at: string
          status: Database["public"]["Enums"]["hc_appointment_status"]
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          doctor_id: string
          ends_at: string
          id?: string
          location_id: string
          notes?: string | null
          organization_id: string
          patient_id: string
          reason?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["hc_appointment_status"]
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          doctor_id?: string
          ends_at?: string
          id?: string
          location_id?: string
          notes?: string | null
          organization_id?: string
          patient_id?: string
          reason?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["hc_appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hc_appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "hc_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "hc_doctors_public_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_appointments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "hc_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "hc_patients"
            referencedColumns: ["id"]
          },
        ]
      }
      hc_availability_blocks: {
        Row: {
          created_at: string
          doctor_id: string
          ends_at: string
          id: string
          location_id: string | null
          reason: string | null
          starts_at: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          ends_at: string
          id?: string
          location_id?: string | null
          reason?: string | null
          starts_at: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          ends_at?: string
          id?: string
          location_id?: string | null
          reason?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hc_availability_blocks_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "hc_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_availability_blocks_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "hc_doctors_public_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_availability_blocks_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "hc_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      hc_dispense_items: {
        Row: {
          barcode_value: string | null
          barcode_verified: boolean
          batch_allocations: Json
          created_at: string
          dispense_id: string
          id: string
          medication_name: string
          notes: string | null
          prescription_item_id: string | null
          product_id: string | null
          qty_dispensed: number
          qty_requested: number
          reservation_id: string | null
          updated_at: string
        }
        Insert: {
          barcode_value?: string | null
          barcode_verified?: boolean
          batch_allocations?: Json
          created_at?: string
          dispense_id: string
          id?: string
          medication_name: string
          notes?: string | null
          prescription_item_id?: string | null
          product_id?: string | null
          qty_dispensed?: number
          qty_requested: number
          reservation_id?: string | null
          updated_at?: string
        }
        Update: {
          barcode_value?: string | null
          barcode_verified?: boolean
          batch_allocations?: Json
          created_at?: string
          dispense_id?: string
          id?: string
          medication_name?: string
          notes?: string | null
          prescription_item_id?: string | null
          product_id?: string | null
          qty_dispensed?: number
          qty_requested?: number
          reservation_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hc_dispense_items_dispense_id_fkey"
            columns: ["dispense_id"]
            isOneToOne: false
            referencedRelation: "hc_dispenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_dispense_items_prescription_item_id_fkey"
            columns: ["prescription_item_id"]
            isOneToOne: false
            referencedRelation: "hc_prescription_items"
            referencedColumns: ["id"]
          },
        ]
      }
      hc_dispense_returns: {
        Row: {
          actor_user_id: string | null
          created_at: string
          dispense_id: string
          dispense_item_id: string | null
          id: string
          qty: number
          reason: string
          updated_at: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          dispense_id: string
          dispense_item_id?: string | null
          id?: string
          qty: number
          reason: string
          updated_at?: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          dispense_id?: string
          dispense_item_id?: string | null
          id?: string
          qty?: number
          reason?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hc_dispense_returns_dispense_id_fkey"
            columns: ["dispense_id"]
            isOneToOne: false
            referencedRelation: "hc_dispenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_dispense_returns_dispense_item_id_fkey"
            columns: ["dispense_item_id"]
            isOneToOne: false
            referencedRelation: "hc_dispense_items"
            referencedColumns: ["id"]
          },
        ]
      }
      hc_dispense_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          dispense_id: string
          from_status: string | null
          id: string
          reason: string | null
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          dispense_id: string
          from_status?: string | null
          id?: string
          reason?: string | null
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          dispense_id?: string
          from_status?: string | null
          id?: string
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hc_dispense_status_history_dispense_id_fkey"
            columns: ["dispense_id"]
            isOneToOne: false
            referencedRelation: "hc_dispenses"
            referencedColumns: ["id"]
          },
        ]
      }
      hc_dispenses: {
        Row: {
          branch_id: string | null
          correlation_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          dispense_no: string | null
          dispensed_by: string | null
          id: string
          notes: string | null
          organization_id: string
          patient_id: string
          prepared_by: string | null
          prescription_id: string
          status: string
          updated_at: string
          verified_by: string | null
        }
        Insert: {
          branch_id?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dispense_no?: string | null
          dispensed_by?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          patient_id: string
          prepared_by?: string | null
          prescription_id: string
          status?: string
          updated_at?: string
          verified_by?: string | null
        }
        Update: {
          branch_id?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dispense_no?: string | null
          dispensed_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          patient_id?: string
          prepared_by?: string | null
          prescription_id?: string
          status?: string
          updated_at?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hc_dispenses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "hc_patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_dispenses_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "hc_prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      hc_doctor_availability: {
        Row: {
          created_at: string
          doctor_id: string
          end_time: string
          id: string
          is_active: boolean
          location_id: string
          slot_duration_minutes: number
          start_time: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          doctor_id: string
          end_time: string
          id?: string
          is_active?: boolean
          location_id: string
          slot_duration_minutes?: number
          start_time: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          doctor_id?: string
          end_time?: string
          id?: string
          is_active?: boolean
          location_id?: string
          slot_duration_minutes?: number
          start_time?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "hc_doctor_availability_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "hc_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_doctor_availability_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "hc_doctors_public_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_doctor_availability_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "hc_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      hc_doctor_join_submissions: {
        Row: {
          admin_notes: string | null
          biography: string | null
          city: string | null
          claimed_specialties: string[]
          created_at: string
          decision_at: string | null
          documents: Json
          duplicate_of: string | null
          duplicate_score: number
          email: string | null
          full_name_ar: string
          full_name_en: string | null
          governorate: string | null
          id: string
          metadata: Json
          normalized_name_ar: string
          phone: string
          phone_e164: string
          photo_review_notes: string | null
          photo_review_status: string | null
          practice_wishlist: Json
          reviewer_id: string | null
          reviewer_notes: string | null
          status: Database["public"]["Enums"]["hc_join_status"]
          submitter_user_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          biography?: string | null
          city?: string | null
          claimed_specialties?: string[]
          created_at?: string
          decision_at?: string | null
          documents?: Json
          duplicate_of?: string | null
          duplicate_score?: number
          email?: string | null
          full_name_ar: string
          full_name_en?: string | null
          governorate?: string | null
          id?: string
          metadata?: Json
          normalized_name_ar: string
          phone: string
          phone_e164: string
          photo_review_notes?: string | null
          photo_review_status?: string | null
          practice_wishlist?: Json
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["hc_join_status"]
          submitter_user_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          biography?: string | null
          city?: string | null
          claimed_specialties?: string[]
          created_at?: string
          decision_at?: string | null
          documents?: Json
          duplicate_of?: string | null
          duplicate_score?: number
          email?: string | null
          full_name_ar?: string
          full_name_en?: string | null
          governorate?: string | null
          id?: string
          metadata?: Json
          normalized_name_ar?: string
          phone?: string
          phone_e164?: string
          photo_review_notes?: string | null
          photo_review_status?: string | null
          practice_wishlist?: Json
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["hc_join_status"]
          submitter_user_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hc_doctor_join_submissions_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "hc_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_doctor_join_submissions_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "hc_doctors_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      hc_doctor_licenses: {
        Row: {
          authority: string | null
          country: string | null
          created_at: string
          doctor_id: string
          document_url: string | null
          id: string
          license_number: string
          status: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          authority?: string | null
          country?: string | null
          created_at?: string
          doctor_id: string
          document_url?: string | null
          id?: string
          license_number: string
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          authority?: string | null
          country?: string | null
          created_at?: string
          doctor_id?: string
          document_url?: string | null
          id?: string
          license_number?: string
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hc_doctor_licenses_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "hc_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_doctor_licenses_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "hc_doctors_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      hc_doctor_locations: {
        Row: {
          created_at: string
          doctor_id: string
          id: string
          location_id: string
          role: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          id?: string
          location_id: string
          role?: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          id?: string
          location_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "hc_doctor_locations_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "hc_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_doctor_locations_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "hc_doctors_public_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_doctor_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "hc_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      hc_doctor_practices: {
        Row: {
          assistant_phone: string | null
          booking_method: Database["public"]["Enums"]["hc_booking_method"]
          consultation_duration_min: number | null
          created_at: string
          doctor_id: string
          emergency_available: boolean
          gallery: Json
          id: string
          is_active: boolean
          is_primary: boolean
          lat: number | null
          lng: number | null
          location_id: string
          notes: string | null
          phone: string | null
          practice_type: Database["public"]["Enums"]["hc_practice_type"]
          telemedicine_ready: boolean
          updated_at: string
          whatsapp: string | null
          working_hours: Json
        }
        Insert: {
          assistant_phone?: string | null
          booking_method?: Database["public"]["Enums"]["hc_booking_method"]
          consultation_duration_min?: number | null
          created_at?: string
          doctor_id: string
          emergency_available?: boolean
          gallery?: Json
          id?: string
          is_active?: boolean
          is_primary?: boolean
          lat?: number | null
          lng?: number | null
          location_id: string
          notes?: string | null
          phone?: string | null
          practice_type?: Database["public"]["Enums"]["hc_practice_type"]
          telemedicine_ready?: boolean
          updated_at?: string
          whatsapp?: string | null
          working_hours?: Json
        }
        Update: {
          assistant_phone?: string | null
          booking_method?: Database["public"]["Enums"]["hc_booking_method"]
          consultation_duration_min?: number | null
          created_at?: string
          doctor_id?: string
          emergency_available?: boolean
          gallery?: Json
          id?: string
          is_active?: boolean
          is_primary?: boolean
          lat?: number | null
          lng?: number | null
          location_id?: string
          notes?: string | null
          phone?: string | null
          practice_type?: Database["public"]["Enums"]["hc_practice_type"]
          telemedicine_ready?: boolean
          updated_at?: string
          whatsapp?: string | null
          working_hours?: Json
        }
        Relationships: [
          {
            foreignKeyName: "hc_doctor_practices_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "hc_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_doctor_practices_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "hc_doctors_public_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_doctor_practices_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "hc_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      hc_doctor_qualifications: {
        Row: {
          country: string | null
          created_at: string
          doctor_id: string
          document_url: string | null
          id: string
          institution: string | null
          title: string
          updated_at: string
          year: number | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          doctor_id: string
          document_url?: string | null
          id?: string
          institution?: string | null
          title: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          country?: string | null
          created_at?: string
          doctor_id?: string
          document_url?: string | null
          id?: string
          institution?: string | null
          title?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hc_doctor_qualifications_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "hc_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_doctor_qualifications_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "hc_doctors_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      hc_doctor_specialties: {
        Row: {
          created_at: string
          doctor_id: string
          id: string
          is_primary: boolean
          specialty_id: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          id?: string
          is_primary?: boolean
          specialty_id: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          id?: string
          is_primary?: boolean
          specialty_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hc_doctor_specialties_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "hc_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_doctor_specialties_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "hc_doctors_public_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_doctor_specialties_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "hc_specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      hc_doctors: {
        Row: {
          academic_title: string | null
          accepted_insurance: string[]
          awards: Json
          bio_ar: string | null
          bio_en: string | null
          certificates: Json
          confidence_score: number
          consultation_fee_max: number | null
          consultation_fee_min: number | null
          created_at: string
          currency: string
          emergency_available: boolean
          full_name_ar: string
          full_name_en: string | null
          gallery: Json
          gender: string | null
          id: string
          intro_video_url: string | null
          is_public: boolean
          languages: string[]
          last_verified_at: string | null
          medical_title: string | null
          metadata: Json
          normalized_name_ar: string | null
          organization_id: string | null
          phone_e164: string | null
          photo_url: string | null
          profile_completeness: number
          qr_token: string | null
          rejection_reason: string | null
          seo_desc_ar: string | null
          seo_title_ar: string | null
          services: Json
          slug: string
          source: string
          sub_specialties: string[]
          telemedicine_ready: boolean
          title: string | null
          trust_score: number
          updated_at: string
          user_id: string | null
          verification_status: Database["public"]["Enums"]["hc_verification_status"]
          verified_at: string | null
          verified_by: string | null
          years_experience: number | null
        }
        Insert: {
          academic_title?: string | null
          accepted_insurance?: string[]
          awards?: Json
          bio_ar?: string | null
          bio_en?: string | null
          certificates?: Json
          confidence_score?: number
          consultation_fee_max?: number | null
          consultation_fee_min?: number | null
          created_at?: string
          currency?: string
          emergency_available?: boolean
          full_name_ar: string
          full_name_en?: string | null
          gallery?: Json
          gender?: string | null
          id?: string
          intro_video_url?: string | null
          is_public?: boolean
          languages?: string[]
          last_verified_at?: string | null
          medical_title?: string | null
          metadata?: Json
          normalized_name_ar?: string | null
          organization_id?: string | null
          phone_e164?: string | null
          photo_url?: string | null
          profile_completeness?: number
          qr_token?: string | null
          rejection_reason?: string | null
          seo_desc_ar?: string | null
          seo_title_ar?: string | null
          services?: Json
          slug: string
          source?: string
          sub_specialties?: string[]
          telemedicine_ready?: boolean
          title?: string | null
          trust_score?: number
          updated_at?: string
          user_id?: string | null
          verification_status?: Database["public"]["Enums"]["hc_verification_status"]
          verified_at?: string | null
          verified_by?: string | null
          years_experience?: number | null
        }
        Update: {
          academic_title?: string | null
          accepted_insurance?: string[]
          awards?: Json
          bio_ar?: string | null
          bio_en?: string | null
          certificates?: Json
          confidence_score?: number
          consultation_fee_max?: number | null
          consultation_fee_min?: number | null
          created_at?: string
          currency?: string
          emergency_available?: boolean
          full_name_ar?: string
          full_name_en?: string | null
          gallery?: Json
          gender?: string | null
          id?: string
          intro_video_url?: string | null
          is_public?: boolean
          languages?: string[]
          last_verified_at?: string | null
          medical_title?: string | null
          metadata?: Json
          normalized_name_ar?: string | null
          organization_id?: string | null
          phone_e164?: string | null
          photo_url?: string | null
          profile_completeness?: number
          qr_token?: string | null
          rejection_reason?: string | null
          seo_desc_ar?: string | null
          seo_title_ar?: string | null
          services?: Json
          slug?: string
          source?: string
          sub_specialties?: string[]
          telemedicine_ready?: boolean
          title?: string | null
          trust_score?: number
          updated_at?: string
          user_id?: string | null
          verification_status?: Database["public"]["Enums"]["hc_verification_status"]
          verified_at?: string | null
          verified_by?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hc_doctors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hc_locations: {
        Row: {
          address: string | null
          branch_id: string | null
          city: string | null
          country: string
          created_at: string
          email: string | null
          governorate: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["hc_location_kind"]
          lat: number | null
          lng: number | null
          metadata: Json
          name_ar: string
          name_en: string | null
          organization_id: string
          phone: string | null
          updated_at: string
          whatsapp: string | null
          working_hours: Json
        }
        Insert: {
          address?: string | null
          branch_id?: string | null
          city?: string | null
          country?: string
          created_at?: string
          email?: string | null
          governorate?: string | null
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["hc_location_kind"]
          lat?: number | null
          lng?: number | null
          metadata?: Json
          name_ar: string
          name_en?: string | null
          organization_id: string
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
          working_hours?: Json
        }
        Update: {
          address?: string | null
          branch_id?: string | null
          city?: string | null
          country?: string
          created_at?: string
          email?: string | null
          governorate?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["hc_location_kind"]
          lat?: number | null
          lng?: number | null
          metadata?: Json
          name_ar?: string
          name_en?: string | null
          organization_id?: string
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
          working_hours?: Json
        }
        Relationships: [
          {
            foreignKeyName: "hc_locations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hc_patients: {
        Row: {
          blood_type: string | null
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          email: string | null
          full_name: string
          gender: string | null
          id: string
          insurance_card_url: string | null
          is_active: boolean
          merged_into_id: string | null
          metadata: Json
          mrn: string | null
          national_id_hash: string | null
          organization_id: string | null
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          blood_type?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          gender?: string | null
          id?: string
          insurance_card_url?: string | null
          is_active?: boolean
          merged_into_id?: string | null
          metadata?: Json
          mrn?: string | null
          national_id_hash?: string | null
          organization_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          blood_type?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          insurance_card_url?: string | null
          is_active?: boolean
          merged_into_id?: string | null
          metadata?: Json
          mrn?: string | null
          national_id_hash?: string | null
          organization_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hc_patients_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "hc_patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_patients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hc_prescription_items: {
        Row: {
          created_at: string
          dose: string | null
          duration_days: number | null
          form: string | null
          frequency: string | null
          id: string
          instructions: string | null
          medication_name: string
          prescription_id: string
          product_id: string | null
          quantity: number
          route: string | null
          strength: string | null
        }
        Insert: {
          created_at?: string
          dose?: string | null
          duration_days?: number | null
          form?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          medication_name: string
          prescription_id: string
          product_id?: string | null
          quantity?: number
          route?: string | null
          strength?: string | null
        }
        Update: {
          created_at?: string
          dose?: string | null
          duration_days?: number | null
          form?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          medication_name?: string
          prescription_id?: string
          product_id?: string | null
          quantity?: number
          route?: string | null
          strength?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hc_prescription_items_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "hc_prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_prescription_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_prescription_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      hc_prescription_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          prescription_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          prescription_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          prescription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hc_prescription_notes_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "hc_prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      hc_prescription_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: string
          prescription_id: string
          reason: string | null
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          prescription_id: string
          reason?: string | null
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          prescription_id?: string
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hc_prescription_status_history_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "hc_prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      hc_prescriptions: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          diagnosis: string | null
          doctor_id: string | null
          external_doctor_name: string | null
          id: string
          issued_at: string
          notes: string | null
          organization_id: string
          patient_id: string
          prescription_no: string | null
          status: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          doctor_id?: string | null
          external_doctor_name?: string | null
          id?: string
          issued_at?: string
          notes?: string | null
          organization_id: string
          patient_id: string
          prescription_no?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          doctor_id?: string | null
          external_doctor_name?: string | null
          id?: string
          issued_at?: string
          notes?: string | null
          organization_id?: string
          patient_id?: string
          prescription_no?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hc_prescriptions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "hc_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_prescriptions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "hc_doctors_public_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_prescriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "hc_patients"
            referencedColumns: ["id"]
          },
        ]
      }
      hc_specialties: {
        Row: {
          code: string
          created_at: string
          description_ar: string | null
          description_en: string | null
          id: string
          name_ar: string
          name_en: string
          sort_order: number
          status: Database["public"]["Enums"]["hc_specialty_status"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          name_ar: string
          name_en: string
          sort_order?: number
          status?: Database["public"]["Enums"]["hc_specialty_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          name_ar?: string
          name_en?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["hc_specialty_status"]
          updated_at?: string
        }
        Relationships: []
      }
      hc_verification_requests: {
        Row: {
          created_at: string
          doctor_id: string
          documents: Json
          duplicate_of: string | null
          id: string
          photo_review_status: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          status: Database["public"]["Enums"]["hc_verification_status"]
          status_history: Json
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          documents?: Json
          duplicate_of?: string | null
          id?: string
          photo_review_status?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["hc_verification_status"]
          status_history?: Json
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          documents?: Json
          duplicate_of?: string | null
          id?: string
          photo_review_status?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["hc_verification_status"]
          status_history?: Json
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hc_verification_requests_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "hc_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_verification_requests_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "hc_doctors_public_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_verification_requests_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "hc_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hc_verification_requests_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "hc_doctors_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      health_checks: {
        Row: {
          created_at: string
          details: Json
          duration: number | null
          failed: number
          id: string
          passed: number
          status: string
          total: number
          warnings: number
        }
        Insert: {
          created_at?: string
          details?: Json
          duration?: number | null
          failed?: number
          id?: string
          passed?: number
          status: string
          total?: number
          warnings?: number
        }
        Update: {
          created_at?: string
          details?: Json
          duration?: number | null
          failed?: number
          id?: string
          passed?: number
          status?: string
          total?: number
          warnings?: number
        }
        Relationships: []
      }
      idempotency_keys: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          key: string
          request_hash: string | null
          response_body: Json | null
          response_status: number | null
          scope: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          key: string
          request_hash?: string | null
          response_body?: Json | null
          response_status?: number | null
          scope: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          key?: string
          request_hash?: string | null
          response_body?: Json | null
          response_status?: number | null
          scope?: string
        }
        Relationships: []
      }
      identity_audit_events: {
        Row: {
          actor_user_id: string | null
          branch_id: string | null
          created_at: string
          event_type: string
          id: string
          org_id: string | null
          payload: Json
          subject_user_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          branch_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          org_id?: string | null
          payload?: Json
          subject_user_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          branch_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          org_id?: string | null
          payload?: Json
          subject_user_id?: string | null
        }
        Relationships: []
      }
      image_generation_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          image_url: string | null
          last_error: string | null
          processed_at: string | null
          product_id: string
          requested_at: string
          status: string
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          image_url?: string | null
          last_error?: string | null
          processed_at?: string | null
          product_id: string
          requested_at?: string
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          image_url?: string | null
          last_error?: string | null
          processed_at?: string | null
          product_id?: string
          requested_at?: string
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_generation_queue_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_generation_queue_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      img_proxy_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error: string | null
          host: string | null
          id: number
          ok: boolean
          status: number
          url: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          host?: string | null
          id?: number
          ok: boolean
          status: number
          url: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          host?: string | null
          id?: number
          ok?: boolean
          status?: number
          url?: string
        }
        Relationships: []
      }
      img_proxy_settings: {
        Row: {
          allowed_hosts: string[]
          id: number
          image_domain: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed_hosts?: string[]
          id?: number
          image_domain?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed_hosts?: string[]
          id?: number
          image_domain?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      img_rate_limit: {
        Row: {
          count: number
          ip: string
          updated_at: string
          window_start: string
        }
        Insert: {
          count?: number
          ip: string
          updated_at?: string
          window_start?: string
        }
        Update: {
          count?: number
          ip?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      ins_companies: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          metadata: Json
          name_ar: string
          name_en: string | null
          phone: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          metadata?: Json
          name_ar: string
          name_en?: string | null
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          metadata?: Json
          name_ar?: string
          name_en?: string | null
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      ins_patient_coverage: {
        Row: {
          company_id: string
          copay_percent: number | null
          created_at: string
          id: string
          metadata: Json
          notes: string | null
          patient_id: string | null
          patient_user_id: string | null
          policy_no: string | null
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          company_id: string
          copay_percent?: number | null
          created_at?: string
          id?: string
          metadata?: Json
          notes?: string | null
          patient_id?: string | null
          patient_user_id?: string | null
          policy_no?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          company_id?: string
          copay_percent?: number | null
          created_at?: string
          id?: string
          metadata?: Json
          notes?: string | null
          patient_id?: string | null
          patient_user_id?: string | null
          policy_no?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ins_patient_coverage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "ins_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ins_patient_coverage_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "hc_patients"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_claims: {
        Row: {
          card_expiry: string | null
          card_image_url: string | null
          channel: string
          created_at: string
          diagnosis: string | null
          id: string
          insurance_company: string
          insurance_number: string
          is_stamped: boolean | null
          patient_name: string
          patient_phone: string
          prescription_date: string | null
          prescription_image_url: string | null
          staff_notes: string | null
          status: string
          updated_at: string
          validation_notes: string | null
        }
        Insert: {
          card_expiry?: string | null
          card_image_url?: string | null
          channel?: string
          created_at?: string
          diagnosis?: string | null
          id?: string
          insurance_company?: string
          insurance_number: string
          is_stamped?: boolean | null
          patient_name: string
          patient_phone: string
          prescription_date?: string | null
          prescription_image_url?: string | null
          staff_notes?: string | null
          status?: string
          updated_at?: string
          validation_notes?: string | null
        }
        Update: {
          card_expiry?: string | null
          card_image_url?: string | null
          channel?: string
          created_at?: string
          diagnosis?: string | null
          id?: string
          insurance_company?: string
          insurance_number?: string
          is_stamped?: boolean | null
          patient_name?: string
          patient_phone?: string
          prescription_date?: string | null
          prescription_image_url?: string | null
          staff_notes?: string | null
          status?: string
          updated_at?: string
          validation_notes?: string | null
        }
        Relationships: []
      }
      insv2_authorizations: {
        Row: {
          approved_amount: number | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          id: string
          metadata: Json
          notes: string | null
          organization_id: string
          patient_id: string
          plan_id: string
          prescription_id: string | null
          reason: string | null
          reference: string | null
          status: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          approved_amount?: number | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          organization_id: string
          patient_id: string
          plan_id: string
          prescription_id?: string | null
          reason?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          approved_amount?: number | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          organization_id?: string
          patient_id?: string
          plan_id?: string
          prescription_id?: string | null
          reason?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insv2_authorizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insv2_authorizations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "hc_patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insv2_authorizations_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "insv2_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insv2_authorizations_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "hc_prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      insv2_claim_items: {
        Row: {
          allowed_amount: number
          billed_amount: number
          claim_id: string
          coinsurance_amount: number
          copay_amount: number
          created_at: string
          deductible_amount: number
          description: string
          dispense_item_id: string | null
          id: string
          notes: string | null
          paid_amount: number
          product_id: string | null
          quantity: number
          reason_code: string | null
          unit_billed: number
          updated_at: string
        }
        Insert: {
          allowed_amount?: number
          billed_amount?: number
          claim_id: string
          coinsurance_amount?: number
          copay_amount?: number
          created_at?: string
          deductible_amount?: number
          description: string
          dispense_item_id?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number
          product_id?: string | null
          quantity?: number
          reason_code?: string | null
          unit_billed?: number
          updated_at?: string
        }
        Update: {
          allowed_amount?: number
          billed_amount?: number
          claim_id?: string
          coinsurance_amount?: number
          copay_amount?: number
          created_at?: string
          deductible_amount?: number
          description?: string
          dispense_item_id?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number
          product_id?: string | null
          quantity?: number
          reason_code?: string | null
          unit_billed?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insv2_claim_items_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "insv2_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insv2_claim_items_dispense_item_id_fkey"
            columns: ["dispense_item_id"]
            isOneToOne: false
            referencedRelation: "hc_dispense_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insv2_claim_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insv2_claim_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      insv2_claim_status_history: {
        Row: {
          changed_by: string | null
          claim_id: string
          created_at: string
          from_status: string | null
          id: string
          reason: string | null
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          claim_id: string
          created_at?: string
          from_status?: string | null
          id?: string
          reason?: string | null
          to_status: string
        }
        Update: {
          changed_by?: string | null
          claim_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "insv2_claim_status_history_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "insv2_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      insv2_claims: {
        Row: {
          adjudicated_at: string | null
          authorization_id: string | null
          branch_id: string | null
          claim_no: string | null
          correlation_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          diagnosis: string | null
          dispense_id: string | null
          id: string
          metadata: Json
          notes: string | null
          organization_id: string
          paid_at: string | null
          patient_id: string
          plan_id: string
          prescription_id: string | null
          provider_id: string
          reject_reason: string | null
          status: string
          submitted_at: string | null
          total_allowed: number
          total_billed: number
          total_copay: number
          total_deductible: number
          total_paid: number
          updated_at: string
        }
        Insert: {
          adjudicated_at?: string | null
          authorization_id?: string | null
          branch_id?: string | null
          claim_no?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          diagnosis?: string | null
          dispense_id?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          patient_id: string
          plan_id: string
          prescription_id?: string | null
          provider_id: string
          reject_reason?: string | null
          status?: string
          submitted_at?: string | null
          total_allowed?: number
          total_billed?: number
          total_copay?: number
          total_deductible?: number
          total_paid?: number
          updated_at?: string
        }
        Update: {
          adjudicated_at?: string | null
          authorization_id?: string | null
          branch_id?: string | null
          claim_no?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          diagnosis?: string | null
          dispense_id?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          patient_id?: string
          plan_id?: string
          prescription_id?: string | null
          provider_id?: string
          reject_reason?: string | null
          status?: string
          submitted_at?: string | null
          total_allowed?: number
          total_billed?: number
          total_copay?: number
          total_deductible?: number
          total_paid?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insv2_claims_authorization_id_fkey"
            columns: ["authorization_id"]
            isOneToOne: false
            referencedRelation: "insv2_authorizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insv2_claims_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insv2_claims_dispense_id_fkey"
            columns: ["dispense_id"]
            isOneToOne: false
            referencedRelation: "hc_dispenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insv2_claims_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insv2_claims_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "hc_patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insv2_claims_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "insv2_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insv2_claims_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "hc_prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insv2_claims_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "insv2_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      insv2_patient_insurance: {
        Row: {
          created_at: string
          created_by: string | null
          group_number: string | null
          holder_name: string | null
          holder_relation: string | null
          id: string
          metadata: Json
          notes: string | null
          organization_id: string
          patient_id: string
          plan_id: string
          policy_number: string
          priority: string
          status: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          group_number?: string | null
          holder_name?: string | null
          holder_relation?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          organization_id: string
          patient_id: string
          plan_id: string
          policy_number: string
          priority?: string
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          group_number?: string | null
          holder_name?: string | null
          holder_relation?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          organization_id?: string
          patient_id?: string
          plan_id?: string
          policy_number?: string
          priority?: string
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insv2_patient_insurance_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insv2_patient_insurance_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "hc_patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insv2_patient_insurance_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "insv2_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      insv2_payment_responses: {
        Row: {
          amount: number
          claim_id: string
          created_at: string
          id: string
          method: string | null
          notes: string | null
          raw_payload: Json
          received_at: string
          recorded_by: string | null
          reference: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          claim_id: string
          created_at?: string
          id?: string
          method?: string | null
          notes?: string | null
          raw_payload?: Json
          received_at?: string
          recorded_by?: string | null
          reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          claim_id?: string
          created_at?: string
          id?: string
          method?: string | null
          notes?: string | null
          raw_payload?: Json
          received_at?: string
          recorded_by?: string | null
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insv2_payment_responses_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "insv2_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      insv2_plans: {
        Row: {
          code: string
          copay_percent: number
          coverage_percent: number
          created_at: string
          created_by: string | null
          deductible: number
          effective_from: string | null
          effective_to: string | null
          formulary_ref: string | null
          id: string
          is_active: boolean
          metadata: Json
          name: string
          organization_id: string
          provider_id: string
          tier: string | null
          updated_at: string
        }
        Insert: {
          code: string
          copay_percent?: number
          coverage_percent?: number
          created_at?: string
          created_by?: string | null
          deductible?: number
          effective_from?: string | null
          effective_to?: string | null
          formulary_ref?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          organization_id: string
          provider_id: string
          tier?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          copay_percent?: number
          coverage_percent?: number
          created_at?: string
          created_by?: string | null
          deductible?: number
          effective_from?: string | null
          effective_to?: string | null
          formulary_ref?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          organization_id?: string
          provider_id?: string
          tier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insv2_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insv2_plans_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "insv2_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      insv2_policy_members: {
        Row: {
          created_at: string
          dob: string | null
          full_name: string
          id: string
          national_id: string | null
          patient_insurance_id: string
          relation: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dob?: string | null
          full_name: string
          id?: string
          national_id?: string | null
          patient_insurance_id: string
          relation: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dob?: string | null
          full_name?: string
          id?: string
          national_id?: string | null
          patient_insurance_id?: string
          relation?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insv2_policy_members_patient_insurance_id_fkey"
            columns: ["patient_insurance_id"]
            isOneToOne: false
            referencedRelation: "insv2_patient_insurance"
            referencedColumns: ["id"]
          },
        ]
      }
      insv2_providers: {
        Row: {
          address: string | null
          code: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          metadata: Json
          name: string
          name_en: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          name_en?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          name_en?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insv2_providers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_expiry_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          batch_id: string
          created_at: string
          expiry_date: string | null
          id: string
          organization_id: string
          qty_at_alert: number
          tier: Database["public"]["Enums"]["inv_expiry_tier"]
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          batch_id: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          organization_id: string
          qty_at_alert?: number
          tier: Database["public"]["Enums"]["inv_expiry_tier"]
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          batch_id?: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          organization_id?: string
          qty_at_alert?: number
          tier?: Database["public"]["Enums"]["inv_expiry_tier"]
        }
        Relationships: [
          {
            foreignKeyName: "inv_expiry_alerts_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inv_stock_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_expiry_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_reorder_suggestions: {
        Row: {
          computed_at: string
          created_at: string
          daily_burn_rate: number
          days_of_cover: number | null
          id: string
          lead_time_days: number
          on_hand: number
          organization_id: string
          product_id: string
          purchase_order_id: string | null
          reorder_point: number
          safety_stock: number
          status: string
          suggested_qty: number
          supplier_id: string | null
          updated_at: string
          warehouse_id: string
          window_days: number
        }
        Insert: {
          computed_at?: string
          created_at?: string
          daily_burn_rate?: number
          days_of_cover?: number | null
          id?: string
          lead_time_days?: number
          on_hand?: number
          organization_id: string
          product_id: string
          purchase_order_id?: string | null
          reorder_point?: number
          safety_stock?: number
          status?: string
          suggested_qty?: number
          supplier_id?: string | null
          updated_at?: string
          warehouse_id: string
          window_days?: number
        }
        Update: {
          computed_at?: string
          created_at?: string
          daily_burn_rate?: number
          days_of_cover?: number | null
          id?: string
          lead_time_days?: number
          on_hand?: number
          organization_id?: string
          product_id?: string
          purchase_order_id?: string | null
          reorder_point?: number
          safety_stock?: number
          status?: string
          suggested_qty?: number
          supplier_id?: string | null
          updated_at?: string
          warehouse_id?: string
          window_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "inv_reorder_suggestions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_reorder_suggestions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_reorder_suggestions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_reorder_suggestions_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_reorder_suggestions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "sup_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_reorder_suggestions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "wh_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_reservations: {
        Row: {
          actor_user_id: string | null
          allocations: Json
          consumed_at: string | null
          correlation_id: string | null
          created_at: string
          id: string
          organization_id: string
          product_id: string
          qty: number
          ref_id: string | null
          ref_type: string | null
          released_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actor_user_id?: string | null
          allocations?: Json
          consumed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          id?: string
          organization_id: string
          product_id: string
          qty: number
          ref_id?: string | null
          ref_type?: string | null
          released_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          actor_user_id?: string | null
          allocations?: Json
          consumed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          product_id?: string
          qty?: number
          ref_id?: string | null
          ref_type?: string | null
          released_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inv_reservations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_stock_batches: {
        Row: {
          batch_no: string | null
          cost: number | null
          created_at: string
          expiry_date: string | null
          id: string
          location_id: string | null
          metadata: Json
          organization_id: string
          product_id: string
          qty_on_hand: number
          qty_reserved: number
          received_at: string
          selling_price: number | null
          supplier_id: string | null
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          batch_no?: string | null
          cost?: number | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          location_id?: string | null
          metadata?: Json
          organization_id: string
          product_id: string
          qty_on_hand?: number
          qty_reserved?: number
          received_at?: string
          selling_price?: number | null
          supplier_id?: string | null
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          batch_no?: string | null
          cost?: number | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          location_id?: string | null
          metadata?: Json
          organization_id?: string
          product_id?: string
          qty_on_hand?: number
          qty_reserved?: number
          received_at?: string
          selling_price?: number | null
          supplier_id?: string | null
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_batches_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "wh_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "sup_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_batches_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "wh_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_stock_movements: {
        Row: {
          actor_user_id: string | null
          batch_id: string | null
          created_at: string
          id: string
          metadata: Json
          movement_type: Database["public"]["Enums"]["inv_movement_type"]
          occurred_at: string
          organization_id: string
          product_id: string
          qty_delta: number
          reason: string | null
          ref_id: string | null
          ref_type: string | null
          warehouse_id: string
        }
        Insert: {
          actor_user_id?: string | null
          batch_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          movement_type: Database["public"]["Enums"]["inv_movement_type"]
          occurred_at?: string
          organization_id: string
          product_id: string
          qty_delta: number
          reason?: string | null
          ref_id?: string | null
          ref_type?: string | null
          warehouse_id: string
        }
        Update: {
          actor_user_id?: string | null
          batch_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          movement_type?: Database["public"]["Enums"]["inv_movement_type"]
          occurred_at?: string
          organization_id?: string
          product_id?: string
          qty_delta?: number
          reason?: string | null
          ref_id?: string | null
          ref_type?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inv_stock_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "wh_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_transfer_items: {
        Row: {
          batch_id: string | null
          created_at: string
          id: string
          metadata: Json
          product_id: string
          qty_picked: number
          qty_received: number
          qty_requested: number
          qty_reserved: number
          transfer_id: string
          updated_at: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          product_id: string
          qty_picked?: number
          qty_received?: number
          qty_requested: number
          qty_reserved?: number
          transfer_id: string
          updated_at?: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          product_id?: string
          qty_picked?: number
          qty_received?: number
          qty_requested?: number
          qty_reserved?: number
          transfer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inv_transfer_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inv_stock_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "inv_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_transfers: {
        Row: {
          approved_by: string | null
          cancelled_at: string | null
          code: string | null
          created_at: string
          dest_warehouse_id: string
          dispatched_at: string | null
          id: string
          metadata: Json
          notes: string | null
          organization_id: string
          received_at: string | null
          requested_by: string | null
          source_warehouse_id: string
          status: Database["public"]["Enums"]["inv_transfer_status"]
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          cancelled_at?: string | null
          code?: string | null
          created_at?: string
          dest_warehouse_id: string
          dispatched_at?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          organization_id: string
          received_at?: string | null
          requested_by?: string | null
          source_warehouse_id: string
          status?: Database["public"]["Enums"]["inv_transfer_status"]
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          cancelled_at?: string | null
          code?: string | null
          created_at?: string
          dest_warehouse_id?: string
          dispatched_at?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          organization_id?: string
          received_at?: string | null
          requested_by?: string | null
          source_warehouse_id?: string
          status?: Database["public"]["Enums"]["inv_transfer_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inv_transfers_dest_warehouse_id_fkey"
            columns: ["dest_warehouse_id"]
            isOneToOne: false
            referencedRelation: "wh_warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_transfers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_transfers_source_warehouse_id_fkey"
            columns: ["source_warehouse_id"]
            isOneToOne: false
            referencedRelation: "wh_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_alerts: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          message: string | null
          product_id: string | null
          resolved: boolean
          resolved_at: string | null
          severity: string
          type: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          product_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          type: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          product_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_alerts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_audit_log: {
        Row: {
          action: string
          actor: string | null
          correlation_id: string | null
          created_at: string
          id: string
          order_id: string
          payload: Json
          reason: string | null
          status: string
        }
        Insert: {
          action: string
          actor?: string | null
          correlation_id?: string | null
          created_at?: string
          id?: string
          order_id: string
          payload?: Json
          reason?: string | null
          status: string
        }
        Update: {
          action?: string
          actor?: string | null
          correlation_id?: string | null
          created_at?: string
          id?: string
          order_id?: string
          payload?: Json
          reason?: string | null
          status?: string
        }
        Relationships: []
      }
      inventory_health_scores: {
        Row: {
          availability_pct: number
          computed_at: string
          current_qty: number
          days_of_cover: number | null
          expiry_risk: number
          id: string
          product_id: string
          recommendation: string | null
          score: number
          status: string
          velocity_daily: number
        }
        Insert: {
          availability_pct?: number
          computed_at?: string
          current_qty?: number
          days_of_cover?: number | null
          expiry_risk?: number
          id?: string
          product_id: string
          recommendation?: string | null
          score: number
          status: string
          velocity_daily?: number
        }
        Update: {
          availability_pct?: number
          computed_at?: string
          current_qty?: number
          days_of_cover?: number | null
          expiry_risk?: number
          id?: string
          product_id?: string
          recommendation?: string | null
          score?: number
          status?: string
          velocity_daily?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_health_scores_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_idempotency: {
        Row: {
          actor_id: string | null
          command: string
          created_at: string
          key: string
          response: Json
        }
        Insert: {
          actor_id?: string | null
          command: string
          created_at?: string
          key: string
          response: Json
        }
        Update: {
          actor_id?: string | null
          command?: string
          created_at?: string
          key?: string
          response?: Json
        }
        Relationships: []
      }
      inventory_manual_adjustments: {
        Row: {
          after_qty: number
          before_qty: number
          created_at: string
          db_user: string | null
          delta: number
          id: string
          performed_by: string | null
          product_id: string
          reason: string | null
          source: string
        }
        Insert: {
          after_qty: number
          before_qty: number
          created_at?: string
          db_user?: string | null
          delta: number
          id?: string
          performed_by?: string | null
          product_id: string
          reason?: string | null
          source?: string
        }
        Update: {
          after_qty?: number
          before_qty?: number
          created_at?: string
          db_user?: string | null
          delta?: number
          id?: string
          performed_by?: string | null
          product_id?: string
          reason?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_manual_adjustments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_reservation_state: {
        Row: {
          correlation_id: string | null
          order_id: string
          released_at: string | null
          reserved_at: string | null
          state: string
          updated_at: string
        }
        Insert: {
          correlation_id?: string | null
          order_id: string
          released_at?: string | null
          reserved_at?: string | null
          state: string
          updated_at?: string
        }
        Update: {
          correlation_id?: string | null
          order_id?: string
          released_at?: string | null
          reserved_at?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_inv_res_state_order"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_shadow_log: {
        Row: {
          branch_code: string | null
          branch_id: string | null
          branch_stock: number | null
          created_at: string
          id: string
          legacy_id: number | null
          legacy_stock: number | null
          note: string | null
          order_id: string | null
          product_id: string | null
          requested_qty: number
          shortfall: number | null
          would_succeed: boolean
        }
        Insert: {
          branch_code?: string | null
          branch_id?: string | null
          branch_stock?: number | null
          created_at?: string
          id?: string
          legacy_id?: number | null
          legacy_stock?: number | null
          note?: string | null
          order_id?: string | null
          product_id?: string | null
          requested_qty: number
          shortfall?: number | null
          would_succeed: boolean
        }
        Update: {
          branch_code?: string | null
          branch_id?: string | null
          branch_stock?: number | null
          created_at?: string
          id?: string
          legacy_id?: number | null
          legacy_stock?: number | null
          note?: string | null
          order_id?: string | null
          product_id?: string | null
          requested_qty?: number
          shortfall?: number | null
          would_succeed?: boolean
        }
        Relationships: []
      }
      inventory_sync_logs: {
        Row: {
          actor_id: string | null
          completed_at: string | null
          errors: string[]
          hidden: number
          id: string
          inserted: number
          metadata: Json
          republished: number
          started_at: string
          status: string
          total_products: number
          updated: number
        }
        Insert: {
          actor_id?: string | null
          completed_at?: string | null
          errors?: string[]
          hidden?: number
          id?: string
          inserted?: number
          metadata?: Json
          republished?: number
          started_at?: string
          status: string
          total_products?: number
          updated?: number
        }
        Update: {
          actor_id?: string | null
          completed_at?: string | null
          errors?: string[]
          hidden?: number
          id?: string
          inserted?: number
          metadata?: Json
          republished?: number
          started_at?: string
          status?: string
          total_products?: number
          updated?: number
        }
        Relationships: []
      }
      inventory_transfers: {
        Row: {
          approved_by: string | null
          correlation_id: string
          created_at: string
          destination_branch_id: string | null
          id: string
          metadata: Json
          notes: string | null
          reason: string | null
          requested_by: string | null
          source_branch_id: string | null
          status: Database["public"]["Enums"]["transfer_status"]
          transfer_type: Database["public"]["Enums"]["transfer_type"]
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          correlation_id: string
          created_at?: string
          destination_branch_id?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          reason?: string | null
          requested_by?: string | null
          source_branch_id?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          transfer_type: Database["public"]["Enums"]["transfer_type"]
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          correlation_id?: string
          created_at?: string
          destination_branch_id?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          reason?: string | null
          requested_by?: string | null
          source_branch_id?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          transfer_type?: Database["public"]["Enums"]["transfer_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transfers_destination_branch_id_fkey"
            columns: ["destination_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_source_branch_id_fkey"
            columns: ["source_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_audit_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["invoice_audit_event_type"]
          id: string
          payload: Json
          upload_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["invoice_audit_event_type"]
          id?: string
          payload?: Json
          upload_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["invoice_audit_event_type"]
          id?: string
          payload?: Json
          upload_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_audit_events_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "invoice_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_extractions: {
        Row: {
          currency: string | null
          extracted_at: string
          id: string
          invoice_date: string | null
          invoice_number: string | null
          model_used: string | null
          ocr_confidence: number | null
          raw_ocr_text: string | null
          subtotal: number | null
          supplier_name_raw: string | null
          tax: number | null
          total: number | null
          upload_id: string
        }
        Insert: {
          currency?: string | null
          extracted_at?: string
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          model_used?: string | null
          ocr_confidence?: number | null
          raw_ocr_text?: string | null
          subtotal?: number | null
          supplier_name_raw?: string | null
          tax?: number | null
          total?: number | null
          upload_id: string
        }
        Update: {
          currency?: string | null
          extracted_at?: string
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          model_used?: string | null
          ocr_confidence?: number | null
          raw_ocr_text?: string | null
          subtotal?: number | null
          supplier_name_raw?: string | null
          tax?: number | null
          total?: number | null
          upload_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_extractions_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "invoice_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          batch_number: string | null
          created_at: string
          detected_name: string | null
          detected_name_normalized: string | null
          expiry_date: string | null
          extraction_id: string
          id: string
          line_no: number
          match_confidence: number | null
          match_source: Database["public"]["Enums"]["invoice_match_source"]
          matched_product_id: string | null
          quantity: number | null
          raw_text: string | null
          status: Database["public"]["Enums"]["invoice_line_status"]
          unit_cost: number | null
          unit_price: number | null
          updated_at: string
          user_confirmed_cost: number | null
          user_confirmed_expiry: string | null
          user_confirmed_product_id: string | null
          user_confirmed_qty: number | null
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          detected_name?: string | null
          detected_name_normalized?: string | null
          expiry_date?: string | null
          extraction_id: string
          id?: string
          line_no: number
          match_confidence?: number | null
          match_source?: Database["public"]["Enums"]["invoice_match_source"]
          matched_product_id?: string | null
          quantity?: number | null
          raw_text?: string | null
          status?: Database["public"]["Enums"]["invoice_line_status"]
          unit_cost?: number | null
          unit_price?: number | null
          updated_at?: string
          user_confirmed_cost?: number | null
          user_confirmed_expiry?: string | null
          user_confirmed_product_id?: string | null
          user_confirmed_qty?: number | null
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          detected_name?: string | null
          detected_name_normalized?: string | null
          expiry_date?: string | null
          extraction_id?: string
          id?: string
          line_no?: number
          match_confidence?: number | null
          match_source?: Database["public"]["Enums"]["invoice_match_source"]
          matched_product_id?: string | null
          quantity?: number | null
          raw_text?: string | null
          status?: Database["public"]["Enums"]["invoice_line_status"]
          unit_cost?: number | null
          unit_price?: number | null
          updated_at?: string
          user_confirmed_cost?: number | null
          user_confirmed_expiry?: string | null
          user_confirmed_product_id?: string | null
          user_confirmed_qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_extraction_id_fkey"
            columns: ["extraction_id"]
            isOneToOne: false
            referencedRelation: "invoice_extractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_user_confirmed_product_id_fkey"
            columns: ["user_confirmed_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_user_confirmed_product_id_fkey"
            columns: ["user_confirmed_product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_uploads: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          mime_type: string
          notes: string | null
          organization_id: string
          source: Database["public"]["Enums"]["invoice_upload_source"]
          status: Database["public"]["Enums"]["invoice_upload_status"]
          storage_path: string
          supplier_id: string | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          mime_type: string
          notes?: string | null
          organization_id: string
          source?: Database["public"]["Enums"]["invoice_upload_source"]
          status?: Database["public"]["Enums"]["invoice_upload_status"]
          storage_path: string
          supplier_id?: string | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          mime_type?: string
          notes?: string | null
          organization_id?: string
          source?: Database["public"]["Enums"]["invoice_upload_source"]
          status?: Database["public"]["Enums"]["invoice_upload_status"]
          storage_path?: string
          supplier_id?: string | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_uploads_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_uploads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_uploads_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "sup_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          html_content: string
          id: string
          invoice_number: string
          order_id: string | null
          paid_at: string | null
          sent_at: string | null
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          html_content: string
          id?: string
          invoice_number: string
          order_id?: string | null
          paid_at?: string | null
          sent_at?: string | null
          status?: string
          total: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          html_content?: string
          id?: string
          invoice_number?: string
          order_id?: string | null
          paid_at?: string | null
          sent_at?: string | null
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      kernel_module_telemetry: {
        Row: {
          budget_used: number
          created_at: string
          error_rate: number
          failures: number
          id: string
          latency_ms: number | null
          meta: Json
          module_key: string
          observed_at: string
          runs: number
          status: string
          updated_at: string
        }
        Insert: {
          budget_used?: number
          created_at?: string
          error_rate?: number
          failures?: number
          id?: string
          latency_ms?: number | null
          meta?: Json
          module_key: string
          observed_at?: string
          runs?: number
          status?: string
          updated_at?: string
        }
        Update: {
          budget_used?: number
          created_at?: string
          error_rate?: number
          failures?: number
          id?: string
          latency_ms?: number | null
          meta?: Json
          module_key?: string
          observed_at?: string
          runs?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_accounts: {
        Row: {
          created_at: string
          id: string
          phone_number: string
          points: number
          tier: string
          total_spent_yer: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          phone_number: string
          points?: number
          tier?: string
          total_spent_yer?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          phone_number?: string
          points?: number
          tier?: string
          total_spent_yer?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      loyalty_transactions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          order_id: string | null
          phone_number: string
          points: number
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          phone_number: string
          points: number
          type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          phone_number?: string
          points?: number
          type?: string
        }
        Relationships: []
      }
      marketing_banners: {
        Row: {
          clicks: number
          created_at: string
          cta_href: string | null
          cta_label: string | null
          expires_at: string | null
          id: string
          image_url: string | null
          impressions: number
          is_active: boolean
          placement: string
          sort_order: number
          starts_at: string
          subtitle: string | null
          theme: string
          title: string
          updated_at: string
        }
        Insert: {
          clicks?: number
          created_at?: string
          cta_href?: string | null
          cta_label?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          impressions?: number
          is_active?: boolean
          placement?: string
          sort_order?: number
          starts_at?: string
          subtitle?: string | null
          theme?: string
          title: string
          updated_at?: string
        }
        Update: {
          clicks?: number
          created_at?: string
          cta_href?: string | null
          cta_label?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          impressions?: number
          is_active?: boolean
          placement?: string
          sort_order?: number
          starts_at?: string
          subtitle?: string | null
          theme?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          name: string
          sent_to: number
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          name: string
          sent_to?: number
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          name?: string
          sent_to?: number
          type?: string
        }
        Relationships: []
      }
      marketing_queue: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          campaign_kind: string
          customer_name: string | null
          customer_phone: string
          error: string | null
          generated_at: string
          id: string
          message_text: string | null
          payload: Json
          reason: string | null
          segment: string | null
          sent_at: string | null
          status: string
          wamid: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          campaign_kind: string
          customer_name?: string | null
          customer_phone: string
          error?: string | null
          generated_at?: string
          id?: string
          message_text?: string | null
          payload?: Json
          reason?: string | null
          segment?: string | null
          sent_at?: string | null
          status?: string
          wamid?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          campaign_kind?: string
          customer_name?: string | null
          customer_phone?: string
          error?: string | null
          generated_at?: string
          id?: string
          message_text?: string | null
          payload?: Json
          reason?: string | null
          segment?: string | null
          sent_at?: string | null
          status?: string
          wamid?: string | null
        }
        Relationships: []
      }
      medical_entities: {
        Row: {
          atc_code: string | null
          created_at: string
          description_ar: string | null
          description_en: string | null
          embedding: string | null
          entity_type: string
          icd_code: string | null
          id: string
          metadata: Json
          name_ar: string
          name_en: string | null
          severity: string | null
          slug: string
          synonyms: string[] | null
          updated_at: string
        }
        Insert: {
          atc_code?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          embedding?: string | null
          entity_type: string
          icd_code?: string | null
          id?: string
          metadata?: Json
          name_ar: string
          name_en?: string | null
          severity?: string | null
          slug: string
          synonyms?: string[] | null
          updated_at?: string
        }
        Update: {
          atc_code?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          embedding?: string | null
          entity_type?: string
          icd_code?: string | null
          id?: string
          metadata?: Json
          name_ar?: string
          name_en?: string | null
          severity?: string | null
          slug?: string
          synonyms?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      medical_posts: {
        Row: {
          ai_generated: boolean
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          category: string
          content: string
          cover_image_url: string | null
          created_at: string
          id: string
          language: string
          publish_date: string
          published_at: string | null
          slug: string
          summary: string | null
          tags: Json
          title: string
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          category: string
          content: string
          cover_image_url?: string | null
          created_at?: string
          id?: string
          language?: string
          publish_date?: string
          published_at?: string | null
          slug: string
          summary?: string | null
          tags?: Json
          title: string
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          content?: string
          cover_image_url?: string | null
          created_at?: string
          id?: string
          language?: string
          publish_date?: string
          published_at?: string | null
          slug?: string
          summary?: string | null
          tags?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      medical_relationships: {
        Row: {
          confidence: number
          created_at: string
          evidence_source: string | null
          id: string
          metadata: Json
          relationship_type: string
          source_id: string
          target_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          evidence_source?: string | null
          id?: string
          metadata?: Json
          relationship_type: string
          source_id: string
          target_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          evidence_source?: string | null
          id?: string
          metadata?: Json
          relationship_type?: string
          source_id?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_relationships_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "medical_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_relationships_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "medical_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_requests: {
        Row: {
          created_at: string
          full_name: string
          id: string
          note: string | null
          phone: string
          request_type: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          note?: string | null
          phone: string
          request_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          note?: string | null
          phone?: string
          request_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      medical_vault_files: {
        Row: {
          created_at: string
          encryption_status: boolean
          file_type: string
          id: string
          metadata: Json
          mime_type: string | null
          patient_id: string
          size_bytes: number | null
          storage_path: string
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          encryption_status?: boolean
          file_type: string
          id?: string
          metadata?: Json
          mime_type?: string | null
          patient_id: string
          size_bytes?: number | null
          storage_path: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          encryption_status?: boolean
          file_type?: string
          id?: string
          metadata?: Json
          mime_type?: string | null
          patient_id?: string
          size_bytes?: number | null
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_vault_files_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "hc_patients"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          metadata: Json
          priority: string
          read: boolean
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          priority?: string
          read?: boolean
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          priority?: string
          read?: boolean
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          created_at: string
          description: string | null
          discount_percent: number | null
          ends_at: string | null
          id: string
          is_active: boolean
          product_id: string | null
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          product_id?: string | null
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          product_id?: string | null
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      operations_alerts: {
        Row: {
          created_at: string
          dedupe_key: string
          id: string
          kind: string
          ref_id: string | null
          resolved_at: string | null
          severity: string
          status: string
          summary: string
        }
        Insert: {
          created_at?: string
          dedupe_key?: string
          id?: string
          kind: string
          ref_id?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          summary: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string
          id?: string
          kind?: string
          ref_id?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          summary?: string
        }
        Relationships: []
      }
      operations_alerts_v14: {
        Row: {
          acknowledged_at: string | null
          alert_type: string
          created_at: string | null
          dedupe_key: string
          id: string
          message: string
          read_at: string | null
          user_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          alert_type: string
          created_at?: string | null
          dedupe_key: string
          id?: string
          message: string
          read_at?: string | null
          user_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          alert_type?: string
          created_at?: string | null
          dedupe_key?: string
          id?: string
          message?: string
          read_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          note: string | null
          order_id: string
          status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          order_id: string
          status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          branch_id: string | null
          correlation_id: string
          created_at: string
          customer_address: string
          customer_name: string
          customer_phone: string
          discount_amount: number
          discount_code: string | null
          id: string
          items: Json
          notes: string | null
          payment_method_code: string | null
          payment_receipt_path: string | null
          payment_status: string
          shipping_fee: number
          shipping_zone_id: string | null
          status: string
          subtotal: number | null
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          correlation_id?: string
          created_at?: string
          customer_address: string
          customer_name: string
          customer_phone: string
          discount_amount?: number
          discount_code?: string | null
          id: string
          items?: Json
          notes?: string | null
          payment_method_code?: string | null
          payment_receipt_path?: string | null
          payment_status?: string
          shipping_fee?: number
          shipping_zone_id?: string | null
          status?: string
          subtotal?: number | null
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          correlation_id?: string
          created_at?: string
          customer_address?: string
          customer_name?: string
          customer_phone?: string
          discount_amount?: number
          discount_code?: string | null
          id?: string
          items?: Json
          notes?: string | null
          payment_method_code?: string | null
          payment_receipt_path?: string | null
          payment_status?: string
          shipping_fee?: number
          shipping_zone_id?: string | null
          status?: string
          subtotal?: number | null
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_payment_method_code_fkey"
            columns: ["payment_method_code"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "orders_shipping_zone_id_fkey"
            columns: ["shipping_zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_audit_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          organization_id: string
          payload: Json
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          organization_id: string
          payload?: Json
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          organization_id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "organization_audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          branch_scope: string[]
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_scope?: string[]
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_scope?: string[]
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          features: Json
          limits: Json
          organization_id: string
          plan: string
          status: string
          trial_ends_at: string | null
          updated_at: string
          usage: Json
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          features?: Json
          limits?: Json
          organization_id: string
          plan?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          usage?: Json
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          features?: Json
          limits?: Json
          organization_id?: string
          plan?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          usage?: Json
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          name: string
          status: string
          type: Database["public"]["Enums"]["organization_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          name: string
          status?: string
          type: Database["public"]["Enums"]["organization_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          name?: string
          status?: string
          type?: Database["public"]["Enums"]["organization_type"]
          updated_at?: string
        }
        Relationships: []
      }
      patient_allergies: {
        Row: {
          allergen: string
          created_at: string
          id: string
          notes: string | null
          patient_id: string
          reaction: string | null
          recorded_at: string
          recorded_by: string | null
          severity: string
          updated_at: string
        }
        Insert: {
          allergen: string
          created_at?: string
          id?: string
          notes?: string | null
          patient_id: string
          reaction?: string | null
          recorded_at?: string
          recorded_by?: string | null
          severity?: string
          updated_at?: string
        }
        Update: {
          allergen?: string
          created_at?: string
          id?: string
          notes?: string | null
          patient_id?: string
          reaction?: string | null
          recorded_at?: string
          recorded_by?: string | null
          severity?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_allergies_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "hc_patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_chronic_medications: {
        Row: {
          created_at: string
          dose: string | null
          id: string
          is_active: boolean
          medicine_name: string
          notes: string | null
          profile_id: string | null
          schedule_preset: string
          start_date: string | null
          times_per_day: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dose?: string | null
          id?: string
          is_active?: boolean
          medicine_name: string
          notes?: string | null
          profile_id?: string | null
          schedule_preset?: string
          start_date?: string | null
          times_per_day?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dose?: string | null
          id?: string
          is_active?: boolean
          medicine_name?: string
          notes?: string | null
          profile_id?: string | null
          schedule_preset?: string
          start_date?: string | null
          times_per_day?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_chronic_medications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "family_health_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_conditions: {
        Row: {
          condition_name: string
          created_at: string
          icd10: string | null
          id: string
          notes: string | null
          onset_date: string | null
          patient_id: string
          recorded_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          condition_name: string
          created_at?: string
          icd10?: string | null
          id?: string
          notes?: string | null
          onset_date?: string | null
          patient_id: string
          recorded_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          condition_name?: string
          created_at?: string
          icd10?: string | null
          id?: string
          notes?: string | null
          onset_date?: string | null
          patient_id?: string
          recorded_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_conditions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "hc_patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_consents: {
        Row: {
          active: boolean
          created_at: string
          expires_at: string | null
          granted_to_id: string
          granted_to_type: string
          id: string
          patient_id: string
          revoked_at: string | null
          scope: Json
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          expires_at?: string | null
          granted_to_id: string
          granted_to_type: string
          id?: string
          patient_id: string
          revoked_at?: string | null
          scope?: Json
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          expires_at?: string | null
          granted_to_id?: string
          granted_to_type?: string
          id?: string
          patient_id?: string
          revoked_at?: string | null
          scope?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_consents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "hc_patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_emergency_contacts: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          name: string
          patient_id: string
          phone: string
          relation: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          name: string
          patient_id: string
          phone: string
          relation?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          name?: string
          patient_id?: string
          phone?: string
          relation?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_emergency_contacts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "hc_patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_health_events: {
        Row: {
          created_at: string
          event_date: string
          event_type: string
          id: string
          patient_id: string
          payload: Json
          source_id: string | null
          source_table: string | null
          summary: string
        }
        Insert: {
          created_at?: string
          event_date?: string
          event_type: string
          id?: string
          patient_id: string
          payload?: Json
          source_id?: string | null
          source_table?: string | null
          summary: string
        }
        Update: {
          created_at?: string
          event_date?: string
          event_type?: string
          id?: string
          patient_id?: string
          payload?: Json
          source_id?: string | null
          source_table?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_health_events_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "hc_patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_medications: {
        Row: {
          active: boolean
          created_at: string
          dosage: string | null
          end_date: string | null
          frequency: string | null
          id: string
          medicine_entity_id: string | null
          medicine_name: string
          notes: string | null
          patient_id: string
          prescribed_by_doctor_id: string | null
          route: string | null
          source: string
          start_date: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          dosage?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          medicine_entity_id?: string | null
          medicine_name: string
          notes?: string | null
          patient_id: string
          prescribed_by_doctor_id?: string | null
          route?: string | null
          source?: string
          start_date?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          dosage?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          medicine_entity_id?: string | null
          medicine_name?: string
          notes?: string | null
          patient_id?: string
          prescribed_by_doctor_id?: string | null
          route?: string | null
          source?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_medications_medicine_entity_id_fkey"
            columns: ["medicine_entity_id"]
            isOneToOne: false
            referencedRelation: "medical_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_medications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "hc_patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_medications_prescribed_by_doctor_id_fkey"
            columns: ["prescribed_by_doctor_id"]
            isOneToOne: false
            referencedRelation: "hc_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_medications_prescribed_by_doctor_id_fkey"
            columns: ["prescribed_by_doctor_id"]
            isOneToOne: false
            referencedRelation: "hc_doctors_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          code: string
          created_at: string
          description_ar: string | null
          id: string
          instructions_ar: string | null
          is_active: boolean
          metadata: Json
          name_ar: string
          name_en: string | null
          requires_receipt: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description_ar?: string | null
          id?: string
          instructions_ar?: string | null
          is_active?: boolean
          metadata?: Json
          name_ar: string
          name_en?: string | null
          requires_receipt?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description_ar?: string | null
          id?: string
          instructions_ar?: string | null
          is_active?: boolean
          metadata?: Json
          name_ar?: string
          name_en?: string | null
          requires_receipt?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          currency: string
          id: string
          method: string
          order_id: string | null
          payment_details: Json
          receipt_url: string | null
          status: string
          transaction_ref: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          method: string
          order_id?: string | null
          payment_details?: Json
          receipt_url?: string | null
          status?: string
          transaction_ref?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          method?: string
          order_id?: string | null
          payment_details?: Json
          receipt_url?: string | null
          status?: string
          transaction_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          created_at: string
          description: string | null
          key: string
          resource: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          key: string
          resource: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          key?: string
          resource?: string
        }
        Relationships: []
      }
      pn_pharmacies: {
        Row: {
          address: string | null
          bio_ar: string | null
          city: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          district: string | null
          email: string | null
          id: string
          is_24_7: boolean
          is_public: boolean
          lat: number | null
          lng: number | null
          logo_url: string | null
          metadata: Json
          name_ar: string
          name_en: string | null
          organization_id: string | null
          phone: string | null
          slug: string
          updated_at: string
          verification_status: Database["public"]["Enums"]["pn_verification_status"]
          verified_at: string | null
          verified_by: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          bio_ar?: string | null
          city?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          district?: string | null
          email?: string | null
          id?: string
          is_24_7?: boolean
          is_public?: boolean
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          metadata?: Json
          name_ar: string
          name_en?: string | null
          organization_id?: string | null
          phone?: string | null
          slug: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["pn_verification_status"]
          verified_at?: string | null
          verified_by?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          bio_ar?: string | null
          city?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          district?: string | null
          email?: string | null
          id?: string
          is_24_7?: boolean
          is_public?: boolean
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          metadata?: Json
          name_ar?: string
          name_en?: string | null
          organization_id?: string | null
          phone?: string | null
          slug?: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["pn_verification_status"]
          verified_at?: string | null
          verified_by?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pn_pharmacies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pn_pharmacy_hours: {
        Row: {
          close_time: string | null
          created_at: string
          id: string
          is_closed: boolean
          open_time: string | null
          pharmacy_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          close_time?: string | null
          created_at?: string
          id?: string
          is_closed?: boolean
          open_time?: string | null
          pharmacy_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          close_time?: string | null
          created_at?: string
          id?: string
          is_closed?: boolean
          open_time?: string | null
          pharmacy_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "pn_pharmacy_hours_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pn_pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      pn_pharmacy_stock: {
        Row: {
          availability: Database["public"]["Enums"]["pn_availability"]
          catalog_product_id: string
          created_at: string
          expiry_date: string | null
          id: string
          notes: string | null
          pharmacy_id: string
          price_visible: boolean
          price_yer: number | null
          updated_at: string
        }
        Insert: {
          availability?: Database["public"]["Enums"]["pn_availability"]
          catalog_product_id: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          notes?: string | null
          pharmacy_id: string
          price_visible?: boolean
          price_yer?: number | null
          updated_at?: string
        }
        Update: {
          availability?: Database["public"]["Enums"]["pn_availability"]
          catalog_product_id?: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          notes?: string | null
          pharmacy_id?: string
          price_visible?: boolean
          price_yer?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pn_pharmacy_stock_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pn_pharmacy_stock_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pn_pharmacy_stock_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pn_pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      pn_transfer_requests: {
        Row: {
          catalog_product_id: string
          created_at: string
          from_pharmacy_id: string
          id: string
          notes: string | null
          qty: number
          reason: Database["public"]["Enums"]["pn_transfer_reason"]
          requested_by: string
          responded_at: string | null
          responded_by: string | null
          status: Database["public"]["Enums"]["pn_transfer_status"]
          to_pharmacy_id: string
          updated_at: string
        }
        Insert: {
          catalog_product_id: string
          created_at?: string
          from_pharmacy_id: string
          id?: string
          notes?: string | null
          qty: number
          reason?: Database["public"]["Enums"]["pn_transfer_reason"]
          requested_by: string
          responded_at?: string | null
          responded_by?: string | null
          status?: Database["public"]["Enums"]["pn_transfer_status"]
          to_pharmacy_id: string
          updated_at?: string
        }
        Update: {
          catalog_product_id?: string
          created_at?: string
          from_pharmacy_id?: string
          id?: string
          notes?: string | null
          qty?: number
          reason?: Database["public"]["Enums"]["pn_transfer_reason"]
          requested_by?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: Database["public"]["Enums"]["pn_transfer_status"]
          to_pharmacy_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pn_transfer_requests_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pn_transfer_requests_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pn_transfer_requests_from_pharmacy_id_fkey"
            columns: ["from_pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pn_pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pn_transfer_requests_to_pharmacy_id_fkey"
            columns: ["to_pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pn_pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      pn_verification_requests: {
        Row: {
          created_at: string
          documents: Json
          id: string
          notes: string | null
          pharmacy_id: string
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          status: Database["public"]["Enums"]["pn_verification_status"]
          submitted_by: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          documents?: Json
          id?: string
          notes?: string | null
          pharmacy_id: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["pn_verification_status"]
          submitted_by: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          documents?: Json
          id?: string
          notes?: string | null
          pharmacy_id?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["pn_verification_status"]
          submitted_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pn_verification_requests_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pn_pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_escalations: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          id: string
          prescription_id: string
          reason: string
          resolution_note: string | null
          resolved_at: string | null
          status: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          prescription_id: string
          reason: string
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          prescription_id?: string
          reason?: string
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_escalations_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_extractions: {
        Row: {
          allergies: Json
          attempts: number
          confidence: number | null
          created_at: string
          diagnosis: string | null
          doctor_name: string | null
          error: string | null
          id: string
          interactions: Json
          medications: Json
          model_tier: string
          model_used: string | null
          next_attempt_at: string
          prescription_date: string | null
          prescription_file_id: string
          prescription_id: string
          raw_response: Json | null
          reviewer_approved_at: string | null
          reviewer_approved_by: string | null
          reviewer_edits: Json | null
          source_type: string
          status: string
          updated_at: string
        }
        Insert: {
          allergies?: Json
          attempts?: number
          confidence?: number | null
          created_at?: string
          diagnosis?: string | null
          doctor_name?: string | null
          error?: string | null
          id?: string
          interactions?: Json
          medications?: Json
          model_tier?: string
          model_used?: string | null
          next_attempt_at?: string
          prescription_date?: string | null
          prescription_file_id: string
          prescription_id: string
          raw_response?: Json | null
          reviewer_approved_at?: string | null
          reviewer_approved_by?: string | null
          reviewer_edits?: Json | null
          source_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          allergies?: Json
          attempts?: number
          confidence?: number | null
          created_at?: string
          diagnosis?: string | null
          doctor_name?: string | null
          error?: string | null
          id?: string
          interactions?: Json
          medications?: Json
          model_tier?: string
          model_used?: string | null
          next_attempt_at?: string
          prescription_date?: string | null
          prescription_file_id?: string
          prescription_id?: string
          raw_response?: Json | null
          reviewer_approved_at?: string | null
          reviewer_approved_by?: string | null
          reviewer_edits?: Json | null
          source_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_extractions_prescription_file_id_fkey"
            columns: ["prescription_file_id"]
            isOneToOne: false
            referencedRelation: "prescription_files"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_files: {
        Row: {
          bucket: string
          created_at: string
          deleted_at: string | null
          id: string
          legacy_blob_id: string | null
          mime_type: string
          object_path: string
          prescription_id: string
          review_status: string
          sha256: string | null
          size_bytes: number
          storage_provider: string
          updated_at: string
          uploaded_by: string | null
          uploaded_via: string
        }
        Insert: {
          bucket?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          legacy_blob_id?: string | null
          mime_type: string
          object_path: string
          prescription_id: string
          review_status?: string
          sha256?: string | null
          size_bytes: number
          storage_provider?: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_via?: string
        }
        Update: {
          bucket?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          legacy_blob_id?: string | null
          mime_type?: string
          object_path?: string
          prescription_id?: string
          review_status?: string
          sha256?: string | null
          size_bytes?: number
          storage_provider?: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_via?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_files_legacy_blob_id_fkey"
            columns: ["legacy_blob_id"]
            isOneToOne: false
            referencedRelation: "prescription_image_blobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_files_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_image_blobs: {
        Row: {
          byte_size: number
          content_bytes: string
          content_type: string
          created_at: string
          id: string
          rx_id: string
          sha256: string
          storage_path: string
        }
        Insert: {
          byte_size: number
          content_bytes: string
          content_type?: string
          created_at?: string
          id?: string
          rx_id: string
          sha256: string
          storage_path: string
        }
        Update: {
          byte_size?: number
          content_bytes?: string
          content_type?: string
          created_at?: string
          id?: string
          rx_id?: string
          sha256?: string
          storage_path?: string
        }
        Relationships: []
      }
      prescription_orders: {
        Row: {
          created_at: string
          extracted_medicines: Json | null
          extracted_text: string | null
          id: string
          image_url: string
          is_valid: boolean | null
          missing_medicines: string[] | null
          pharmacist_notes: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          extracted_medicines?: Json | null
          extracted_text?: string | null
          id?: string
          image_url: string
          is_valid?: boolean | null
          missing_medicines?: string[] | null
          pharmacist_notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          extracted_medicines?: Json | null
          extracted_text?: string | null
          id?: string
          image_url?: string
          is_valid?: boolean | null
          missing_medicines?: string[] | null
          pharmacist_notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      prescription_reviews: {
        Row: {
          assigned_at: string | null
          completed_at: string | null
          created_at: string
          id: string
          prescription_id: string
          review_notes: string | null
          reviewer_id: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          prescription_id: string
          review_notes?: string | null
          reviewer_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          prescription_id?: string
          review_notes?: string | null
          reviewer_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_reviews_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: true
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          created_at: string
          customer_address: string
          customer_name: string
          customer_phone: string
          id: string
          image_urls: string[]
          notes: string | null
          status: string
        }
        Insert: {
          created_at?: string
          customer_address: string
          customer_name: string
          customer_phone: string
          id: string
          image_urls?: string[]
          notes?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          customer_address?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          image_urls?: string[]
          notes?: string | null
          status?: string
        }
        Relationships: []
      }
      privileged_definer_functions: {
        Row: {
          created_at: string
          function_signature: string
          reason: string
        }
        Insert: {
          created_at?: string
          function_signature: string
          reason: string
        }
        Update: {
          created_at?: string
          function_signature?: string
          reason?: string
        }
        Relationships: []
      }
      product_classifications: {
        Row: {
          active_ingredient: string | null
          ai_model: string | null
          ai_raw: Json | null
          complementary_legacy_ids: number[]
          conditions: string[]
          confidence: number
          created_at: string
          generic_name: string | null
          id: string
          is_chronic: boolean
          pharmacological_class: string | null
          product_legacy_id: number
          related_legacy_ids: number[]
          requires_prescription: boolean
          reviewed_at: string | null
          reviewer_id: string | null
          status: Database["public"]["Enums"]["classification_status"]
          therapeutic_category:
            | Database["public"]["Enums"]["therapeutic_category"]
            | null
          updated_at: string
        }
        Insert: {
          active_ingredient?: string | null
          ai_model?: string | null
          ai_raw?: Json | null
          complementary_legacy_ids?: number[]
          conditions?: string[]
          confidence?: number
          created_at?: string
          generic_name?: string | null
          id?: string
          is_chronic?: boolean
          pharmacological_class?: string | null
          product_legacy_id: number
          related_legacy_ids?: number[]
          requires_prescription?: boolean
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["classification_status"]
          therapeutic_category?:
            | Database["public"]["Enums"]["therapeutic_category"]
            | null
          updated_at?: string
        }
        Update: {
          active_ingredient?: string | null
          ai_model?: string | null
          ai_raw?: Json | null
          complementary_legacy_ids?: number[]
          conditions?: string[]
          confidence?: number
          created_at?: string
          generic_name?: string | null
          id?: string
          is_chronic?: boolean
          pharmacological_class?: string | null
          product_legacy_id?: number
          related_legacy_ids?: number[]
          requires_prescription?: boolean
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["classification_status"]
          therapeutic_category?:
            | Database["public"]["Enums"]["therapeutic_category"]
            | null
          updated_at?: string
        }
        Relationships: []
      }
      product_gallery_images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          image_url: string
          product_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_url: string
          product_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_url?: string
          product_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_gallery_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_image_overrides: {
        Row: {
          dedupe_key: string
          fetched_at: string
          found: boolean
          image_url: string | null
          source: string
          updated_by: string | null
        }
        Insert: {
          dedupe_key: string
          fetched_at?: string
          found?: boolean
          image_url?: string | null
          source?: string
          updated_by?: string | null
        }
        Update: {
          dedupe_key?: string
          fetched_at?: string
          found?: boolean
          image_url?: string | null
          source?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          badge: string | null
          brand: string | null
          category: string
          created_at: string
          description: string | null
          expiry_date: string | null
          id: string
          image_url: string | null
          inventory_migration_group: string | null
          is_active: boolean
          is_published: boolean
          last_restocked_at: string | null
          legacy_id: number | null
          name: string
          old_price: number | null
          price: number
          reorder_point: number
          reorder_threshold: number
          sort_order: number
          stock_qty: number
          supplier_cost: number | null
          supplier_name: string | null
          track_stock: boolean
          updated_at: string
        }
        Insert: {
          badge?: string | null
          brand?: string | null
          category: string
          created_at?: string
          description?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          inventory_migration_group?: string | null
          is_active?: boolean
          is_published?: boolean
          last_restocked_at?: string | null
          legacy_id?: number | null
          name: string
          old_price?: number | null
          price?: number
          reorder_point?: number
          reorder_threshold?: number
          sort_order?: number
          stock_qty?: number
          supplier_cost?: number | null
          supplier_name?: string | null
          track_stock?: boolean
          updated_at?: string
        }
        Update: {
          badge?: string | null
          brand?: string | null
          category?: string
          created_at?: string
          description?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          inventory_migration_group?: string | null
          is_active?: boolean
          is_published?: boolean
          last_restocked_at?: string | null
          legacy_id?: number | null
          name?: string
          old_price?: number | null
          price?: number
          reorder_point?: number
          reorder_threshold?: number
          sort_order?: number
          stock_qty?: number
          supplier_cost?: number | null
          supplier_name?: string | null
          track_stock?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          family_name: string | null
          father_name: string | null
          first_name: string | null
          id: string
          metadata: Json
          notification_prefs: Json
          phone: string | null
          preferred_language: string
          profile_completed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          family_name?: string | null
          father_name?: string | null
          first_name?: string | null
          id: string
          metadata?: Json
          notification_prefs?: Json
          phone?: string | null
          preferred_language?: string
          profile_completed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          family_name?: string | null
          father_name?: string | null
          first_name?: string | null
          id?: string
          metadata?: Json
          notification_prefs?: Json
          phone?: string | null
          preferred_language?: string
          profile_completed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      provider_ranking_scores: {
        Row: {
          computed_at: string
          factors: Json
          id: string
          level: string
          provider_id: string
          provider_kind: string
          rating: number | null
          response_rate: number | null
          reviews_count: number | null
          score: number
          verified: boolean | null
          years_experience: number | null
        }
        Insert: {
          computed_at?: string
          factors?: Json
          id?: string
          level?: string
          provider_id: string
          provider_kind: string
          rating?: number | null
          response_rate?: number | null
          reviews_count?: number | null
          score?: number
          verified?: boolean | null
          years_experience?: number | null
        }
        Update: {
          computed_at?: string
          factors?: Json
          id?: string
          level?: string
          provider_id?: string
          provider_kind?: string
          rating?: number | null
          response_rate?: number | null
          reviews_count?: number | null
          score?: number
          verified?: boolean | null
          years_experience?: number | null
        }
        Relationships: []
      }
      purchase_order_lines: {
        Row: {
          batch_no: string | null
          created_at: string
          expiry_date: string | null
          id: string
          line_no: number
          metadata: Json
          po_id: string
          product_id: string
          qty_ordered: number
          qty_received: number
          unit_cost: number
          updated_at: string
        }
        Insert: {
          batch_no?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          line_no: number
          metadata?: Json
          po_id: string
          product_id: string
          qty_ordered: number
          qty_received?: number
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          batch_no?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          line_no?: number
          metadata?: Json
          po_id?: string
          product_id?: string
          qty_ordered?: number
          qty_received?: number
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          code: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          metadata: Json
          notes: string | null
          organization_id: string
          received_at: string | null
          status: Database["public"]["Enums"]["po_status"]
          supplier_id: string
          total_amount: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          metadata?: Json
          notes?: string | null
          organization_id: string
          received_at?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          supplier_id: string
          total_amount?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          metadata?: Json
          notes?: string | null
          organization_id?: string
          received_at?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          supplier_id?: string
          total_amount?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "sup_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "wh_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_recommendations: {
        Row: {
          created_at: string
          expected_stockout_at: string | null
          id: string
          preferred_supplier_id: string | null
          product_id: string
          reason: string
          recommended_qty: number
          resolved_at: string | null
          status: string
          urgency: string
        }
        Insert: {
          created_at?: string
          expected_stockout_at?: string | null
          id?: string
          preferred_supplier_id?: string | null
          product_id: string
          reason: string
          recommended_qty: number
          resolved_at?: string | null
          status?: string
          urgency: string
        }
        Update: {
          created_at?: string
          expected_stockout_at?: string | null
          id?: string
          preferred_supplier_id?: string | null
          product_id?: string
          reason?: string
          recommended_qty?: number
          resolved_at?: string | null
          status?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_recommendations_preferred_supplier_id_fkey"
            columns: ["preferred_supplier_id"]
            isOneToOne: false
            referencedRelation: "sup_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_recommendations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          active: boolean
          auth: string
          endpoint: string
          fail_count: number
          id: string
          last_success_at: string | null
          p256dh: string
          subscribed_at: string
          unsubscribed_at: string | null
          user_agent: string | null
          user_id: string | null
          visitor_token: string | null
        }
        Insert: {
          active?: boolean
          auth: string
          endpoint: string
          fail_count?: number
          id?: string
          last_success_at?: string | null
          p256dh: string
          subscribed_at?: string
          unsubscribed_at?: string | null
          user_agent?: string | null
          user_id?: string | null
          visitor_token?: string | null
        }
        Update: {
          active?: boolean
          auth?: string
          endpoint?: string
          fail_count?: number
          id?: string
          last_success_at?: string | null
          p256dh?: string
          subscribed_at?: string
          unsubscribed_at?: string | null
          user_agent?: string | null
          user_id?: string | null
          visitor_token?: string | null
        }
        Relationships: []
      }
      rate_limit_buckets: {
        Row: {
          count: number
          key: string
          updated_at: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          updated_at?: string
          window_start?: string
        }
        Update: {
          count?: number
          key?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      retention_config: {
        Row: {
          archive_enabled: boolean
          email_alerts_enabled: boolean
          email_cooldown_minutes: number
          email_recipients: string[]
          error_logs_archive_days: number
          error_logs_days: number
          id: number
          incidents_archive_days: number
          incidents_days: number
          updated_at: string
          uptime_checks_days: number
        }
        Insert: {
          archive_enabled?: boolean
          email_alerts_enabled?: boolean
          email_cooldown_minutes?: number
          email_recipients?: string[]
          error_logs_archive_days?: number
          error_logs_days?: number
          id?: number
          incidents_archive_days?: number
          incidents_days?: number
          updated_at?: string
          uptime_checks_days?: number
        }
        Update: {
          archive_enabled?: boolean
          email_alerts_enabled?: boolean
          email_cooldown_minutes?: number
          email_recipients?: string[]
          error_logs_archive_days?: number
          error_logs_days?: number
          id?: number
          incidents_archive_days?: number
          incidents_days?: number
          updated_at?: string
          uptime_checks_days?: number
        }
        Relationships: []
      }
      retention_policies: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          last_deleted: number | null
          last_error: string | null
          last_run_at: string | null
          retain_days: number
          table_name: string
          timestamp_column: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_deleted?: number | null
          last_error?: string | null
          last_run_at?: string | null
          retain_days: number
          table_name: string
          timestamp_column?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_deleted?: number | null
          last_error?: string | null
          last_run_at?: string | null
          retain_days?: number
          table_name?: string
          timestamp_column?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          is_approved: boolean
          order_id: string | null
          product_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          order_id?: string | null
          product_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          order_id?: string | null
          product_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_key: string
          role: Database["public"]["Enums"]["org_role"]
        }
        Insert: {
          permission_key: string
          role: Database["public"]["Enums"]["org_role"]
        }
        Update: {
          permission_key?: string
          role?: Database["public"]["Enums"]["org_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      seedance_generations: {
        Row: {
          aspect_ratio: string
          created_at: string
          error_message: string | null
          id: string
          job_id: string
          prompt: string
          seconds: number
          status: string
          storage_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          aspect_ratio?: string
          created_at?: string
          error_message?: string | null
          id?: string
          job_id: string
          prompt: string
          seconds?: number
          status?: string
          storage_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          aspect_ratio?: string
          created_at?: string
          error_message?: string | null
          id?: string
          job_id?: string
          prompt?: string
          seconds?: number
          status?: string
          storage_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shipping_zones: {
        Row: {
          code: string
          created_at: string
          currency: string
          estimated_days: string | null
          fee: number
          id: string
          is_active: boolean
          name_ar: string
          name_en: string | null
          regions: string[]
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string
          estimated_days?: string | null
          fee?: number
          id?: string
          is_active?: boolean
          name_ar: string
          name_en?: string | null
          regions?: string[]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          estimated_days?: string | null
          fee?: number
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string | null
          regions?: string[]
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      social_post_attempts: {
        Row: {
          attempt_no: number
          created_at: string
          error_message: string | null
          external_id: string | null
          hmac_valid: boolean | null
          id: string
          idempotent_skip: boolean
          post_id: string
          request_payload: Json | null
          response_body: string | null
          response_status: number | null
          source: string
          status: string
        }
        Insert: {
          attempt_no: number
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          hmac_valid?: boolean | null
          id?: string
          idempotent_skip?: boolean
          post_id: string
          request_payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          source?: string
          status: string
        }
        Update: {
          attempt_no?: number
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          hmac_valid?: boolean | null
          id?: string
          idempotent_skip?: boolean
          post_id?: string
          request_payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_post_attempts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_post_stats: {
        Row: {
          collected_at: string
          comments: number
          id: string
          likes: number
          post_id: string
          shares: number
          views: number
        }
        Insert: {
          collected_at?: string
          comments?: number
          id?: string
          likes?: number
          post_id: string
          shares?: number
          views?: number
        }
        Update: {
          collected_at?: string
          comments?: number
          id?: string
          likes?: number
          post_id?: string
          shares?: number
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "social_post_stats_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          attempt_count: number
          caption: string
          confidence_score: number | null
          created_at: string
          cta: string | null
          error_message: string | null
          external_id: string | null
          generation_version: string | null
          hashtags: string[]
          id: string
          last_attempt_at: string | null
          last_error: string | null
          model_version: string | null
          next_retry_at: string | null
          platform: string
          product_id: string | null
          published_at: string | null
          ranking_version: string | null
          scheduled_for: string | null
          status: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          attempt_count?: number
          caption: string
          confidence_score?: number | null
          created_at?: string
          cta?: string | null
          error_message?: string | null
          external_id?: string | null
          generation_version?: string | null
          hashtags?: string[]
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          model_version?: string | null
          next_retry_at?: string | null
          platform: string
          product_id?: string | null
          published_at?: string | null
          ranking_version?: string | null
          scheduled_for?: string | null
          status?: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          attempt_count?: number
          caption?: string
          confidence_score?: number | null
          created_at?: string
          cta?: string | null
          error_message?: string | null
          external_id?: string | null
          generation_version?: string | null
          hashtags?: string[]
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          model_version?: string | null
          next_retry_at?: string | null
          platform?: string
          product_id?: string | null
          published_at?: string | null
          ranking_version?: string | null
          scheduled_for?: string | null
          status?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          body: string | null
          channels: string[]
          correlation_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          kind: string
          payload: Json
          severity: string
          title: string
          whatsapp_attempts: number
          whatsapp_last_error: string | null
          whatsapp_status: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          body?: string | null
          channels?: string[]
          correlation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          kind: string
          payload?: Json
          severity?: string
          title: string
          whatsapp_attempts?: number
          whatsapp_last_error?: string | null
          whatsapp_status?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          body?: string | null
          channels?: string[]
          correlation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          kind?: string
          payload?: Json
          severity?: string
          title?: string
          whatsapp_attempts?: number
          whatsapp_last_error?: string | null
          whatsapp_status?: string | null
        }
        Relationships: []
      }
      staff_permissions: {
        Row: {
          created_at: string
          id: string
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          user_id?: string
        }
        Relationships: []
      }
      stock_subscriptions: {
        Row: {
          active: boolean
          created_at: string
          id: string
          notified_at: string | null
          phone_number: string
          product_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          notified_at?: string | null
          phone_number: string
          product_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          notified_at?: string | null
          phone_number?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_watch_requests: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          notified_at: string | null
          phone: string
          product_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          notified_at?: string | null
          phone: string
          product_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          notified_at?: string | null
          phone?: string
          product_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_watch_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_watch_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_bundle_orders: {
        Row: {
          bundle_id: string | null
          bundle_title: string | null
          created_at: string
          full_name: string
          id: string
          notes: string | null
          phone: string
          status: string
          updated_at: string
        }
        Insert: {
          bundle_id?: string | null
          bundle_title?: string | null
          created_at?: string
          full_name: string
          id?: string
          notes?: string | null
          phone: string
          status?: string
          updated_at?: string
        }
        Update: {
          bundle_id?: string | null
          bundle_title?: string | null
          created_at?: string
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_bundle_orders_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "store_health_bundles"
            referencedColumns: ["id"]
          },
        ]
      }
      store_health_bundle_items: {
        Row: {
          bundle_id: string
          created_at: string
          id: string
          label_ar: string
          product_id: string | null
          quantity: number
          updated_at: string
        }
        Insert: {
          bundle_id: string
          created_at?: string
          id?: string
          label_ar: string
          product_id?: string | null
          quantity?: number
          updated_at?: string
        }
        Update: {
          bundle_id?: string
          created_at?: string
          id?: string
          label_ar?: string
          product_id?: string | null
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_health_bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "store_health_bundles"
            referencedColumns: ["id"]
          },
        ]
      }
      store_health_bundles: {
        Row: {
          bundle_price: number | null
          created_at: string
          description_ar: string | null
          discount_label: string | null
          id: string
          image_url: string | null
          is_active: boolean
          slug: string
          sort_order: number
          title_ar: string
          updated_at: string
        }
        Insert: {
          bundle_price?: number | null
          created_at?: string
          description_ar?: string | null
          discount_label?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          slug: string
          sort_order?: number
          title_ar: string
          updated_at?: string
        }
        Update: {
          bundle_price?: number | null
          created_at?: string
          description_ar?: string | null
          discount_label?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          slug?: string
          sort_order?: number
          title_ar?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_prescription_uploads: {
        Row: {
          created_at: string
          file_name: string | null
          file_path: string | null
          full_name: string
          handled_by: string | null
          id: string
          notes: string | null
          phone: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          full_name: string
          handled_by?: string | null
          id?: string
          notes?: string | null
          phone: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          full_name?: string
          handled_by?: string | null
          id?: string
          notes?: string | null
          phone?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_refill_subscriptions: {
        Row: {
          condition_tag: string | null
          created_at: string
          full_name: string
          id: string
          interval_days: number
          next_reminder_at: string
          phone: string
          product_id: string | null
          product_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          condition_tag?: string | null
          created_at?: string
          full_name: string
          id?: string
          interval_days?: number
          next_reminder_at?: string
          phone: string
          product_id?: string | null
          product_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          condition_tag?: string | null
          created_at?: string
          full_name?: string
          id?: string
          interval_days?: number
          next_reminder_at?: string
          phone?: string
          product_id?: string | null
          product_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      sun_decisions: {
        Row: {
          agent_dispatched: string | null
          confidence: number | null
          created_at: string
          decision: Json
          event_id: string | null
          event_name: string
          id: string
          latency_ms: number | null
          outcome: string
          reasoning: string | null
        }
        Insert: {
          agent_dispatched?: string | null
          confidence?: number | null
          created_at?: string
          decision?: Json
          event_id?: string | null
          event_name: string
          id?: string
          latency_ms?: number | null
          outcome?: string
          reasoning?: string | null
        }
        Update: {
          agent_dispatched?: string | null
          confidence?: number | null
          created_at?: string
          decision?: Json
          event_id?: string | null
          event_name?: string
          id?: string
          latency_ms?: number | null
          outcome?: string
          reasoning?: string | null
        }
        Relationships: []
      }
      sun_memory: {
        Row: {
          created_at: string
          id: string
          key: string
          last_seen_at: string
          scope: string
          subject_id: string
          updated_at: string
          value: Json
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          last_seen_at?: string
          scope: string
          subject_id: string
          updated_at?: string
          value?: Json
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          last_seen_at?: string
          scope?: string
          subject_id?: string
          updated_at?: string
          value?: Json
          weight?: number
        }
        Relationships: []
      }
      sup_supplier_products: {
        Row: {
          created_at: string
          default_cost: number | null
          id: string
          lead_time_days: number | null
          metadata: Json
          min_order_qty: number | null
          product_id: string
          supplier_id: string
          supplier_sku: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_cost?: number | null
          id?: string
          lead_time_days?: number | null
          metadata?: Json
          min_order_qty?: number | null
          product_id: string
          supplier_id: string
          supplier_sku?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_cost?: number | null
          id?: string
          lead_time_days?: number | null
          metadata?: Json
          min_order_qty?: number | null
          product_id?: string
          supplier_id?: string
          supplier_sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sup_supplier_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sup_supplier_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sup_supplier_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "sup_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sup_suppliers: {
        Row: {
          code: string | null
          contact: Json
          created_at: string
          created_by: string | null
          id: string
          legal_name: string | null
          metadata: Json
          name: string
          organization_id: string
          status: Database["public"]["Enums"]["sup_status"]
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          contact?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          legal_name?: string | null
          metadata?: Json
          name: string
          organization_id: string
          status?: Database["public"]["Enums"]["sup_status"]
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          contact?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          legal_name?: string | null
          metadata?: Json
          name?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["sup_status"]
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sup_suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_link_audit: {
        Row: {
          after_supplier_cost: number | null
          after_supplier_name: string | null
          batch_id: string
          before_supplier_cost: number | null
          before_supplier_name: string | null
          created_at: string
          id: string
          performed_by: string | null
          product_id: string
          reason: string | null
          rolled_back_at: string | null
          rolled_back_by: string | null
        }
        Insert: {
          after_supplier_cost?: number | null
          after_supplier_name?: string | null
          batch_id?: string
          before_supplier_cost?: number | null
          before_supplier_name?: string | null
          created_at?: string
          id?: string
          performed_by?: string | null
          product_id: string
          reason?: string | null
          rolled_back_at?: string | null
          rolled_back_by?: string | null
        }
        Update: {
          after_supplier_cost?: number | null
          after_supplier_name?: string | null
          batch_id?: string
          before_supplier_cost?: number | null
          before_supplier_name?: string | null
          created_at?: string
          id?: string
          performed_by?: string | null
          product_id?: string
          reason?: string | null
          rolled_back_at?: string | null
          rolled_back_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_link_audit_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
      system_incidents: {
        Row: {
          dedupe_key: string
          evidence: Json
          id: string
          opened_at: string
          resolved_at: string | null
          severity: string
          source: string
          status: string
          summary: string | null
          title: string
        }
        Insert: {
          dedupe_key?: string
          evidence?: Json
          id?: string
          opened_at?: string
          resolved_at?: string | null
          severity?: string
          source: string
          status?: string
          summary?: string | null
          title: string
        }
        Update: {
          dedupe_key?: string
          evidence?: Json
          id?: string
          opened_at?: string
          resolved_at?: string | null
          severity?: string
          source?: string
          status?: string
          summary?: string | null
          title?: string
        }
        Relationships: []
      }
      telemedicine_sessions: {
        Row: {
          appointment_id: string | null
          created_at: string
          doctor_id: string
          ended_at: string | null
          id: string
          join_token: string
          metadata: Json
          notes: string | null
          patient_id: string
          scheduled_at: string | null
          session_type: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          doctor_id: string
          ended_at?: string | null
          id?: string
          join_token?: string
          metadata?: Json
          notes?: string | null
          patient_id: string
          scheduled_at?: string | null
          session_type?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          doctor_id?: string
          ended_at?: string | null
          id?: string
          join_token?: string
          metadata?: Json
          notes?: string | null
          patient_id?: string
          scheduled_at?: string | null
          session_type?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telemedicine_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "hc_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telemedicine_sessions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "hc_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telemedicine_sessions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "hc_doctors_public_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telemedicine_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "hc_patients"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_lookups: {
        Row: {
          count: number
          ip: string
          updated_at: string
          window_start: string
        }
        Insert: {
          count?: number
          ip: string
          updated_at?: string
          window_start?: string
        }
        Update: {
          count?: number
          ip?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      transfer_audit_log: {
        Row: {
          actor_user_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["transfer_status"] | null
          id: string
          metadata: Json
          reason: string | null
          to_status: Database["public"]["Enums"]["transfer_status"]
          transfer_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["transfer_status"] | null
          id?: string
          metadata?: Json
          reason?: string | null
          to_status: Database["public"]["Enums"]["transfer_status"]
          transfer_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["transfer_status"] | null
          id?: string
          metadata?: Json
          reason?: string | null
          to_status?: Database["public"]["Enums"]["transfer_status"]
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_audit_log_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "inventory_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_items: {
        Row: {
          id: string
          product_id: string
          qty_picked: number
          qty_received: number
          qty_requested: number
          transfer_id: string
        }
        Insert: {
          id?: string
          product_id: string
          qty_picked?: number
          qty_received?: number
          qty_requested: number
          transfer_id: string
        }
        Update: {
          id?: string
          product_id?: string
          qty_picked?: number
          qty_received?: number
          qty_requested?: number
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "inventory_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      trigger_metrics: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          payload: Json
          status: string
          trigger_name: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          payload?: Json
          status: string
          trigger_name: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          payload?: Json
          status?: string
          trigger_name?: string
        }
        Relationships: []
      }
      trust_pages: {
        Row: {
          contact: string
          cookies: string
          data_collection: string
          encryption: string
          incident_reporting: string
          intro: string
          retention: string
          slug: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          contact?: string
          cookies?: string
          data_collection?: string
          encryption?: string
          incident_reporting?: string
          intro?: string
          retention?: string
          slug: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          contact?: string
          cookies?: string
          data_collection?: string
          encryption?: string
          incident_reporting?: string
          intro?: string
          retention?: string
          slug?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      uptime_checks: {
        Row: {
          checked_at: string
          error: string | null
          id: string
          latency_ms: number | null
          ok: boolean
          region: string | null
        }
        Insert: {
          checked_at?: string
          error?: string | null
          id?: string
          latency_ms?: number | null
          ok: boolean
          region?: string | null
        }
        Update: {
          checked_at?: string
          error?: string | null
          id?: string
          latency_ms?: number | null
          ok?: boolean
          region?: string | null
        }
        Relationships: []
      }
      uptime_incidents: {
        Row: {
          created_at: string
          details: Json | null
          ended_at: string | null
          id: string
          severity: string
          started_at: string
          summary: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          ended_at?: string | null
          id?: string
          severity?: string
          started_at?: string
          summary: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          ended_at?: string | null
          id?: string
          severity?: string
          started_at?: string
          summary?: string
          updated_at?: string
        }
        Relationships: []
      }
      uptime_incidents_archive: {
        Row: {
          archived_at: string
          created_at: string
          details: Json | null
          ended_at: string | null
          id: string
          severity: string
          started_at: string
          summary: string
          updated_at: string
        }
        Insert: {
          archived_at?: string
          created_at?: string
          details?: Json | null
          ended_at?: string | null
          id?: string
          severity?: string
          started_at?: string
          summary: string
          updated_at?: string
        }
        Update: {
          archived_at?: string
          created_at?: string
          details?: Json | null
          ended_at?: string | null
          id?: string
          severity?: string
          started_at?: string
          summary?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_devices: {
        Row: {
          active: boolean
          created_at: string
          device_name: string | null
          fcm_token: string
          id: string
          platform: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          device_name?: string | null
          fcm_token: string
          id?: string
          platform?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          device_name?: string | null
          fcm_token?: string
          id?: string
          platform?: string | null
          updated_at?: string
          user_id?: string
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
      visitor_sessions: {
        Row: {
          browser: string | null
          country: string | null
          created_at: string
          device: string | null
          first_visit: boolean
          id: string
          interests: Json
          ip_hash: string | null
          language: string | null
          last_seen_at: string
          pages_viewed: Json
          visitor_token: string
        }
        Insert: {
          browser?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          first_visit?: boolean
          id?: string
          interests?: Json
          ip_hash?: string | null
          language?: string | null
          last_seen_at?: string
          pages_viewed?: Json
          visitor_token: string
        }
        Update: {
          browser?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          first_visit?: boolean
          id?: string
          interests?: Json
          ip_hash?: string | null
          language?: string | null
          last_seen_at?: string
          pages_viewed?: Json
          visitor_token?: string
        }
        Relationships: []
      }
      wa_allowlist: {
        Row: {
          created_at: string
          district: string
          is_active: boolean
          label: string | null
          phone: string
        }
        Insert: {
          created_at?: string
          district?: string
          is_active?: boolean
          label?: string | null
          phone: string
        }
        Update: {
          created_at?: string
          district?: string
          is_active?: boolean
          label?: string | null
          phone?: string
        }
        Relationships: []
      }
      wh_locations: {
        Row: {
          code: string
          created_at: string
          id: string
          label: string | null
          metadata: Json
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          label?: string | null
          metadata?: Json
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          label?: string | null
          metadata?: Json
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wh_locations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "wh_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      wh_warehouses: {
        Row: {
          address: string | null
          branch_id: string | null
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["wh_kind"]
          metadata: Json
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          branch_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["wh_kind"]
          metadata?: Json
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          branch_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["wh_kind"]
          metadata?: Json
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wh_warehouses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wh_warehouses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          last_intent: string | null
          last_message: string | null
          last_message_at: string
          metadata: Json
          phone_number: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          last_intent?: string | null
          last_message?: string | null
          last_message_at?: string
          metadata?: Json
          phone_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          last_intent?: string | null
          last_message?: string | null
          last_message_at?: string
          metadata?: Json
          phone_number?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_delivery_logs: {
        Row: {
          attempts: number
          correlation_id: string | null
          created_at: string
          delivered_at: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          idempotency_key: string | null
          last_attempt_at: string | null
          message_kind: string
          next_retry_at: string | null
          payload: Json
          read_at: string | null
          recipient_phone: string
          ref_id: string | null
          ref_kind: string | null
          sent_at: string | null
          status: string
          template_name: string | null
          wamid: string | null
        }
        Insert: {
          attempts?: number
          correlation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_attempt_at?: string | null
          message_kind: string
          next_retry_at?: string | null
          payload?: Json
          read_at?: string | null
          recipient_phone: string
          ref_id?: string | null
          ref_kind?: string | null
          sent_at?: string | null
          status?: string
          template_name?: string | null
          wamid?: string | null
        }
        Update: {
          attempts?: number
          correlation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_attempt_at?: string | null
          message_kind?: string
          next_retry_at?: string | null
          payload?: Json
          read_at?: string | null
          recipient_phone?: string
          ref_id?: string | null
          ref_kind?: string | null
          sent_at?: string | null
          status?: string
          template_name?: string | null
          wamid?: string | null
        }
        Relationships: []
      }
      whatsapp_escalations: {
        Row: {
          assigned_to: string | null
          conversation_id: string
          created_at: string
          id: string
          payload: Json
          reason: string
          resolved_at: string | null
          status: string
        }
        Insert: {
          assigned_to?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          payload?: Json
          reason: string
          resolved_at?: string | null
          status?: string
        }
        Update: {
          assigned_to?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          payload?: Json
          reason?: string
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_escalations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_events: {
        Row: {
          correlation_id: string | null
          created_at: string
          direction: string
          event_type: string
          from_number: string | null
          id: string
          message_id: string
          payload: Json
          phone_number_id: string | null
          processed_at: string
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string
          direction: string
          event_type: string
          from_number?: string | null
          id?: string
          message_id: string
          payload: Json
          phone_number_id?: string | null
          processed_at?: string
        }
        Update: {
          correlation_id?: string | null
          created_at?: string
          direction?: string
          event_type?: string
          from_number?: string | null
          id?: string
          message_id?: string
          payload?: Json
          phone_number_id?: string | null
          processed_at?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          agent_run_id: string | null
          content: string | null
          conversation_id: string
          created_at: string
          direction: string
          error: string | null
          id: string
          intent: string | null
          message_type: string
          status: string
          wa_message_id: string | null
        }
        Insert: {
          agent_run_id?: string | null
          content?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          error?: string | null
          id?: string
          intent?: string | null
          message_type?: string
          status?: string
          wa_message_id?: string | null
        }
        Update: {
          agent_run_id?: string | null
          content?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          error?: string | null
          id?: string
          intent?: string | null
          message_type?: string
          status?: string
          wa_message_id?: string | null
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
      whatsapp_notification_dispatch: {
        Row: {
          attempts: number
          correlation_id: string | null
          created_at: string
          duration_ms: number | null
          event_id: string
          event_name: string
          id: string
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          order_id: string | null
          prescription_id: string | null
          recipient_phone: string
          rendered_body: string | null
          sent_at: string | null
          status: string
          template_id: string
          updated_at: string
          wamid: string | null
        }
        Insert: {
          attempts?: number
          correlation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          event_id: string
          event_name: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          order_id?: string | null
          prescription_id?: string | null
          recipient_phone: string
          rendered_body?: string | null
          sent_at?: string | null
          status?: string
          template_id: string
          updated_at?: string
          wamid?: string | null
        }
        Update: {
          attempts?: number
          correlation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          event_id?: string
          event_name?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          order_id?: string | null
          prescription_id?: string | null
          recipient_phone?: string
          rendered_body?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string
          updated_at?: string
          wamid?: string | null
        }
        Relationships: []
      }
      whatsapp_notification_templates: {
        Row: {
          body_template: string
          created_at: string
          description: string | null
          enabled: boolean
          event_name: string
          id: string
          updated_at: string
          updated_by: string | null
          variables: string[]
        }
        Insert: {
          body_template: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          event_name: string
          id: string
          updated_at?: string
          updated_by?: string | null
          variables?: string[]
        }
        Update: {
          body_template?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          event_name?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          variables?: string[]
        }
        Relationships: []
      }
    }
    Views: {
      ai_decisions_unified: {
        Row: {
          agent_code: string | null
          confidence: number | null
          created_at: string | null
          decision: Json | null
          event_id: string | null
          event_name: string | null
          id: string | null
          latency_ms: number | null
          outcome: string | null
          reasoning: string | null
          source: string | null
        }
        Relationships: []
      }
      audit_logs_unified: {
        Row: {
          details: Json | null
          occurred_at: string | null
          source: string | null
          source_id: string | null
        }
        Relationships: []
      }
      hc_doctors_public_safe: {
        Row: {
          academic_title: string | null
          accepted_insurance: string[] | null
          awards: Json | null
          bio_ar: string | null
          bio_en: string | null
          certificates: Json | null
          consultation_fee_max: number | null
          consultation_fee_min: number | null
          created_at: string | null
          currency: string | null
          emergency_available: boolean | null
          full_name_ar: string | null
          full_name_en: string | null
          gallery: Json | null
          gender: string | null
          id: string | null
          intro_video_url: string | null
          is_public: boolean | null
          languages: string[] | null
          last_verified_at: string | null
          medical_title: string | null
          organization_id: string | null
          photo_url: string | null
          profile_completeness: number | null
          seo_title_ar: string | null
          services: Json | null
          slug: string | null
          sub_specialties: string[] | null
          telemedicine_ready: boolean | null
          title: string | null
          trust_score: number | null
          updated_at: string | null
          verification_status:
            | Database["public"]["Enums"]["hc_verification_status"]
            | null
          verified_at: string | null
          years_experience: number | null
        }
        Insert: {
          academic_title?: string | null
          accepted_insurance?: string[] | null
          awards?: Json | null
          bio_ar?: string | null
          bio_en?: string | null
          certificates?: Json | null
          consultation_fee_max?: number | null
          consultation_fee_min?: number | null
          created_at?: string | null
          currency?: string | null
          emergency_available?: boolean | null
          full_name_ar?: string | null
          full_name_en?: string | null
          gallery?: Json | null
          gender?: string | null
          id?: string | null
          intro_video_url?: string | null
          is_public?: boolean | null
          languages?: string[] | null
          last_verified_at?: string | null
          medical_title?: string | null
          organization_id?: string | null
          photo_url?: string | null
          profile_completeness?: number | null
          seo_title_ar?: string | null
          services?: Json | null
          slug?: string | null
          sub_specialties?: string[] | null
          telemedicine_ready?: boolean | null
          title?: string | null
          trust_score?: number | null
          updated_at?: string | null
          verification_status?:
            | Database["public"]["Enums"]["hc_verification_status"]
            | null
          verified_at?: string | null
          years_experience?: number | null
        }
        Update: {
          academic_title?: string | null
          accepted_insurance?: string[] | null
          awards?: Json | null
          bio_ar?: string | null
          bio_en?: string | null
          certificates?: Json | null
          consultation_fee_max?: number | null
          consultation_fee_min?: number | null
          created_at?: string | null
          currency?: string | null
          emergency_available?: boolean | null
          full_name_ar?: string | null
          full_name_en?: string | null
          gallery?: Json | null
          gender?: string | null
          id?: string | null
          intro_video_url?: string | null
          is_public?: boolean | null
          languages?: string[] | null
          last_verified_at?: string | null
          medical_title?: string | null
          organization_id?: string | null
          photo_url?: string | null
          profile_completeness?: number | null
          seo_title_ar?: string | null
          services?: Json | null
          slug?: string | null
          sub_specialties?: string[] | null
          telemedicine_ready?: boolean | null
          title?: string | null
          trust_score?: number | null
          updated_at?: string | null
          verification_status?:
            | Database["public"]["Enums"]["hc_verification_status"]
            | null
          verified_at?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hc_doctors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_admin_notifications: {
        Row: {
          body: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string | null
          kind: string | null
          payload: Json | null
          severity: string | null
          title: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string | null
          kind?: string | null
          payload?: Json | null
          severity?: string | null
          title?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string | null
          kind?: string | null
          payload?: Json | null
          severity?: string | null
          title?: string | null
        }
        Relationships: []
      }
      product_classifications_public: {
        Row: {
          active_ingredient: string | null
          complementary_legacy_ids: number[] | null
          conditions: string[] | null
          created_at: string | null
          generic_name: string | null
          id: string | null
          is_chronic: boolean | null
          pharmacological_class: string | null
          product_legacy_id: number | null
          related_legacy_ids: number[] | null
          requires_prescription: boolean | null
          status: Database["public"]["Enums"]["classification_status"] | null
          therapeutic_category:
            | Database["public"]["Enums"]["therapeutic_category"]
            | null
          updated_at: string | null
        }
        Insert: {
          active_ingredient?: string | null
          complementary_legacy_ids?: number[] | null
          conditions?: string[] | null
          created_at?: string | null
          generic_name?: string | null
          id?: string | null
          is_chronic?: boolean | null
          pharmacological_class?: string | null
          product_legacy_id?: number | null
          related_legacy_ids?: number[] | null
          requires_prescription?: boolean | null
          status?: Database["public"]["Enums"]["classification_status"] | null
          therapeutic_category?:
            | Database["public"]["Enums"]["therapeutic_category"]
            | null
          updated_at?: string | null
        }
        Update: {
          active_ingredient?: string | null
          complementary_legacy_ids?: number[] | null
          conditions?: string[] | null
          created_at?: string | null
          generic_name?: string | null
          id?: string | null
          is_chronic?: boolean | null
          pharmacological_class?: string | null
          product_legacy_id?: number | null
          related_legacy_ids?: number[] | null
          requires_prescription?: boolean | null
          status?: Database["public"]["Enums"]["classification_status"] | null
          therapeutic_category?:
            | Database["public"]["Enums"]["therapeutic_category"]
            | null
          updated_at?: string | null
        }
        Relationships: []
      }
      store_products: {
        Row: {
          barcode: string | null
          brand: string | null
          category_id: string | null
          dosage_form: string | null
          generic_name: string | null
          id: string | null
          image_url: string | null
          is_public: boolean | null
          manufacturer: string | null
          manufacturer_country: string | null
          name: string | null
          name_ar: string | null
          name_en: string | null
          organization_id: string | null
          pack_unit: string | null
          price: number | null
          requires_prescription: boolean | null
          status: Database["public"]["Enums"]["catalog_status"] | null
          stock_balance: number | null
          store_code: string | null
          strength: string | null
          supplier_name_text: string | null
          updated_at: string | null
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          dosage_form?: string | null
          generic_name?: string | null
          id?: string | null
          image_url?: string | null
          is_public?: boolean | null
          manufacturer?: string | null
          manufacturer_country?: string | null
          name?: never
          name_ar?: string | null
          name_en?: string | null
          organization_id?: string | null
          pack_unit?: string | null
          price?: number | null
          requires_prescription?: boolean | null
          status?: Database["public"]["Enums"]["catalog_status"] | null
          stock_balance?: never
          store_code?: string | null
          strength?: string | null
          supplier_name_text?: string | null
          updated_at?: string | null
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          dosage_form?: string | null
          generic_name?: string | null
          id?: string | null
          image_url?: string | null
          is_public?: boolean | null
          manufacturer?: string | null
          manufacturer_country?: string | null
          name?: never
          name_ar?: string | null
          name_en?: string | null
          organization_id?: string | null
          pack_unit?: string | null
          price?: number | null
          requires_prescription?: boolean | null
          status?: Database["public"]["Enums"]["catalog_status"] | null
          stock_balance?: never
          store_code?: string | null
          strength?: string | null
          supplier_name_text?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "catalog_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      unprocessed_agent_events: {
        Row: {
          entity_id: string | null
          entity_type: string | null
          event_name: string | null
          id: string | null
          last_error: string | null
          occurred_at: string | null
          payload: Json | null
          retry_count: number | null
          source: string | null
        }
        Insert: {
          entity_id?: string | null
          entity_type?: string | null
          event_name?: string | null
          id?: string | null
          last_error?: string | null
          occurred_at?: string | null
          payload?: Json | null
          retry_count?: number | null
          source?: string | null
        }
        Update: {
          entity_id?: string | null
          entity_type?: string | null
          event_name?: string | null
          id?: string | null
          last_error?: string | null
          occurred_at?: string | null
          payload?: Json | null
          retry_count?: number | null
          source?: string | null
        }
        Relationships: []
      }
      v_privileged_definer_grants: {
        Row: {
          anon_can_execute: boolean | null
          authenticated_can_execute: boolean | null
          function_signature: string | null
          is_security_definer: boolean | null
          search_path_locked: boolean | null
        }
        Relationships: []
      }
      whatsapp_notification_health: {
        Row: {
          avg_attempts: number | null
          avg_duration_ms: number | null
          cnt: number | null
          dead_cnt: number | null
          event_name: string | null
          hour: string | null
          max_attempts_seen: number | null
          status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _agent_kpi_upsert: {
        Args: {
          _agent: string
          _details: Json
          _metric: string
          _score: number
        }
        Returns: undefined
      }
      _agent_rec_upsert: {
        Args: {
          _agent: string
          _category: string
          _confidence: number
          _dedupe: string
          _impact: number
          _payload: Json
          _rationale: string
          _title: string
        }
        Returns: string
      }
      _classif_can_manage: { Args: never; Returns: boolean }
      _intel_can_manage: { Args: never; Returns: boolean }
      _therapeutic_label_ar: { Args: { _cat: string }; Returns: string }
      ack_staff_alert: { Args: { _id: string }; Returns: boolean }
      add_loyalty_points: {
        Args: { _order_id?: string; _phone: string; _spent_yer: number }
        Returns: number
      }
      admin_bundles_report: { Args: never; Returns: Json }
      admin_list_cron_jobs: {
        Args: never
        Returns: {
          active: boolean
          command: string
          jobid: number
          jobname: string
          schedule: string
        }[]
      }
      admin_list_cron_runs: {
        Args: { _limit?: number }
        Returns: {
          command: string
          database: string
          end_time: string
          job_pid: number
          jobid: number
          jobname: string
          return_message: string
          runid: number
          start_time: string
          status: string
          username: string
        }[]
      }
      admin_revenue_series: { Args: { _days?: number }; Returns: Json }
      admin_stats: { Args: never; Returns: Json }
      agent_events_dlq_stats: { Args: never; Returns: Json }
      agent_runs_list: { Args: { _limit?: number }; Returns: Json }
      agent_workforce_summary: { Args: never; Returns: Json }
      ai_get_branch_availability: {
        Args: { _product_query: string }
        Returns: {
          branch_name: string
          in_stock: boolean
          product_id: string
          product_name: string
        }[]
      }
      ai_get_order_status: {
        Args: { _order_id: string; _phone: string }
        Returns: {
          created_at: string
          id: string
          item_count: number
          status: string
          total: number
        }[]
      }
      ai_get_prescription_status: {
        Args: { _phone: string; _prescription_id: string }
        Returns: {
          created_at: string
          has_review: boolean
          id: string
          status: string
        }[]
      }
      ai_list_branches: {
        Args: never
        Returns: {
          address: string
          code: string
          id: string
          name: string
          phone: string
        }[]
      }
      ai_search_products: {
        Args: { _limit?: number; _query: string }
        Returns: {
          brand: string
          category: string
          description: string
          id: string
          in_stock: boolean
          name: string
          price: number
        }[]
      }
      apply_retention_policies: {
        Args: never
        Returns: {
          deleted: number
          error: string
          table_name: string
        }[]
      }
      approve_classification: {
        Args: { _edits?: Json; _id: string }
        Returns: boolean
      }
      auto_bundle_candidates: {
        Args: { _days?: number }
        Returns: {
          a_id: number
          a_name: string
          avg_combined_price: number
          b_id: number
          b_name: string
          co_count: number
          lift: number
        }[]
      }
      auto_populate_bundle_items: { Args: never; Returns: number }
      billing_activate_plan: {
        Args: {
          _organization_id?: string
          _plan_code: string
          _subject_id: string
          _subject_type: Database["public"]["Enums"]["billing_audience"]
          _trial_days?: number
        }
        Returns: string
      }
      billing_cancel_subscription: {
        Args: { _at_period_end?: boolean; _subscription_id: string }
        Returns: undefined
      }
      billing_issue_invoice: {
        Args: {
          _period_end: string
          _period_start: string
          _subscription_id: string
        }
        Returns: string
      }
      billing_record_payment: {
        Args: { _amount_yer: number; _invoice_id: string; _notes?: string }
        Returns: undefined
      }
      bootstrap_owner: { Args: never; Returns: boolean }
      branch_reorder_suggestions: {
        Args: {
          _branch_id: string
          _coverage_days?: number
          _limit?: number
          _lookback_days?: number
          _offset?: number
        }
        Returns: {
          available: number
          branch_id: string
          daily_velocity: number
          movement_qty_30d: number
          on_hand: number
          product_id: string
          product_name: string
          reason: string
          reorder_point: number
          reserved: number
          suggested_restock_qty: number
          urgency: string
        }[]
      }
      campaign_report: { Args: never; Returns: Json }
      cancel_transfer: {
        Args: { _reason?: string; _transfer_id: string }
        Returns: string
      }
      catalog_normalize_ar: { Args: { _t: string }; Returns: string }
      catalog_search: {
        Args: { _limit?: number; _org_id: string; _q: string }
        Returns: {
          brand: string
          generic_name: string
          id: string
          name_ar: string
          name_en: string
          score: number
        }[]
      }
      check_img_rate_limit: {
        Args: { _ip: string; _max: number; _window_seconds: number }
        Returns: boolean
      }
      check_tracking_rate_limit: {
        Args: { _ip: string; _max?: number; _window_seconds?: number }
        Returns: boolean
      }
      checkout_cart_fefo: {
        Args: {
          p_customer_address: string
          p_customer_name: string
          p_customer_phone: string
          p_notes?: string
          p_payment_method_code: string
          p_shipping_zone_id: string
        }
        Returns: Json
      }
      chronic_overdue: {
        Args: { _grace?: number }
        Returns: {
          chronic_flags: Json
          days_between: number
          days_since: number
          dominant_category: string
          last_order_at: string
          name: string
          phone: string
          total_spent: number
        }[]
      }
      claim_agent_events: {
        Args: { _limit?: number; _worker?: string }
        Returns: {
          entity_id: string
          entity_type: string
          event_name: string
          id: string
          occurred_at: string
          payload: Json
          retry_count: number
          source: string
        }[]
      }
      claim_customer_rx_notifications: {
        Args: { _limit?: number }
        Returns: {
          attempts: number
          correlation_id: string | null
          created_at: string
          duration_ms: number | null
          event_id: string
          event_name: string
          id: string
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          order_id: string | null
          prescription_id: string | null
          recipient_phone: string
          rendered_body: string | null
          sent_at: string | null
          status: string
          template_id: string
          updated_at: string
          wamid: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "whatsapp_notification_dispatch"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      clean_old_telemetry: {
        Args: never
        Returns: {
          deleted_decisions: number
          deleted_feedback: number
        }[]
      }
      cleanup_idempotency_keys: { Args: never; Returns: number }
      commit_transfer_receipt: {
        Args: { _transfer_id: string }
        Returns: string
      }
      conditions_catalog: {
        Args: never
        Returns: {
          chronic_count: number
          condition: string
          product_count: number
          sample_image: string
        }[]
      }
      consume_rate_limit: {
        Args: { _key: string; _max: number; _window_seconds: number }
        Returns: boolean
      }
      create_backup: { Args: { _kind?: string }; Returns: string }
      create_scheduled_backup: { Args: { _kind: string }; Returns: string }
      crm_campaign_transition: {
        Args: {
          p_id: string
          p_next: Database["public"]["Enums"]["crm_campaign_status"]
        }
        Returns: Database["public"]["Enums"]["crm_campaign_status"]
      }
      crm_coupon_redeem: {
        Args: {
          p_code: string
          p_created_by: string
          p_customer: string
          p_discount: number
          p_order_ref: string
          p_org: string
        }
        Returns: {
          coupon_id: string
          promotion_id: string
          redemption_id: string
        }[]
      }
      crm_loyalty_apply_txn: {
        Args: {
          p_account_id: string
          p_correlation_id: string
          p_created_by: string
          p_kind: string
          p_metadata: Json
          p_points: number
          p_reason: string
          p_source_ref: string
        }
        Returns: {
          new_balance: number
          transaction_id: string
        }[]
      }
      crm_loyalty_recompute_balance: {
        Args: { p_account_id: string }
        Returns: number
      }
      crm_loyalty_recompute_tier: {
        Args: { p_account_id: string }
        Returns: string
      }
      crm_loyalty_seed_tiers: { Args: { p_org: string }; Returns: undefined }
      crm_segment_recalc: {
        Args: { p_customer_ids: string[]; p_segment_id: string }
        Returns: number
      }
      cto_health: { Args: never; Returns: Json }
      current_inventory_write_mode: { Args: never; Returns: string }
      current_org: { Args: never; Returns: string }
      customer_notification_get_status: {
        Args: { _token: string }
        Returns: Json
      }
      customer_notification_set_optout: {
        Args: { _opt_out: boolean; _token: string }
        Returns: Json
      }
      customers_for_enrichment: {
        Args: { _limit?: number }
        Returns: {
          chronic_flags: Json
          dominant_category: string
          health_score: number
          last_order_at: string
          name: string
          orders_count: number
          phone: string
          segment: string
          top_categories: Json
          total_spent: number
          value_score: number
        }[]
      }
      declining_products: {
        Args: never
        Returns: {
          drop_pct: number
          legacy_id: number
          name: string
          revenue_prev: number
          revenue_this: number
          units_prev: number
          units_this: number
        }[]
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      detect_stale_transfers: {
        Args: { _stale_minutes?: number }
        Returns: {
          alerts_created: number
          alerts_updated: number
        }[]
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      emit_agent_event: {
        Args: {
          _entity_id?: string
          _entity_type?: string
          _event_name: string
          _payload?: Json
          _source?: string
        }
        Returns: string
      }
      emit_domain_event: {
        Args: {
          p_correlation_id?: string
          p_event_type: string
          p_payload?: Json
          p_priority?: string
          p_source: string
        }
        Returns: string
      }
      emit_identity_event: {
        Args: {
          _actor: string
          _branch: string
          _org: string
          _payload: Json
          _subject: string
          _type: string
        }
        Returns: undefined
      }
      emit_order_event: {
        Args: {
          _correlation_id?: string
          _event_name: string
          _meta?: Json
          _order_id: string
        }
        Returns: string
      }
      emit_prescription_event: {
        Args: {
          _actor_id?: string
          _actor_type?: string
          _event_name: string
          _metadata?: Json
          _order_id?: string
          _prescription_id: string
          _source?: string
        }
        Returns: string
      }
      enqueue_chronic_refill_action: {
        Args: {
          _customer_phone: string
          _discount_code: string
          _message_arabic: string
          _tier: string
        }
        Returns: string
      }
      enqueue_chronic_refills: {
        Args: { _discount_pct?: number; _limit?: number }
        Returns: Json
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_user_organization: {
        Args: { p_user_id?: string }
        Returns: string
      }
      exec_dashboard: { Args: never; Returns: Json }
      executive_alerts: { Args: never; Returns: Json }
      fail_agent_event: {
        Args: {
          _error: string
          _event_id: string
          _max_retries?: number
          _processed_by: string
        }
        Returns: Json
      }
      generate_agent_actions: { Args: never; Returns: number }
      generate_invoice_number: { Args: never; Returns: string }
      generate_marketing_campaigns: { Args: never; Returns: Json }
      generate_mrn: { Args: { p_org: string }; Returns: string }
      get_agent_alerts: {
        Args: never
        Returns: {
          agent: string
          alert_key: string
          message: string
          payload: Json
          severity: string
        }[]
      }
      get_backup_schedule: { Args: never; Returns: Json }
      get_event_consumer_schedule: { Args: never; Returns: Json }
      get_order_history_public: {
        Args: { _client_ip?: string; _id: string; _phone_last4: string }
        Returns: {
          created_at: string
          note: string
          status: string
        }[]
      }
      get_order_public: {
        Args: { _client_ip?: string; _id: string; _phone_last4: string }
        Returns: {
          created_at: string
          customer_name: string
          id: string
          items: Json
          status: string
          total: number
        }[]
      }
      has_branch_access: {
        Args: { _branch_id: string; _user_id: string }
        Returns: boolean
      }
      has_consent: {
        Args: {
          _grantee_id: string
          _grantee_type: string
          _patient_id: string
          _scope: string
        }
        Returns: boolean
      }
      has_org_permission: {
        Args: {
          _branch_id?: string
          _org_id: string
          _permission: string
          _user_id: string
        }
        Returns: boolean
      }
      has_org_role: {
        Args: { _org: string; _roles: string[]; _user: string }
        Returns: boolean
      }
      has_permission: {
        Args: { _perm: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hc_approve_join_submission: {
        Args: { _submission: string }
        Returns: string
      }
      hc_create_appointment: {
        Args: {
          _doctor: string
          _duration_minutes?: number
          _location: string
          _patient: string
          _reason?: string
          _starts_at: string
        }
        Returns: string
      }
      hc_create_doctor: { Args: { _payload: Json }; Returns: string }
      hc_create_location: { Args: { _payload: Json }; Returns: string }
      hc_create_specialty: {
        Args: {
          _code: string
          _description_ar?: string
          _description_en?: string
          _name_ar: string
          _name_en: string
          _sort_order?: number
        }
        Returns: string
      }
      hc_detect_doctor_duplicates: {
        Args: { _name_ar: string; _phone: string }
        Returns: {
          doctor_id: string
          full_name_ar: string
          phone_e164: string
          score: number
          slug: string
        }[]
      }
      hc_emit_event: {
        Args: {
          _entity_id: string
          _entity_type: string
          _name: string
          _payload: Json
        }
        Returns: undefined
      }
      hc_flag_join_photo: {
        Args: { _notes: string; _status: string; _submission: string }
        Returns: undefined
      }
      hc_healthcare_kpis: { Args: never; Returns: Json }
      hc_normalize_ar: { Args: { _s: string }; Returns: string }
      hc_normalize_doctor_row: { Args: { _doctor: string }; Returns: undefined }
      hc_recompute_profile_completeness: {
        Args: { _doctor: string }
        Returns: number
      }
      hc_recompute_trust_score: { Args: { _doctor: string }; Returns: number }
      hc_reject_join_submission: {
        Args: { _reason: string; _submission: string }
        Returns: undefined
      }
      hc_submit_verification: {
        Args: { _doctor: string; _documents?: Json }
        Returns: string
      }
      hc_transition_appointment: {
        Args: {
          _appt: string
          _new: Database["public"]["Enums"]["hc_appointment_status"]
          _reason?: string
        }
        Returns: undefined
      }
      hc_verify_doctor: {
        Args: {
          _decision: Database["public"]["Enums"]["hc_verification_status"]
          _doctor: string
          _notes?: string
        }
        Returns: undefined
      }
      insv2_can_access_org: { Args: { _org: string }; Returns: boolean }
      insv2_org_role: { Args: { _org: string }; Returns: string }
      inv_adjust_stock:
        | {
            Args: { _batch: string; _qty_delta: number; _reason: string }
            Returns: string
          }
        | {
            Args: {
              p_actor: string
              p_batch: string
              p_correlation: string
              p_delta: number
              p_reason: string
            }
            Returns: string
          }
      inv_consume_reservation: {
        Args: { p_actor: string; p_correlation: string; p_reservation: string }
        Returns: undefined
      }
      inv_dispatch_transfer: { Args: { _transfer: string }; Returns: undefined }
      inv_emit: {
        Args: { p_correlation: string; p_payload: Json; p_type: string }
        Returns: undefined
      }
      inv_emit_event: {
        Args: {
          _entity_id: string
          _entity_type: string
          _event: string
          _org: string
          _payload: Json
        }
        Returns: undefined
      }
      inv_intel_snapshot: {
        Args: never
        Returns: {
          products_scored: number
          recommendations_created: number
        }[]
      }
      inv_receive_stock:
        | {
            Args: {
              _batch_no?: string
              _cost?: number
              _expiry?: string
              _org: string
              _product: string
              _qty: number
              _reason?: string
              _supplier?: string
              _warehouse: string
            }
            Returns: string
          }
        | {
            Args: {
              p_actor: string
              p_batch: string
              p_correlation: string
              p_cost: number
              p_expiry: string
              p_org: string
              p_product: string
              p_qty: number
              p_supplier: string
              p_warehouse: string
            }
            Returns: string
          }
      inv_receive_transfer: { Args: { _transfer: string }; Returns: undefined }
      inv_release_reservation: {
        Args: { p_actor: string; p_correlation: string; p_reservation: string }
        Returns: undefined
      }
      inv_reserve_fefo: {
        Args: {
          p_actor: string
          p_allow_partial?: boolean
          p_correlation: string
          p_org: string
          p_product: string
          p_qty: number
          p_ref_id: string
          p_ref_type: string
        }
        Returns: string
      }
      inv_reserve_for_transfer: { Args: { _transfer: string }; Returns: number }
      inv_return_stock: {
        Args: {
          p_actor: string
          p_correlation: string
          p_org: string
          p_product: string
          p_qty: number
          p_reason: string
          p_warehouse: string
        }
        Returns: string
      }
      inv_scan_expiry: {
        Args: { _horizon_days?: number; _org: string }
        Returns: number
      }
      inv_transfer_stock: {
        Args: {
          p_actor: string
          p_correlation: string
          p_from_warehouse: string
          p_org: string
          p_product: string
          p_qty: number
          p_to_warehouse: string
        }
        Returns: string
      }
      inventory_intel: { Args: never; Returns: Json }
      inventory_pilot_report: { Args: never; Returns: Json }
      inventory_readiness_report: { Args: never; Returns: Json }
      inventory_report: { Args: never; Returns: Json }
      is_branch_manager_of: {
        Args: { _branch_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
      is_owner_or_admin: { Args: { _user_id: string }; Returns: boolean }
      latest_executive_report: { Args: never; Returns: Json }
      list_approved_classifications_public: { Args: never; Returns: Json }
      list_bundles_public: { Args: never; Returns: Json }
      list_classifications_admin: {
        Args: { _category?: string; _limit?: number; _status?: string }
        Returns: Json
      }
      list_my_org_permissions: {
        Args: { _org_id: string }
        Returns: {
          permission_key: string
        }[]
      }
      log_activity: {
        Args: {
          _action: string
          _details?: Json
          _entity_id?: string
          _entity_type?: string
        }
        Returns: string
      }
      log_inventory_shadow: {
        Args: { _legacy_id: number; _order_id: string; _requested_qty: number }
        Returns: undefined
      }
      log_org_event: {
        Args: { _actor: string; _org: string; _payload: Json; _type: string }
        Returns: undefined
      }
      mark_customer_rx_notification_failed: {
        Args: { _base_seconds?: number; _error: string; _id: string }
        Returns: Json
      }
      mark_customer_rx_notification_sent: {
        Args: {
          _duration_ms: number
          _id: string
          _rendered_body: string
          _wamid: string
        }
        Returns: undefined
      }
      mark_event_processed: {
        Args: { _error?: string; _event_id: string; _processed_by?: string }
        Returns: boolean
      }
      marketing_queue_approve: { Args: { _id: string }; Returns: boolean }
      marketing_queue_list: {
        Args: { _limit?: number; _status?: string }
        Returns: Json
      }
      marketing_queue_mark_sent: {
        Args: { _error?: string; _id: string; _wamid?: string }
        Returns: boolean
      }
      marketing_queue_skip: { Args: { _id: string }; Returns: boolean }
      match_ai_neural_memory: {
        Args: {
          filter_owner_type?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          content: string
          created_at: string
          id: string
          memory_category: string
          metadata: Json
          owner_id: string
          owner_type: string
          similarity: number
        }[]
      }
      monitor_cron_failures: { Args: never; Returns: Json }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      org_feature_enabled: {
        Args: { _feature: string; _org_id: string }
        Returns: boolean
      }
      org_within_limit: {
        Args: { _current: number; _limit: string; _org_id: string }
        Returns: boolean
      }
      patient_belongs_to_current_user: {
        Args: { _patient_id: string }
        Returns: boolean
      }
      pg_get_indexdef_by_name: { Args: { p_name: string }; Returns: string }
      pharmacy_chronic_legacy_ids: { Args: never; Returns: Json }
      pharmacy_homepage_sections: { Args: never; Returns: Json }
      pharmacy_related_products: { Args: { _legacy_id: number }; Returns: Json }
      pharmacy_search: { Args: { _q: string }; Returns: Json }
      pharmacy_taxonomy_stats: { Args: never; Returns: Json }
      place_order:
        | {
            Args: { _customer: Json; _id: string; _items: Json }
            Returns: Json
          }
        | {
            Args: {
              _customer: Json
              _discount_code?: string
              _id: string
              _items: Json
            }
            Returns: Json
          }
      pn_flag_near_expiry: { Args: { _days?: number }; Returns: number }
      pn_get_pharmacy_public: { Args: { _slug: string }; Returns: Json }
      pn_list_pharmacy_products: {
        Args: { _limit?: number; _offset?: number; _q?: string; _slug: string }
        Returns: {
          availability: Database["public"]["Enums"]["pn_availability"]
          catalog_product_id: string
          expiry_date: string
          price_visible: boolean
          price_yer: number
          product_name: string
        }[]
      }
      pn_request_transfer: {
        Args: {
          _catalog_product_id: string
          _from_pharmacy_id: string
          _notes?: string
          _qty: number
          _reason?: Database["public"]["Enums"]["pn_transfer_reason"]
          _to_pharmacy_id: string
        }
        Returns: string
      }
      pn_search_medicine_nearby: {
        Args: {
          _lat?: number
          _limit?: number
          _lng?: number
          _q: string
          _radius_km?: number
        }
        Returns: {
          availability: Database["public"]["Enums"]["pn_availability"]
          catalog_product_id: string
          city: string
          distance_km: number
          district: string
          expiry_date: string
          lat: number
          lng: number
          pharmacy_id: string
          pharmacy_name_ar: string
          pharmacy_slug: string
          phone: string
          price_visible: boolean
          price_yer: number
          product_name: string
          whatsapp: string
        }[]
      }
      pn_submit_verification: {
        Args: { _documents?: Json; _notes?: string; _pharmacy_id: string }
        Returns: string
      }
      pn_upsert_stock: {
        Args: {
          _availability: Database["public"]["Enums"]["pn_availability"]
          _catalog_product_id: string
          _expiry_date?: string
          _notes?: string
          _pharmacy_id: string
          _price_visible?: boolean
          _price_yer?: number
        }
        Returns: string
      }
      pn_verify_pharmacy: {
        Args: {
          _approved: boolean
          _pharmacy_id: string
          _reviewer_notes?: string
        }
        Returns: undefined
      }
      po_receive: {
        Args: { p_actor: string; p_correlation: string; p_po: string }
        Returns: undefined
      }
      prescription_file_count: {
        Args: { _prescription_id: string }
        Returns: number
      }
      public_feature_flags: {
        Args: never
        Returns: {
          key: string
          value: Json
        }[]
      }
      public_pharmacy_status: {
        Args: never
        Returns: {
          key: string
          value: Json
        }[]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      rebuild_customer_intel: { Args: never; Returns: Json }
      recompute_loyalty_tier: { Args: { _phone: string }; Returns: string }
      reconcile_inventory_mismatch: { Args: never; Returns: Json }
      redeem_loyalty_points: {
        Args: { _phone: string; _points: number }
        Returns: number
      }
      reject_classification: { Args: { _id: string }; Returns: boolean }
      release_order_stock: {
        Args: { _actor?: string; _order_id: string; _reason?: string }
        Returns: Json
      }
      release_transfer_reservation: {
        Args: { _reason?: string; _transfer_id: string }
        Returns: string
      }
      reserve_order_stock: {
        Args: { _actor?: string; _order_id: string; _reason?: string }
        Returns: Json
      }
      reserve_transfer_stock: {
        Args: { _transfer_id: string }
        Returns: string
      }
      revenue_by_condition: {
        Args: { _days?: number }
        Returns: {
          condition: string
          orders_count: number
          revenue: number
        }[]
      }
      rotate_cron_secret: {
        Args: { _base_url?: string; _secret: string }
        Returns: Json
      }
      run_all_agents_now: { Args: never; Returns: Json }
      run_bi_worker: { Args: never; Returns: Json }
      run_ceo_worker: { Args: never; Returns: Json }
      run_cto_worker: { Args: never; Returns: Json }
      run_cx_worker: { Args: never; Returns: Json }
      run_inventory_worker: { Args: never; Returns: Json }
      run_marketing_worker: { Args: never; Returns: Json }
      run_operations_worker: { Args: never; Returns: Json }
      run_retention_policy: { Args: never; Returns: Json }
      run_sales_worker: { Args: never; Returns: Json }
      sales_opportunities: { Args: never; Returns: Json }
      save_customer_ai_insight: {
        Args: { _insight: string; _phone: string }
        Returns: undefined
      }
      schedule_event_consumer: {
        Args: {
          _batch?: number
          _cron_secret: string
          _project_host?: string
          _schedule?: string
        }
        Returns: Json
      }
      search_medicines_public: {
        Args: { _limit?: number; _q: string }
        Returns: {
          brand: string
          dosage_form: string
          generic_name: string
          id: string
          match_kind: string
          name_ar: string
          name_en: string
          score: number
          strength: string
        }[]
      }
      set_inventory_pilot: {
        Args: { _group?: string; _legacy_ids: number[] }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      submit_prescription: {
        Args: { _customer: Json; _id: string; _image_urls: string[] }
        Returns: Json
      }
      top_selling_products: {
        Args: { _days?: number; _limit?: number }
        Returns: {
          current_price: number
          current_stock: number
          orders_count: number
          product_name: string
          revenue_yer: number
          units_sold: number
        }[]
      }
      track_banner_event: {
        Args: { _banner_id: string; _event: string }
        Returns: boolean
      }
      upsert_classification: { Args: { _payload: Json }; Returns: string }
      validate_discount: {
        Args: { _code: string; _customer_phone?: string; _subtotal: number }
        Returns: Json
      }
      verify_prescription_image_coverage: { Args: never; Returns: Json }
      weekly_exec_report_build: { Args: never; Returns: Json }
    }
    Enums: {
      action_execution_status:
        | "PENDING_APPROVAL"
        | "EXECUTED"
        | "SKIPPED"
        | "FAILED"
      action_target_pipeline:
        | "PRESCRIPTIONS"
        | "ORDERS"
        | "MARKETING_QUEUE"
        | "INVENTORY"
      app_role: "admin" | "user" | "owner"
      billing_audience: "pharmacy" | "doctor" | "supplier" | "organization"
      billing_invoice_status: "draft" | "issued" | "paid" | "void" | "failed"
      billing_ledger_entry: "charge" | "refund" | "credit" | "adjustment"
      billing_sub_status:
        | "trialing"
        | "active"
        | "past_due"
        | "cancelled"
        | "expired"
      billing_tier:
        | "free"
        | "basic"
        | "premium"
        | "enterprise"
        | "professional"
        | "analytics"
      branch_role: "manager" | "staff" | "viewer"
      branch_type: "WAREHOUSE" | "BRANCH" | "OFFICE"
      catalog_ai_signal_type:
        | "ocr"
        | "barcode"
        | "image"
        | "invoice"
        | "prescription"
      catalog_alias_source: "manual" | "ocr" | "ai" | "import"
      catalog_import_decision: "matched" | "new" | "ambiguous" | "invalid"
      catalog_import_status:
        | "analyzing"
        | "analyzed"
        | "committing"
        | "committed"
        | "failed"
      catalog_media_kind: "primary" | "gallery" | "thumbnail" | "barcode"
      catalog_media_status: "pending" | "approved" | "rejected"
      catalog_status:
        | "draft"
        | "pending_review"
        | "approved"
        | "rejected"
        | "archived"
      classification_status: "pending" | "approved" | "rejected"
      crm_campaign_channel: "whatsapp" | "sms" | "email" | "push" | "in_app"
      crm_campaign_event_kind:
        | "queued"
        | "sent"
        | "delivered"
        | "opened"
        | "clicked"
        | "bounced"
        | "failed"
        | "unsubscribed"
      crm_campaign_status:
        | "draft"
        | "scheduled"
        | "running"
        | "paused"
        | "completed"
        | "cancelled"
      crm_recipient_status:
        | "pending"
        | "sent"
        | "delivered"
        | "failed"
        | "skipped"
      hc_appointment_status:
        | "requested"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      hc_booking_method:
        | "walk_in"
        | "phone"
        | "whatsapp"
        | "online"
        | "assistant"
      hc_join_status:
        | "new"
        | "reviewing"
        | "approved"
        | "rejected"
        | "duplicate"
      hc_location_kind:
        | "clinic"
        | "hospital"
        | "medical_center"
        | "pharmacy_clinic"
      hc_practice_type:
        | "gov_hospital"
        | "private_hospital"
        | "military_hospital"
        | "teaching_hospital"
        | "clinic"
        | "medical_center"
        | "charity"
        | "ngo"
      hc_specialty_status: "active" | "inactive"
      hc_verification_status: "pending" | "verified" | "rejected"
      inv_expiry_tier: "NEAR_90" | "NEAR_60" | "NEAR_30" | "EXPIRED"
      inv_movement_type:
        | "STOCK_RECEIVED"
        | "STOCK_TRANSFERRED_OUT"
        | "STOCK_TRANSFERRED_IN"
        | "STOCK_SOLD"
        | "STOCK_ADJUSTED"
        | "STOCK_EXPIRED"
        | "STOCK_RESERVED"
        | "STOCK_RELEASED"
      inv_transfer_status:
        | "draft"
        | "approved"
        | "reserved"
        | "picked"
        | "packed"
        | "dispatched"
        | "received"
        | "cancelled"
      invoice_audit_event_type:
        | "uploaded"
        | "extraction_started"
        | "extraction_completed"
        | "extraction_failed"
        | "line_reviewed"
        | "committed"
        | "cancelled"
      invoice_line_status: "pending" | "confirmed" | "skipped"
      invoice_match_source: "exact" | "alias" | "fuzzy" | "manual" | "unmatched"
      invoice_upload_source: "camera" | "file"
      invoice_upload_status:
        | "uploaded"
        | "extracting"
        | "extracted"
        | "failed"
        | "committed"
        | "cancelled"
      org_role:
        | "owner"
        | "admin"
        | "manager"
        | "employee"
        | "pharmacist"
        | "doctor"
        | "supplier_user"
        | "insurance_user"
        | "customer"
      organization_type:
        | "PHARMACY"
        | "CLINIC"
        | "LAB"
        | "INSURANCE"
        | "SUPPLIER"
        | "CORPORATE"
      pn_availability: "in_stock" | "low" | "out"
      pn_transfer_reason: "near_expiry" | "shortage" | "other"
      pn_transfer_status:
        | "draft"
        | "pending"
        | "accepted"
        | "rejected"
        | "cancelled"
      pn_verification_status: "pending" | "verified" | "rejected"
      po_status: "draft" | "submitted" | "approved" | "received" | "cancelled"
      sup_status: "active" | "inactive" | "suspended"
      therapeutic_category:
        | "diabetes"
        | "hypertension"
        | "cardiology"
        | "allergy"
        | "asthma"
        | "gi"
        | "antibiotics"
        | "neurology"
        | "dermatology"
        | "pediatrics"
        | "womens_health"
        | "vitamins"
        | "pain"
        | "respiratory"
        | "ophthalmology"
        | "urology"
        | "hormonal"
        | "oncology"
        | "mental_health"
        | "other"
      transfer_status:
        | "REQUESTED"
        | "APPROVED"
        | "RESERVED"
        | "PICKING"
        | "PACKED"
        | "DISPATCHED"
        | "IN_TRANSIT"
        | "RECEIVED"
        | "COMPLETED"
        | "CANCELLED"
        | "REJECTED"
      transfer_type: "WH_TO_BRANCH" | "BRANCH_TO_BRANCH" | "BRANCH_TO_WH"
      valid_agent_modes:
        | "pharmacist"
        | "inventory"
        | "procurement"
        | "refill"
        | "marketing"
        | "import_excel_classifier"
        | "bi"
        | "ceo"
        | "cto"
        | "cx"
        | "operations"
        | "sales"
        | "whatsapp"
      wh_kind: "central" | "branch" | "virtual" | "transit"
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
      action_execution_status: [
        "PENDING_APPROVAL",
        "EXECUTED",
        "SKIPPED",
        "FAILED",
      ],
      action_target_pipeline: [
        "PRESCRIPTIONS",
        "ORDERS",
        "MARKETING_QUEUE",
        "INVENTORY",
      ],
      app_role: ["admin", "user", "owner"],
      billing_audience: ["pharmacy", "doctor", "supplier", "organization"],
      billing_invoice_status: ["draft", "issued", "paid", "void", "failed"],
      billing_ledger_entry: ["charge", "refund", "credit", "adjustment"],
      billing_sub_status: [
        "trialing",
        "active",
        "past_due",
        "cancelled",
        "expired",
      ],
      billing_tier: [
        "free",
        "basic",
        "premium",
        "enterprise",
        "professional",
        "analytics",
      ],
      branch_role: ["manager", "staff", "viewer"],
      branch_type: ["WAREHOUSE", "BRANCH", "OFFICE"],
      catalog_ai_signal_type: [
        "ocr",
        "barcode",
        "image",
        "invoice",
        "prescription",
      ],
      catalog_alias_source: ["manual", "ocr", "ai", "import"],
      catalog_import_decision: ["matched", "new", "ambiguous", "invalid"],
      catalog_import_status: [
        "analyzing",
        "analyzed",
        "committing",
        "committed",
        "failed",
      ],
      catalog_media_kind: ["primary", "gallery", "thumbnail", "barcode"],
      catalog_media_status: ["pending", "approved", "rejected"],
      catalog_status: [
        "draft",
        "pending_review",
        "approved",
        "rejected",
        "archived",
      ],
      classification_status: ["pending", "approved", "rejected"],
      crm_campaign_channel: ["whatsapp", "sms", "email", "push", "in_app"],
      crm_campaign_event_kind: [
        "queued",
        "sent",
        "delivered",
        "opened",
        "clicked",
        "bounced",
        "failed",
        "unsubscribed",
      ],
      crm_campaign_status: [
        "draft",
        "scheduled",
        "running",
        "paused",
        "completed",
        "cancelled",
      ],
      crm_recipient_status: [
        "pending",
        "sent",
        "delivered",
        "failed",
        "skipped",
      ],
      hc_appointment_status: [
        "requested",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      hc_booking_method: [
        "walk_in",
        "phone",
        "whatsapp",
        "online",
        "assistant",
      ],
      hc_join_status: ["new", "reviewing", "approved", "rejected", "duplicate"],
      hc_location_kind: [
        "clinic",
        "hospital",
        "medical_center",
        "pharmacy_clinic",
      ],
      hc_practice_type: [
        "gov_hospital",
        "private_hospital",
        "military_hospital",
        "teaching_hospital",
        "clinic",
        "medical_center",
        "charity",
        "ngo",
      ],
      hc_specialty_status: ["active", "inactive"],
      hc_verification_status: ["pending", "verified", "rejected"],
      inv_expiry_tier: ["NEAR_90", "NEAR_60", "NEAR_30", "EXPIRED"],
      inv_movement_type: [
        "STOCK_RECEIVED",
        "STOCK_TRANSFERRED_OUT",
        "STOCK_TRANSFERRED_IN",
        "STOCK_SOLD",
        "STOCK_ADJUSTED",
        "STOCK_EXPIRED",
        "STOCK_RESERVED",
        "STOCK_RELEASED",
      ],
      inv_transfer_status: [
        "draft",
        "approved",
        "reserved",
        "picked",
        "packed",
        "dispatched",
        "received",
        "cancelled",
      ],
      invoice_audit_event_type: [
        "uploaded",
        "extraction_started",
        "extraction_completed",
        "extraction_failed",
        "line_reviewed",
        "committed",
        "cancelled",
      ],
      invoice_line_status: ["pending", "confirmed", "skipped"],
      invoice_match_source: ["exact", "alias", "fuzzy", "manual", "unmatched"],
      invoice_upload_source: ["camera", "file"],
      invoice_upload_status: [
        "uploaded",
        "extracting",
        "extracted",
        "failed",
        "committed",
        "cancelled",
      ],
      org_role: [
        "owner",
        "admin",
        "manager",
        "employee",
        "pharmacist",
        "doctor",
        "supplier_user",
        "insurance_user",
        "customer",
      ],
      organization_type: [
        "PHARMACY",
        "CLINIC",
        "LAB",
        "INSURANCE",
        "SUPPLIER",
        "CORPORATE",
      ],
      pn_availability: ["in_stock", "low", "out"],
      pn_transfer_reason: ["near_expiry", "shortage", "other"],
      pn_transfer_status: [
        "draft",
        "pending",
        "accepted",
        "rejected",
        "cancelled",
      ],
      pn_verification_status: ["pending", "verified", "rejected"],
      po_status: ["draft", "submitted", "approved", "received", "cancelled"],
      sup_status: ["active", "inactive", "suspended"],
      therapeutic_category: [
        "diabetes",
        "hypertension",
        "cardiology",
        "allergy",
        "asthma",
        "gi",
        "antibiotics",
        "neurology",
        "dermatology",
        "pediatrics",
        "womens_health",
        "vitamins",
        "pain",
        "respiratory",
        "ophthalmology",
        "urology",
        "hormonal",
        "oncology",
        "mental_health",
        "other",
      ],
      transfer_status: [
        "REQUESTED",
        "APPROVED",
        "RESERVED",
        "PICKING",
        "PACKED",
        "DISPATCHED",
        "IN_TRANSIT",
        "RECEIVED",
        "COMPLETED",
        "CANCELLED",
        "REJECTED",
      ],
      transfer_type: ["WH_TO_BRANCH", "BRANCH_TO_BRANCH", "BRANCH_TO_WH"],
      valid_agent_modes: [
        "pharmacist",
        "inventory",
        "procurement",
        "refill",
        "marketing",
        "import_excel_classifier",
        "bi",
        "ceo",
        "cto",
        "cx",
        "operations",
        "sales",
        "whatsapp",
      ],
      wh_kind: ["central", "branch", "virtual", "transit"],
    },
  },
} as const
