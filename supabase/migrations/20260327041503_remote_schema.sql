

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE TYPE "public"."AttendanceStatus" AS ENUM (
    'PRESENT',
    'ABSENT'
);


ALTER TYPE "public"."AttendanceStatus" OWNER TO "postgres";


CREATE TYPE "public"."BlockStatus" AS ENUM (
    'CURRENT',
    'UPCOMING',
    'COMPLETED'
);


ALTER TYPE "public"."BlockStatus" OWNER TO "postgres";


CREATE TYPE "public"."ClassType" AS ENUM (
    'WEEKLY',
    'EKSKUL'
);


ALTER TYPE "public"."ClassType" OWNER TO "postgres";


CREATE TYPE "public"."MakeUpStatus" AS ENUM (
    'PENDING_UPLOAD',
    'SUBMITTED',
    'REVIEWED_OK'
);


ALTER TYPE "public"."MakeUpStatus" OWNER TO "postgres";


CREATE TYPE "public"."Role" AS ENUM (
    'ADMIN',
    'COACH',
    'CODER'
);


ALTER TYPE "public"."Role" OWNER TO "postgres";


CREATE TYPE "public"."SessionStatus" AS ENUM (
    'SCHEDULED',
    'COMPLETED',
    'CANCELLED'
);


ALTER TYPE "public"."SessionStatus" OWNER TO "postgres";


CREATE TYPE "public"."attendance_status_enum" AS ENUM (
    'PRESENT',
    'ABSENT'
);


ALTER TYPE "public"."attendance_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."block_report_status_enum" AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'SENT',
    'SUBMITTED'
);


ALTER TYPE "public"."block_report_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."class_block_status_enum" AS ENUM (
    'UPCOMING',
    'CURRENT',
    'COMPLETED'
);


ALTER TYPE "public"."class_block_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."class_type_enum" AS ENUM (
    'WEEKLY',
    'EKSKUL'
);


ALTER TYPE "public"."class_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."coach_leave_status_enum" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE "public"."coach_leave_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."coder_block_status_enum" AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED'
);


ALTER TYPE "public"."coder_block_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."enrollment_status_enum" AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


ALTER TYPE "public"."enrollment_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."invoice_status_enum" AS ENUM (
    'PENDING',
    'PAID',
    'OVERDUE'
);


ALTER TYPE "public"."invoice_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."make_up_status_enum" AS ENUM (
    'PENDING_UPLOAD',
    'SUBMITTED',
    'REVIEWED'
);


ALTER TYPE "public"."make_up_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."role_enum" AS ENUM (
    'ADMIN',
    'COACH',
    'CODER',
    'superadmin'
);


ALTER TYPE "public"."role_enum" OWNER TO "postgres";


CREATE TYPE "public"."rubric_submission_status_enum" AS ENUM (
    'DRAFT',
    'FINAL'
);


ALTER TYPE "public"."rubric_submission_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."session_status_enum" AS ENUM (
    'SCHEDULED',
    'COMPLETED',
    'CANCELLED'
);


ALTER TYPE "public"."session_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."whatsapp_category_enum" AS ENUM (
    'PARENT_ABSENT',
    'REPORT_SEND',
    'REMINDER',
    'INVOICE'
);


ALTER TYPE "public"."whatsapp_category_enum" OWNER TO "postgres";


CREATE TYPE "public"."whatsapp_status_enum" AS ENUM (
    'QUEUED',
    'SENT',
    'FAILED'
);


ALTER TYPE "public"."whatsapp_status_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."extract_ccr_sequence"("code" "text") RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  IF NOT public.validate_ccr_code(code) THEN
    RETURN NULL;
  END IF;
  RETURN CAST(SUBSTRING(code FROM 4) AS integer);
END;
$$;


ALTER FUNCTION "public"."extract_ccr_sequence"("code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."format_ccr_code"("seq" integer) RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  RETURN 'CCR' || LPAD(seq::text, 3, '0');
END;
$$;


ALTER FUNCTION "public"."format_ccr_code"("seq" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_next_ccr_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  max_seq integer;
  next_code text;
BEGIN
  SELECT COALESCE(MAX(ccr_sequence), 0) INTO max_seq FROM public.ccr_numbers;
  next_code := public.format_ccr_code(max_seq + 1);
  RETURN next_code;
END;
$$;


ALTER FUNCTION "public"."get_next_ccr_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_next_ccr_sequence"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN nextval('public.ccr_sequence_seq');
END;
$$;


ALTER FUNCTION "public"."get_next_ccr_sequence"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_chat"("query_embedding" "public"."vector", "match_count" integer DEFAULT NULL::integer, "filter" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("id" bigint, "content" "text", "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where metadata @> filter
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;


ALTER FUNCTION "public"."match_chat"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_coaches"("query_embedding" "public"."vector", "match_count" integer DEFAULT NULL::integer, "filter" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("id" bigint, "content" "text", "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (embedding <=> query_embedding) as similarity
  from coaches
  where metadata @> filter
  order by embedding <=> query_embedding
  limit match_count;
end;
$$;


ALTER FUNCTION "public"."match_coaches"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer DEFAULT NULL::integer, "filter" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("id" bigint, "content" "text", "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where metadata @> filter
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;


ALTER FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_knowledge_internal"("query_embedding" "public"."vector", "match_count" integer DEFAULT NULL::integer, "filter" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("id" bigint, "content" "text", "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (embedding <=> query_embedding) as similarity
  from knowledge_internal
  where metadata @> filter
  order by embedding <=> query_embedding
  limit match_count;
end;
$$;


ALTER FUNCTION "public"."match_knowledge_internal"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_block_report_descriptions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_block_report_descriptions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_block_reports_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_block_reports_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_ccr_code"("code" "text") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $_$
BEGIN
  RETURN code ~ '^CCR[0-9]{3,}$';
END;
$_$;


ALTER FUNCTION "public"."validate_ccr_code"("code" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "coder_id" "uuid" NOT NULL,
    "status" "public"."attendance_status_enum" NOT NULL,
    "reason" "text",
    "make_up_task_created" boolean DEFAULT false NOT NULL,
    "recorded_by" "uuid" NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."block_evaluation_answers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "eval_session_id" "uuid" NOT NULL,
    "coder_id" "uuid" NOT NULL,
    "question_id" "text" NOT NULL,
    "question_index" integer NOT NULL,
    "answer" "text" NOT NULL,
    "answered_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."block_evaluation_answers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."block_evaluation_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    "block_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "template_id" "uuid",
    "current_question_index" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'waiting'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."block_evaluation_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."block_evaluation_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "level_id" "uuid",
    "questions" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."block_evaluation_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."block_evaluations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coder_id" "uuid" NOT NULL,
    "class_id" "uuid" NOT NULL,
    "block_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "template_id" "uuid",
    "answers" "jsonb" NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."block_evaluations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."block_report_descriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_id" "uuid" NOT NULL,
    "criteria_id" "uuid" NOT NULL,
    "score" numeric(4,2),
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."block_report_descriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."block_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    "block_id" "uuid" NOT NULL,
    "coder_id" "uuid" NOT NULL,
    "status" "public"."block_report_status_enum" DEFAULT 'DRAFT'::"public"."block_report_status_enum" NOT NULL,
    "average_score" numeric,
    "grade" character varying(2),
    "is_ai_generated" boolean DEFAULT false NOT NULL,
    "sent_via_whatsapp" boolean DEFAULT false NOT NULL,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."block_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."block_software" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "block_id" "uuid" NOT NULL,
    "software_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."block_software" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "level_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "summary" "text",
    "order_index" integer NOT NULL,
    "estimated_sessions" integer,
    "is_published" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "software_id" "uuid",
    CONSTRAINT "blocks_estimated_sessions_check" CHECK (("estimated_sessions" >= 0)),
    CONSTRAINT "blocks_order_index_check" CHECK (("order_index" >= 0))
);


ALTER TABLE "public"."blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."broadcast_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" character varying(255) NOT NULL,
    "content" "text" NOT NULL,
    "target_audience" character varying(50) DEFAULT 'ALL'::character varying NOT NULL,
    "sent_by" "uuid",
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "total_recipients" integer DEFAULT 0,
    "successful_count" integer DEFAULT 0,
    "failed_count" integer DEFAULT 0,
    "scheduled_for" timestamp with time zone,
    "status" character varying(50) DEFAULT 'SENT'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "valid_broadcast_status" CHECK ((("status")::"text" = ANY ((ARRAY['PENDING'::character varying, 'SENT'::character varying, 'SCHEDULED'::character varying, 'FAILED'::character varying])::"text"[]))),
    CONSTRAINT "valid_broadcast_target" CHECK ((("target_audience")::"text" = ANY ((ARRAY['ALL'::character varying, 'COACHES'::character varying, 'CODERS'::character varying])::"text"[])))
);


ALTER TABLE "public"."broadcast_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ccr_numbers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_phone" "text" NOT NULL,
    "ccr_sequence" integer NOT NULL,
    "parent_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ccr_code" "text" NOT NULL
);


ALTER TABLE "public"."ccr_numbers" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."ccr_sequence_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ccr_sequence_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."class_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    "block_id" "uuid" NOT NULL,
    "status" "public"."class_block_status_enum" DEFAULT 'UPCOMING'::"public"."class_block_status_enum" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "pitching_day_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."class_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."class_lessons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_block_id" "uuid" NOT NULL,
    "lesson_template_id" "uuid",
    "title" "text" NOT NULL,
    "summary" "text",
    "order_index" integer NOT NULL,
    "session_id" "uuid",
    "unlock_at" timestamp with time zone,
    "make_up_instructions" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "slide_url" "text",
    "coach_example_url" "text",
    "coach_example_storage_path" "text",
    CONSTRAINT "class_lessons_order_index_check" CHECK (("order_index" >= 0))
);


