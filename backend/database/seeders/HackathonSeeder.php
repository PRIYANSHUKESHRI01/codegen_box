<?php

namespace Database\Seeders;

use App\Models\College;
use App\Models\Company;
use App\Models\Hackathon;
use App\Models\HackathonParticipant;
use App\Models\HackathonSubmission;
use App\Models\HackathonTeam;
use App\Models\Plan;
use App\Models\User;
use App\Services\Hackathons\HackathonResultsService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * DEMO DATA for the Hack Arena — five hackathons caught in five different
 * moments, so every state of the arena can be seen without waiting for a clock:
 *
 *   1. AI for Bharat Build Sprint     LIVE now, hosted by AptRun (featured). The demo student's team has a draft.
 *   2. Nimbus Cloud-Native Challenge  registration OPEN, hosted by a hiring partner (Nimbus Labs).
 *   3. GreenCode Climate Hack         announced, registration not open YET.
 *   4. HealthTech Hack Day            deadline passed, being JUDGED (some projects scored, some not).
 *   5. Campus Connect Hack 2.0        COMPLETED — results published, the demo student's team came second.
 *
 * Every date is relative to the moment this runs, so the arena always looks
 * current. Re-running is safe: hackathons are matched by slug and their people
 * and projects are only created once. Like the rest of DatabaseSeeder this is
 * for local/demo databases — never run it against production.
 */
class HackathonSeeder extends Seeder
{
    private const DEMO_PASSWORD = 'arena_demo_pass_26';

    private ?User $host = null;

    /** @var list<User> */
    private array $cohort = [];

    private ?User $alex = null;

    public function run(): void
    {
        if (Plan::count() === 0) {
            // Creating a student fires a listener that attaches the free plan.
            $this->call(PlanSeeder::class);
        }

        $this->host = User::where('role', User::ROLE_SUPERADMIN)->first() ?? User::where('role', User::ROLE_ADMIN_INTERNAL)->first();
        $this->alex = $this->demoStudent();
        $this->cohort = $this->cohort();

        $nimbus = Company::updateOrCreate(
            ['slug' => 'nimbus-labs'],
            [
                'name' => 'Nimbus Labs',
                'logo' => '⚡',
                'website_url' => 'https://nimbuslabs.example.com',
                'industry' => 'Cloud Infrastructure',
                'overview' => 'Nimbus Labs builds developer tooling for cloud-native teams, hiring directly through AptRun for its engineering roles.',
                'account_type' => Company::ACCOUNT_TYPE_HIRING_TENANT,
            ]
        );

        $this->liveSprint();
        $this->companyChallenge($nimbus);
        $this->announcedHack();
        $this->judgingHackDay();
        $this->completedHack();
    }

    // ───────────────────────────── 1. live ─────────────────────────────

