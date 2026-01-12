export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Role = 'ADMIN' | 'COACH' | 'CODER';

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          username: string;
          password_hash: string;
          full_name: string;
          role: Role;
          parent_contact_phone: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          username: string;
          password_hash: string;
          full_name: string;
          role: Role;
          parent_contact_phone?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
        Relationships: [];
      };
      levels: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          order_index: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['levels']['Insert']>;
        Relationships: [];
      };
      blocks: {
        Row: {
          id: string;
          level_id: string;
          name: string;
          summary: string | null;
          order_index: number;
          estimated_sessions: number | null;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          level_id: string;
          name: string;
          summary?: string | null;
          order_index: number;
          estimated_sessions?: number | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['blocks']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'blocks_level_id_fkey';
            columns: ['level_id'];
            referencedRelation: 'levels';
            referencedColumns: ['id'];
          },
        ];
      };
      classes: {
        Row: {
          id: string;
          name: string;
          type: 'WEEKLY' | 'EKSKUL';
          level_id: string | null;
          coach_id: string;
          schedule_day: string;
          schedule_time: string;
          zoom_link: string;
          start_date: string;
          end_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: 'WEEKLY' | 'EKSKUL';
          level_id?: string | null;
          coach_id: string;
          schedule_day: string;
          schedule_time: string;
          zoom_link: string;
          start_date: string;
          end_date: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['classes']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'classes_level_id_fkey';
            columns: ['level_id'];
            referencedRelation: 'levels';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'classes_coach_id_fkey';
            columns: ['coach_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      class_blocks: {
        Row: {
          id: string;
          class_id: string;
          block_id: string;
          status: 'UPCOMING' | 'CURRENT' | 'COMPLETED';
          start_date: string;
          end_date: string;
          pitching_day_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          block_id: string;
          status?: 'UPCOMING' | 'CURRENT' | 'COMPLETED';
          start_date: string;
          end_date: string;
          pitching_day_date?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['class_blocks']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'class_blocks_block_id_fkey';
            columns: ['block_id'];
            referencedRelation: 'blocks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'class_blocks_class_id_fkey';
            columns: ['class_id'];
            referencedRelation: 'classes';
            referencedColumns: ['id'];
          },
        ];
      };
      lesson_templates: {
        Row: {
          id: string;
          block_id: string;
          title: string;
          summary: string | null;
          slide_url: string | null;
          example_url: string | null;
          example_storage_path: string | null;
          order_index: number;
          estimated_meeting_count: number | null;
          make_up_instructions: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          block_id: string;
          title: string;
          summary?: string | null;
          slide_url?: string | null;
          example_url?: string | null;
          example_storage_path?: string | null;
          order_index: number;
          estimated_meeting_count?: number | null;
          make_up_instructions?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['lesson_templates']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'lesson_templates_block_id_fkey';
            columns: ['block_id'];
            referencedRelation: 'blocks';
            referencedColumns: ['id'];
          },
        ];
      };
      sessions: {
        Row: {
          id: string;
          class_id: string;
          date_time: string;
          zoom_link_snapshot: string;
          status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
          substitute_coach_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          date_time: string;
          zoom_link_snapshot: string;
          status?: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
          substitute_coach_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['sessions']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'sessions_class_id_fkey';
            columns: ['class_id'];
            referencedRelation: 'classes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sessions_substitute_coach_id_fkey';
            columns: ['substitute_coach_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      class_lessons: {
        Row: {
          id: string;
          class_block_id: string;
          lesson_template_id: string | null;
          title: string;
          summary: string | null;
          order_index: number;
          session_id: string | null;
          unlock_at: string | null;
          make_up_instructions: string | null;
          slide_url: string | null;
          coach_example_url: string | null;
          coach_example_storage_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          class_block_id: string;
          lesson_template_id?: string | null;
          title: string;
          summary?: string | null;
          order_index: number;
          session_id?: string | null;
          unlock_at?: string | null;
          make_up_instructions?: string | null;
          slide_url?: string | null;
          coach_example_url?: string | null;
          coach_example_storage_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['class_lessons']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'class_lessons_class_block_id_fkey';
            columns: ['class_block_id'];
            referencedRelation: 'class_blocks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'class_lessons_lesson_template_id_fkey';
            columns: ['lesson_template_id'];
            referencedRelation: 'lesson_templates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'class_lessons_session_id_fkey';
            columns: ['session_id'];
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      coder_block_progress: {
        Row: {
          id: string;
          coder_id: string;
          level_id: string;
          block_id: string;
          journey_order: number;
          status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          coder_id: string;
          level_id: string;
          block_id: string;
          journey_order: number;
          status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['coder_block_progress']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'coder_block_progress_block_id_fkey';
            columns: ['block_id'];
            referencedRelation: 'blocks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'coder_block_progress_coder_id_fkey';
            columns: ['coder_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'coder_block_progress_level_id_fkey';
            columns: ['level_id'];
            referencedRelation: 'levels';
            referencedColumns: ['id'];
          },
        ];
      };
      enrollments: {
        Row: {
          id: string;
          class_id: string;
          coder_id: string;
          enrolled_at: string;
          status: 'ACTIVE' | 'INACTIVE';
        };
        Insert: {
          id?: string;
          class_id: string;
          coder_id: string;
          enrolled_at?: string;
          status?: 'ACTIVE' | 'INACTIVE';
        };
        Update: Partial<Database['public']['Tables']['enrollments']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'enrollments_class_id_fkey';
            columns: ['class_id'];
            referencedRelation: 'classes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'enrollments_coder_id_fkey';
            columns: ['coder_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      attendance: {
        Row: {
          id: string;
          session_id: string;
          coder_id: string;
          status: 'PRESENT' | 'LATE' | 'EXCUSED' | 'ABSENT';
          reason: string | null;
          make_up_task_created: boolean;
          recorded_by: string;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          coder_id: string;
          status: 'PRESENT' | 'LATE' | 'EXCUSED' | 'ABSENT';
          reason?: string | null;
          make_up_task_created?: boolean;
          recorded_by: string;
          recorded_at?: string;
        };
        Update: Partial<Database['public']['Tables']['attendance']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'attendance_session_id_fkey';
            columns: ['session_id'];
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_coder_id_fkey';
            columns: ['coder_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_recorded_by_fkey';
            columns: ['recorded_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      make_up_tasks: {
        Row: {
          id: string;
          attendance_id: string;
          coder_id: string;
          session_id: string;
          class_lesson_id: string | null;
          due_date: string;
          status: 'PENDING_UPLOAD' | 'SUBMITTED' | 'REVIEWED';
          instructions: string | null;
          submission_files: Json | null;
          submitted_at: string | null;
          reviewed_by_coach_id: string | null;
          reviewed_at: string | null;
          feedback: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          attendance_id: string;
          coder_id: string;
          session_id: string;
          class_lesson_id?: string | null;
          due_date: string;
          status?: 'PENDING_UPLOAD' | 'SUBMITTED' | 'REVIEWED';
          instructions?: string | null;
          submission_files?: Json | null;
          submitted_at?: string | null;
          reviewed_by_coach_id?: string | null;
          reviewed_at?: string | null;
          feedback?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['make_up_tasks']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'make_up_tasks_attendance_id_fkey';
            columns: ['attendance_id'];
            referencedRelation: 'attendance';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'make_up_tasks_coder_id_fkey';
            columns: ['coder_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'make_up_tasks_session_id_fkey';
            columns: ['session_id'];
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'make_up_tasks_class_lesson_id_fkey';
            columns: ['class_lesson_id'];
            referencedRelation: 'class_lessons';
            referencedColumns: ['id'];
          },
        ];
      };
      coach_leave_requests: {
        Row: {
          id: string;
          coach_id: string;
          session_id: string;
          status: 'PENDING' | 'APPROVED' | 'REJECTED';
          note: string | null;
          substitute_coach_id: string | null;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          coach_id: string;
          session_id: string;
          status?: 'PENDING' | 'APPROVED' | 'REJECTED';
          note?: string | null;
          substitute_coach_id?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['coach_leave_requests']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'coach_leave_requests_coach_id_fkey';
            columns: ['coach_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'coach_leave_requests_session_id_fkey';
            columns: ['session_id'];
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'coach_leave_requests_substitute_coach_id_fkey';
            columns: ['substitute_coach_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'coach_leave_requests_approved_by_fkey';
            columns: ['approved_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      exkul_session_competencies: {
        Row: {
          id: string;
          session_id: string;
          competencies: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          competencies: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['exkul_session_competencies']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'exkul_session_competencies_session_id_fkey';
            columns: ['session_id'];
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      materials: {
        Row: {
          id: string;
          class_id: string;
          session_id: string | null;
          block_id: string | null;
          title: string;
          description: string | null;
          file_url: string | null;
          coach_note: string | null;
          visible_from_session_id: string | null;
          uploaded_by_user_id: string;
          uploaded_by_role: Role;
          created_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          session_id?: string | null;
          block_id?: string | null;
          title: string;
          description?: string | null;
          file_url?: string | null;
          coach_note?: string | null;
          visible_from_session_id?: string | null;
          uploaded_by_user_id: string;
          uploaded_by_role: Role;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['materials']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'materials_class_id_fkey';
            columns: ['class_id'];
            referencedRelation: 'classes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'materials_session_id_fkey';
            columns: ['session_id'];
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'materials_block_id_fkey';
            columns: ['block_id'];
            referencedRelation: 'blocks';
            referencedColumns: ['id'];
          },
        ];
      };
      rubric_templates: {
        Row: {
          id: string;
          class_type: 'WEEKLY' | 'EKSKUL';
          level_id: string | null;
          competencies: Json;
          positive_characters: string[];
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          class_type: 'WEEKLY' | 'EKSKUL';
          level_id?: string | null;
          competencies: Json;
          positive_characters: string[];
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['rubric_templates']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'rubric_templates_level_id_fkey';
            columns: ['level_id'];
            referencedRelation: 'levels';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rubric_templates_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      rubric_submissions: {
        Row: {
          id: string;
          class_id: string;
          coder_id: string;
          block_id: string | null;
          semester_tag: string | null;
          rubric_template_id: string;
          grades: Json;
          positive_character_chosen: string[];
          narrative: string;
          submitted_by: string;
          submitted_at: string;
          updated_at: string;
          status: 'DRAFT' | 'FINAL';
        };
        Insert: {
          id?: string;
          class_id: string;
          coder_id: string;
          block_id?: string | null;
          semester_tag?: string | null;
          rubric_template_id: string;
          grades: Json;
          positive_character_chosen: string[];
          narrative: string;
          submitted_by: string;
          submitted_at?: string;
          updated_at?: string;
          status?: 'DRAFT' | 'FINAL';
        };
        Update: Partial<Database['public']['Tables']['rubric_submissions']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'rubric_submissions_block_id_fkey';
            columns: ['block_id'];
            referencedRelation: 'blocks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rubric_submissions_class_id_fkey';
            columns: ['class_id'];
            referencedRelation: 'classes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rubric_submissions_coder_id_fkey';
            columns: ['coder_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rubric_submissions_rubric_template_id_fkey';
            columns: ['rubric_template_id'];
            referencedRelation: 'rubric_templates';
            referencedColumns: ['id'];
          },
        ];
      };
      pitching_day_reports: {
        Row: {
          id: string;
          rubric_submission_id: string;
          pdf_url: string;
          storage_path: string;
          generated_at: string;
          sent_via_whatsapp: boolean;
          sent_to_parent_at: string | null;
        };
        Insert: {
          id?: string;
          rubric_submission_id: string;
          pdf_url: string;
          storage_path: string;
          generated_at?: string;
          sent_via_whatsapp?: boolean;
          sent_to_parent_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['pitching_day_reports']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'pitching_day_reports_submission_id_fkey';
            columns: ['rubric_submission_id'];
            referencedRelation: 'rubric_submissions';
            referencedColumns: ['id'];
          },
        ];
      };
      whatsapp_message_logs: {
        Row: {
          id: string;
          category: 'PARENT_ABSENT' | 'REPORT_SEND' | 'REMINDER';
          payload: Json;
          response: Json | null;
          status: 'QUEUED' | 'SENT' | 'FAILED';
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          category: 'PARENT_ABSENT' | 'REPORT_SEND' | 'REMINDER';
          payload: Json;
          response?: Json | null;
          status?: 'QUEUED' | 'SENT' | 'FAILED';
          created_at?: string;
          processed_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['whatsapp_message_logs']['Insert']>;
        Relationships: [];
      };
      software: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          version: string | null;
          installation_url: string | null;
          installation_instructions: string | null;
          minimum_specs: Json | null;
          access_info: string | null;
          icon_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          version?: string | null;
          installation_url?: string | null;
          installation_instructions?: string | null;
          minimum_specs?: Json | null;
          access_info?: string | null;
          icon_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['software']['Insert']>;
        Relationships: [];
      };
      block_software: {
        Row: {
          id: string;
          block_id: string;
          software_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          block_id: string;
          software_id: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['block_software']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'block_software_block_id_fkey';
            columns: ['block_id'];
            referencedRelation: 'blocks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'block_software_software_id_fkey';
            columns: ['software_id'];
            referencedRelation: 'software';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

export type Tables = Database['public']['Tables'];

export type TableName = keyof Tables;

export type TablesInsert<TName extends TableName> = Tables[TName]['Insert'];

export type TablesRow<TName extends TableName> = Tables[TName]['Row'];

export type TablesUpdate<TName extends TableName> = Tables[TName]['Update'];
