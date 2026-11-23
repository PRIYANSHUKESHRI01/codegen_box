<?php

namespace Database\Seeders;

use App\Models\AptBotFaq;
use Illuminate\Database\Seeder;

class AptBotFaqSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $faqs = [
            // ── 1. ABOUT APTRUN ──────────────────────────────────────────────
            [
                'category' => 'about_aptrun',
                'category_label' => 'About AptRun',
                'category_icon' => 'Brain',
                'question' => 'What is AptRun and how does it help me get placed?',
                'slug' => 'what-is-aptrun',
                'answer' => "AptRun is India's leading campus placement and engineering readiness sandbox. It brings together everything you need to crack tier-1 tech placements:

• **Practice Arena**: Hundreds of handpicked DSA coding problems organized by core pattern and company tags.
• **Learning Centre & Articles**: In-depth theoretical articles and system design patterns from first principles.
• **Mock AI Interviews**: Interactive voice interviews with real-time speech transcription and industry rubric feedback.
• **Vault AI Interview**: High-stakes AI interview simulation that unlocks candidate verification for hiring partners.
• **Performance Report**: Real-time evaluation of your coding speed, accuracy, and interview communication.",
                'action_label' => 'Explore Practice Arena',
                'action_url' => '/dashboard/practice',
                'related_slugs' => ['what-is-readiness-score', 'what-is-project-lab'],
                'display_order' => 1,
            ],
            [
                'category' => 'about_aptrun',
                'category_label' => 'About AptRun',
                'category_icon' => 'Brain',
                'question' => 'What is the AptRun Readiness Score?',
                'slug' => 'what-is-readiness-score',
                'answer' => "The **Readiness Score (0–100%)** is your comprehensive hiring readiness benchmark evaluated across 4 core vectors:

1. **Problem Solving (DSA)**: Algorithmic correctness, time/space complexity, and consistency.
2. **Technical Breadth**: Core CS fundamentals, operating systems, DBMS, and system design.
3. **Soft Skills & Aptitude**: Speed and accuracy in quantitative, logical, and situational questions.
4. **Interview Articulation**: Voice-clarity, structure, and technical depth in AI interviews.

A Readiness Score of **60% or above** unlocks direct recruiter recommendations on Mellow Vault.",
                'action_label' => 'View Performance Report',
                'action_url' => '/dashboard/reports',
                'related_slugs' => ['what-is-aptrun', 'vault-ai-60-percent-qualification'],
                'display_order' => 2,
            ],
            [
                'category' => 'about_aptrun',
                'category_label' => 'About AptRun',
                'category_icon' => 'Brain',
                'question' => 'What is Project Lab and how does it work?',
                'slug' => 'what-is-project-lab',
                'answer' => "Project Lab gives you end-to-end, production-grade software development projects designed to make your resume stand out to technical interviewers.

Each project includes:
• Architectural blueprints and database schema designs.
• Milestone-by-milestone guided tasks with live code editors.
• System design explanations and real-world deployment considerations.",
                'action_label' => 'Open Project Lab',
                'action_url' => '/dashboard/projects',
                'related_slugs' => ['what-is-aptrun'],
                'display_order' => 3,
            ],

            // ── 2. VAULT AI INTERVIEW ────────────────────────────────────────
            [
                'category' => 'vault_ai',
                'category_label' => 'Vault AI Interview',
                'category_icon' => 'ShieldCheck',
                'question' => 'What is the Vault AI Interview?',
                'slug' => 'what-is-vault-ai-interview',
                'answer' => "The **Vault AI Interview** is AptRun's flagship candidate qualification interview. Unlike practice mock rounds, Vault AI tests simulate live high-stakes company hiring interviews:

• **Structure**: Series containing 3 progressive sets testing technical fundamentals, architecture, and live problem solving.
• **Proctoring**: Fullscreen locking, webcam/mic verification, and tab-switch monitoring to guarantee honest performance.
• **Evaluation**: Multidimensional AI scoring analyzing technical accuracy, response depth, and communication delivery.",
                'action_label' => 'Go to Vault AI Interview',
                'action_url' => '/dashboard/vault-interviews',
                'related_slugs' => ['vault-ai-60-percent-qualification', 'vault-ai-retakes'],
                'display_order' => 10,
            ],
            [
                'category' => 'vault_ai',
                'category_label' => 'Vault AI Interview',
                'category_icon' => 'ShieldCheck',
                'question' => 'Why is 60%+ the qualification score in Vault AI Interview?',
                'slug' => 'vault-ai-60-percent-qualification',
                'answer' => "Scoring **60% or higher** in the Vault AI Interview is the benchmark required by our corporate hiring partners on Mellow Vault:

• **Verified for Hiring Badge**: Reaching 60%+ unlocks the verified badge on your profile.
• **Recruiter Visibility**: Verified profiles are directly indexed for top tech employers and recruiting teams seeking pre-vetted engineers.
• **Fast-Tracked Shortlisting**: Companies skip preliminary screening rounds and invite verified candidates directly to final technical/HR rounds.",
                'action_label' => 'Start Vault AI Interview',
                'action_url' => '/dashboard/vault-interviews',
                'related_slugs' => ['direct-candidates-mellow-vault', 'vault-ai-retakes'],
                'display_order' => 11,
            ],
            [
                'category' => 'vault_ai',
                'category_label' => 'Vault AI Interview',
                'category_icon' => 'ShieldCheck',
                'question' => 'Can I retake the Vault AI Interview if I scored below 60%?',
                'slug' => 'vault-ai-retakes',
                'answer' => "Yes! If you scored below 60%, you can review your AI feedback rubric, practice weak topics in the Mock AI Interview or Practice Arena, and reattempt:

• Your highest achieved score is preserved on your profile.
• We recommend practicing in Mock AI Interview before re-attempting your next Vault set.",
                'action_label' => 'Practice Mock Interviews',
                'action_url' => '/dashboard/interviews',
                'related_slugs' => ['what-is-vault-ai-interview', 'vault-ai-60-percent-qualification'],
                'display_order' => 12,
            ],

            // ── 3. PLACEMENT DRIVES & MELLOW VAULT ────────────────────────────
            [
                'category' => 'placement_drives',
                'category_label' => 'Placement Drives & Mellow Vault',
                'category_icon' => 'Briefcase',
                'question' => 'Why do direct AptRun candidates not see campus drives on Upcoming Drives?',
                'slug' => 'direct-candidates-campus-drives-explained',
                'answer' => "Campus placement drives on the **Upcoming Drives** page are exclusive drives opened directly by partner college placement cells (TPOs) for their enrolled students.

If you are an independent/direct AptRun member:
• You get hired off-campus through **Mellow Vault**!
• Complete the **Vault AI Interview** with **60%+** to be verified for hiring.
• Once verified, our network of hiring partners accesses your profile directly on Mellow Vault.",
                'action_label' => 'Learn About Mellow Vault',
                'action_url' => '/dashboard/vault',
                'related_slugs' => ['direct-candidates-mellow-vault', 'future-hiring-on-aptrun'],
                'display_order' => 20,
            ],
            [
                'category' => 'placement_drives',
                'category_label' => 'Placement Drives & Mellow Vault',
                'category_icon' => 'Briefcase',
                'question' => 'How do independent users get hired through Mellow Vault?',
                'slug' => 'direct-candidates-mellow-vault',
                'answer' => "Mellow Vault is the off-campus hiring partner network for AptRun members:

1. **Profile Setup**: Your AptRun profile connects directly to Mellow Vault.
2. **Verification Milestone**: Score **60% or higher** in the **Vault AI Interview**.
3. **Employer Outreach**: Hiring partners browse verified profiles, review interview scores, and extend interview invites directly.",
                'action_label' => 'Open Mellow Vault',
                'action_url' => '/dashboard/vault',
                'related_slugs' => ['vault-ai-60-percent-qualification', 'future-hiring-on-aptrun'],
                'display_order' => 21,
            ],
            [
                'category' => 'placement_drives',
                'category_label' => 'Placement Drives & Mellow Vault',
                'category_icon' => 'Briefcase',
                'question' => 'Will hiring partners also recruit directly on AptRun in the future?',
                'slug' => 'future-hiring-on-aptrun',
                'answer' => "Yes! In the near future, hiring partners and tech recruiters will also host recruitment drives and hackathons directly on AptRun!

To make sure you are prioritized when direct AptRun drives open:
• Keep solving daily DSA problems in the Practice Arena.
• Achieve 60%+ in Vault AI Interview sets.
• Keep your Readiness Score above 70%.",
                'action_label' => 'Practice on AptRun',
                'action_url' => '/dashboard/practice',
                'related_slugs' => ['direct-candidates-mellow-vault', 'what-is-readiness-score'],
                'display_order' => 22,
            ],

            // ── 4. MOCK AI VOICE INTERVIEWS ──────────────────────────────────
            [
                'category' => 'mock_interviews',
                'category_label' => 'Mock AI Voice Interviews',
                'category_icon' => 'Mic',
                'question' => 'How do Mock AI Voice Interviews work?',
                'slug' => 'how-mock-interviews-work',
                'answer' => "Mock AI Interviews replicate real technical screening and HR rounds using conversational AI:

• Choose your domain (Backend, Frontend, Full Stack, Data Science, etc.) and tech stack (Laravel, React, Node.js, Python, Java, etc.).
• The AI interviewer speaks questions aloud.
• Speak your answer naturally into your microphone — speech recognition transcribes your words in real time.
• Upon completion, you receive an immediate breakdown of concept accuracy, technical keywords, and clarity.",
                'action_label' => 'Start a Mock Interview',
                'action_url' => '/dashboard/interviews',
                'related_slugs' => ['mock-interview-supported-stacks', 'mic-troubleshooting'],
                'display_order' => 30,
            ],
            [
                'category' => 'mock_interviews',
                'category_label' => 'Mock AI Voice Interviews',
                'category_icon' => 'Mic',
                'question' => 'What domains and tech stacks can I practice?',
                'slug' => 'mock-interview-supported-stacks',
                'answer' => "AptRun supports 25+ industry tech stacks across all primary engineering disciplines:

• **Full Stack & Backend**: Laravel, Node.js/Express, Python/Django, Java Spring Boot, Go, .NET, Ruby on Rails.
• **Frontend**: React, Next.js, Vue.js, Angular, TypeScript.
• **Data & AI**: Python Data Science, Machine Learning, SQL, Big Data.
• **Mobile & Systems**: Flutter, Android Kotlin, iOS Swift, C++, DevOps & Cloud.",
                'action_label' => 'Explore Interview Tracks',
                'action_url' => '/dashboard/interviews/practice',
                'related_slugs' => ['how-mock-interviews-work'],
                'display_order' => 31,
            ],

            // ── 5. SOFT SKILLS & APTITUDE ────────────────────────────────────
            [
                'category' => 'soft_skills',
                'category_label' => 'Soft Skills & Tests',
                'category_icon' => 'CheckCircle2',
                'question' => 'How are Soft Skills tests structured on AptRun?',
                'slug' => 'how-soft-skills-tests-work',
                'answer' => "AptRun provides 45 comprehensive test sets mimicking campus aptitude assessments:

• **4 Key Categories**: Quantitative Aptitude, Logical Reasoning, Verbal English, and Situational Judgement.
• **Zero Negative Marking**: All multiple-choice questions have equal weight.
• **Real-Time Autosave**: Your selections are immediately saved to the server as you click options.
• **Fullscreen & Anti-Copy**: Continuous fullscreen and anti-cheating protection are active throughout the test.",
                'action_label' => 'Take a Soft Skills Test',
                'action_url' => '/dashboard/soft-skills',
                'related_slugs' => ['fullscreen-strikes-explained'],
                'display_order' => 40,
            ],

            // ── 6. ERRORS & TROUBLESHOOTING ──────────────────────────────────
            [
                'category' => 'troubleshooting',
                'category_label' => 'Errors & Troubleshooting',
                'category_icon' => 'AlertTriangle',
                'question' => 'I got a strike warning for exiting fullscreen. How does this work?',
                'slug' => 'fullscreen-strikes-explained',
                'answer' => "Proctored assessments (Contests, Vault AI, Soft Skills) require continuous fullscreen mode:

• Pressing Esc, switching browser tabs, or opening external apps triggers a **Strike Warning**.
• You receive **2 warnings**. A **3rd strike** terminates and auto-submits your attempt.
• If you accidentally exited fullscreen, click the **'Resume Fullscreen'** button immediately to return to the exam without further penalty.",
                'action_label' => 'Read Proctoring Guidelines',
                'action_url' => '/dashboard/soft-skills',
                'related_slugs' => ['mic-troubleshooting', 'camera-troubleshooting'],
                'display_order' => 50,
            ],
            [
                'category' => 'troubleshooting',
                'category_label' => 'Errors & Troubleshooting',
                'category_icon' => 'AlertTriangle',
                'question' => 'Microphone or webcam not working in interview.',
                'slug' => 'mic-troubleshooting',
                'answer' => "If your microphone or camera is not detected:

1. **Browser Permission**: Click the **Lock icon** on the left of your browser address bar and verify that Camera and Microphone permissions are set to **Allow**.
2. **Hardware Check**: Ensure your headset/mic is firmly plugged in and not muted via physical switch.
3. **App Conflict**: Close other apps that might be using the camera (Zoom, Google Meet, Teams, Discord).
4. **Refresh**: Reload the page to initialize the device test preview.",
                'action_label' => 'Test in Mock Interview',
                'action_url' => '/dashboard/interviews',
                'related_slugs' => ['camera-troubleshooting'],
                'display_order' => 51,
            ],
            [
                'category' => 'troubleshooting',
                'category_label' => 'Errors & Troubleshooting',
                'category_icon' => 'AlertTriangle',
                'question' => 'My test timer ran out before I clicked submit.',
                'slug' => 'test-timer-expired',
                'answer' => "Don't panic! AptRun's server continuously auto-saves every answer you select.

If your timer reaches 0:00:
• The system automatically submits all saved responses to the scoring engine.
• No answers are lost, and your score will be generated accurately based on what was saved.",
                'action_label' => 'Check Your Results',
                'action_url' => '/dashboard/soft-skills',
                'related_slugs' => ['fullscreen-strikes-explained'],
                'display_order' => 52,
            ],

            // ── 7. BILLING, PLANS & ACCOUNTS ─────────────────────────────────
            [
                'category' => 'billing',
                'category_label' => 'Plans & Account Settings',
                'category_icon' => 'CreditCard',
                'question' => 'What is included in the AptRun Expert Plan?',
                'slug' => 'expert-plan-features',
                'answer' => "The **AptRun Expert Plan** unlocks the complete career launchpad:

• Unlimited DSA problem submissions in Practice Arena.
• Full access to Project Lab and guided production projects.
• Unlimited Mock AI Voice Interviews across all 25+ stacks.
• Vault AI Interview eligibility and Mellow Vault candidate verification.
• Comprehensive performance analytics and percentile benchmarking.",
                'action_label' => 'View Subscription Plans',
                'action_url' => '/dashboard/billing',
                'related_slugs' => ['what-is-aptrun', 'direct-candidates-mellow-vault'],
                'display_order' => 60,
            ],
            [
                'category' => 'billing',
                'category_label' => 'Plans & Account Settings',
                'category_icon' => 'CreditCard',
                'question' => 'How do I update my profile, roll number, or graduation year?',
                'slug' => 'update-profile-settings',
                'answer' => "You can update your personal information, department, roll number, and graduation year directly under your profile settings:

• Go to **Dashboard > Settings** (or click your avatar at the bottom of the sidebar).
• Update your academic year, graduation year (from 2018 onwards), and department.
• Save changes to ensure placement eligibility criteria reflect your accurate profile.",
                'action_label' => 'Go to Settings',
                'action_url' => '/dashboard/settings',
                'related_slugs' => ['expert-plan-features'],
                'display_order' => 61,
            ],
        ];

        foreach ($faqs as $faq) {
            AptBotFaq::updateOrCreate(
                ['slug' => $faq['slug']],
                $faq
            );
        }
    }
}