    private function liveSprint(): void
    {
        $h = $this->upsert('ai-for-bharat-build-sprint', [
            'title' => 'AI for Bharat Build Sprint',
            'tagline' => 'Ship an AI product that works for a billion people — in 72 hours.',
            'description' => <<<'MD'
## The challenge

India runs on languages, local context and low-bandwidth realities that most AI products ignore. For 72 hours, build something that **makes AI genuinely useful for people outside the English-speaking, high-bandwidth bubble** — and ship it.

A farmer who wants crop advice in Marathi on a basic phone. A patient who needs a prescription explained in Tamil. A clerk who spends four hours a day re-typing forms. Pick a real problem, talk to the people who have it, and build.

## What you will do

- Form a team of up to four (or go solo) and pick a **track**.
- Build a working prototype — a deployed demo beats slides, every time.
- Submit your repository, a live link and a short video before the deadline.
- Present to a panel of engineers from AptRun's hiring partners.

## Why enter

The top teams get **fast-tracked interviews** with our hiring partners, cash prizes, and a permanent winner badge on their AptRun profile. Every submitted project appears in the public gallery — a portfolio piece recruiters can actually open.
MD,
            'accent' => 'violet',
            'themes' => ['AI', 'Open Innovation', 'Social Good'],
            'mode' => Hackathon::MODE_ONLINE,
            'location' => null,
            'host_type' => Hackathon::HOST_PLATFORM,
            'company_id' => null,
            'registration_opens_at' => now()->subDays(12),
            'registration_closes_at' => now()->addDay(),
            'starts_at' => now()->subHours(30),
            'ends_at' => now()->addHours(42),
            'results_expected_at' => now()->addDays(6),
            'min_team_size' => 1,
            'max_team_size' => 4,
            'max_participants' => 500,
            'prize_pool_amount' => 150000,
            'currency' => 'INR',
            'prizes' => [
                ['place' => 1, 'title' => 'Grand Champion', 'reward' => '₹75,000', 'perks' => ['Fast-track interviews with 3 hiring partners', 'AptRun Pro for a year', 'Permanent winner badge']],
                ['place' => 2, 'title' => 'Runner-up', 'reward' => '₹45,000', 'perks' => ['Priority shortlist with hiring partners', 'AptRun Pro for six months']],
                ['place' => 3, 'title' => 'Second Runner-up', 'reward' => '₹30,000', 'perks' => ['Priority shortlist with hiring partners']],
            ],
            'tracks' => [
                ['name' => 'Agri & Rural AI', 'description' => 'Crop advice, mandi prices, weather and finance for farmers.'],
                ['name' => 'Language & Accessibility', 'description' => 'Make AI usable in Indian languages and for people with disabilities.'],
                ['name' => 'Public Services', 'description' => 'Cut the friction out of forms, benefits, health and civic services.'],
                ['name' => 'Open Innovation', 'description' => 'Anything else that makes life measurably better.'],
            ],
            'criteria' => [
                ['name' => 'Innovation', 'weight' => 25, 'description' => 'Is the idea original and well chosen for the problem?'],
                ['name' => 'Technical execution', 'weight' => 30, 'description' => 'Does it work? Quality of the build and engineering decisions.'],
                ['name' => 'Real-world impact', 'weight' => 25, 'description' => 'Would the people you built it for actually use it?'],
                ['name' => 'Demo & storytelling', 'weight' => 20, 'description' => 'A clear write-up, a live demo, a story worth telling.'],
            ],
            'rules' => <<<'MD'
- Teams of **1–4** students. Everyone must be registered on AptRun.
- Work must be **started after kickoff**. Open-source libraries, APIs and pre-trained models are welcome; pre-built projects are not.
- Submit a public repository, a working demo link and a video of **up to 3 minutes**.
- One submission per team. You can keep editing until the deadline.
- Be honest about what is built and what is mocked — judges will check.
- Plagiarism or misrepresenting work leads to disqualification.
MD,
            'eligibility' => 'Open to every student on AptRun, from any college and year.',
            'faqs' => [
                ['question' => 'Can I join after the hackathon has started?', 'answer' => 'Yes — late registration is open until the date shown on the schedule, and you can still submit by the deadline.'],
                ['question' => 'Do I need a team?', 'answer' => 'No. Solo entries are welcome, and you can also create a team or join one with an invite code.'],
                ['question' => 'Which AI tools can I use?', 'answer' => 'Any. Public APIs, open-source models and no-code tools are all fine as long as you build the product yourself.'],
                ['question' => 'When are results announced?', 'answer' => 'Within a week of the deadline. Results appear here and on your profile.'],
            ],
            'resources' => [
                ['label' => 'Starter repository template', 'url' => 'https://github.com/'],
                ['label' => 'Free API credits guide', 'url' => 'https://aptrun.example.com/guides/api-credits'],
            ],
            'is_featured' => true,
        ]);

        if ($h->participants()->exists()) {
            return;
        }

        $teams = [
            // Alex's team — a draft in progress, to show the "continue your project" state.
            ['name' => 'Byte Brigade', 'members' => [$this->alex, $this->cohort[0], $this->cohort[1]], 'project' => [
                'title' => 'KisanBol', 'tagline' => 'A voice-first crop advisor for farmers, in their own language.',
                'description' => 'Farmers speak a question in Marathi and get spoken advice back — sowing windows, pest alerts and mandi prices. Runs on a basic Android phone over 2G.',
                'track' => 'Agri & Rural AI', 'repo_url' => 'https://github.com/byte-brigade/kisanbol', 'demo_url' => null, 'video_url' => null,
                'tech_stack' => ['Python', 'FastAPI', 'Whisper', 'React'], 'status' => 'draft',
            ]],
            ['name' => 'Lexicon Labs', 'members' => [$this->cohort[2], $this->cohort[3]], 'project' => [
                'title' => 'Sahayak', 'tagline' => 'Government forms, explained and filled in your language.',
                'description' => 'Upload a form, ask what it means, and Sahayak walks you through every field in Hindi, Bengali or Tamil — then pre-fills it from your documents.',
                'track' => 'Public Services', 'repo_url' => 'https://github.com/lexicon-labs/sahayak', 'demo_url' => 'https://sahayak.example.com', 'video_url' => 'https://youtu.be/demo-sahayak',
                'tech_stack' => ['Next.js', 'Gemini', 'PostgreSQL'], 'status' => 'submitted',
            ]],
            ['name' => 'Signal & Noise', 'members' => [$this->cohort[4]], 'project' => [
                'title' => 'Lipi', 'tagline' => 'Real-time sign-language captions for any video call.',
                'description' => 'A browser extension that watches a signer on a call and produces live captions, so deaf and hearing colleagues can finally meet in the middle.',
                'track' => 'Language & Accessibility', 'repo_url' => 'https://github.com/signal-noise/lipi', 'demo_url' => 'https://lipi.example.com', 'video_url' => 'https://youtu.be/demo-lipi',
                'tech_stack' => ['TypeScript', 'MediaPipe', 'WebRTC'], 'status' => 'submitted',
            ]],
            ['name' => 'Null Pointers', 'members' => [$this->cohort[5], $this->cohort[6], $this->cohort[7], $this->cohort[8]], 'project' => [
                'title' => 'GramSeva', 'tagline' => 'One WhatsApp number for every panchayat service.',
                'description' => 'Residents message a single number to check ration status, pay property tax or log a complaint. Panchayat staff see everything in a lightweight dashboard.',
                'track' => 'Public Services', 'repo_url' => null, 'demo_url' => null, 'video_url' => null,
                'tech_stack' => ['Node.js', 'WhatsApp API'], 'status' => 'draft',
            ]],
            ['name' => 'Solo Sprint', 'members' => [$this->cohort[9]], 'project' => null],
            ['name' => 'Gradient Descenders', 'members' => [$this->cohort[10], $this->cohort[11]], 'project' => [
                'title' => 'Mausam Mitra', 'tagline' => 'Hyper-local rain forecasts for the next six hours.',
                'description' => 'Combines radar, satellite and crowd-sourced reports to tell a farmer if the rain is coming to their field — not their district.',
                'track' => 'Agri & Rural AI', 'repo_url' => 'https://github.com/gradient-descenders/mausam', 'demo_url' => 'https://mausam.example.com', 'video_url' => null,
                'tech_stack' => ['Python', 'PyTorch', 'Leaflet'], 'status' => 'submitted',
            ]],
        ];

        $this->seedTeams($h, $teams);

        $h->announcements()->create(['author_id' => $this->host?->id, 'title' => 'Late registration extended', 'body' => 'Registration now stays open until tomorrow, so friends who are still deciding can still join your team. Share your invite code!', 'created_at' => now()->subHours(20)]);
        $h->announcements()->create(['author_id' => $this->host?->id, 'title' => 'Kickoff is live 🚀', 'body' => 'The hackathon has started. Pick your track, open a repository, and remember: a deployed demo beats slides.', 'created_at' => now()->subHours(30)]);
    }

