<?php

namespace Database\Seeders;

use App\Models\SpeakingPrompt;
use Illuminate\Database\Seeder;

/**
 * Launch content for Speaking Practice — real, complete passages (not
 * placeholder text) across all three difficulty tiers, same "real content
 * from day one" posture as ArticleSeeder. Idempotent via updateOrCreate by
 * title. No admin CRUD in v1 (see the Learning Centre plan's scope
 * boundaries) — this is the only way this content gets authored for now.
 */
class SpeakingPromptSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->prompts() as $order => $prompt) {
            SpeakingPrompt::updateOrCreate(
                ['title' => $prompt['title']],
                [
                    'passage_text' => $prompt['passage_text'],
                    'category' => $prompt['category'],
                    'difficulty' => $prompt['difficulty'],
                    'target_wpm_min' => 110,
                    'target_wpm_max' => 160,
                    'is_active' => true,
                    'display_order' => $order,
                ]
            );
        }
    }

    private function prompts(): array
    {
        return [
            // Beginner
            [
                'title' => 'My Daily Routine',
                'category' => 'Everyday Life',
                'difficulty' => SpeakingPrompt::DIFFICULTY_BEGINNER,
                'passage_text' => 'Every morning, I wake up at seven o\'clock and get ready for the day. I brush my teeth, take a quick shower, and eat a simple breakfast. After that, I check my messages and plan what I need to do. I usually leave home by eight thirty so I can reach my classes on time. In the evening, I like to relax by listening to music or going for a short walk.',
            ],
            [
                'title' => 'A Walk in the Park',
                'category' => 'Everyday Life',
                'difficulty' => SpeakingPrompt::DIFFICULTY_BEGINNER,
                'passage_text' => 'Last weekend, I visited a park near my house with two of my friends. The weather was cool and sunny, so many families were sitting on the grass. We walked around the lake, took some photographs, and bought ice cream from a small stall near the gate. It was a simple afternoon, but it helped me feel calm and refreshed before a busy week.',
            ],
            [
                'title' => 'My Favorite Hobby',
                'category' => 'Everyday Life',
                'difficulty' => SpeakingPrompt::DIFFICULTY_BEGINNER,
                'passage_text' => 'My favorite hobby is reading short stories before I go to sleep. I enjoy stories because they let me imagine new places and characters without leaving my room. On weekends, I sometimes visit a small bookstore near my college and spend an hour looking through the shelves. Reading also helps me learn new words, which is useful when I am speaking English with my friends.',
            ],
            [
                'title' => 'Ordering Food at a Restaurant',
                'category' => 'Everyday Life',
                'difficulty' => SpeakingPrompt::DIFFICULTY_BEGINNER,
                'passage_text' => 'When I go to a restaurant with my friends, I usually look at the menu carefully before deciding what to order. I like to ask the waiter for recommendations if I am not sure what to choose. Once the food arrives, we talk, laugh, and enjoy the meal together. At the end, we ask for the bill and decide whether to split the cost equally among everyone.',
            ],

            // Intermediate
            [
                'title' => 'The Importance of Time Management',
                'category' => 'Professional Skills',
                'difficulty' => SpeakingPrompt::DIFFICULTY_INTERMEDIATE,
                'passage_text' => 'Time management is one of the most valuable skills a student can develop before entering the workplace. When you plan your day in advance, you spend less time deciding what to do next and more time actually getting things done. Breaking large tasks into smaller, manageable steps makes even difficult projects feel achievable. People who manage their time well are not necessarily busier than others; they simply make more deliberate choices about where their attention goes.',
            ],
            [
                'title' => 'Technology in Modern Education',
                'category' => 'Technology',
                'difficulty' => SpeakingPrompt::DIFFICULTY_INTERMEDIATE,
                'passage_text' => 'Technology has changed the way students learn in classrooms around the world. Interactive tools, recorded lectures, and online practice platforms allow learners to study at their own pace instead of following a fixed schedule. At the same time, teachers can track a student\'s progress more accurately than ever before, identifying exactly where extra support is needed. However, technology works best when it supports genuine understanding, not when it simply replaces the effort of thinking things through.',
            ],
            [
                'title' => 'Preparing for a Job Interview',
                'category' => 'Career Readiness',
                'difficulty' => SpeakingPrompt::DIFFICULTY_INTERMEDIATE,
                'passage_text' => 'Preparing well for a job interview can make the difference between a nervous performance and a confident one. It helps to research the company beforehand, understand the role you are applying for, and think of real examples from your own experience that show your strengths. Practicing your answers out loud, rather than just in your head, trains you to speak clearly under pressure. Remember that an interview is also your chance to ask thoughtful questions about the team and the work itself.',
            ],
            [
                'title' => 'The Benefits of Teamwork',
                'category' => 'Professional Skills',
                'difficulty' => SpeakingPrompt::DIFFICULTY_INTERMEDIATE,
                'passage_text' => 'Working in a team teaches skills that are difficult to develop when you always work alone. You learn to listen to different points of view, negotiate when opinions disagree, and combine individual strengths into something stronger than any one person could build alone. Good teamwork does not mean everyone thinks the same way; it means people with different strengths trust each other enough to divide the work sensibly and support one another when something goes wrong.',
            ],

            // Advanced
            [
                'title' => 'The Impact of Artificial Intelligence on the Job Market',
                'category' => 'Technology',
                'difficulty' => SpeakingPrompt::DIFFICULTY_ADVANCED,
                'passage_text' => 'Artificial intelligence is reshaping industries at a pace few predicted even a decade ago, automating tasks that once required years of specialized training while simultaneously creating entirely new categories of work. This dual effect means the conversation should move beyond a simple question of job losses versus job gains, toward a more nuanced discussion of which human skills remain irreplaceable. Creativity, ethical judgment, and the ability to navigate ambiguous, unprecedented situations continue to distinguish human contribution from automated efficiency, and these are precisely the capabilities that future education must prioritize.',
            ],
            [
                'title' => 'Effective Communication in the Workplace',
                'category' => 'Professional Skills',
                'difficulty' => SpeakingPrompt::DIFFICULTY_ADVANCED,
                'passage_text' => 'Effective workplace communication extends far beyond simply exchanging information; it requires the deliberate practice of ensuring that a message is understood exactly as intended, regardless of the listener\'s background or assumptions. Ambiguity, left unaddressed, tends to compound over time, turning small misunderstandings into significant operational failures. Professionals who communicate well are typically those who tailor their language to their audience, actively solicit feedback to confirm comprehension, and remain genuinely receptive to being misunderstood themselves rather than assuming clarity was automatically achieved.',
            ],
            [
                'title' => 'Overcoming Challenges in a Competitive Industry',
                'category' => 'Career Readiness',
                'difficulty' => SpeakingPrompt::DIFFICULTY_ADVANCED,
                'passage_text' => 'Entering a highly competitive industry demands more than raw talent; it requires a sustained willingness to adapt in the face of repeated setbacks that would discourage a less determined candidate. Rejection, in this context, is rarely a verdict on one\'s ultimate potential but rather a reflection of timing, fit, or circumstances entirely outside one\'s control. Professionals who eventually thrive are frequently distinguished not by an absence of failure, but by their capacity to extract a specific, actionable lesson from each setback and apply it deliberately to their next attempt.',
            ],
            [
                'title' => 'The Role of Innovation in Business Growth',
                'category' => 'Business',
                'difficulty' => SpeakingPrompt::DIFFICULTY_ADVANCED,
                'passage_text' => 'Sustainable business growth rarely emerges from a single breakthrough idea; it is far more often the cumulative result of a culture that consistently rewards thoughtful experimentation over blind adherence to existing methods. Organizations that institutionalize innovation treat failure not as something to be avoided at all costs, but as an anticipated and informative byproduct of genuine progress. This mindset requires leadership to tolerate short-term inefficiency in exchange for long-term adaptability, a trade-off that becomes increasingly difficult to justify as an organization scales and risk aversion naturally sets in.',
            ],
        ];
    }
}
