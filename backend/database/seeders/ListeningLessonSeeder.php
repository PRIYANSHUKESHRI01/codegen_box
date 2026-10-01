<?php

namespace Database\Seeders;

use App\Models\ListeningLesson;
use Illuminate\Database\Seeder;

/**
 * Launch content for Listening Lab — read aloud client-side via the
 * existing VoiceEngine.speak() (browser TTS), then a short comprehension
 * quiz graded server-side. Every question is answerable directly from its
 * passage. Idempotent via updateOrCreate by title. No admin CRUD in v1 (see
 * the Learning Centre plan's scope boundaries).
 */
class ListeningLessonSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->lessons() as $order => $lesson) {
            ListeningLesson::updateOrCreate(
                ['title' => $lesson['title']],
                [
                    'passage_text' => $lesson['passage_text'],
                    'category' => $lesson['category'],
                    'difficulty' => $lesson['difficulty'],
                    'questions' => $lesson['questions'],
                    'is_active' => true,
                    'display_order' => $order,
                ]
            );
        }
    }

    private function lessons(): array
    {
        return [
            [
                'title' => 'Campus Orientation Day',
                'category' => 'Campus Life',
                'difficulty' => ListeningLesson::DIFFICULTY_BEGINNER,
                'passage_text' => 'Every new student at the college attends an orientation day before classes begin. The event starts at nine in the morning in the main auditorium, where the principal welcomes everyone. After that, students are divided into small groups of fifteen and taken on a tour of the library, the labs, and the sports ground. The day ends with a lunch in the cafeteria, where students can meet their classmates and ask senior students questions about college life.',
                'questions' => [
                    ['question' => 'What time does orientation day start?', 'options' => ['Seven in the morning', 'Nine in the morning', 'Noon', 'Two in the afternoon'], 'correct_index' => 1, 'explanation' => 'The passage says the event starts at nine in the morning.'],
                    ['question' => 'How many students are in each tour group?', 'options' => ['Ten', 'Twelve', 'Fifteen', 'Twenty'], 'correct_index' => 2, 'explanation' => 'Students are divided into small groups of fifteen.'],
                    ['question' => 'Where does the day end?', 'options' => ['The library', 'The sports ground', 'The auditorium', 'The cafeteria'], 'correct_index' => 3, 'explanation' => 'The day ends with lunch in the cafeteria.'],
                ],
            ],
            [
                'title' => "The Library's New Hours",
                'category' => 'Campus Life',
                'difficulty' => ListeningLesson::DIFFICULTY_BEGINNER,
                'passage_text' => 'Starting next month, the college library will stay open until ten at night instead of closing at six. The change was made after students asked for more time to study during exam season. The library will also open an hour earlier on Saturdays, at nine instead of ten. Students are reminded that the quiet study room on the second floor still closes at eight every evening, even though the rest of the library stays open later.',
                'questions' => [
                    ['question' => 'What new closing time will the library have?', 'options' => ['Eight at night', 'Nine at night', 'Ten at night', 'Midnight'], 'correct_index' => 2, 'explanation' => 'The library will stay open until ten at night.'],
                    ['question' => 'Why was the change made?', 'options' => ['A new librarian was hired', 'Students asked for more study time', 'The building was renovated', 'Fewer students were visiting'], 'correct_index' => 1, 'explanation' => 'The change was made after students asked for more time to study during exam season.'],
                    ['question' => 'What still closes at eight every evening?', 'options' => ['The whole library', 'The main entrance', 'The quiet study room on the second floor', 'The computer lab'], 'correct_index' => 2, 'explanation' => 'The quiet study room on the second floor still closes at eight, even though the rest of the library stays open later.'],
                ],
            ],
            [
                'title' => 'Building Good Study Habits',
                'category' => 'Career Readiness',
                'difficulty' => ListeningLesson::DIFFICULTY_BEGINNER,
                'passage_text' => 'Good study habits are built slowly, through small daily choices rather than one long session before an exam. Setting aside the same thirty minutes each day, in a quiet place without a phone nearby, trains the brain to focus faster over time. Reviewing notes shortly after a class, rather than weeks later, also makes information much easier to remember. Students who study a little every day usually feel calmer before exams than those who wait until the last few days.',
                'questions' => [
                    ['question' => 'According to the passage, how should study habits be built?', 'options' => ['Through one long session before exams', 'Slowly, through small daily choices', 'Only during exam week', 'By studying with a large group'], 'correct_index' => 1, 'explanation' => 'The passage says good study habits are built slowly, through small daily choices.'],
                    ['question' => 'What should be kept away during study time?', 'options' => ['Notebooks', 'A phone', 'Water', 'A pen'], 'correct_index' => 1, 'explanation' => 'It recommends a quiet place without a phone nearby.'],
                    ['question' => 'When is the best time to review notes?', 'options' => ['Weeks after class', 'Shortly after a class', 'The night before an exam', 'Only on weekends'], 'correct_index' => 1, 'explanation' => 'Reviewing notes shortly after a class makes information much easier to remember.'],
                ],
            ],
            [
                'title' => 'Choosing a Career Path',
                'category' => 'Career Readiness',
                'difficulty' => ListeningLesson::DIFFICULTY_INTERMEDIATE,
                'passage_text' => 'Choosing a career path can feel overwhelming, especially when there seem to be countless possible directions to take. Career counselors often suggest starting not with "what job should I choose," but with "what kind of problems do I enjoy solving." This shift in thinking helps students explore roles they might never have considered by title alone. It also helps to talk to people already working in a field of interest, since a job title rarely captures what the daily work actually involves. Trying a short internship, even an unpaid one, often reveals more in a few weeks than months of research online.',
                'questions' => [
                    ['question' => 'What do career counselors suggest starting with?', 'options' => ['A list of high-paying jobs', 'What kind of problems you enjoy solving', 'Your parents\' opinion', 'The most popular career choice'], 'correct_index' => 1, 'explanation' => 'Counselors suggest starting with what kind of problems a student enjoys solving.'],
                    ['question' => 'Why should students talk to people already working in a field?', 'options' => ['Because a job title rarely captures the daily work', 'Because it guarantees a job offer', 'Because online research is not allowed', 'Because it is required for graduation'], 'correct_index' => 0, 'explanation' => 'A job title rarely captures what the daily work actually involves.'],
                    ['question' => 'What does the passage say reveals more than months of online research?', 'options' => ['Reading more articles', 'A short internship', 'Watching career videos', 'Taking a personality test'], 'correct_index' => 1, 'explanation' => 'A short internship, even unpaid, often reveals more in a few weeks than months of research online.'],
                ],
            ],
            [
                'title' => 'Remote Work Trends',
                'category' => 'Technology',
                'difficulty' => ListeningLesson::DIFFICULTY_INTERMEDIATE,
                'passage_text' => 'Remote work, once considered a rare perk offered by a small number of companies, has become a standard option across many industries. Employees frequently report better focus and fewer daily interruptions when working from home, though many also describe feeling more isolated from their colleagues over time. In response, a growing number of companies now offer a hybrid model, asking employees to come into the office two or three days a week while working remotely the rest of the time. Surveys suggest that this middle ground, rather than either extreme, is what most employees actually prefer.',
                'questions' => [
                    ['question' => 'What do many remote employees report feeling over time?', 'options' => ['More isolated from colleagues', 'Less productive', 'More interrupted', 'Less trusted by managers'], 'correct_index' => 0, 'explanation' => 'Many employees describe feeling more isolated from their colleagues over time.'],
                    ['question' => 'How many days a week do hybrid employees typically go to the office, according to the passage?', 'options' => ['Every day', 'Two or three days', 'Once a month', 'Never'], 'correct_index' => 1, 'explanation' => 'Companies ask employees to come in two or three days a week under a hybrid model.'],
                    ['question' => 'What do surveys suggest most employees prefer?', 'options' => ['Fully remote work', 'Fully in-office work', 'The hybrid middle ground', 'No preference at all'], 'correct_index' => 2, 'explanation' => 'Surveys suggest the hybrid middle ground is what most employees actually prefer.'],
                ],
            ],
            [
                'title' => 'The Science of Motivation',
                'category' => 'Professional Skills',
                'difficulty' => ListeningLesson::DIFFICULTY_INTERMEDIATE,
                'passage_text' => 'Psychologists often separate motivation into two types: extrinsic, which comes from outside rewards like money or praise, and intrinsic, which comes from genuine personal interest in the task itself. Research consistently shows that intrinsic motivation produces more creative, higher-quality work over the long term, while extrinsic rewards work well for simple, repetitive tasks but can actually reduce performance on complex ones. This does not mean external rewards are useless; rather, they work best when paired with autonomy, letting people choose how they approach a task instead of dictating every step.',
                'questions' => [
                    ['question' => 'What is intrinsic motivation, according to the passage?', 'options' => ['Motivation from outside rewards', 'Motivation from genuine personal interest', 'Motivation from fear of punishment', 'Motivation that only applies to children'], 'correct_index' => 1, 'explanation' => 'Intrinsic motivation comes from genuine personal interest in the task itself.'],
                    ['question' => 'What does research show about extrinsic rewards on complex tasks?', 'options' => ['They always improve performance', 'They can reduce performance', 'They have no effect at all', 'They only work for adults'], 'correct_index' => 1, 'explanation' => 'Extrinsic rewards can actually reduce performance on complex tasks.'],
                    ['question' => 'What do external rewards work best paired with?', 'options' => ['Strict deadlines', 'Autonomy', 'Constant supervision', 'Public rankings'], 'correct_index' => 1, 'explanation' => 'External rewards work best when paired with autonomy.'],
                ],
            ],
            [
                'title' => 'The Rise of Renewable Energy',
                'category' => 'Technology',
                'difficulty' => ListeningLesson::DIFFICULTY_ADVANCED,
                'passage_text' => 'The cost of generating electricity from solar and wind power has fallen so dramatically over the past decade that, in most regions, renewable energy is now cheaper than building new coal or gas power plants. This shift has less to do with environmental policy and more to do with straightforward economics, as manufacturing efficiency and competition among suppliers have driven prices down far faster than early forecasts predicted. The remaining challenge is not generation but storage: because the sun does not always shine and the wind does not always blow, large-scale battery technology remains the critical bottleneck standing between current renewable capacity and a fully reliable, round-the-clock power grid.',
                'questions' => [
                    ['question' => 'What does the passage say is now cheaper than new coal or gas plants in most regions?', 'options' => ['Nuclear power', 'Renewable energy', 'Imported oil', 'Natural gas storage'], 'correct_index' => 1, 'explanation' => 'Renewable energy is now cheaper than building new coal or gas power plants in most regions.'],
                    ['question' => 'What does the passage credit for driving renewable prices down?', 'options' => ['Government bans on fossil fuels', 'Manufacturing efficiency and competition among suppliers', 'A sudden drop in electricity demand', 'International trade tariffs'], 'correct_index' => 1, 'explanation' => 'Manufacturing efficiency and competition among suppliers drove prices down.'],
                    ['question' => 'What does the passage identify as the critical remaining bottleneck?', 'options' => ['Solar panel manufacturing', 'Large-scale battery storage technology', 'Public support for renewables', 'Wind turbine design'], 'correct_index' => 1, 'explanation' => 'Large-scale battery technology remains the critical bottleneck for a fully reliable grid.'],
                ],
            ],
            [
                'title' => 'Negotiating a Job Offer',
                'category' => 'Career Readiness',
                'difficulty' => ListeningLesson::DIFFICULTY_ADVANCED,
                'passage_text' => 'Many candidates accept the first salary figure offered simply because negotiation feels uncomfortable, yet most recruiters expect some back-and-forth and rarely withdraw an offer over a reasonable counter. The key is framing the conversation around market value and demonstrated impact rather than personal financial need, since the latter, however genuine, carries little weight in a business decision. It also helps to negotiate the entire package rather than fixating on base salary alone, since benefits like signing bonuses, additional leave, or flexible working arrangements can sometimes be adjusted even when the base figure genuinely cannot move.',
                'questions' => [
                    ['question' => 'Why do many candidates accept the first salary offered, according to the passage?', 'options' => ['Because negotiation feels uncomfortable', 'Because the first offer is always the best', 'Because recruiters forbid negotiation', 'Because it is illegal to negotiate'], 'correct_index' => 0, 'explanation' => 'Many candidates accept the first figure simply because negotiation feels uncomfortable.'],
                    ['question' => 'What should the negotiation conversation be framed around?', 'options' => ['Personal financial need', 'Market value and demonstrated impact', 'How long the process has taken', 'Comparisons with coworkers\' salaries'], 'correct_index' => 1, 'explanation' => 'The key is framing the conversation around market value and demonstrated impact.'],
                    ['question' => 'What does the passage suggest can sometimes be adjusted even when base salary cannot move?', 'options' => ['The job title', 'Signing bonuses, leave, or flexible arrangements', 'The company\'s ownership structure', 'The interview process itself'], 'correct_index' => 1, 'explanation' => 'Benefits like signing bonuses, additional leave, or flexible working arrangements can sometimes be adjusted.'],
                ],
            ],
        ];
    }
}
