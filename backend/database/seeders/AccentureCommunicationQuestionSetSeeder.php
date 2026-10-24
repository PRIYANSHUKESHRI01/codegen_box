<?php

namespace Database\Seeders;

use App\Models\SpeakingPrompt;
use Illuminate\Database\Seeder;

class AccentureCommunicationQuestionSetSeeder extends Seeder
{
    public function run(): void
    {
        $prompts = $this->prompts();

        foreach ($prompts as $order => $p) {
            SpeakingPrompt::updateOrCreate(
                ['title' => $p['title']],
                [
                    'user_id' => null,
                    'source' => SpeakingPrompt::SOURCE_LIBRARY,
                    'passage_text' => $p['passage_text'],
                    'category' => $p['category'],
                    'difficulty' => $p['difficulty'],
                    'target_wpm_min' => $p['target_wpm_min'] ?? 110,
                    'target_wpm_max' => $p['target_wpm_max'] ?? 160,
                    'is_active' => true,
                    'display_order' => 200 + $order,
                ]
            );
        }
    }

    /**
     * Spoken communication practice passages replicating Accenture's Versant/SVAr
     * reading, extempore, and professional pronunciation assessment sections.
     */
    private function prompts(): array
    {
        return [
            [
                'title' => 'Accenture Versant: Enterprise Cloud Modernization',
                'category' => 'Interview Ready',
                'difficulty' => SpeakingPrompt::DIFFICULTY_INTERMEDIATE,
                'target_wpm_min' => 120,
                'target_wpm_max' => 150,
                'passage_text' => 'Modern enterprise consulting demands agile adaptability as cloud architectures, microservices, and automated continuous delivery pipelines replace legacy monolithic frameworks across distributed engineering teams. Technology leaders must balance innovation speed with strict data governance, zero-trust security postures, and cost optimization.',
            ],
            [
                'title' => 'Accenture Versant: Agile Delivery and Scrum Sprints',
                'category' => 'Workplace English',
                'difficulty' => SpeakingPrompt::DIFFICULTY_BEGINNER,
                'target_wpm_min' => 110,
                'target_wpm_max' => 140,
                'passage_text' => 'During daily agile stand-ups, each engineer provides a concise summary of their previous day achievements, immediate milestone objectives, and any blocking dependencies. Transparent communication ensures that cross-functional teams resolve architectural bottlenecks before release deadlines.',
            ],
            [
                'title' => 'Accenture Versant: Client Communication and Consultation',
                'category' => 'Workplace English',
                'difficulty' => SpeakingPrompt::DIFFICULTY_INTERMEDIATE,
                'target_wpm_min' => 115,
                'target_wpm_max' => 145,
                'passage_text' => 'Effective client consulting requires translating intricate technical architectures into lucid business outcomes. When discussing trade-offs between relational databases and distributed document stores, consultants must articulate performance latency, operational expenditure, and long-term horizontal scalability clearly.',
            ],
            [
                'title' => 'Accenture Versant: Incident Management and Reliability',
                'category' => 'Tech & Career',
                'difficulty' => SpeakingPrompt::DIFFICULTY_ADVANCED,
                'target_wpm_min' => 120,
                'target_wpm_max' => 155,
                'passage_text' => 'When a critical production anomaly occurs, site reliability engineers isolate root causes through structured telemetry tracing rather than rushed speculation. Conducting blameless post-mortem retrospectives enables organizations to strengthen automated safeguards and prevent recurring regressions.',
            ],
            [
                'title' => 'Accenture Extempore: Generative AI in Software Engineering',
                'category' => 'Interview Ready',
                'difficulty' => SpeakingPrompt::DIFFICULTY_ADVANCED,
                'target_wpm_min' => 120,
                'target_wpm_max' => 160,
                'passage_text' => 'Generative AI code assistants are transforming developer productivity by accelerating boilerplate synthesis, automating unit test scaffolding, and generating documentation. However, foundational software engineering skills remain indispensable. Engineers must rigorously audit synthesized code for security vulnerabilities, concurrency race conditions, and algorithmic efficiency.',
            ],
            [
                'title' => 'Accenture Extempore: Hybrid Workplace and Professional Growth',
                'category' => 'Interview Ready',
                'difficulty' => SpeakingPrompt::DIFFICULTY_INTERMEDIATE,
                'target_wpm_min' => 115,
                'target_wpm_max' => 150,
                'passage_text' => 'A structured hybrid model blends collaborative in-person mentorship with autonomous deep-focus remote blocks. For engineering graduates beginning their careers, in-office interactions foster tacit knowledge transfer and cultural camaraderie, while remote days encourage disciplined time management and uninterrupted problem solving.',
            ],
            [
                'title' => 'Accenture Extempore: Learning From Project Setbacks',
                'category' => 'Interview Ready',
                'difficulty' => SpeakingPrompt::DIFFICULTY_BEGINNER,
                'target_wpm_min' => 110,
                'target_wpm_max' => 140,
                'passage_text' => 'Technical setbacks and unexpected build failures are valuable diagnostic learning signals rather than personal shortcomings. By taking swift ownership of mistakes, communicating transparently with supervisors, and instituting automated regression tests, software engineers build long-term technical resilience.',
            ],
        ];
    }
}

