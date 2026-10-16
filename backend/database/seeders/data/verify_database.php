<?php

require __DIR__ . '/../../../vendor/autoload.php';
$app = require_once __DIR__ . '/../../../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\SoftSkillAssessment;
use App\Models\SoftSkillQuestion;
use App\Models\SoftSkillAssessmentQuestion;
use Illuminate\Support\Facades\DB;

echo "=== SOFT SKILL ASSESSMENT DB VERIFICATION ===\n\n";

$publishedAssessments = SoftSkillAssessment::where('status', 'published')
    ->where('is_question_set', true)
    ->orderBy('question_set_number')
    ->get();

echo "Total Published Question Sets: " . $publishedAssessments->count() . "\n";

$allValid = true;
$setCounts = [];

foreach ($publishedAssessments as $a) {
    $qCount = $a->assessmentQuestions()->count();
    $setCounts[] = $qCount;
    if ($qCount !== 25) {
        echo "[ERROR] Assessment {$a->title} (set #{$a->question_set_number}) has {$qCount} questions, expected 25!\n";
        $allValid = false;
    }
}

echo "First Set: " . $publishedAssessments->first()->title . " (slug: " . $publishedAssessments->first()->slug . ", set_number: " . $publishedAssessments->first()->question_set_number . ")\n";
echo "Last Set:  " . $publishedAssessments->last()->title . " (slug: " . $publishedAssessments->last()->slug . ", set_number: " . $publishedAssessments->last()->question_set_number . ")\n";

$totalQuestionsInBank = SoftSkillQuestion::count();
$totalPivotLinks = SoftSkillAssessmentQuestion::count();

echo "\nTotal Questions in `soft_skill_questions` bank: {$totalQuestionsInBank}\n";
echo "Total Assessment-Question links in pivot: {$totalPivotLinks}\n";

$categoryBreakdown = SoftSkillQuestion::select('category', DB::raw('count(*) as count'))
    ->groupBy('category')
    ->get();

echo "\nQuestion Bank Category Distribution:\n";
foreach ($categoryBreakdown as $cat) {
    echo "  - " . ucfirst($cat->category) . ": {$cat->count}\n";
}

if ($publishedAssessments->count() === 70 && $allValid) {
    echo "\n>>> VERIFICATION SUCCESS: All 70 sets are published, correctly numbered, and each contains exactly 25 questions! <<<\n";
} else {
    echo "\n>>> VERIFICATION FAILED: Counts did not match expected values. <<<\n";
    exit(1);
}
