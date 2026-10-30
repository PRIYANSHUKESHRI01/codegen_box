-- For Mellow Vault: what AptRun would like to exist on `developer_details_tb`.
-- Nothing here is required for AptRun to work - the writer fills these columns only if they exist and skips them if not.
-- Run on the Mellow Vault database (take a backup first). Review each block; they are independent.

-- 1. Why this developer is listed: AptRun's own scores (so Mellow Vault can show / filter / rank on "readiness 60+").
ALTER TABLE developer_details_tb
  ADD COLUMN aptrun_profile_id          CHAR(36)          NULL AFTER aptrun_synced_at,
  ADD COLUMN aptrun_readiness_score     TINYINT UNSIGNED  NULL AFTER aptrun_profile_id,
  ADD COLUMN aptrun_readiness_tier      VARCHAR(30)       NULL AFTER aptrun_readiness_score,
  ADD COLUMN aptrun_ai_interview_score  DECIMAL(5,2)      NULL AFTER aptrun_readiness_tier,
  ADD COLUMN aptrun_ai_interview_stack  VARCHAR(60)       NULL AFTER aptrun_ai_interview_score,
  ADD COLUMN aptrun_listed              TINYINT(1)        NOT NULL DEFAULT 0 AFTER aptrun_ai_interview_stack;

-- 2. Lookups AptRun does on every write (email is how a student is matched to an existing developer).
ALTER TABLE developer_details_tb
  ADD INDEX idx_dev_email (email),
  ADD INDEX idx_dev_aptrun_user (aptrun_user_id),
  ADD UNIQUE KEY uq_dev_aptrun_profile (aptrun_profile_id);

-- 3. Recommended: college emails are often longer than 50 characters, and AptRun never sends a phone number.
ALTER TABLE developer_details_tb
  MODIFY email VARCHAR(255) NOT NULL,
  MODIFY phone VARCHAR(20)  NOT NULL DEFAULT '';

-- 4. Strongly recommended: `show_password` keeps passwords readable. Drop it once nothing depends on it.
-- ALTER TABLE developer_details_tb DROP COLUMN show_password;   -- (also make `password` the only credential column)