ALTER TABLE "public"."class_lessons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "public"."class_type_enum" NOT NULL,
    "level_id" "uuid",
    "coach_id" "uuid" NOT NULL,
    "schedule_day" "text" NOT NULL,
    "schedule_time" time without time zone NOT NULL,
    "zoom_link" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ekskul_lesson_plan_id" "uuid"
);


ALTER TABLE "public"."classes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_leave_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "status" "public"."coach_leave_status_enum" DEFAULT 'PENDING'::"public"."coach_leave_status_enum" NOT NULL,
    "note" "text",
    "substitute_coach_id" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."coach_leave_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coaches" (
    "id" bigint NOT NULL,
    "content" "text",
    "metadata" "jsonb",
    "embedding" "public"."vector"(1536)
);


ALTER TABLE "public"."coaches" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."coaches_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."coaches_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."coaches_id_seq" OWNED BY "public"."coaches"."id";



CREATE TABLE IF NOT EXISTS "public"."coder_block_completions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coder_id" "uuid" NOT NULL,
    "block_id" "uuid" NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"(),
    "completed_by_admin" boolean DEFAULT false,
    "notes" "text"
);


ALTER TABLE "public"."coder_block_completions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coder_block_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coder_id" "uuid" NOT NULL,
    "level_id" "uuid" NOT NULL,
    "block_id" "uuid" NOT NULL,
    "journey_order" integer NOT NULL,
    "status" "public"."coder_block_status_enum" DEFAULT 'PENDING'::"public"."coder_block_status_enum" NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "coder_block_progress_journey_order_check" CHECK (("journey_order" >= 0))
);


ALTER TABLE "public"."coder_block_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coder_payment_periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coder_id" "uuid",
    "class_id" "uuid",
    "payment_plan_id" "uuid",
    "pricing_id" "uuid",
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "total_amount" numeric NOT NULL,
    "status" "text" DEFAULT 'ACTIVE'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."coder_payment_periods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" bigint NOT NULL,
    "content" "text",
    "metadata" "jsonb",
    "embedding" "public"."vector"(1536)
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."documents_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."documents_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."documents_id_seq" OWNED BY "public"."documents"."id";



CREATE TABLE IF NOT EXISTS "public"."ekskul_lesson_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "total_lessons" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ekskul_lesson_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ekskul_lessons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid",
    "title" "text" NOT NULL,
    "summary" "text",
    "slide_url" "text",
    "example_url" "text",
    "order_index" integer NOT NULL,
    "estimated_meetings" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ekskul_lessons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ekskul_plan_software" (
    "plan_id" "uuid" NOT NULL,
    "software_id" "uuid" NOT NULL
);


ALTER TABLE "public"."ekskul_plan_software" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enrollments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    "coder_id" "uuid" NOT NULL,
    "enrolled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "public"."enrollment_status_enum" DEFAULT 'ACTIVE'::"public"."enrollment_status_enum" NOT NULL
);


ALTER TABLE "public"."enrollments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."evaluation_criteria" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "order_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."evaluation_criteria" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exkul_session_competencies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "competencies" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."exkul_session_competencies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "coder_id" "uuid",
    "coder_name" "text" NOT NULL,
    "class_name" "text" NOT NULL,
    "level_name" "text" NOT NULL,
    "base_price" integer DEFAULT 0 NOT NULL,
    "discount_amount" integer DEFAULT 0 NOT NULL,
    "final_price" integer DEFAULT 0 NOT NULL,
    "payment_period_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    CONSTRAINT "invoice_items_base_price_check" CHECK (("base_price" >= 0)),
    CONSTRAINT "invoice_items_discount_amount_check" CHECK (("discount_amount" >= 0)),
    CONSTRAINT "invoice_items_final_price_check" CHECK (("final_price" >= 0))
);


ALTER TABLE "public"."invoice_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."invoice_items"."coder_id" IS 'Link to users table. Can be NULL for seasonal invoices.';



COMMENT ON COLUMN "public"."invoice_items"."description" IS 'Optional description for custom or seasonal items.';



CREATE TABLE IF NOT EXISTS "public"."invoice_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "generate_day" integer DEFAULT 15 NOT NULL,
    "due_days" integer DEFAULT 10 NOT NULL,
    "bank_name" "text" DEFAULT ''::"text" NOT NULL,
    "bank_account_number" "text" DEFAULT ''::"text" NOT NULL,
    "bank_account_holder" "text" DEFAULT ''::"text" NOT NULL,
    "admin_whatsapp_number" "text" DEFAULT ''::"text" NOT NULL,
    "base_url" "text" DEFAULT 'http://localhost:3000'::"text" NOT NULL,
    "invoice_message_template" "text" DEFAULT 'Yth. Bpk/Ibu {parent_name},

Tagihan kursus telah tersedia:

📄 Invoice: {invoice_number}
💰 Total: Rp {total_amount}
📅 Jatuh Tempo: {due_date}

Lihat detail:
{invoice_url}

Terima kasih 🙏
CLEVIO Coder'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "whatsapp_delay_min" integer DEFAULT 10 NOT NULL,
    "whatsapp_delay_max" integer DEFAULT 30 NOT NULL,
    "registration_fee" integer DEFAULT 150000,
    "registration_fee_discount_percent" integer DEFAULT 0,
    "payment_confirmation_template" "text" DEFAULT 'Yth. Bpk/Ibu {parent_name},

Pembayaran invoice {invoice_number} sebesar Rp {amount} telah kami terima.

Terima kasih atas pembayarannya.
CLEVIO Coder'::"text",
    "seasonal_invoice_message_template" "text" DEFAULT 'Halo Kak {student_name},

Berikut invoice untuk pembayaran program *{program_name}*:

📋 Invoice: {invoice_number}
🔗 Link: {invoice_url}

Mohon dilakukan pembayaran sebelum jatuh tempo. Terima kasih!'::"text",
    "weekly_invoice_message_template" "text" DEFAULT '... template default ...'::"text",
    "enable_class_reminder" boolean DEFAULT false,
    "class_reminder_time" "text" DEFAULT '09:00'::"text",
    "class_reminder_message_template" "text" DEFAULT 'Halo Kak {parent_name},