    // ───────────────────────────── 2. company, registration open ─────────────────────────────

    private function companyChallenge(Company $nimbus): void
    {
        $h = $this->upsert('nimbus-cloud-native-challenge', [
            'title' => 'Nimbus Cloud-Native Challenge',
            'tagline' => 'Build developer tooling that cloud teams would actually pay for. Interview with the people who ship it.',
            'description' => <<<'MD'
## Build the tool you wish existed

Nimbus Labs builds developer tooling for cloud-native teams. This challenge is our way of meeting the next generation of engineers the way we hire best — **by looking at what you build**.

Choose a pain point in how teams build, deploy or operate software and build the tool that removes it: a smarter CI step, a cost explainer, a one-command preview environment, an incident timeline. Small and sharp beats big and vague.

## Format

- **Weekend sprint** — 48 hours, online, then a **final demo day** at the Nimbus Labs office in Bengaluru for the top five teams (travel covered).
- Teams of 2–4.
- Mentors from the Nimbus platform team will be on call throughout.

## Hiring

This is a real recruiting event. **Every finalist gets a guaranteed technical interview** with Nimbus Labs, and winners skip the first screening round.
MD,
            'accent' => 'teal',
            'themes' => ['Cloud', 'DevOps', 'Developer Tools'],
            'mode' => Hackathon::MODE_HYBRID,
            'location' => 'Nimbus Labs HQ, Bengaluru (finals) · online sprint',
            'host_type' => Hackathon::HOST_COMPANY,
            'company_id' => $nimbus->id,
            'registration_opens_at' => now()->subDays(3),
            'registration_closes_at' => now()->addDays(9),
            'starts_at' => now()->addDays(12),
            'ends_at' => now()->addDays(14),
            'results_expected_at' => now()->addDays(18),
            'min_team_size' => 2,
            'max_team_size' => 4,
            'max_participants' => 120,
            'prize_pool_amount' => 200000,
            'currency' => 'INR',
            'prizes' => [
                ['place' => 1, 'title' => 'Winner', 'reward' => '₹1,00,000', 'perks' => ['Skip the first interview round', 'Paid internship offer track', 'Nimbus Labs swag box']],
                ['place' => 2, 'title' => 'Runner-up', 'reward' => '₹60,000', 'perks' => ['Guaranteed technical interview']],
                ['place' => 3, 'title' => 'Third place', 'reward' => '₹40,000', 'perks' => ['Guaranteed technical interview']],
            ],
            'tracks' => [
                ['name' => 'CI/CD & Delivery', 'description' => 'Make shipping faster, safer and boring.'],
                ['name' => 'Observability', 'description' => 'Help teams understand what their systems are doing.'],
                ['name' => 'Cost & Platform', 'description' => 'Tame cloud bills and developer-platform sprawl.'],
            ],
            'criteria' => [
                ['name' => 'Problem clarity', 'weight' => 20, 'description' => 'A real pain point, described crisply.'],
                ['name' => 'Engineering quality', 'weight' => 35, 'description' => 'Architecture, correctness, tests, operability.'],
                ['name' => 'Usefulness', 'weight' => 25, 'description' => 'Would an engineering team adopt this tomorrow?'],
                ['name' => 'Presentation', 'weight' => 20, 'description' => 'Demo, docs and the story you tell.'],
            ],
            'rules' => <<<'MD'
- Teams of **2–4** students — find teammates in advance; solo entries are not accepted for this one.
- Start fresh at kickoff; open-source dependencies are fine.
- Your repository must be public and include a README that lets a stranger run the project.
- Finalists must be available for the demo day in Bengaluru (travel and stay covered) or present remotely by prior arrangement.
MD,
            'eligibility' => 'Final-year and pre-final-year students; all branches welcome.',
            'faqs' => [
                ['question' => 'Do I need cloud experience?', 'answer' => 'It helps, but a good idea and clean engineering matter more. Mentors will help you get unstuck.'],
                ['question' => 'Is travel to Bengaluru covered?', 'answer' => 'Yes — for the finalists attending demo day in person.'],
                ['question' => 'Will this help me get hired?', 'answer' => 'Every finalist gets a guaranteed technical interview with Nimbus Labs.'],
            ],
            'resources' => [['label' => 'Nimbus Labs engineering blog', 'url' => 'https://nimbuslabs.example.com/blog']],
            'is_featured' => false,
        ]);

        if ($h->participants()->exists()) {
            return;
        }

        $this->seedTeams($h, [
            ['name' => 'Pipeline Pirates', 'members' => [$this->cohort[12], $this->cohort[13], $this->cohort[14]], 'project' => null],
            ['name' => 'Kube Kings', 'members' => [$this->cohort[15], $this->cohort[16]], 'project' => null],
            ['name' => 'Latency Hunters', 'members' => [$this->cohort[17], $this->cohort[18], $this->cohort[19]], 'project' => null],
        ]);

        $h->announcements()->create(['author_id' => $this->host?->id, 'title' => 'Mentor line-up announced', 'body' => 'Six engineers from the Nimbus platform team will mentor throughout the sprint. Office hours are posted on the schedule.', 'created_at' => now()->subDay()]);
    }

