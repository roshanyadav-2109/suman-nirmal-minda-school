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
      absence_notice: {
        Row: {
          academic_year_id: number
          created_at: string
          explained_at: string | null
          explained_by: string | null
          id: number
          on_date: string
          reason: string | null
          section_id: number
          status: string
          student_id: number
        }
        Insert: {
          academic_year_id: number
          created_at?: string
          explained_at?: string | null
          explained_by?: string | null
          id?: never
          on_date: string
          reason?: string | null
          section_id: number
          status?: string
          student_id: number
        }
        Update: {
          academic_year_id?: number
          created_at?: string
          explained_at?: string | null
          explained_by?: string | null
          id?: never
          on_date?: string
          reason?: string | null
          section_id?: number
          status?: string
          student_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "absence_notice_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_notice_explained_by_fkey"
            columns: ["explained_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_notice_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_notice_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_year: {
        Row: {
          created_at: string
          end_date: string
          id: number
          is_current: boolean
          name: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: never
          is_current?: boolean
          name: string
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: never
          is_current?: boolean
          name?: string
          start_date?: string
        }
        Relationships: []
      }
      announcement: {
        Row: {
          academic_year_id: number | null
          body: string
          class_id: number | null
          created_at: string
          created_by: number | null
          id: number
          published_at: string
          scope: Database["public"]["Enums"]["announcement_scope"]
          section_id: number | null
          title: string
        }
        Insert: {
          academic_year_id?: number | null
          body: string
          class_id?: number | null
          created_at?: string
          created_by?: number | null
          id?: never
          published_at?: string
          scope?: Database["public"]["Enums"]["announcement_scope"]
          section_id?: number | null
          title: string
        }
        Update: {
          academic_year_id?: number | null
          body?: string
          class_id?: number | null
          created_at?: string
          created_by?: number | null
          id?: never
          published_at?: string
          scope?: Database["public"]["Enums"]["announcement_scope"]
          section_id?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "section"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment: {
        Row: {
          academic_year_id: number
          assessed_on: string
          assessment_type_id: number
          created_at: string
          created_by: number | null
          id: number
          is_published: boolean
          max_marks: number
          name: string
          published_at: string | null
          section_id: number
          subject_id: number
          term: number | null
        }
        Insert: {
          academic_year_id: number
          assessed_on: string
          assessment_type_id: number
          created_at?: string
          created_by?: number | null
          id?: never
          is_published?: boolean
          max_marks?: number
          name: string
          published_at?: string | null
          section_id: number
          subject_id: number
          term?: number | null
        }
        Update: {
          academic_year_id?: number
          assessed_on?: string
          assessment_type_id?: number
          created_at?: string
          created_by?: number | null
          id?: never
          is_published?: boolean
          max_marks?: number
          name?: string
          published_at?: string | null
          section_id?: number
          subject_id?: number
          term?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_assessment_type_id_fkey"
            columns: ["assessment_type_id"]
            isOneToOne: false
            referencedRelation: "assessment_type"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subject"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_type: {
        Row: {
          code: string
          id: number
          is_numeric: boolean
          name: string
          weightage: number | null
        }
        Insert: {
          code: string
          id?: never
          is_numeric?: boolean
          name: string
          weightage?: number | null
        }
        Update: {
          code?: string
          id?: never
          is_numeric?: boolean
          name?: string
          weightage?: number | null
        }
        Relationships: []
      }
      attendance_record: {
        Row: {
          academic_year_id: number
          created_at: string
          id: number
          marked_by: number | null
          on_date: string
          period: number | null
          section_id: number
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: number
          subject_id: number | null
        }
        Insert: {
          academic_year_id: number
          created_at?: string
          id?: never
          marked_by?: number | null
          on_date: string
          period?: number | null
          section_id: number
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: number
          subject_id?: number | null
        }
        Update: {
          academic_year_id?: number
          created_at?: string
          id?: never
          marked_by?: number | null
          on_date?: string
          period?: number | null
          section_id?: number
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: number
          subject_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_record_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_record_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_record_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_record_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_record_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subject"
            referencedColumns: ["id"]
          },
        ]
      }
      class: {
        Row: {
          created_at: string
          id: number
          level: number
          name: string
          stage: Database["public"]["Enums"]["nep_stage"]
        }
        Insert: {
          created_at?: string
          id?: never
          level: number
          name: string
          stage: Database["public"]["Enums"]["nep_stage"]
        }
        Update: {
          created_at?: string
          id?: never
          level?: number
          name?: string
          stage?: Database["public"]["Enums"]["nep_stage"]
        }
        Relationships: []
      }
      class_subject: {
        Row: {
          class_id: number
          subject_id: number
        }
        Insert: {
          class_id: number
          subject_id: number
        }
        Update: {
          class_id?: number
          subject_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_subject_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subject_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subject"
            referencedColumns: ["id"]
          },
        ]
      }
      event: {
        Row: {
          academic_year_id: number | null
          class_id: number | null
          created_at: string
          created_by: number | null
          description: string | null
          end_date: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          id: number
          remind_before_days: number
          section_id: number | null
          start_date: string
          title: string
        }
        Insert: {
          academic_year_id?: number | null
          class_id?: number | null
          created_at?: string
          created_by?: number | null
          description?: string | null
          end_date?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: never
          remind_before_days?: number
          section_id?: number | null
          start_date: string
          title: string
        }
        Update: {
          academic_year_id?: number | null
          class_id?: number | null
          created_at?: string
          created_by?: number | null
          description?: string | null
          end_date?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: never
          remind_before_days?: number
          section_id?: number | null
          start_date?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "section"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          body: string
          created_at: string
          from_profile: string | null
          id: number
          related_announcement_id: number | null
          responded_by: number | null
          response: string | null
          section_id: number
          status: Database["public"]["Enums"]["feedback_status"]
          student_id: number
          subject: string
        }
        Insert: {
          body: string
          created_at?: string
          from_profile?: string | null
          id?: never
          related_announcement_id?: number | null
          responded_by?: number | null
          response?: string | null
          section_id: number
          status?: Database["public"]["Enums"]["feedback_status"]
          student_id: number
          subject: string
        }
        Update: {
          body?: string
          created_at?: string
          from_profile?: string | null
          id?: never
          related_announcement_id?: number | null
          responded_by?: number | null
          response?: string | null
          section_id?: number
          status?: Database["public"]["Enums"]["feedback_status"]
          student_id?: number
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_from_profile_fkey"
            columns: ["from_profile"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_related_announcement_id_fkey"
            columns: ["related_announcement_id"]
            isOneToOne: false
            referencedRelation: "announcement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: number
          phone: string | null
          relation: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: never
          phone?: string | null
          relation?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: never
          phone?: string | null
          relation?: string | null
        }
        Relationships: []
      }
      guardian_student: {
        Row: {
          guardian_id: number
          is_primary: boolean
          student_id: number
        }
        Insert: {
          guardian_id: number
          is_primary?: boolean
          student_id: number
        }
        Update: {
          guardian_id?: number
          is_primary?: boolean
          student_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "guardian_student_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardian"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_student_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      hpc_input: {
        Row: {
          academic_year_id: number
          competency: string
          created_at: string
          id: number
          note: string | null
          rating: number | null
          source: Database["public"]["Enums"]["hpc_source"]
          student_id: number
          submitted_by: string | null
        }
        Insert: {
          academic_year_id: number
          competency: string
          created_at?: string
          id?: never
          note?: string | null
          rating?: number | null
          source: Database["public"]["Enums"]["hpc_source"]
          student_id: number
          submitted_by?: string | null
        }
        Update: {
          academic_year_id?: number
          competency?: string
          created_at?: string
          id?: never
          note?: string | null
          rating?: number | null
          source?: Database["public"]["Enums"]["hpc_source"]
          student_id?: number
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hpc_input_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hpc_input_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hpc_input_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_application: {
        Row: {
          academic_year_id: number
          applied_by: string | null
          created_at: string
          decided_at: string | null
          decided_by: number | null
          decision_note: string | null
          from_date: string
          id: number
          reason: string
          section_id: number
          status: Database["public"]["Enums"]["leave_status"]
          student_id: number
          to_date: string
        }
        Insert: {
          academic_year_id: number
          applied_by?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: number | null
          decision_note?: string | null
          from_date: string
          id?: never
          reason: string
          section_id: number
          status?: Database["public"]["Enums"]["leave_status"]
          student_id: number
          to_date: string
        }
        Update: {
          academic_year_id?: number
          applied_by?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: number | null
          decision_note?: string | null
          from_date?: string
          id?: never
          reason?: string
          section_id?: number
          status?: Database["public"]["Enums"]["leave_status"]
          student_id?: number
          to_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_application_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_application_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_application_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_application_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_application_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      mark: {
        Row: {
          assessment_id: number
          created_at: string
          entered_by: number | null
          grade: string | null
          id: number
          is_absent: boolean
          marks_obtained: number | null
          remark: string | null
          student_id: number
          updated_at: string
        }
        Insert: {
          assessment_id: number
          created_at?: string
          entered_by?: number | null
          grade?: string | null
          id?: never
          is_absent?: boolean
          marks_obtained?: number | null
          remark?: string | null
          student_id: number
          updated_at?: string
        }
        Update: {
          assessment_id?: number
          created_at?: string
          entered_by?: number | null
          grade?: string | null
          id?: never
          is_absent?: boolean
          marks_obtained?: number | null
          remark?: string | null
          student_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mark_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mark_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "v_mark_detail"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "mark_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "v_student_subject_trend"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "mark_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mark_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_report: {
        Row: {
          academic_year_id: number
          emailed_at: string | null
          generated_at: string
          id: number
          month: string
          pdf_path: string | null
          section_id: number
          student_id: number
          summary: Json | null
        }
        Insert: {
          academic_year_id: number
          emailed_at?: string | null
          generated_at?: string
          id?: never
          month: string
          pdf_path?: string | null
          section_id: number
          student_id: number
          summary?: Json | null
        }
        Update: {
          academic_year_id?: number
          emailed_at?: string | null
          generated_at?: string
          id?: never
          month?: string
          pdf_path?: string | null
          section_id?: number
          student_id?: number
          summary?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_report_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_report_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_report_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      observation: {
        Row: {
          academic_year_id: number
          body: string
          category: Database["public"]["Enums"]["observation_category"]
          competency: string | null
          created_at: string
          id: number
          observed_on: string
          rating: number | null
          staff_id: number
          student_id: number
          subject_id: number | null
          visible_to_guardian: boolean
        }
        Insert: {
          academic_year_id: number
          body: string
          category?: Database["public"]["Enums"]["observation_category"]
          competency?: string | null
          created_at?: string
          id?: never
          observed_on?: string
          rating?: number | null
          staff_id: number
          student_id: number
          subject_id?: number | null
          visible_to_guardian?: boolean
        }
        Update: {
          academic_year_id?: number
          body?: string
          category?: Database["public"]["Enums"]["observation_category"]
          competency?: string | null
          created_at?: string
          id?: never
          observed_on?: string
          rating?: number | null
          staff_id?: number
          student_id?: number
          subject_id?: number | null
          visible_to_guardian?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "observation_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observation_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observation_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observation_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subject"
            referencedColumns: ["id"]
          },
        ]
      }
      profile: {
        Row: {
          created_at: string
          full_name: string
          guardian_id: number | null
          id: string
          locale: string
          role: Database["public"]["Enums"]["profile_role"]
          staff_id: number | null
          student_id: number | null
        }
        Insert: {
          created_at?: string
          full_name: string
          guardian_id?: number | null
          id: string
          locale?: string
          role: Database["public"]["Enums"]["profile_role"]
          staff_id?: number | null
          student_id?: number | null
        }
        Update: {
          created_at?: string
          full_name?: string
          guardian_id?: number | null
          id?: string
          locale?: string
          role?: Database["public"]["Enums"]["profile_role"]
          staff_id?: number | null
          student_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: true
            referencedRelation: "guardian"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion: {
        Row: {
          created_at: string
          decided_by: number | null
          from_section_id: number | null
          from_year_id: number | null
          id: number
          outcome: string
          student_id: number
          to_section_id: number | null
          to_year_id: number
        }
        Insert: {
          created_at?: string
          decided_by?: number | null
          from_section_id?: number | null
          from_year_id?: number | null
          id?: never
          outcome: string
          student_id: number
          to_section_id?: number | null
          to_year_id: number
        }
        Update: {
          created_at?: string
          decided_by?: number | null
          from_section_id?: number | null
          from_year_id?: number | null
          id?: never
          outcome?: string
          student_id?: number
          to_section_id?: number | null
          to_year_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "promotion_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_from_section_id_fkey"
            columns: ["from_section_id"]
            isOneToOne: false
            referencedRelation: "section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_from_year_id_fkey"
            columns: ["from_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_to_section_id_fkey"
            columns: ["to_section_id"]
            isOneToOne: false
            referencedRelation: "section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_to_year_id_fkey"
            columns: ["to_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
        ]
      }
      school: {
        Row: {
          address: string | null
          code: string | null
          created_at: string
          emblem_path: string | null
          id: number
          name: string
        }
        Insert: {
          address?: string | null
          code?: string | null
          created_at?: string
          emblem_path?: string | null
          id?: never
          name: string
        }
        Update: {
          address?: string | null
          code?: string | null
          created_at?: string
          emblem_path?: string | null
          id?: never
          name?: string
        }
        Relationships: []
      }
      section: {
        Row: {
          class_id: number
          created_at: string
          id: number
          name: string
        }
        Insert: {
          class_id: number
          created_at?: string
          id?: never
          name: string
        }
        Update: {
          class_id?: number
          created_at?: string
          id?: never
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class"
            referencedColumns: ["id"]
          },
        ]
      }
      slippage_flag: {
        Row: {
          academic_year_id: number
          computed_at: string
          id: number
          is_active: boolean
          reason: string | null
          section_id: number
          student_id: number
          subject_id: number | null
          trend_delta: number | null
          window_size: number
        }
        Insert: {
          academic_year_id: number
          computed_at?: string
          id?: never
          is_active?: boolean
          reason?: string | null
          section_id: number
          student_id: number
          subject_id?: number | null
          trend_delta?: number | null
          window_size?: number
        }
        Update: {
          academic_year_id?: number
          computed_at?: string
          id?: never
          is_active?: boolean
          reason?: string | null
          section_id?: number
          student_id?: number
          subject_id?: number | null
          trend_delta?: number | null
          window_size?: number
        }
        Relationships: [
          {
            foreignKeyName: "slippage_flag_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slippage_flag_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slippage_flag_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slippage_flag_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subject"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          email: string | null
          employee_code: string | null
          full_name: string
          id: number
          phone: string | null
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          employee_code?: string | null
          full_name: string
          id?: never
          phone?: string | null
          role: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          employee_code?: string | null
          full_name?: string
          id?: never
          phone?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
        }
        Relationships: []
      }
      student: {
        Row: {
          admission_no: string
          created_at: string
          dob: string | null
          exit_remark: string | null
          full_name: string
          gender: Database["public"]["Enums"]["gender_type"] | null
          id: number
          left_on: string | null
          photo_path: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admission_no: string
          created_at?: string
          dob?: string | null
          exit_remark?: string | null
          full_name: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: never
          left_on?: string | null
          photo_path?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admission_no?: string
          created_at?: string
          dob?: string | null
          exit_remark?: string | null
          full_name?: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: never
          left_on?: string | null
          photo_path?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_enrollment: {
        Row: {
          academic_year_id: number
          created_at: string
          id: number
          roll_no: number | null
          section_id: number
          status: string
          student_id: number
        }
        Insert: {
          academic_year_id: number
          created_at?: string
          id?: never
          roll_no?: number | null
          section_id: number
          status?: string
          student_id: number
        }
        Update: {
          academic_year_id?: number
          created_at?: string
          id?: never
          roll_no?: number | null
          section_id?: number
          status?: string
          student_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_enrollment_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollment_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollment_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      subject: {
        Row: {
          code: string
          created_at: string
          id: number
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: never
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: never
          name?: string
        }
        Relationships: []
      }
      teacher_allotment: {
        Row: {
          academic_year_id: number
          created_at: string
          id: number
          is_class_teacher: boolean
          section_id: number
          staff_id: number
          subject_id: number | null
        }
        Insert: {
          academic_year_id: number
          created_at?: string
          id?: never
          is_class_teacher?: boolean
          section_id: number
          staff_id: number
          subject_id?: number | null
        }
        Update: {
          academic_year_id?: number
          created_at?: string
          id?: never
          is_class_teacher?: boolean
          section_id?: number
          staff_id?: number
          subject_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_allotment_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_allotment_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_allotment_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_allotment_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subject"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_mark_detail: {
        Row: {
          academic_year_id: number | null
          assessed_on: string | null
          assessment_id: number | null
          assessment_name: string | null
          band: string | null
          class_id: number | null
          class_level: number | null
          class_name: string | null
          is_absent: boolean | null
          is_current: boolean | null
          is_numeric: boolean | null
          mark_id: number | null
          marks_obtained: number | null
          max_marks: number | null
          percent: number | null
          section_id: number | null
          section_name: string | null
          student_id: number | null
          student_name: string | null
          subject_code: string | null
          subject_id: number | null
          subject_name: string | null
          term: number | null
          type_code: string | null
          year_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subject"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mark_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class"
            referencedColumns: ["id"]
          },
        ]
      }
      v_section_distribution: {
        Row: {
          academic_year_id: number | null
          band: string | null
          n: number | null
          section_id: number | null
          subject_id: number | null
          term: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subject"
            referencedColumns: ["id"]
          },
        ]
      }
      v_section_subject_summary: {
        Row: {
          academic_year_id: number | null
          avg_percent: number | null
          class_id: number | null
          class_level: number | null
          class_name: string | null
          max_percent: number | null
          min_percent: number | null
          n_marks: number | null
          n_students: number | null
          section_id: number | null
          section_name: string | null
          subject_code: string | null
          subject_id: number | null
          subject_name: string | null
          term: number | null
          year_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subject"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class"
            referencedColumns: ["id"]
          },
        ]
      }
      v_student_subject_trend: {
        Row: {
          academic_year_id: number | null
          assessed_on: string | null
          assessment_id: number | null
          assessment_name: string | null
          band: string | null
          class_id: number | null
          class_level: number | null
          class_name: string | null
          delta: number | null
          is_absent: boolean | null
          is_current: boolean | null
          is_numeric: boolean | null
          mark_id: number | null
          marks_obtained: number | null
          max_marks: number | null
          percent: number | null
          prev_percent: number | null
          section_id: number | null
          section_name: string | null
          seq: number | null
          student_id: number | null
          student_name: string | null
          subject_code: string | null
          subject_id: number | null
          subject_name: string | null
          term: number | null
          type_code: string | null
          year_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subject"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mark_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      attendance_overview: {
        Args: { p_date: string; p_year: number }
        Returns: {
          class_id: number
          class_level: number
          class_name: string
          present: number
          section_id: number
          section_name: string
          total: number
        }[]
      }
      attendance_overview_range: {
        Args: { p_end: string; p_start: string; p_year: number }
        Returns: {
          class_id: number
          class_level: number
          class_name: string
          present: number
          section_id: number
          section_name: string
          total: number
        }[]
      }
      auto_conclusions: {
        Args: { p_section: number; p_year: number }
        Returns: string[]
      }
      class_comparison: {
        Args: { p_subject: number; p_year: number }
        Returns: {
          avg_percent: number
          class_id: number
          class_level: number
          class_name: string
          n_students: number
        }[]
      }
      class_overview: {
        Args: { p_year: number }
        Returns: {
          avg_percent: number
          class_id: number
          class_level: number
          class_name: string
          students: number
        }[]
      }
      commit_promotion: {
        Args: { p_from_year: number; p_rows: Json; p_to_year: number }
        Returns: number
      }
      create_class_exam: {
        Args: {
          p_class: number
          p_date: string
          p_max: number
          p_name: string
          p_subject: number
          p_term: number
          p_type?: string
          p_year: number
        }
        Returns: number
      }
      grade_band: { Args: { pct: number }; Returns: string }
      needs_support: {
        Args: { p_section: number; p_threshold?: number; p_year: number }
        Returns: {
          avg_percent: number
          reason: string
          recent_trend: number
          student_id: number
          student_name: string
          weak_subjects: string
        }[]
      }
      needs_support_class: {
        Args: { p_class: number; p_threshold?: number; p_year: number }
        Returns: {
          avg_percent: number
          reason: string
          recent_trend: number
          section_name: string
          student_id: number
          student_name: string
          weak_subjects: string
        }[]
      }
      promotable_classes: {
        Args: { p_from_year: number; p_to_year: number }
        Returns: {
          class_id: number
          class_level: number
          class_name: string
          promoted: number
          students: number
        }[]
      }
      promotion_roster: {
        Args: { p_class: number; p_from_year: number; p_to_year: number }
        Returns: {
          full_name: string
          outcome: string
          roll_no: number
          section_id: number
          section_name: string
          status: string
          student_id: number
          to_section_id: number
        }[]
      }
      promotion_summary: {
        Args: { p_to_year: number }
        Returns: {
          class_id: number
          class_level: number
          class_name: string
          graduated: number
          promoted: number
          retained: number
          total: number
          transferred: number
        }[]
      }
      refresh_slippage_flags: {
        Args: { p_threshold?: number; p_window?: number }
        Returns: number
      }
      school_overview: {
        Args: { p_year: number }
        Returns: {
          attendance_pct: number
          avg_percent: number
          slippage: number
          students: number
        }[]
      }
      section_attendance_range: {
        Args: {
          p_end: string
          p_section: number
          p_start: string
          p_year: number
        }
        Returns: {
          full_name: string
          present: number
          roll_no: number
          student_id: number
          total: number
        }[]
      }
      section_comparison: {
        Args: { p_class: number; p_subject: number; p_year: number }
        Returns: {
          avg_percent: number
          n_students: number
          section_id: number
          section_name: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      student_standing: {
        Args: { p_student: number; p_year: number }
        Returns: {
          class_avg: number
          class_rank: number
          class_size: number
          section_avg: number
          section_rank: number
          section_size: number
          student_avg: number
        }[]
      }
      top_performers: {
        Args: {
          p_limit?: number
          p_section: number
          p_subject?: number
          p_year: number
        }
        Returns: {
          avg_percent: number
          n_marks: number
          student_id: number
          student_name: string
        }[]
      }
      top_performers_class: {
        Args: {
          p_class: number
          p_limit?: number
          p_subject?: number
          p_year: number
        }
        Returns: {
          avg_percent: number
          n_marks: number
          section_name: string
          student_id: number
          student_name: string
        }[]
      }
    }
    Enums: {
      announcement_scope: "school" | "class" | "section"
      attendance_status: "present" | "absent" | "late" | "leave" | "holiday"
      event_type: "holiday" | "exam" | "ptm" | "activity" | "other"
      feedback_status: "new" | "read" | "responded"
      gender_type: "male" | "female" | "other"
      hpc_source: "self" | "peer" | "parent" | "teacher"
      leave_status: "pending" | "approved" | "rejected" | "cancelled"
      nep_stage: "foundational" | "preparatory" | "middle" | "senior"
      observation_category:
        | "strength"
        | "difficulty"
        | "progress"
        | "behaviour"
        | "general"
      profile_role: "student" | "guardian" | "staff"
      staff_role: "subject_teacher" | "class_teacher" | "principal" | "office"
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
      announcement_scope: ["school", "class", "section"],
      attendance_status: ["present", "absent", "late", "leave", "holiday"],
      event_type: ["holiday", "exam", "ptm", "activity", "other"],
      feedback_status: ["new", "read", "responded"],
      gender_type: ["male", "female", "other"],
      hpc_source: ["self", "peer", "parent", "teacher"],
      leave_status: ["pending", "approved", "rejected", "cancelled"],
      nep_stage: ["foundational", "preparatory", "middle", "senior"],
      observation_category: [
        "strength",
        "difficulty",
        "progress",
        "behaviour",
        "general",
      ],
      profile_role: ["student", "guardian", "staff"],
      staff_role: ["subject_teacher", "class_teacher", "principal", "office"],
    },
  },
} as const
