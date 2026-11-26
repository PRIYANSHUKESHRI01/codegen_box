<?php

namespace Database\Seeders;

use App\Models\VoiceVerificationPrompt;
use Illuminate\Database\Seeder;

/**
 * Seeds the 5-minute (5 x 60s) baseline Voice Identity Verification interview prompts.
 * Students complete this interview once before taking any Vault AI or Mock AI interview.
 */
class VoiceVerificationSeeder extends Seeder
{
    public function run(): void
    {
        $prompts = [
            [
                'position' => 1,
                'slug' => 'intro-background',
                'title' => 'Personal & Academic Introduction',
                'category' => 'introduction',
                'prompt_text' => 'Introduce yourself clearly in your natural speaking voice. Share your full name, current degree or discipline, key technical areas you enjoy working on, and what kind of engineering or professional role you are preparing for.',
                'guidance' => 'Speak naturally at your normal interview pace for about a minute. Avoid whispering or speaking too far from the microphone.',
                'target_seconds' => 60,
                'min_seconds' => 20,
                'is_active' => true,
            ],
            [
                'position' => 2,
                'slug' => 'project-architecture',
                'title' => 'Project or Technical Deep-Dive',
                'category' => 'technical',
                'prompt_text' => 'Describe a project, lab assignment, or technical system you built or studied recently. Explain the problem it solved, the architecture or tools you chose, and one challenging bug or design trade-off you resolved.',
                'guidance' => 'Use specific technical terms naturally — this captures your normal articulation and vocabulary cadence.',
                'target_seconds' => 60,
                'min_seconds' => 20,
                'is_active' => true,
            ],
            [
                'position' => 3,
                'slug' => 'problem-solving-approach',
                'title' => 'Structured Problem Solving',
                'category' => 'problem_solving',
                'prompt_text' => 'When you encounter an unfamiliar problem during a coding round or live technical interview, how do you break it down step by step? Walk through how you clarify requirements, test edge cases, and optimize your solution.',
                'guidance' => 'Explain your thought process steadily in complete sentences.',
                'target_seconds' => 60,
                'min_seconds' => 20,
                'is_active' => true,
            ],
            [
                'position' => 4,
                'slug' => 'teamwork-collaboration',
                'title' => 'Collaboration & Ownership Scenario',
                'category' => 'scenario',
                'prompt_text' => 'Tell us about a time you collaborated with peers under a tight deadline or resolved a disagreement on how to implement something. What did you communicate, how did you align the team, and what was the outcome?',
                'guidance' => 'Maintain a clear, consistent distance from your microphone.',
                'target_seconds' => 60,
                'min_seconds' => 20,
                'is_active' => true,
            ],
            [
                'position' => 5,
                'slug' => 'biometric-passphrase',
                'title' => 'Voice Integrity Confirmation & Goals',
                'category' => 'passphrase',
                'prompt_text' => 'First read aloud: "I confirm that all Vault AI and Mock AI interviews on AptRun will be taken strictly by me in my own voice without external assistance." Then share your top two learning goals for the next three months.',
                'guidance' => 'Reading the confirmation statement plus your goals completes your 5-minute baseline voice profile.',
                'target_seconds' => 60,
                'min_seconds' => 20,
                'is_active' => true,
            ],
        ];

        foreach ($prompts as $prompt) {
            VoiceVerificationPrompt::updateOrCreate(
                ['slug' => $prompt['slug']],
                $prompt
            );
        }
    }
}