    // ───────────────────────────── 3. announced, not open yet ─────────────────────────────

    private function announcedHack(): void
    {
        $this->upsert('greencode-climate-hack', [
            'title' => 'GreenCode Climate Hack',
            'tagline' => 'Code for the planet: tools that cut emissions, waste and energy use.',
            'description' => <<<'MD'
## Software for a cooler planet

Climate change is, among other things, a data problem: who is emitting, who is wasting, and who needs help first. This hackathon asks you to build the software that answers those questions.

Think carbon-aware scheduling, energy dashboards for small factories, crop-loss early warning, waste-sorting vision models, or tools that help a college measure — and cut — its own footprint.

## Hybrid format

Kick off online, build for a weekend, and meet in **Pune** for the final showcase. Mentors from climate-tech startups and the open-climate-data community will be available throughout.
MD,
            'accent' => 'emerald',
            'themes' => ['Climate', 'Sustainability', 'IoT'],
            'mode' => Hackathon::MODE_HYBRID,
            'location' => 'Pune Tech Park (showcase) · online build',
            'host_type' => Hackathon::HOST_PLATFORM,
            'company_id' => null,
            'registration_opens_at' => now()->addDays(4),
            'registration_closes_at' => now()->addDays(24),
            'starts_at' => now()->addDays(27),
            'ends_at' => now()->addDays(29),
            'results_expected_at' => now()->addDays(33),
            'min_team_size' => 2,
            'max_team_size' => 5,
            'max_participants' => 300,
            'prize_pool_amount' => 100000,
            'currency' => 'INR',
            'prizes' => [
                ['place' => 1, 'title' => 'Climate Champion', 'reward' => '₹50,000', 'perks' => ['Incubation intro with a climate-tech fund']],
                ['place' => 2, 'title' => 'Runner-up', 'reward' => '₹30,000', 'perks' => ['Mentorship session with a founder']],
                ['place' => 3, 'title' => 'Third place', 'reward' => '₹20,000', 'perks' => []],
            ],
            'tracks' => [
                ['name' => 'Energy', 'description' => 'Measure, forecast and reduce energy use.'],
                ['name' => 'Waste & Circular Economy', 'description' => 'Sort, reuse and trace materials.'],
                ['name' => 'Climate Resilience', 'description' => 'Help communities prepare for floods, heat and drought.'],
            ],
            'criteria' => null,
            'rules' => "- Teams of **2–5** students.\n- Use open climate datasets where you can, and cite them.\n- Be honest about assumptions in your models; judges reward clarity over polish.",
            'eligibility' => 'Open to every student on AptRun.',
            'faqs' => [
                ['question' => 'When does registration open?', 'answer' => 'In a few days. Check back here — the page will show a Register button as soon as it does.'],
                ['question' => 'Do I need hardware?', 'answer' => 'No. IoT ideas are welcome but software-only entries compete on equal terms.'],
            ],
            'resources' => [['label' => 'Open climate datasets', 'url' => 'https://data.gov.in/']],
            'is_featured' => false,
        ]);
    }

