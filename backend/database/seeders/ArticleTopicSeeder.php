<?php

namespace Database\Seeders;

use App\Models\ArticleTopic;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * The two launch topics for the Articles knowledge base. Idempotent
 * (updateOrCreate by slug) so reseeding never duplicates rows. Requires the
 * seeded Ops account to exist first — same guard as InterviewSeeder.
 */
class ArticleTopicSeeder extends Seeder
{
    public function run(): void
    {
        $priya = User::where('email', 'priya@mellow.ai')->first();

        if (! $priya) {
            return;
        }

        ArticleTopic::updateOrCreate(
            ['slug' => 'dsa'],
            [
                'name' => 'Data Structures & Algorithms',
                'description' => 'Core DSA theory explained from first principles — the patterns that actually show up in technical interviews.',
                'icon' => 'Binary',
                'color' => 'indigo',
                'display_order' => 1,
                'created_by' => $priya->id,
            ]
        );

        ArticleTopic::updateOrCreate(
            ['slug' => 'go-programming'],
            [
                'name' => 'Go Programming',
                'description' => "Practical, production-minded deep-dives into Go — starting with what makes its concurrency model genuinely different.",
                'icon' => 'Cpu',
                'color' => 'sky',
                'display_order' => 2,
                'created_by' => $priya->id,
            ]
        );
    }
}
