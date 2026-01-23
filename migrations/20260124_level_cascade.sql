-- 1. LEVEL DEPENDENCIES

-- Blocks -> Level: CASCADE
ALTER TABLE public.blocks
DROP CONSTRAINT IF EXISTS blocks_level_id_fkey,
ADD CONSTRAINT blocks_level_id_fkey
    FOREIGN KEY (level_id)
    REFERENCES public.levels(id)
    ON DELETE CASCADE;

-- Pricing -> Level: CASCADE
ALTER TABLE public.pricing
DROP CONSTRAINT IF EXISTS pricing_level_id_fkey,
ADD CONSTRAINT pricing_level_id_fkey
    FOREIGN KEY (level_id)
    REFERENCES public.levels(id)
    ON DELETE CASCADE;

-- Payment Pricing -> Level: CASCADE
ALTER TABLE public.payment_pricing
DROP CONSTRAINT IF EXISTS payment_pricing_level_id_fkey,
ADD CONSTRAINT payment_pricing_level_id_fkey
    FOREIGN KEY (level_id)
    REFERENCES public.levels(id)
    ON DELETE CASCADE;

-- Rubric Templates -> Level: CASCADE
ALTER TABLE public.rubric_templates
DROP CONSTRAINT IF EXISTS rubric_templates_level_id_fkey,
ADD CONSTRAINT rubric_templates_level_id_fkey
    FOREIGN KEY (level_id)
    REFERENCES public.levels(id)
    ON DELETE CASCADE;

-- Coder Block Progress -> Level: CASCADE
ALTER TABLE public.coder_block_progress
DROP CONSTRAINT IF EXISTS coder_block_progress_level_id_fkey,
ADD CONSTRAINT coder_block_progress_level_id_fkey
    FOREIGN KEY (level_id)
    REFERENCES public.levels(id)
    ON DELETE CASCADE;

-- Classes -> Level: SET NULL (Don't delete classes, just detach)
ALTER TABLE public.classes
DROP CONSTRAINT IF EXISTS classes_level_id_fkey,
ADD CONSTRAINT classes_level_id_fkey
    FOREIGN KEY (level_id)
    REFERENCES public.levels(id)
    ON DELETE SET NULL;


-- 5. PRICING DEPENDENCIES (Cascaded from Level)

-- Coder Payment Periods -> Pricing: SET NULL
ALTER TABLE public.coder_payment_periods
DROP CONSTRAINT IF EXISTS coder_payment_periods_pricing_id_fkey,
ADD CONSTRAINT coder_payment_periods_pricing_id_fkey
    FOREIGN KEY (pricing_id)
    REFERENCES public.pricing(id)
    ON DELETE SET NULL;
-- 2. BLOCK DEPENDENCIES (Cascaded from Level)

-- Lesson Templates -> Block: CASCADE
ALTER TABLE public.lesson_templates
DROP CONSTRAINT IF EXISTS lesson_templates_block_id_fkey,
ADD CONSTRAINT lesson_templates_block_id_fkey
    FOREIGN KEY (block_id)
    REFERENCES public.blocks(id)
    ON DELETE CASCADE;

-- Class Blocks -> Block: CASCADE
ALTER TABLE public.class_blocks
DROP CONSTRAINT IF EXISTS class_blocks_block_id_fkey,
ADD CONSTRAINT class_blocks_block_id_fkey
    FOREIGN KEY (block_id)
    REFERENCES public.blocks(id)
    ON DELETE CASCADE;

-- Coder Block Completions -> Block: CASCADE
ALTER TABLE public.coder_block_completions
DROP CONSTRAINT IF EXISTS coder_block_completions_block_id_fkey,
ADD CONSTRAINT coder_block_completions_block_id_fkey
    FOREIGN KEY (block_id)
    REFERENCES public.blocks(id)
    ON DELETE CASCADE;

-- Coder Block Progress -> Block: CASCADE
ALTER TABLE public.coder_block_progress
DROP CONSTRAINT IF EXISTS coder_block_progress_block_id_fkey,
ADD CONSTRAINT coder_block_progress_block_id_fkey
    FOREIGN KEY (block_id)
    REFERENCES public.blocks(id)
    ON DELETE CASCADE;

-- Materials -> Block: SET NULL
ALTER TABLE public.materials
DROP CONSTRAINT IF EXISTS materials_block_id_fkey,
ADD CONSTRAINT materials_block_id_fkey
    FOREIGN KEY (block_id)
    REFERENCES public.blocks(id)
    ON DELETE SET NULL;

-- Rubric Submissions -> Block: SET NULL
ALTER TABLE public.rubric_submissions
DROP CONSTRAINT IF EXISTS rubric_submissions_block_id_fkey,
ADD CONSTRAINT rubric_submissions_block_id_fkey
    FOREIGN KEY (block_id)
    REFERENCES public.blocks(id)
    ON DELETE SET NULL;

-- Block Software -> Block: CASCADE
ALTER TABLE public.block_software
DROP CONSTRAINT IF EXISTS block_software_block_id_fkey,
ADD CONSTRAINT block_software_block_id_fkey
    FOREIGN KEY (block_id)
    REFERENCES public.blocks(id)
    ON DELETE CASCADE;


-- 3. CLASS BLOCKS DEPENDENCIES (Cascaded from Block)

-- Class Lessons -> Class Block: CASCADE
ALTER TABLE public.class_lessons
DROP CONSTRAINT IF EXISTS class_lessons_class_block_id_fkey,
ADD CONSTRAINT class_lessons_class_block_id_fkey
    FOREIGN KEY (class_block_id)
    REFERENCES public.class_blocks(id)
    ON DELETE CASCADE;


-- 4. LESSON TEMPLATE DEPENDENCIES (Cascaded from Block)

-- Class Lessons -> Lesson Template: SET NULL (Keep lesson in schedule, detach from deleted template)
ALTER TABLE public.class_lessons
DROP CONSTRAINT IF EXISTS class_lessons_lesson_template_id_fkey,
ADD CONSTRAINT class_lessons_lesson_template_id_fkey
    FOREIGN KEY (lesson_template_id)
    REFERENCES public.lesson_templates(id)
    ON DELETE SET NULL;

-- Lesson Reports -> Lesson Template: SET NULL
ALTER TABLE public.lesson_reports
DROP CONSTRAINT IF EXISTS lesson_reports_lesson_template_id_fkey,
ADD CONSTRAINT lesson_reports_lesson_template_id_fkey
    FOREIGN KEY (lesson_template_id)
    REFERENCES public.lesson_templates(id)
    ON DELETE SET NULL;