    // ───────────────────────────── 4. judging ─────────────────────────────

    private function judgingHackDay(): void
    {
        $h = $this->upsert('healthtech-hack-day', [
            'title' => 'HealthTech Hack Day',
            'tagline' => 'One day, one clinic problem, one working prototype.',
            'description' => <<<'MD'
## Build for the people who keep us well

A single-day, in-person sprint at the Hyderabad Innovation Hub. Clinicians shared real, unglamorous problems — missed follow-ups, unreadable handwriting, unmanageable queues — and teams spent the day building answers.

**Submissions are in and the judges are scoring.** Results will be announced here shortly.
MD,
            'accent' => 'rose',
            'themes' => ['HealthTech', 'AI', 'Accessibility'],
            // Mapped to one college only: students of other colleges never see it.
            'audience' => Hackathon::AUDIENCE_COLLEGES,
            'mode' => Hackathon::MODE_IN_PERSON,
            'location' => 'Innovation Hub, Hyderabad',
            'host_type' => Hackathon::HOST_PLATFORM,
            'company_id' => null,
            'registration_opens_at' => now()->subDays(20),
            'registration_closes_at' => now()->subDays(6),
            'starts_at' => now()->subDays(3),
            'ends_at' => now()->subDays(2),
            'results_expected_at' => now()->addDays(2),
            'min_team_size' => 2,
            'max_team_size' => 4,
            'max_participants' => 80,
            'prize_pool_amount' => 60000,
            'currency' => 'INR',
            'prizes' => [
                ['place' => 1, 'title' => 'Best Prototype', 'reward' => '₹30,000', 'perks' => ['Pilot introduction at a partner clinic']],
                ['place' => 2, 'title' => 'Runner-up', 'reward' => '₹20,000', 'perks' => []],
                ['place' => 3, 'title' => 'Third place', 'reward' => '₹10,000', 'perks' => []],
            ],
            'tracks' => [
                ['name' => 'Clinic Operations', 'description' => 'Queues, scheduling and follow-ups.'],
                ['name' => 'Patient Experience', 'description' => 'Make care easier to understand and access.'],
            ],
            'criteria' => null,
            'rules' => "- Teams of **2–4** students, on site for the full day.\n- Prototypes only — never use real patient data.",
            'eligibility' => 'Students based in or near Hyderabad.',
            'faqs' => [['question' => 'When will I know the result?', 'answer' => 'Judging is underway. Results will be published on this page as soon as scoring is complete.']],
            'resources' => [],
            'is_featured' => false,
        ]);

        $h->colleges()->sync([$this->college()->id]);

        if ($h->participants()->exists()) {
            return;
        }

        $projects = [
            ['CareLoop', 'Automatic follow-up reminders that patients actually answer.', 'Patient Experience', ['React Native', 'Twilio', 'Supabase'], [$this->alex, $this->cohort[20], $this->cohort[21]], [8, 8, 9, 7], 'Excellent grasp of the follow-up problem and a polished reminder flow. Next step: test it with real patients.'],
            ['QueueLess', 'Live clinic queue with SMS check-in — no more waiting rooms.', 'Clinic Operations', ['Vue', 'Laravel', 'MySQL'], [$this->cohort[0], $this->cohort[2]], [7, 8, 8, 8], 'Solid engineering and a clear demo. The wait-time estimate needs real data.'],
            ['ScribeAI', 'Turns a doctor’s dictation into structured notes.', 'Clinic Operations', ['Python', 'Whisper', 'FastAPI'], [$this->cohort[3], $this->cohort[4], $this->cohort[5]], [9, 7, 8, 9], 'Most original idea of the day. Accuracy on medical terms is the thing to harden.'],
            ['MedMap', 'Find the nearest pharmacy that has your prescription in stock.', 'Patient Experience', ['Next.js', 'Mapbox'], [$this->cohort[6], $this->cohort[7]], null, null],
            ['Pulse', 'A glanceable dashboard for ward nurses.', 'Clinic Operations', ['Svelte', 'Node.js'], [$this->cohort[8], $this->cohort[9]], null, null],
            ['Dhwani', 'Voice interface for patients who cannot read.', 'Patient Experience', ['Flutter', 'Firebase'], [$this->cohort[10], $this->cohort[11], $this->cohort[12]], null, null],
        ];

        $service = app(HackathonResultsService::class);
        $criteria = $h->effectiveCriteria();

        foreach ($projects as $index => [$title, $tagline, $track, $stack, $members, $marks, $feedback]) {
            $team = $this->team($h, 'Team '.$title, $members);

            $submission = HackathonSubmission::create([
                'hackathon_id' => $h->id,
                'hackathon_team_id' => $team->id,
                'submitted_by' => $members[0]->id,
                'title' => $title,
                'tagline' => $tagline,
                'description' => "{$title} was built over a single day with a clinician on call. {$tagline} The prototype is demoable end to end and the repository includes setup instructions.",
                'track' => $track,
                'repo_url' => 'https://github.com/demo/'.Str::slug($title),
                'demo_url' => 'https://'.Str::slug($title).'.example.com',
                'video_url' => null,
                'tech_stack' => $stack,
                'status' => HackathonSubmission::STATUS_SUBMITTED,
                'submitted_at' => now()->subDays(2)->subHours(10 + $index),
            ]);

            if ($marks !== null) {
                $named = [];
                foreach ($criteria as $i => $criterion) {
                    $named[$criterion['name']] = $marks[$i];
                }

                $submission->update([
                    'scores' => $named,
                    'final_score' => $service->weightedScore($h, $named),
                    'feedback' => $feedback,
                    'scored_by' => $this->host?->id,
                    'scored_at' => now()->subHours(6),
                ]);
            }
        }

        $h->announcements()->create(['author_id' => $this->host?->id, 'title' => 'Thank you, hackers!', 'body' => 'Submissions are closed and the judges are scoring. Results will be published here soon.', 'created_at' => now()->subDays(2)]);
    }