Mengingatkan kembali bahwa hari ini ada jadwal kelas untuk:
{student_name}

Jam: {time}
Di: {zoom_link}

Harap hadir tepat waktu ya. Terima kasih!'::"text",
    "class_reminder_delay_min" integer DEFAULT 5,
    "class_reminder_delay_max" integer DEFAULT 15,
    "enable_makeup_reminder" boolean DEFAULT false,
    "makeup_reminder_h3" boolean DEFAULT true,
    "makeup_reminder_h1" boolean DEFAULT true,
    "makeup_reminder_message_template" "text" DEFAULT 'Halo Ayah/Bunda {parent_name},

Ingat ya, tugas susulan untuk {student_name} akan berakhir pada {due_date}.

Link tugas: {makeup_url}

Mohon dikerjakan sebelum deadline.
Terima kasih! 🙏'::"text",
    "enable_absent_notification" boolean DEFAULT true,
    CONSTRAINT "invoice_settings_due_days_check" CHECK (("due_days" >= 1)),
    CONSTRAINT "invoice_settings_generate_day_check" CHECK ((("generate_day" >= 1) AND ("generate_day" <= 28)))
);


ALTER TABLE "public"."invoice_settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."invoice_settings"."whatsapp_delay_min" IS 'Minimum delay in seconds between WhatsApp messages';



COMMENT ON COLUMN "public"."invoice_settings"."whatsapp_delay_max" IS 'Maximum delay in seconds between WhatsApp messages';



CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_number" "text" NOT NULL,
    "ccr_id" "uuid",
    "parent_phone" "text" NOT NULL,
    "parent_name" "text" NOT NULL,
    "period_month" integer NOT NULL,
    "period_year" integer NOT NULL,
    "total_amount" integer DEFAULT 0 NOT NULL,
    "status" "public"."invoice_status_enum" DEFAULT 'PENDING'::"public"."invoice_status_enum" NOT NULL,
    "due_date" "date" NOT NULL,
    "paid_at" timestamp with time zone,
    "paid_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invoice_type" character varying(20) DEFAULT 'MONTHLY'::character varying,
    "seasonal_student_name" "text",
    "seasonal_student_phone" "text",
    "period_start_date" "date",
    "period_end_date" "date",
    CONSTRAINT "invoices_period_month_check" CHECK ((("period_month" >= 1) AND ("period_month" <= 12))),
    CONSTRAINT "invoices_period_year_check" CHECK (("period_year" >= 2020)),
    CONSTRAINT "invoices_total_amount_check" CHECK (("total_amount" >= 0))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


COMMENT ON COLUMN "public"."invoices"."period_month" IS 'Month of invoice generation (kept for filtering/grouping)';



COMMENT ON COLUMN "public"."invoices"."period_year" IS 'Year of invoice generation (kept for filtering/grouping)';



COMMENT ON COLUMN "public"."invoices"."seasonal_student_name" IS 'Student name for seasonal invoices (no coder account)';



COMMENT ON COLUMN "public"."invoices"."seasonal_student_phone" IS 'Parent WhatsApp for seasonal invoices';



COMMENT ON COLUMN "public"."invoices"."period_start_date" IS 'Start date of student learning period (actual period being paid for)';



COMMENT ON COLUMN "public"."invoices"."period_end_date" IS 'End date of student learning period (actual period being paid for)';



CREATE TABLE IF NOT EXISTS "public"."knowledge_internal" (
    "id" bigint NOT NULL,
    "content" "text",
    "metadata" "jsonb",
    "embedding" "public"."vector"(1536)
);


ALTER TABLE "public"."knowledge_internal" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."knowledge_internal_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."knowledge_internal_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."knowledge_internal_id_seq" OWNED BY "public"."knowledge_internal"."id";



CREATE TABLE IF NOT EXISTS "public"."lesson_evaluations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "coder_id" "uuid" NOT NULL,
    "criteria_id" "uuid" NOT NULL,
    "score" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "lesson_evaluations_score_check" CHECK ((("score" >= 1) AND ("score" <= 10)))
);


ALTER TABLE "public"."lesson_evaluations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lesson_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lesson_template_id" "uuid",
    "coach_id" "uuid",
    "report_type" "text",
    "description" "text",
    "status" "text" DEFAULT 'PENDING'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."lesson_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lesson_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "block_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text",
    "order_index" integer NOT NULL,
    "estimated_meeting_count" integer,
    "make_up_instructions" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "slide_url" "text",
    "example_url" "text",
    "example_storage_path" "text",
    CONSTRAINT "lesson_templates_duration_minutes_check" CHECK (("estimated_meeting_count" >= 0)),
    CONSTRAINT "lesson_templates_order_index_check" CHECK (("order_index" >= 0))
);


ALTER TABLE "public"."lesson_templates" OWNER TO "postgres";


COMMENT ON COLUMN "public"."lesson_templates"."estimated_meeting_count" IS 'Number of meetings/sessions required for this lesson';



CREATE TABLE IF NOT EXISTS "public"."levels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "order_index" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "levels_order_index_check" CHECK (("order_index" >= 0))
);


ALTER TABLE "public"."levels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."make_up_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "attendance_id" "uuid" NOT NULL,
    "coder_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "class_lesson_id" "uuid",
    "due_date" timestamp with time zone NOT NULL,
    "status" "public"."make_up_status_enum" DEFAULT 'PENDING_UPLOAD'::"public"."make_up_status_enum" NOT NULL,
    "instructions" "text",
    "submission_files" "jsonb",
    "submitted_at" timestamp with time zone,
    "reviewed_by_coach_id" "uuid",
    "reviewed_at" timestamp with time zone,
    "feedback" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."make_up_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "block_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "file_url" "text",
    "coach_note" "text",
    "visible_from_session_id" "uuid",
    "uploaded_by_user_id" "uuid" NOT NULL,
    "uploaded_by_role" "public"."role_enum" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."materials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."n8n_chat_histories" (
    "id" integer NOT NULL,
    "session_id" character varying(255) NOT NULL,
    "message" "jsonb" NOT NULL
);


ALTER TABLE "public"."n8n_chat_histories" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."n8n_chat_histories_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."n8n_chat_histories_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."n8n_chat_histories_id_seq" OWNED BY "public"."n8n_chat_histories"."id";



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "type" character varying(50) DEFAULT 'SYSTEM'::character varying
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "duration_months" integer NOT NULL,
    "discount_percent" numeric DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."payment_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_pricing" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid",
    "level_id" "uuid",
    "mode" "text" DEFAULT 'WEEKLY'::"text" NOT NULL,
    "amount" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."payment_pricing" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_period_id" "uuid",
    "reminder_type" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'SENT'::"text"
);


ALTER TABLE "public"."payment_reminders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_period_id" "uuid",
    "amount" numeric NOT NULL,
    "payment_date" timestamp with time zone DEFAULT "now"(),
    "payment_method" "text",
    "notes" "text",
    "created_by" "uuid"
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pitching_day_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rubric_submission_id" "uuid" NOT NULL,
    "pdf_url" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_via_whatsapp" boolean DEFAULT false NOT NULL,
    "sent_to_parent_at" timestamp with time zone
);


ALTER TABLE "public"."pitching_day_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pricing" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "level_id" "uuid",
    "mode" "text" NOT NULL,
    "base_price_monthly" numeric NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "pricing_type" character varying(20) DEFAULT 'WEEKLY'::character varying,
    "seasonal_name" "text"
);


ALTER TABLE "public"."pricing" OWNER TO "postgres";


COMMENT ON COLUMN "public"."pricing"."pricing_type" IS 'Type of pricing: WEEKLY (regular with level) or SEASONAL (standalone seasonal programs)';



COMMENT ON COLUMN "public"."pricing"."seasonal_name" IS 'Name of seasonal program (only for SEASONAL type)';



