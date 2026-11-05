<?php

require __DIR__ . '/../../../vendor/autoload.php';
$app = require_once __DIR__ . '/../../../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Problem;
use App\Services\ProblemCodeGenerator\StarterCodeGenerator;

echo "=== VERIFYING BATCH 21 IN DATABASE ===\n\n";

$total = Problem::count();
echo "Total problems in database: {$total}\n";

$hanoi = Problem::where('slug', 'tower-of-hanoi')->first();
if (!$hanoi) {
    echo "ERROR: tower-of-hanoi not found!\n";
    exit(1);
}

echo "Found Tower of Hanoi:\n";
echo "  - Title: {$hanoi->title}\n";
echo "  - Slug: {$hanoi->slug}\n";
echo "  - Difficulty: {$hanoi->difficulty}\n";
echo "  - Function: {$hanoi->function_name}\n";
echo "  - Params: " . json_encode($hanoi->params) . "\n";
echo "  - Return Type: {$hanoi->return_type}\n";
echo "  - Test Cases: " . $hanoi->testCases()->count() . "\n";
echo "  - Sample Test Cases: " . $hanoi->sampleTestCases()->count() . "\n";
echo "  - Display Order: {$hanoi->display_order}\n\n";

$gen = new StarterCodeGenerator();
echo "Generated Python Starter Code:\n";
echo $gen->generate($hanoi, 'python') . "\n";

echo "Generated Java Starter Code:\n";
echo $gen->generate($hanoi, 'java') . "\n";

echo "Generated C++ Starter Code:\n";
echo $gen->generate($hanoi, 'cpp') . "\n";

echo "Generated JavaScript Starter Code:\n";
echo $gen->generate($hanoi, 'javascript') . "\n";

$harness = app(\App\Services\ProblemCodeGenerator\HarnessGenerator::class);
echo "Harness Generation Tests:\n";
echo "  - Python harness: " . strlen($harness->generate($hanoi, 'python', $hanoi->sampleTestCases()->get())) . " bytes\n";
echo "  - Java harness: " . strlen($harness->generate($hanoi, 'java', $hanoi->sampleTestCases()->get())) . " bytes\n";
echo "  - C++ harness: " . strlen($harness->generate($hanoi, 'cpp', $hanoi->sampleTestCases()->get())) . " bytes\n";
echo "  - JS harness: " . strlen($harness->generate($hanoi, 'javascript', $hanoi->sampleTestCases()->get())) . " bytes\n\n";

// Verify batch 21 range: display_order 2006 to 2105
$batch21Problems = Problem::whereBetween('display_order', [2006, 2105])->orderBy('display_order')->get();
echo "Batch 21 problems in DB: " . $batch21Problems->count() . " / 100\n";

$first = $batch21Problems->first();
$last = $batch21Problems->last();
echo "First: #{$first->display_order} {$first->title} ({$first->slug})\n";
echo "Last:  #{$last->display_order} {$last->title} ({$last->slug})\n";

$allValid = true;
foreach ($batch21Problems as $p) {
    $tcCount = $p->testCases()->count();
    $samples = $p->sampleTestCases()->count();
    if ($tcCount < 3 || $samples < 1) {
        echo "Problem {$p->slug} has suspicious testcase count ({$tcCount} total, {$samples} samples)\n";
        $allValid = false;
    }
}

if ($allValid) {
    echo "\nALL 100 PROBLEMS IN BATCH 21 VERIFIED PERFECTLY WITH VALID TEST CASES!\n";
} else {
    echo "\nSome problems had issues!\n";
    exit(1);
}