    // ───────────────────────────── 5. completed ─────────────────────────────

    private function completedHack(): void
    {
        $h = $this->upsert('campus-connect-hack-2', [
            'title' => 'Campus Connect Hack 2.0',
            'tagline' => 'Tools that make campus life better — built by the students who live it.',
            'description' => <<<'MD'
## That's a wrap

Campus Connect asked students to fix something about their own campus: finding notes, booking labs, getting to class on time, hearing about events before they happen. Ten teams shipped, nine submitted, and the standard was remarkable.

Congratulations to the winners — and thank you to everyone who built something real.
MD,
            'accent' => 'amber',
            'themes' => ['EdTech', 'Community', 'Web'],
            'mode' => Hackathon::MODE_ONLINE,
            'location' => null,
            'host_type' => Hackathon::HOST_PLATFORM,
            'company_id' => null,
            'registration_opens_at' => now()->subDays(40),
            'registration_closes_at' => now()->subDays(20),
            'starts_at' => now()->subDays(17),
            'ends_at' => now()->subDays(14),
            'results_expected_at' => now()->subDays(11),
            'min_team_size' => 1,
            'max_team_size' => 4,
            'max_participants' => 200,
            'prize_pool_amount' => 75000,
            'currency' => 'INR',
            'prizes' => [
                ['place' => 1, 'title' => 'Campus Champion', 'reward' => '₹40,000', 'perks' => ['AptRun Pro for a year', 'Winner badge']],
                ['place' => 2, 'title' => 'Runner-up', 'reward' => '₹25,000', 'perks' => ['AptRun Pro for six months']],
                ['place' => 3, 'title' => 'Third place', 'reward' => '₹10,000', 'perks' => []],
            ],
            'tracks' => null,
            'criteria' => null,
            'rules' => "- Teams of 1–4 students.\n- Original work only; credit every library and dataset.",
            'eligibility' => 'Open to every student on AptRun.',
            'faqs' => [],
            'resources' => [],
            'is_featured' => false,
        ]);

        if ($h->participants()->exists()) {
            return;
        }

        // title, tagline, members, marks [innovation, technical, impact, presentation], feedback, disqualified?
        $projects = [
            ['StudySync', 'Group study planner that finds a slot everyone is free.', [$this->cohort[13], $this->cohort[14]], [9, 9, 8, 9], 'A beautifully finished product with a real scheduling engine behind it. Best demo of the event.'],
            ['CampusBuzz', 'Every event, club and deadline on one calendar.', [$this->alex, $this->cohort[15], $this->cohort[16]], [8, 9, 8, 8], 'Great engineering and genuinely useful. The club-onboarding flow was a lovely touch.'],
            ['NotesNest', 'Searchable, shareable lecture notes with AI summaries.', [$this->cohort[17]], [8, 8, 8, 7], 'Strong idea and clean execution; moderation of shared notes needs thought.'],
            ['LabLock', 'Book a lab seat in two taps.', [$this->cohort[18], $this->cohort[19]], [7, 8, 8, 8], 'Solved a problem every student has. Integration with the timetable would make it complete.'],
            ['BusBuddy', 'Live campus shuttle tracking.', [$this->cohort[20], $this->cohort[21], $this->cohort[22]], [7, 7, 8, 7], 'Useful and well-demoed; accuracy depends on driver adoption.'],
            ['MessMenu', 'Rate and plan around the hostel mess menu.', [$this->cohort[23]], [7, 7, 8, 7], 'Charming, and the data it collects could genuinely improve the mess.'],
            ['PeerTutor', 'Match students with senior tutors.', [$this->cohort[0], $this->cohort[1]], [6, 7, 7, 6], 'A good start. Tutor verification is the missing piece.'],
            ['LostLink', 'Lost-and-found for the whole campus.', [$this->cohort[2], $this->cohort[3]], [6, 6, 7, 7], 'Clear and focused. Needs more polish.'],
            ['QuizRush', 'Live quiz battles for revision.', [$this->cohort[4], $this->cohort[5]], [8, 8, 8, 8], 'Fun and technically solid, but disqualified after a review found a large part of the code was copied without credit.', true],
        ];

        $service = app(HackathonResultsService::class);
        $criteria = $h->effectiveCriteria();

        foreach ($projects as $index => $project) {
            [$title, $tagline, $members, $marks, $feedback] = $project;
            $disqualified = $project[5] ?? false;

            $team = $this->team($h, 'Team '.$title, $members);
            $named = [];
            foreach ($criteria as $i => $criterion) {
                $named[$criterion['name']] = $marks[$i];
            }

            HackathonSubmission::create([
                'hackathon_id' => $h->id,
                'hackathon_team_id' => $team->id,
                'submitted_by' => $members[0]->id,
                'title' => $title,
                'tagline' => $tagline,
                'description' => "{$title}: {$tagline} Built during the hackathon and used by a handful of real students during testing. The repository has setup instructions and a short architecture note.",
                'track' => null,
                'repo_url' => 'https://github.com/demo/'.Str::slug($title),
                'demo_url' => 'https://'.Str::slug($title).'.example.com',
                'video_url' => $index < 3 ? 'https://youtu.be/demo-'.Str::slug($title) : null,
                'tech_stack' => [['React', 'Node.js'], ['Next.js', 'Prisma'], ['Laravel', 'Vue'], ['Flutter', 'Firebase']][$index % 4],
                'status' => HackathonSubmission::STATUS_SUBMITTED,
                'submitted_at' => now()->subDays(14)->subHours(2 + $index * 3),
                'scores' => $named,
                'final_score' => $service->weightedScore($h, $named),
                'feedback' => $feedback,
                'scored_by' => $this->host?->id,
                'scored_at' => now()->subDays(12),
                'is_disqualified' => $disqualified,
                'disqualified_reason' => $disqualified ? 'Substantial uncredited copied code found during review.' : null,
            ]);
        }

        // A team that registered but never submitted — realistic, and exercises the "no project" path.
        $this->team($h, 'Team Procrastinators', [$this->cohort[6]]);

        $service->publish($h);

        // publish() stamps "now"; back-date it so the timeline reads true.
        $h->update(['results_published_at' => now()->subDays(11)]);

        $h->announcements()->create(['author_id' => $this->host?->id, 'title' => 'Results are out! 🏆', 'body' => 'Congratulations to StudySync, CampusBuzz and NotesNest. Every team will find their scores and feedback on their project.', 'created_at' => now()->subDays(11)]);
    }

