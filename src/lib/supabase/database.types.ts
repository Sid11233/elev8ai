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
      applications: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          job_id: string
          pitch: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          job_id: string
          pitch?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          job_id?: string
          pitch?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          application_id: string
          created_at: string
          id: string
          last_message_at: string | null
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      course_access: {
        Row: {
          amount_cents: number | null
          course_id: string
          created_at: string
          id: string
          order_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents?: number | null
          course_id: string
          created_at?: string
          id?: string
          order_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number | null
          course_id?: string
          created_at?: string
          id?: string
          order_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_access_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_assignments: {
        Row: {
          course_id: string
          created_at: string
          feedback: string | null
          file_paths: string[]
          graded_at: string | null
          graded_by: string | null
          id: string
          links: string[]
          notes: string | null
          status: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          feedback?: string | null
          file_paths?: string[]
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          links?: string[]
          notes?: string | null
          status?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          feedback?: string | null
          file_paths?: string[]
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          links?: string[]
          notes?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          assignment_brief: string | null
          created_at: string
          description: string | null
          id: string
          lemon_variant_id: string | null
          price_cents: number
          published: boolean
          skill_id: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          assignment_brief?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lemon_variant_id?: string | null
          price_cents: number
          published?: boolean
          skill_id?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          assignment_brief?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lemon_variant_id?: string | null
          price_cents?: number
          published?: boolean
          skill_id?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          category: string
          company_id: string
          created_at: string
          deadline: string | null
          description: string
          id: string
          max_units: number | null
          pay_cents: number
          pay_type: string
          proof_instructions: string
          published_at: string | null
          required_skill_id: string | null
          slots: number
          spots_taken: number
          status: string
          title: string
          unit_label: string | null
          updated_at: string
        }
        Insert: {
          category: string
          company_id: string
          created_at?: string
          deadline?: string | null
          description: string
          id?: string
          max_units?: number | null
          pay_cents: number
          pay_type: string
          proof_instructions?: string
          published_at?: string | null
          required_skill_id?: string | null
          slots?: number
          spots_taken?: number
          status?: string
          title: string
          unit_label?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          deadline?: string | null
          description?: string
          id?: string
          max_units?: number | null
          pay_cents?: number
          pay_type?: string
          proof_instructions?: string
          published_at?: string | null
          required_skill_id?: string | null
          slots?: number
          spots_taken?: number
          status?: string
          title?: string
          unit_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_required_skill_id_fkey"
            columns: ["required_skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_completions: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_completions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          body_md: string | null
          course_id: string
          created_at: string
          id: string
          position: number
          title: string
          updated_at: string
          video_id: string | null
        }
        Insert: {
          body_md?: string | null
          course_id: string
          created_at?: string
          id?: string
          position?: number
          title: string
          updated_at?: string
          video_id?: string | null
        }
        Update: {
          body_md?: string | null
          course_id?: string
          created_at?: string
          id?: string
          position?: number
          title?: string
          updated_at?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_path: string | null
          body: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          attachment_path?: string | null
          body?: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          attachment_path?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          emailed_at: string | null
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          emailed_at?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          emailed_at?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payout_details: {
        Row: {
          created_at: string
          details: Json
          method: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json
          method: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: Json
          method?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payouts: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          method: string | null
          paid_at: string | null
          paid_by: string | null
          reference: string | null
          status: string
          submission_id: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          method?: string | null
          paid_at?: string | null
          paid_by?: string | null
          reference?: string | null
          status?: string
          submission_id: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          method?: string | null
          paid_at?: string | null
          paid_by?: string | null
          reference?: string | null
          status?: string
          submission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          email_opt_out: boolean
          full_name: string | null
          onboarded: boolean
          phone: string | null
          role: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email_opt_out?: boolean
          full_name?: string | null
          onboarded?: boolean
          phone?: string | null
          role?: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email_opt_out?: boolean
          full_name?: string | null
          onboarded?: boolean
          phone?: string | null
          role?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      skills: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          application_id: string
          created_at: string
          file_paths: string[]
          id: string
          links: string[]
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_note: string | null
          status: string
          units_approved: number | null
          units_claimed: number | null
          user_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          file_paths?: string[]
          id?: string
          links?: string[]
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          status?: string
          units_approved?: number | null
          units_claimed?: number | null
          user_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          file_paths?: string[]
          id?: string
          links?: string[]
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          status?: string
          units_approved?: number | null
          units_claimed?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      user_skills: {
        Row: {
          awarded_by: string | null
          created_at: string
          id: string
          skill_id: string
          source: string
          user_id: string
        }
        Insert: {
          awarded_by?: string | null
          created_at?: string
          id?: string
          skill_id: string
          source: string
          user_id: string
        }
        Update: {
          awarded_by?: string | null
          created_at?: string
          id?: string
          skill_id?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_to_job: {
        Args: { p_job_id: string; p_pitch?: string }
        Returns: string
      }
      can_access_conversation_folder: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      decide_application: {
        Args: { p_accept: boolean; p_application_id: string; p_note?: string }
        Returns: undefined
      }
      get_course_syllabus: {
        Args: { p_course_id: string }
        Returns: {
          id: string
          position: number
          title: string
        }[]
      }
      grade_assignment: {
        Args: { p_assignment_id: string; p_feedback?: string; p_pass: boolean }
        Returns: string
      }
      has_course_access: { Args: { p_course_id: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_conversation_participant: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      list_conversations: {
        Args: never
        Returns: {
          application_id: string
          conversation_id: string
          job_id: string
          job_title: string
          last_message: string
          last_message_at: string
          last_message_has_attachment: boolean
          last_sender_id: string
          talent_id: string
          unread_count: number
        }[]
      }
      mark_conversation_read: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      mark_payouts_paid: {
        Args: { p_method: string; p_payout_ids: string[]; p_reference?: string }
        Returns: number
      }
      review_submission: {
        Args: {
          p_decision: string
          p_note?: string
          p_submission_id: string
          p_units_approved?: number
        }
        Returns: undefined
      }
      submit_assignment: {
        Args: {
          p_course_id: string
          p_file_paths: string[]
          p_links: string[]
          p_notes: string
        }
        Returns: string
      }
      submit_work: {
        Args: {
          p_application_id: string
          p_file_paths: string[]
          p_links: string[]
          p_notes: string
          p_units_claimed?: number
        }
        Returns: string
      }
      withdraw_application: {
        Args: { p_application_id: string }
        Returns: undefined
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
    Enums: {},
  },
} as const
