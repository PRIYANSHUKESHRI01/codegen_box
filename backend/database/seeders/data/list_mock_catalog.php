<?php

require __DIR__ . '/../../../vendor/autoload.php';
$app = require_once __DIR__ . '/../../../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Services\Mock\MockInterviewCatalog;

$catalog = app(MockInterviewCatalog::class);
$catalog->flush();

$totalStacks = 0;
$totalRounds = 0;

foreach ($catalog->roles() as $roleKey => $role) {
    echo "=== ROLE: {$roleKey} ({$role['title']}) ===\n";
    foreach ($role['stacks'] as $stackKey => $stack) {
        $totalStacks++;
        echo "  [{$stackKey}] {$stack['name']}\n";
        foreach ($stack['rounds'] as $round) {
            $totalRounds++;
            echo "    -> {$round['id']}: {$round['title']}\n";
        }
    }
}

echo "\nSUMMARY:\n";
echo "Total Roles: " . count($catalog->roles()) . "\n";
echo "Total Stacks: {$totalStacks}\n";
echo "Total Practice Rounds: {$totalRounds}\n";
echo "Current Questions in mock_interview_questions: " . \App\Models\MockInterviewQuestion::count() . "\n";