    // ───────────────────────────── helpers ─────────────────────────────

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function upsert(string $slug, array $attributes): Hackathon
    {
        return Hackathon::updateOrCreate(
            ['slug' => $slug],
            $attributes + [
                'cover_image' => "/hackathons/{$slug}.svg",
                'status' => Hackathon::STATUS_PUBLISHED,
                'published_at' => now()->subDays(30),
                'created_by' => $this->host?->id,
            ]
        );
    }

    /**
     * @param  list<array{name: string, members: list<User>, project: ?array<string, mixed>}>  $teams
     */
    private function seedTeams(Hackathon $hackathon, array $teams): void
    {
        foreach ($teams as $definition) {
            $team = $this->team($hackathon, $definition['name'], $definition['members']);

            if ($definition['project'] === null) {
                continue;
            }

            $project = $definition['project'];
            $submitted = ($project['status'] ?? 'draft') === 'submitted';

            HackathonSubmission::create([
                'hackathon_id' => $hackathon->id,
                'hackathon_team_id' => $team->id,
                'submitted_by' => $definition['members'][0]->id,
                'title' => $project['title'],
                'tagline' => $project['tagline'],
                'description' => $project['description'],
                'track' => $project['track'],
                'repo_url' => $project['repo_url'],
                'demo_url' => $project['demo_url'],
                'video_url' => $project['video_url'],
                'tech_stack' => $project['tech_stack'],
                'status' => $submitted ? HackathonSubmission::STATUS_SUBMITTED : HackathonSubmission::STATUS_DRAFT,
                'submitted_at' => $submitted ? now()->subHours(random_int(2, 20)) : null,
            ]);
        }
    }