CREATE TABLE IF NOT EXISTS "public"."rubric_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    "coder_id" "uuid" NOT NULL,
    "block_id" "uuid",
    "semester_tag" "text",
    "rubric_template_id" "uuid" NOT NULL,
    "grades" "jsonb" NOT NULL,
    "positive_character_chosen" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "narrative" "text" NOT NULL,
    "submitted_by" "uuid" NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "public"."rubric_submission_status_enum" DEFAULT 'FINAL'::"public"."rubric_submission_status_enum" NOT NULL
);


ALTER TABLE "public"."rubric_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rubric_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_type" "public"."class_type_enum" NOT NULL,
    "level_id" "uuid",
    "competencies" "jsonb" NOT NULL,
    "positive_characters" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rubric_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    "date_time" timestamp with time zone NOT NULL,
    "zoom_link_snapshot" "text" NOT NULL,
    "status" "public"."session_status_enum" DEFAULT 'SCHEDULED'::"public"."session_status_enum" NOT NULL,
    "substitute_coach_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ekskul_lesson_id" "uuid"
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."software" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "version" "text",
    "installation_url" "text",
    "installation_instructions" "text",
    "minimum_specs" "jsonb",
    "access_info" "text",
    "icon_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."software" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "makeup_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "coder_id" "uuid" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_type" "text",
    "notes" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "verdict" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "submissions_verdict_check" CHECK (("verdict" = ANY (ARRAY['APPROVED'::"text", 'REJECTED'::"text", 'NEEDS_REVISION'::"text"])))
);


ALTER TABLE "public"."submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "username" "text" NOT NULL,
    "password_hash" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "role" "public"."role_enum" NOT NULL,
    "parent_contact_phone" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "avatar_path" "text",
    "birth_date" "date",
    "gender" "text",
    "school_name" "text",
    "school_grade" "text",
    "parent_name" "text",
    "parent_email" "text",
    "address" "text",
    "notes" "text",
    "referral_source" "text",
    "admin_permissions" "jsonb",
    "coach_bio" "text",
    "coach_skills" "text"[] DEFAULT '{}'::"text"[],
    "notif_new_class" boolean DEFAULT true NOT NULL,
    "notif_leave_update" boolean DEFAULT true NOT NULL,
    "notif_session_reminder" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."coach_bio" IS 'Bio singkat coach untuk ditampilkan di profil';



COMMENT ON COLUMN "public"."users"."coach_skills" IS 'Daftar bidang keahlian coach (array of strings)';



COMMENT ON COLUMN "public"."users"."notif_new_class" IS 'Coach ingin notifikasi ketika ada kelas baru';



COMMENT ON COLUMN "public"."users"."notif_leave_update" IS 'Coach ingin notifikasi ketika ada update pengajuan izin';



COMMENT ON COLUMN "public"."users"."notif_session_reminder" IS 'Coach ingin notifikasi pengingat sebelum sesi dimulai';



CREATE TABLE IF NOT EXISTS "public"."whatsapp_message_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "public"."whatsapp_category_enum" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "response" "jsonb",
    "status" "public"."whatsapp_status_enum" DEFAULT 'QUEUED'::"public"."whatsapp_status_enum" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone
);


ALTER TABLE "public"."whatsapp_message_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "text" NOT NULL,
    "session_data" "jsonb",
    "is_connected" boolean DEFAULT false NOT NULL,
    "connected_phone" "text",
    "last_activity_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."whatsapp_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" character varying(50) NOT NULL,
    "template_content" "text" NOT NULL,
    "variables" "jsonb" DEFAULT '[]'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "valid_whatsapp_template_category" CHECK ((("category")::"text" = ANY ((ARRAY['PARENT_ABSENT'::character varying, 'REPORT_SEND'::character varying, 'REMINDER'::character varying])::"text"[])))
);


ALTER TABLE "public"."whatsapp_templates" OWNER TO "postgres";


ALTER TABLE ONLY "public"."coaches" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."coaches_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."documents" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."documents_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."knowledge_internal" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."knowledge_internal_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."n8n_chat_histories" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."n8n_chat_histories_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_session_id_coder_id_key" UNIQUE ("session_id", "coder_id");



ALTER TABLE ONLY "public"."block_evaluation_answers"
    ADD CONSTRAINT "block_evaluation_answers_eval_session_id_coder_id_question__key" UNIQUE ("eval_session_id", "coder_id", "question_id");



ALTER TABLE ONLY "public"."block_evaluation_answers"
    ADD CONSTRAINT "block_evaluation_answers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."block_evaluation_sessions"
    ADD CONSTRAINT "block_evaluation_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."block_evaluation_sessions"
    ADD CONSTRAINT "block_evaluation_sessions_session_id_key" UNIQUE ("session_id");



ALTER TABLE ONLY "public"."block_evaluation_templates"
    ADD CONSTRAINT "block_evaluation_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."block_evaluations"
    ADD CONSTRAINT "block_evaluations_coder_id_block_id_key" UNIQUE ("coder_id", "block_id");



ALTER TABLE ONLY "public"."block_evaluations"
    ADD CONSTRAINT "block_evaluations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."block_report_descriptions"
    ADD CONSTRAINT "block_report_descriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."block_report_descriptions"
    ADD CONSTRAINT "block_report_descriptions_report_id_criteria_id_key" UNIQUE ("report_id", "criteria_id");



ALTER TABLE ONLY "public"."block_reports"
    ADD CONSTRAINT "block_reports_class_id_block_id_coder_id_key" UNIQUE ("class_id", "block_id", "coder_id");



ALTER TABLE ONLY "public"."block_reports"
    ADD CONSTRAINT "block_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."block_software"
    ADD CONSTRAINT "block_software_block_id_software_id_key" UNIQUE ("block_id", "software_id");



ALTER TABLE ONLY "public"."block_software"
    ADD CONSTRAINT "block_software_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_level_id_name_key" UNIQUE ("level_id", "name");



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_level_id_order_index_key" UNIQUE ("level_id", "order_index");



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."broadcast_logs"
    ADD CONSTRAINT "broadcast_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ccr_numbers"
    ADD CONSTRAINT "ccr_numbers_parent_phone_key" UNIQUE ("parent_phone");



ALTER TABLE ONLY "public"."ccr_numbers"
    ADD CONSTRAINT "ccr_numbers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_blocks"
    ADD CONSTRAINT "class_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_lessons"
    ADD CONSTRAINT "class_lessons_class_block_id_order_index_key" UNIQUE ("class_block_id", "order_index");



