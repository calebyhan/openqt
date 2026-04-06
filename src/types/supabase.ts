export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      campaign_days: {
        Row: {
          campaign_id: string
          day_number: number
          id: string
          notes: string | null
          passage_ref: string | null
          prompt: string | null
          title: string | null
        }
        Insert: {
          campaign_id: string
          day_number: number
          id?: string
          notes?: string | null
          passage_ref?: string | null
          prompt?: string | null
          title?: string | null
        }
        Update: {
          campaign_id?: string
          day_number?: number
          id?: string
          notes?: string | null
          passage_ref?: string | null
          prompt?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_days_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_groups: {
        Row: {
          added_at: string
          campaign_id: string
          group_id: string
        }
        Insert: {
          added_at?: string
          campaign_id: string
          group_id: string
        }
        Update: {
          added_at?: string
          campaign_id?: string
          group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_groups_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_members: {
        Row: {
          campaign_id: string
          current_streak: number
          joined_at: string
          last_completed_day: number
          longest_streak: number
          user_id: string
        }
        Insert: {
          campaign_id: string
          current_streak?: number
          joined_at?: string
          last_completed_day?: number
          longest_streak?: number
          user_id: string
        }
        Update: {
          campaign_id?: string
          current_streak?: number
          joined_at?: string
          last_completed_day?: number
          longest_streak?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          id: string
          is_published: boolean
          start_date: string | null
          template_id: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_published?: boolean
          start_date?: string | null
          template_id?: string | null
          title: string
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_published?: boolean
          start_date?: string | null
          template_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "qt_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          body: string
          created_at: string
          id: string
          qt_entry_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          qt_entry_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          qt_entry_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_qt_entry_id_fkey"
            columns: ["qt_entry_id"]
            isOneToOne: false
            referencedRelation: "qt_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          auto_share: boolean
          group_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          auto_share?: boolean
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          auto_share?: boolean
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          invite_code: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          invite_code?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          invite_code?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_template_id: string | null
          default_translation: string
          display_name: string
          id: string
          notif_campaign_day: boolean
          notif_comments: boolean
          notif_daily_reminder: boolean
          notif_reactions: boolean
          notif_reminder_time: string
          notif_streak_warning: boolean
          push_subscription: Json | null
          timezone: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_template_id?: string | null
          default_translation?: string
          display_name: string
          id: string
          notif_campaign_day?: boolean
          notif_comments?: boolean
          notif_daily_reminder?: boolean
          notif_reactions?: boolean
          notif_reminder_time?: string
          notif_streak_warning?: boolean
          push_subscription?: Json | null
          timezone?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_template_id?: string | null
          default_translation?: string
          display_name?: string
          id?: string
          notif_campaign_day?: boolean
          notif_comments?: boolean
          notif_daily_reminder?: boolean
          notif_reactions?: boolean
          notif_reminder_time?: string
          notif_streak_warning?: boolean
          push_subscription?: Json | null
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_template_id_fkey"
            columns: ["default_template_id"]
            isOneToOne: false
            referencedRelation: "qt_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      qt_entries: {
        Row: {
          campaign_day: number | null
          campaign_id: string | null
          content: Json
          created_at: string
          id: string
          is_draft: boolean
          template_id: string
          title: string | null
          updated_at: string
          user_id: string
          verse_refs: Json | null
        }
        Insert: {
          campaign_day?: number | null
          campaign_id?: string | null
          content?: Json
          created_at?: string
          id?: string
          is_draft?: boolean
          template_id: string
          title?: string | null
          updated_at?: string
          user_id: string
          verse_refs?: Json | null
        }
        Update: {
          campaign_day?: number | null
          campaign_id?: string | null
          content?: Json
          created_at?: string
          id?: string
          is_draft?: boolean
          template_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          verse_refs?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "qt_entries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qt_entries_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "qt_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qt_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      qt_shares: {
        Row: {
          group_id: string
          id: string
          qt_entry_id: string
          shared_at: string
          visibility: string
        }
        Insert: {
          group_id: string
          id?: string
          qt_entry_id: string
          shared_at?: string
          visibility: string
        }
        Update: {
          group_id?: string
          id?: string
          qt_entry_id?: string
          shared_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "qt_shares_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qt_shares_qt_entry_id_fkey"
            columns: ["qt_entry_id"]
            isOneToOne: false
            referencedRelation: "qt_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      qt_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_system: boolean
          name: string
          sections: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          sections: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          sections?: Json
        }
        Relationships: [
          {
            foreignKeyName: "qt_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          qt_entry_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          qt_entry_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          qt_entry_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_qt_entry_id_fkey"
            columns: ["qt_entry_id"]
            isOneToOne: false
            referencedRelation: "qt_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_comment_on_entry: { Args: { eid: string }; Returns: boolean }
      can_see_entry: { Args: { eid: string }; Returns: boolean }
      is_group_member: { Args: { gid: string }; Returns: boolean }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

