<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Domain Prep subjects and topics for the Management, Commerce and Arts/Humanities disciplines
 * (database/data/domain_taxonomy.php). Structure only — no questions. Idempotent: keyed by (discipline, code).
 *
 * A subject can be FOR specific branches (`branch_codes`); without that it is shared by every branch of the discipline.
 * That is what stops a BA English student being offered Sanskrit grammar while an MBA (Finance) student still
 * practises Marketing Management as part of the common core.
 */
return new class extends Migration
{
    public function up(): void
    {
        $data = require database_path('data/domain_taxonomy.php');
        $now = now();

        foreach ($data as $discipline => $subjects) {
            $sort = 0;

            foreach ($subjects as $subjectCode => $spec) {
                [$name, $topics] = $spec;
                $branches = $spec[2] ?? null;

                DB::table('core_subjects')->insertOrIgnore([
                    'discipline_code' => $discipline, 'code' => $subjectCode, 'name' => mb_substr($name, 0, 150), 'sort' => ++$sort,
                    'branch_codes' => $branches === null ? null : json_encode(array_values($branches)),
                    'created_at' => $now, 'updated_at' => $now,
                ]);

                $subjectId = DB::table('core_subjects')->where('discipline_code', $discipline)->where('code', $subjectCode)->value('id');
                $used = [];
                $topicSort = 0;

                foreach ($topics as $topicName) {
                    $slug = Str::slug($topicName, '_');
                    $code = mb_substr($slug !== '' ? $slug : 'topic', 0, 76);

                    // Two topics of one subject must never share a code (unique per subject).
                    for ($n = 2; isset($used[$code]); $n++) {
                        $code = mb_substr($slug !== '' ? $slug : 'topic', 0, 72).'_'.$n;
                    }
                    $used[$code] = true;

                    DB::table('core_topics')->insertOrIgnore([
                        'subject_id' => $subjectId, 'code' => $code, 'name' => mb_substr($topicName, 0, 200), 'sort' => ++$topicSort,
                        'created_at' => $now, 'updated_at' => $now,
                    ]);
                }
            }
        }
    }

    public function down(): void
    {
        $data = require database_path('data/domain_taxonomy.php');

        foreach (array_keys($data) as $discipline) {
            // Topics go with their subjects (cascade); a subject that already holds questions is RESTRICTed and stays.
            DB::table('core_subjects')->where('discipline_code', $discipline)->whereNotIn('id', DB::table('core_questions')->select('subject_id'))->delete();
        }
    }
};