ALTER TABLE ONLY "public"."class_lessons"
    ADD CONSTRAINT "class_lessons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_lessons"
    ADD CONSTRAINT "class_lessons_session_id_key" UNIQUE ("session_id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_leave_requests"
    ADD CONSTRAINT "coach_leave_requests_coach_id_session_id_key" UNIQUE ("coach_id", "session_id");



ALTER TABLE ONLY "public"."coach_leave_requests"
    ADD CONSTRAINT "coach_leave_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coaches"
    ADD CONSTRAINT "coaches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coder_block_completions"
    ADD CONSTRAINT "coder_block_completions_coder_id_block_id_key" UNIQUE ("coder_id", "block_id");



ALTER TABLE ONLY "public"."coder_block_completions"
    ADD CONSTRAINT "coder_block_completions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coder_block_progress"
    ADD CONSTRAINT "coder_block_progress_coder_id_block_id_key" UNIQUE ("coder_id", "block_id");



ALTER TABLE ONLY "public"."coder_block_progress"
    ADD CONSTRAINT "coder_block_progress_coder_id_level_id_journey_order_key" UNIQUE ("coder_id", "level_id", "journey_order");



ALTER TABLE ONLY "public"."coder_block_progress"
    ADD CONSTRAINT "coder_block_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coder_payment_periods"
    ADD CONSTRAINT "coder_payment_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ekskul_lesson_plans"
    ADD CONSTRAINT "ekskul_lesson_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ekskul_lessons"
    ADD CONSTRAINT "ekskul_lessons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ekskul_plan_software"
    ADD CONSTRAINT "ekskul_plan_software_pkey" PRIMARY KEY ("plan_id", "software_id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_class_id_coder_id_key" UNIQUE ("class_id", "coder_id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."evaluation_criteria"
    ADD CONSTRAINT "evaluation_criteria_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exkul_session_competencies"
    ADD CONSTRAINT "exkul_session_competencies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exkul_session_competencies"
    ADD CONSTRAINT "exkul_session_competencies_session_id_key" UNIQUE ("session_id");



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_settings"
    ADD CONSTRAINT "invoice_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_internal"
    ADD CONSTRAINT "knowledge_internal_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lesson_evaluations"
    ADD CONSTRAINT "lesson_evaluations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lesson_evaluations"
    ADD CONSTRAINT "lesson_evaluations_session_id_coder_id_criteria_id_key" UNIQUE ("session_id", "coder_id", "criteria_id");



ALTER TABLE ONLY "public"."lesson_reports"
    ADD CONSTRAINT "lesson_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lesson_templates"
    ADD CONSTRAINT "lesson_templates_block_id_order_index_key" UNIQUE ("block_id", "order_index");



ALTER TABLE ONLY "public"."lesson_templates"
    ADD CONSTRAINT "lesson_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."levels"
    ADD CONSTRAINT "levels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."make_up_tasks"
    ADD CONSTRAINT "make_up_tasks_attendance_id_key" UNIQUE ("attendance_id");



ALTER TABLE ONLY "public"."make_up_tasks"
    ADD CONSTRAINT "make_up_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."n8n_chat_histories"
    ADD CONSTRAINT "n8n_chat_histories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_plans"
    ADD CONSTRAINT "payment_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_pricing"
    ADD CONSTRAINT "payment_pricing_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_reminders"
    ADD CONSTRAINT "payment_reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pitching_day_reports"
    ADD CONSTRAINT "pitching_day_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pitching_day_reports"
    ADD CONSTRAINT "pitching_day_reports_rubric_submission_id_key" UNIQUE ("rubric_submission_id");



ALTER TABLE ONLY "public"."pricing"
    ADD CONSTRAINT "pricing_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rubric_submissions"
    ADD CONSTRAINT "rubric_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rubric_templates"
    ADD CONSTRAINT "rubric_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."software"
    ADD CONSTRAINT "software_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."software"
    ADD CONSTRAINT "software_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_message_logs"
    ADD CONSTRAINT "whatsapp_message_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_sessions"
    ADD CONSTRAINT "whatsapp_sessions_client_id_key" UNIQUE ("client_id");



ALTER TABLE ONLY "public"."whatsapp_sessions"
    ADD CONSTRAINT "whatsapp_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_templates"
    ADD CONSTRAINT "whatsapp_templates_category_key" UNIQUE ("category");



ALTER TABLE ONLY "public"."whatsapp_templates"
    ADD CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id");



CREATE INDEX "attendance_coder_id_idx" ON "public"."attendance" USING "btree" ("coder_id");



CREATE INDEX "attendance_session_id_idx" ON "public"."attendance" USING "btree" ("session_id");



CREATE INDEX "block_software_block_id_idx" ON "public"."block_software" USING "btree" ("block_id");



CREATE UNIQUE INDEX "ccr_numbers_ccr_code_key" ON "public"."ccr_numbers" USING "btree" ("ccr_code");



CREATE INDEX "ccr_numbers_parent_phone_idx" ON "public"."ccr_numbers" USING "btree" ("parent_phone");



CREATE INDEX "class_blocks_block_id_idx" ON "public"."class_blocks" USING "btree" ("block_id");



CREATE INDEX "class_blocks_class_id_idx" ON "public"."class_blocks" USING "btree" ("class_id");



CREATE INDEX "class_lessons_class_block_idx" ON "public"."class_lessons" USING "btree" ("class_block_id", "order_index");



CREATE INDEX "classes_coach_id_idx" ON "public"."classes" USING "btree" ("coach_id");



CREATE INDEX "coach_leave_requests_status_idx" ON "public"."coach_leave_requests" USING "btree" ("status");



CREATE INDEX "coder_block_progress_coder_level_idx" ON "public"."coder_block_progress" USING "btree" ("coder_id", "level_id", "status");



CREATE INDEX "enrollments_coder_id_idx" ON "public"."enrollments" USING "btree" ("coder_id");



CREATE INDEX "idx_broadcast_logs_sent_at" ON "public"."broadcast_logs" USING "btree" ("sent_at" DESC);



CREATE INDEX "idx_broadcast_logs_status" ON "public"."broadcast_logs" USING "btree" ("status");



CREATE INDEX "idx_invoices_seasonal" ON "public"."invoices" USING "btree" ("invoice_type") WHERE (("invoice_type")::"text" = 'SEASONAL'::"text");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_pricing_type" ON "public"."pricing" USING "btree" ("pricing_type");



CREATE INDEX "idx_submissions_coder_id" ON "public"."submissions" USING "btree" ("coder_id");



CREATE INDEX "idx_submissions_makeup_id" ON "public"."submissions" USING "btree" ("makeup_id");



CREATE INDEX "idx_submissions_session_id" ON "public"."submissions" USING "btree" ("session_id");



CREATE INDEX "idx_whatsapp_templates_category" ON "public"."whatsapp_templates" USING "btree" ("category");



CREATE INDEX "invoice_items_coder_id_idx" ON "public"."invoice_items" USING "btree" ("coder_id");



CREATE INDEX "invoice_items_invoice_id_idx" ON "public"."invoice_items" USING "btree" ("invoice_id");



CREATE UNIQUE INDEX "invoices_monthly_unique_idx" ON "public"."invoices" USING "btree" ("ccr_id", "period_month", "period_year") WHERE (("invoice_type")::"text" = 'MONTHLY'::"text");



CREATE INDEX "invoices_parent_phone_idx" ON "public"."invoices" USING "btree" ("parent_phone");



CREATE INDEX "invoices_period_dates_idx" ON "public"."invoices" USING "btree" ("period_start_date", "period_end_date");



CREATE INDEX "invoices_period_idx" ON "public"."invoices" USING "btree" ("period_year", "period_month");



CREATE INDEX "invoices_status_idx" ON "public"."invoices" USING "btree" ("status");



CREATE INDEX "lesson_templates_block_id_idx" ON "public"."lesson_templates" USING "btree" ("block_id", "order_index");



CREATE UNIQUE INDEX "levels_name_key" ON "public"."levels" USING "btree" ("name");



CREATE UNIQUE INDEX "levels_order_index_key" ON "public"."levels" USING "btree" ("order_index");



CREATE INDEX "make_up_tasks_status_due_idx" ON "public"."make_up_tasks" USING "btree" ("status", "due_date");



CREATE INDEX "materials_class_id_created_at_idx" ON "public"."materials" USING "btree" ("class_id", "created_at" DESC);



CREATE INDEX "rubric_submissions_class_coder_idx" ON "public"."rubric_submissions" USING "btree" ("class_id", "coder_id");



CREATE INDEX "rubric_templates_class_type_idx" ON "public"."rubric_templates" USING "btree" ("class_type", "level_id");



CREATE INDEX "sessions_class_id_idx" ON "public"."sessions" USING "btree" ("class_id", "date_time");



CREATE INDEX "sessions_substitute_coach_id_idx" ON "public"."sessions" USING "btree" ("substitute_coach_id");



CREATE UNIQUE INDEX "users_username_key" ON "public"."users" USING "btree" ("username");



CREATE INDEX "whatsapp_message_logs_created_at_idx" ON "public"."whatsapp_message_logs" USING "btree" ("created_at" DESC);



CREATE OR REPLACE TRIGGER "set_submissions_updated_at" BEFORE UPDATE ON "public"."submissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_blocks_updated_at" BEFORE UPDATE ON "public"."blocks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_timestamp"();



CREATE OR REPLACE TRIGGER "trg_class_lessons_updated_at" BEFORE UPDATE ON "public"."class_lessons" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_timestamp"();



CREATE OR REPLACE TRIGGER "trg_classes_updated_at" BEFORE UPDATE ON "public"."classes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_timestamp"();



CREATE OR REPLACE TRIGGER "trg_coach_leave_requests_updated_at" BEFORE UPDATE ON "public"."coach_leave_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_timestamp"();



CREATE OR REPLACE TRIGGER "trg_coder_block_progress_updated_at" BEFORE UPDATE ON "public"."coder_block_progress" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_timestamp"();



CREATE OR REPLACE TRIGGER "trg_exkul_session_competencies_updated_at" BEFORE UPDATE ON "public"."exkul_session_competencies" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_timestamp"();



CREATE OR REPLACE TRIGGER "trg_invoice_settings_updated_at" BEFORE UPDATE ON "public"."invoice_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_timestamp"();



CREATE OR REPLACE TRIGGER "trg_invoices_updated_at" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_timestamp"();



CREATE OR REPLACE TRIGGER "trg_lesson_templates_updated_at" BEFORE UPDATE ON "public"."lesson_templates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_timestamp"();



CREATE OR REPLACE TRIGGER "trg_rubric_submissions_updated_at" BEFORE UPDATE ON "public"."rubric_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_timestamp"();



CREATE OR REPLACE TRIGGER "trg_sessions_updated_at" BEFORE UPDATE ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_timestamp"();



CREATE OR REPLACE TRIGGER "trg_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_timestamp"();



CREATE OR REPLACE TRIGGER "trg_whatsapp_sessions_updated_at" BEFORE UPDATE ON "public"."whatsapp_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_update_block_report_descriptions_timestamp" BEFORE UPDATE ON "public"."block_report_descriptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_block_report_descriptions_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_block_reports_timestamp" BEFORE UPDATE ON "public"."block_reports" FOR EACH ROW EXECUTE FUNCTION "public"."set_block_reports_updated_at"();



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_coder_id_fkey" FOREIGN KEY ("coder_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."block_evaluation_answers"
    ADD CONSTRAINT "block_evaluation_answers_coder_id_fkey" FOREIGN KEY ("coder_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."block_evaluation_answers"
    ADD CONSTRAINT "block_evaluation_answers_eval_session_id_fkey" FOREIGN KEY ("eval_session_id") REFERENCES "public"."block_evaluation_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."block_evaluation_sessions"
    ADD CONSTRAINT "block_evaluation_sessions_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."block_evaluation_sessions"
    ADD CONSTRAINT "block_evaluation_sessions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."block_evaluation_sessions"
    ADD CONSTRAINT "block_evaluation_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."block_evaluation_sessions"
    ADD CONSTRAINT "block_evaluation_sessions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."block_evaluation_sessions"
    ADD CONSTRAINT "block_evaluation_sessions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."block_evaluation_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."block_evaluation_templates"
    ADD CONSTRAINT "block_evaluation_templates_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."block_evaluations"
    ADD CONSTRAINT "block_evaluations_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."block_evaluations"
    ADD CONSTRAINT "block_evaluations_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."block_evaluations"
    ADD CONSTRAINT "block_evaluations_coder_id_fkey" FOREIGN KEY ("coder_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."block_evaluations"
    ADD CONSTRAINT "block_evaluations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."block_evaluations"
    ADD CONSTRAINT "block_evaluations_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."block_evaluation_templates"("id");



ALTER TABLE ONLY "public"."block_report_descriptions"
    ADD CONSTRAINT "block_report_descriptions_criteria_id_fkey" FOREIGN KEY ("criteria_id") REFERENCES "public"."evaluation_criteria"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."block_report_descriptions"
    ADD CONSTRAINT "block_report_descriptions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."block_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."block_reports"
    ADD CONSTRAINT "block_reports_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."block_reports"
    ADD CONSTRAINT "block_reports_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."block_reports"
    ADD CONSTRAINT "block_reports_coder_id_fkey" FOREIGN KEY ("coder_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."block_software"
    ADD CONSTRAINT "block_software_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."block_software"
    ADD CONSTRAINT "block_software_software_id_fkey" FOREIGN KEY ("software_id") REFERENCES "public"."software"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."broadcast_logs"
    ADD CONSTRAINT "broadcast_logs_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."class_blocks"
    ADD CONSTRAINT "class_blocks_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_blocks"
    ADD CONSTRAINT "class_blocks_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_lessons"
    ADD CONSTRAINT "class_lessons_class_block_id_fkey" FOREIGN KEY ("class_block_id") REFERENCES "public"."class_blocks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_lessons"
    ADD CONSTRAINT "class_lessons_lesson_template_id_fkey" FOREIGN KEY ("lesson_template_id") REFERENCES "public"."lesson_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."class_lessons"
    ADD CONSTRAINT "class_lessons_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."coach_leave_requests"
    ADD CONSTRAINT "coach_leave_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."coach_leave_requests"
    ADD CONSTRAINT "coach_leave_requests_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_leave_requests"
    ADD CONSTRAINT "coach_leave_requests_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_leave_requests"
    ADD CONSTRAINT "coach_leave_requests_substitute_coach_id_fkey" FOREIGN KEY ("substitute_coach_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."coder_block_completions"
    ADD CONSTRAINT "coder_block_completions_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coder_block_completions"
    ADD CONSTRAINT "coder_block_completions_coder_id_fkey" FOREIGN KEY ("coder_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."coder_block_progress"
    ADD CONSTRAINT "coder_block_progress_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coder_block_progress"
    ADD CONSTRAINT "coder_block_progress_coder_id_fkey" FOREIGN KEY ("coder_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coder_block_progress"
    ADD CONSTRAINT "coder_block_progress_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coder_payment_periods"
    ADD CONSTRAINT "coder_payment_periods_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id");



ALTER TABLE ONLY "public"."coder_payment_periods"
    ADD CONSTRAINT "coder_payment_periods_coder_id_fkey" FOREIGN KEY ("coder_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."coder_payment_periods"
    ADD CONSTRAINT "coder_payment_periods_payment_plan_id_fkey" FOREIGN KEY ("payment_plan_id") REFERENCES "public"."payment_plans"("id");



ALTER TABLE ONLY "public"."coder_payment_periods"
    ADD CONSTRAINT "coder_payment_periods_pricing_id_fkey" FOREIGN KEY ("pricing_id") REFERENCES "public"."pricing"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ekskul_lessons"
    ADD CONSTRAINT "ekskul_lessons_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."ekskul_lesson_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ekskul_plan_software"
    ADD CONSTRAINT "ekskul_plan_software_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."ekskul_lesson_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ekskul_plan_software"
    ADD CONSTRAINT "ekskul_plan_software_software_id_fkey" FOREIGN KEY ("software_id") REFERENCES "public"."software"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_coder_id_fkey" FOREIGN KEY ("coder_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exkul_session_competencies"
    ADD CONSTRAINT "exkul_session_competencies_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_coder_id_fkey" FOREIGN KEY ("coder_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_payment_period_id_fkey" FOREIGN KEY ("payment_period_id") REFERENCES "public"."coder_payment_periods"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_ccr_id_fkey" FOREIGN KEY ("ccr_id") REFERENCES "public"."ccr_numbers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."lesson_evaluations"
    ADD CONSTRAINT "lesson_evaluations_coder_id_fkey" FOREIGN KEY ("coder_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lesson_evaluations"
    ADD CONSTRAINT "lesson_evaluations_criteria_id_fkey" FOREIGN KEY ("criteria_id") REFERENCES "public"."evaluation_criteria"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lesson_evaluations"
    ADD CONSTRAINT "lesson_evaluations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lesson_reports"
    ADD CONSTRAINT "lesson_reports_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."lesson_reports"
    ADD CONSTRAINT "lesson_reports_lesson_template_id_fkey" FOREIGN KEY ("lesson_template_id") REFERENCES "public"."lesson_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lesson_templates"
    ADD CONSTRAINT "lesson_templates_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."make_up_tasks"
    ADD CONSTRAINT "make_up_tasks_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendance"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."make_up_tasks"
    ADD CONSTRAINT "make_up_tasks_class_lesson_id_fkey" FOREIGN KEY ("class_lesson_id") REFERENCES "public"."class_lessons"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."make_up_tasks"
    ADD CONSTRAINT "make_up_tasks_coder_id_fkey" FOREIGN KEY ("coder_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."make_up_tasks"
    ADD CONSTRAINT "make_up_tasks_reviewed_by_coach_id_fkey" FOREIGN KEY ("reviewed_by_coach_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."make_up_tasks"
    ADD CONSTRAINT "make_up_tasks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_visible_from_session_id_fkey" FOREIGN KEY ("visible_from_session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_pricing"
    ADD CONSTRAINT "payment_pricing_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_pricing"
    ADD CONSTRAINT "payment_pricing_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."payment_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_reminders"
    ADD CONSTRAINT "payment_reminders_payment_period_id_fkey" FOREIGN KEY ("payment_period_id") REFERENCES "public"."coder_payment_periods"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_payment_period_id_fkey" FOREIGN KEY ("payment_period_id") REFERENCES "public"."coder_payment_periods"("id");



ALTER TABLE ONLY "public"."pitching_day_reports"
    ADD CONSTRAINT "pitching_day_reports_rubric_submission_id_fkey" FOREIGN KEY ("rubric_submission_id") REFERENCES "public"."rubric_submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing"
    ADD CONSTRAINT "pricing_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rubric_submissions"
    ADD CONSTRAINT "rubric_submissions_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rubric_submissions"
    ADD CONSTRAINT "rubric_submissions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rubric_submissions"
    ADD CONSTRAINT "rubric_submissions_coder_id_fkey" FOREIGN KEY ("coder_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rubric_submissions"
    ADD CONSTRAINT "rubric_submissions_rubric_template_id_fkey" FOREIGN KEY ("rubric_template_id") REFERENCES "public"."rubric_templates"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."rubric_submissions"
    ADD CONSTRAINT "rubric_submissions_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."rubric_templates"
    ADD CONSTRAINT "rubric_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."rubric_templates"
    ADD CONSTRAINT "rubric_templates_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_substitute_coach_id_fkey" FOREIGN KEY ("substitute_coach_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_coder_id_fkey" FOREIGN KEY ("coder_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_makeup_id_fkey" FOREIGN KEY ("makeup_id") REFERENCES "public"."make_up_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_templates"
    ADD CONSTRAINT "whatsapp_templates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



CREATE POLICY "Admin can manage broadcast logs" ON "public"."broadcast_logs" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'ADMIN'::"public"."role_enum")))));



CREATE POLICY "Admin can manage whatsapp templates" ON "public"."whatsapp_templates" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'ADMIN'::"public"."role_enum")))));



CREATE POLICY "Admins and Coaches can manage block_report_descriptions" ON "public"."block_report_descriptions" USING ((("auth"."jwt"() ->> 'role'::"text") = ANY (ARRAY['ADMIN'::"text", 'COACH'::"text"])));



CREATE POLICY "Admins can do everything with templates" ON "public"."whatsapp_templates" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'ADMIN'::"public"."role_enum"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'ADMIN'::"public"."role_enum")))));



CREATE POLICY "Admins can manage evaluation_criteria" ON "public"."evaluation_criteria" USING ((("auth"."jwt"() ->> 'role'::"text") = 'ADMIN'::"text"));



CREATE POLICY "Anyone can manage block_reports" ON "public"."block_reports" USING (true) WITH CHECK (true);



CREATE POLICY "Anyone can manage lesson_evaluations" ON "public"."lesson_evaluations" USING (true) WITH CHECK (true);



CREATE POLICY "Anyone can read answers" ON "public"."block_evaluation_answers" FOR SELECT USING (true);



CREATE POLICY "Anyone can read eval sessions" ON "public"."block_evaluation_sessions" FOR SELECT USING (true);



CREATE POLICY "Anyone can read evaluation_criteria" ON "public"."evaluation_criteria" FOR SELECT USING (true);



CREATE POLICY "Coders can insert own evaluations" ON "public"."block_evaluations" FOR INSERT WITH CHECK (("auth"."uid"() = "coder_id"));



CREATE POLICY "Coders can read evaluation templates" ON "public"."block_evaluation_templates" FOR SELECT USING (true);



CREATE POLICY "Coders can read own evaluations" ON "public"."block_evaluations" FOR SELECT USING (("auth"."uid"() = "coder_id"));



CREATE POLICY "Coders can read their own block_report_descriptions via report " ON "public"."block_report_descriptions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."block_reports" "br"
  WHERE (("br"."id" = "block_report_descriptions"."report_id") AND ("br"."coder_id" = "auth"."uid"()) AND ("br"."status" = 'PUBLISHED'::"public"."block_report_status_enum")))));