    /**
     * @param  list<User>  $members  the first is the leader
     */
    private function team(Hackathon $hackathon, string $name, array $members): HackathonTeam
    {
        $team = HackathonTeam::create([
            'hackathon_id' => $hackathon->id,
            'name' => $name,
            'invite_code' => HackathonTeam::generateInviteCode($hackathon->id),
            'leader_id' => $members[0]->id,
        ]);

        foreach ($members as $index => $member) {
            HackathonParticipant::create([
                'hackathon_id' => $hackathon->id,
                'user_id' => $member->id,
                'hackathon_team_id' => $team->id,
                'role' => $index === 0 ? HackathonParticipant::ROLE_LEADER : HackathonParticipant::ROLE_MEMBER,
                'registered_at' => $hackathon->registration_opens_at->copy()->addHours(3 + $index * 5 + $team->id % 7),
            ]);
        }

        return $team;
    }

    private function demoStudent(): User
    {
        $apex = $this->college();

        return User::firstOrCreate(
            ['email' => 'alex.chen@student.apex.edu'],
            [
                'name' => 'Alex Chen',
                'handle' => 'alex_coder',
                'password' => Hash::make('alex_coder_codeforge'),
                'role' => User::ROLE_USER,
                'college_id' => $apex->id,
            ]
        );
    }

    /** @return list<User> 24 demo students, so there is a crowd to fill the teams. */
    private function cohort(): array
    {
        $apex = $this->college();

        $names = [
            'Aarav Mehta', 'Diya Nair', 'Kabir Malhotra', 'Ishita Verma', 'Rohan Kulkarni', 'Sneha Reddy',
            'Arjun Patel', 'Meera Joshi', 'Vihaan Gupta', 'Tanvi Saxena', 'Rahul Deshmukh', 'Priyanka Das',
            'Karthik Menon', 'Aditi Rao', 'Siddharth Jain', 'Nisha Banerjee', 'Yash Agarwal', 'Pooja Hegde',
            'Aman Khan', 'Riya Kapoor', 'Dev Choudhary', 'Shruti Pillai', 'Manav Singhania', 'Zoya Ahmed',
        ];
        $branches = ['Computer Science', 'Information Technology', 'Electronics & Communication', 'Electrical Engineering'];

        return array_map(function (string $name, int $i) use ($apex, $branches) {
            $slug = Str::slug($name, '.');

            return User::firstOrCreate(
                ['email' => "{$slug}.arena@student.apex.edu"],
                [
                    'name' => $name,
                    'handle' => Str::slug($name, '_').'_'.($i + 1),
                    'password' => Hash::make(self::DEMO_PASSWORD),
                    'role' => User::ROLE_USER,
                    'college_id' => $apex->id,
                    'branch' => $branches[$i % count($branches)],
                ]
            );
        }, $names, array_keys($names));
    }

    private function college(): College
    {
        return College::firstOrCreate(
            ['short_code' => 'APEX'],
            [
                'name' => 'Apex Institute of Technology & Research',
                'city' => 'Bengaluru',
                'state' => 'Karnataka',
                'tier' => 'Academic Enterprise',
                'placement_rate' => 92.50,
            ]
        );
    }
}
