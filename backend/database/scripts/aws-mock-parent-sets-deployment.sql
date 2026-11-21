-- ==============================================================================
-- AptRun AWS RDS / MySQL Production Migration: Mock AI Interview 5 Parent Sets
-- Date: 2026-11-20
-- Description:
--   Adds parent_set_number column to mock_interview_questions table (default 1)
--   and creates composite performance index for 5 Parent Sets lookups.
-- ==============================================================================

-- 1. Check if column exists, add if not present
SET @col_exists := (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'mock_interview_questions' 
      AND COLUMN_NAME = 'parent_set_number'
);

SET @sql_add_col := IF(
    @col_exists = 0,
    'ALTER TABLE mock_interview_questions ADD COLUMN parent_set_number TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER stack_key;',
    'SELECT "Column parent_set_number already exists" AS status;'
);

PREPARE stmt FROM @sql_add_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Add composite index for fast querying by stack_key, parent_set_number, round_number, position
SET @idx_exists := (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'mock_interview_questions' 
      AND INDEX_NAME = 'mock_questions_parent_set_idx'
);

SET @sql_add_idx := IF(
    @idx_exists = 0,
    'CREATE INDEX mock_questions_parent_set_idx ON mock_interview_questions (stack_key, parent_set_number, round_number, position);',
    'SELECT "Index mock_questions_parent_set_idx already exists" AS status;'
);

PREPARE stmt FROM @sql_add_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ==============================================================================
-- 3. Execution of Seeders on AWS EC2 / ECS / App Runner:
--
-- Run the following artisan commands in production backend container:
--
--   php artisan migrate --force
--   php artisan db:seed --class=MockInterviewParentSetsSeeder --force
--
-- This seeds all 2,940 authentic interview questions across Sets 2 to 5 for
-- all 49 tech stacks, maintaining existing Set 1 questions intact.
-- ==============================================================================