CREATE POLICY "Coders can read their own lesson_evaluations" ON "public"."lesson_evaluations" FOR SELECT USING (("auth"."uid"() = "coder_id"));



CREATE POLICY "Coders can read their own published block_reports" ON "public"."block_reports" FOR SELECT USING ((("auth"."uid"() = "coder_id") AND ("status" = 'PUBLISHED'::"public"."block_report_status_enum")));



CREATE POLICY "Coders insert own answers" ON "public"."block_evaluation_answers" FOR INSERT WITH CHECK (("auth"."uid"() = "coder_id"));



CREATE POLICY "Service role bypass" ON "public"."whatsapp_templates" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."block_evaluation_answers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."block_evaluation_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."block_evaluation_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."block_evaluations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."block_report_descriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."block_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."broadcast_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."evaluation_criteria" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lesson_evaluations" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."block_evaluation_answers";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."block_evaluation_sessions";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."extract_ccr_sequence"("code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."extract_ccr_sequence"("code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."extract_ccr_sequence"("code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."format_ccr_code"("seq" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."format_ccr_code"("seq" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."format_ccr_code"("seq" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_next_ccr_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_next_ccr_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_next_ccr_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_next_ccr_sequence"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_next_ccr_sequence"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_next_ccr_sequence"() TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_chat"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."match_chat"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_chat"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_coaches"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."match_coaches"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_coaches"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_knowledge_internal"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."match_knowledge_internal"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_knowledge_internal"("query_embedding" "public"."vector", "match_count" integer, "filter" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_block_report_descriptions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_block_report_descriptions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_block_report_descriptions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_block_reports_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_block_reports_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_block_reports_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_ccr_code"("code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_ccr_code"("code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_ccr_code"("code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";












GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";









GRANT ALL ON TABLE "public"."attendance" TO "anon";
GRANT ALL ON TABLE "public"."attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance" TO "service_role";



GRANT ALL ON TABLE "public"."block_evaluation_answers" TO "anon";
GRANT ALL ON TABLE "public"."block_evaluation_answers" TO "authenticated";
GRANT ALL ON TABLE "public"."block_evaluation_answers" TO "service_role";



GRANT ALL ON TABLE "public"."block_evaluation_sessions" TO "anon";
GRANT ALL ON TABLE "public"."block_evaluation_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."block_evaluation_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."block_evaluation_templates" TO "anon";
GRANT ALL ON TABLE "public"."block_evaluation_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."block_evaluation_templates" TO "service_role";



GRANT ALL ON TABLE "public"."block_evaluations" TO "anon";
GRANT ALL ON TABLE "public"."block_evaluations" TO "authenticated";
GRANT ALL ON TABLE "public"."block_evaluations" TO "service_role";



GRANT ALL ON TABLE "public"."block_report_descriptions" TO "anon";
GRANT ALL ON TABLE "public"."block_report_descriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."block_report_descriptions" TO "service_role";



GRANT ALL ON TABLE "public"."block_reports" TO "anon";
GRANT ALL ON TABLE "public"."block_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."block_reports" TO "service_role";



GRANT ALL ON TABLE "public"."block_software" TO "anon";
GRANT ALL ON TABLE "public"."block_software" TO "authenticated";
GRANT ALL ON TABLE "public"."block_software" TO "service_role";



GRANT ALL ON TABLE "public"."blocks" TO "anon";
GRANT ALL ON TABLE "public"."blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."blocks" TO "service_role";



GRANT ALL ON TABLE "public"."broadcast_logs" TO "anon";
GRANT ALL ON TABLE "public"."broadcast_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."broadcast_logs" TO "service_role";



GRANT ALL ON TABLE "public"."ccr_numbers" TO "anon";
GRANT ALL ON TABLE "public"."ccr_numbers" TO "authenticated";
GRANT ALL ON TABLE "public"."ccr_numbers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ccr_sequence_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ccr_sequence_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ccr_sequence_seq" TO "service_role";



GRANT ALL ON TABLE "public"."class_blocks" TO "anon";
GRANT ALL ON TABLE "public"."class_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."class_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."class_lessons" TO "anon";
GRANT ALL ON TABLE "public"."class_lessons" TO "authenticated";
GRANT ALL ON TABLE "public"."class_lessons" TO "service_role";



GRANT ALL ON TABLE "public"."classes" TO "anon";
GRANT ALL ON TABLE "public"."classes" TO "authenticated";
GRANT ALL ON TABLE "public"."classes" TO "service_role";



GRANT ALL ON TABLE "public"."coach_leave_requests" TO "anon";
GRANT ALL ON TABLE "public"."coach_leave_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_leave_requests" TO "service_role";



GRANT ALL ON TABLE "public"."coaches" TO "anon";
GRANT ALL ON TABLE "public"."coaches" TO "authenticated";
GRANT ALL ON TABLE "public"."coaches" TO "service_role";



GRANT ALL ON SEQUENCE "public"."coaches_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."coaches_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."coaches_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."coder_block_completions" TO "anon";
GRANT ALL ON TABLE "public"."coder_block_completions" TO "authenticated";
GRANT ALL ON TABLE "public"."coder_block_completions" TO "service_role";



GRANT ALL ON TABLE "public"."coder_block_progress" TO "anon";
GRANT ALL ON TABLE "public"."coder_block_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."coder_block_progress" TO "service_role";



GRANT ALL ON TABLE "public"."coder_payment_periods" TO "anon";
GRANT ALL ON TABLE "public"."coder_payment_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."coder_payment_periods" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON SEQUENCE "public"."documents_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."documents_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."documents_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ekskul_lesson_plans" TO "anon";
GRANT ALL ON TABLE "public"."ekskul_lesson_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."ekskul_lesson_plans" TO "service_role";



GRANT ALL ON TABLE "public"."ekskul_lessons" TO "anon";
GRANT ALL ON TABLE "public"."ekskul_lessons" TO "authenticated";
GRANT ALL ON TABLE "public"."ekskul_lessons" TO "service_role";



GRANT ALL ON TABLE "public"."ekskul_plan_software" TO "anon";
GRANT ALL ON TABLE "public"."ekskul_plan_software" TO "authenticated";
GRANT ALL ON TABLE "public"."ekskul_plan_software" TO "service_role";



GRANT ALL ON TABLE "public"."enrollments" TO "anon";
GRANT ALL ON TABLE "public"."enrollments" TO "authenticated";
GRANT ALL ON TABLE "public"."enrollments" TO "service_role";



GRANT ALL ON TABLE "public"."evaluation_criteria" TO "anon";
GRANT ALL ON TABLE "public"."evaluation_criteria" TO "authenticated";
GRANT ALL ON TABLE "public"."evaluation_criteria" TO "service_role";



GRANT ALL ON TABLE "public"."exkul_session_competencies" TO "anon";
GRANT ALL ON TABLE "public"."exkul_session_competencies" TO "authenticated";
GRANT ALL ON TABLE "public"."exkul_session_competencies" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_items" TO "anon";
GRANT ALL ON TABLE "public"."invoice_items" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_items" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_settings" TO "anon";
GRANT ALL ON TABLE "public"."invoice_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_settings" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_internal" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_internal" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_internal" TO "service_role";



GRANT ALL ON SEQUENCE "public"."knowledge_internal_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."knowledge_internal_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."knowledge_internal_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."lesson_evaluations" TO "anon";
GRANT ALL ON TABLE "public"."lesson_evaluations" TO "authenticated";
GRANT ALL ON TABLE "public"."lesson_evaluations" TO "service_role";



GRANT ALL ON TABLE "public"."lesson_reports" TO "anon";
GRANT ALL ON TABLE "public"."lesson_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."lesson_reports" TO "service_role";



GRANT ALL ON TABLE "public"."lesson_templates" TO "anon";
GRANT ALL ON TABLE "public"."lesson_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."lesson_templates" TO "service_role";



GRANT ALL ON TABLE "public"."levels" TO "anon";
GRANT ALL ON TABLE "public"."levels" TO "authenticated";
GRANT ALL ON TABLE "public"."levels" TO "service_role";



GRANT ALL ON TABLE "public"."make_up_tasks" TO "anon";
GRANT ALL ON TABLE "public"."make_up_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."make_up_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."materials" TO "anon";
GRANT ALL ON TABLE "public"."materials" TO "authenticated";
GRANT ALL ON TABLE "public"."materials" TO "service_role";



GRANT ALL ON TABLE "public"."n8n_chat_histories" TO "anon";
GRANT ALL ON TABLE "public"."n8n_chat_histories" TO "authenticated";
GRANT ALL ON TABLE "public"."n8n_chat_histories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."n8n_chat_histories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."n8n_chat_histories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."n8n_chat_histories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."payment_plans" TO "anon";
GRANT ALL ON TABLE "public"."payment_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_plans" TO "service_role";



GRANT ALL ON TABLE "public"."payment_pricing" TO "anon";
GRANT ALL ON TABLE "public"."payment_pricing" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_pricing" TO "service_role";



GRANT ALL ON TABLE "public"."payment_reminders" TO "anon";
GRANT ALL ON TABLE "public"."payment_reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_reminders" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."pitching_day_reports" TO "anon";
GRANT ALL ON TABLE "public"."pitching_day_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."pitching_day_reports" TO "service_role";



GRANT ALL ON TABLE "public"."pricing" TO "anon";
GRANT ALL ON TABLE "public"."pricing" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing" TO "service_role";



GRANT ALL ON TABLE "public"."rubric_submissions" TO "anon";
GRANT ALL ON TABLE "public"."rubric_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."rubric_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."rubric_templates" TO "anon";
GRANT ALL ON TABLE "public"."rubric_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."rubric_templates" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."software" TO "anon";
GRANT ALL ON TABLE "public"."software" TO "authenticated";
GRANT ALL ON TABLE "public"."software" TO "service_role";



GRANT ALL ON TABLE "public"."submissions" TO "anon";
GRANT ALL ON TABLE "public"."submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."submissions" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_message_logs" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_message_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_message_logs" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_sessions" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_templates" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_templates" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























drop extension if exists "pg_net";

alter table "public"."broadcast_logs" drop constraint "valid_broadcast_status";

alter table "public"."broadcast_logs" drop constraint "valid_broadcast_target";

alter table "public"."whatsapp_templates" drop constraint "valid_whatsapp_template_category";

alter table "public"."broadcast_logs" add constraint "valid_broadcast_status" CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'SENT'::character varying, 'SCHEDULED'::character varying, 'FAILED'::character varying])::text[]))) not valid;

alter table "public"."broadcast_logs" validate constraint "valid_broadcast_status";

alter table "public"."broadcast_logs" add constraint "valid_broadcast_target" CHECK (((target_audience)::text = ANY ((ARRAY['ALL'::character varying, 'COACHES'::character varying, 'CODERS'::character varying])::text[]))) not valid;

alter table "public"."broadcast_logs" validate constraint "valid_broadcast_target";

alter table "public"."whatsapp_templates" add constraint "valid_whatsapp_template_category" CHECK (((category)::text = ANY ((ARRAY['PARENT_ABSENT'::character varying, 'REPORT_SEND'::character varying, 'REMINDER'::character varying])::text[]))) not valid;

alter table "public"."whatsapp_templates" validate constraint "valid_whatsapp_template_category";


