<?php

namespace Database\Seeders;

use App\Models\MellowVaultStackMapping;
use App\Services\Vault\MellowVaultProfileSyncService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Seeds `mellow_vault_stack_mappings` from Mellow Vault's `higher_professional_tb`
 * catalog (`pro_id` 24–61) mapped to AptRun's live Vault AI Interview stacks,
 * and also pulls any extra live rows if `mellow_vault` DB is connected.
 */
class MellowVaultStackMappingSeeder extends Seeder
{
    /** @var array<int, array{0: string, 1: string, 2: string, 3: string}> */
    private const CANONICAL = [
        24 => ['Data Mining', 'data_mining', 'data_science', 'Data Mining'],
        25 => ['Quantum Computing', 'quantum_computing', 'emerging_tech', 'Quantum Computing'],
        26 => ['Deep Learning', 'deeplearning_pytorch', 'ai_ml', 'PyTorch & Deep Learning'],
        28 => ['AI and Robotics', 'robotics', 'ai_ml', 'AI & Robotics'],
        29 => ['Natural Language Processing (NLP)', 'nlp', 'ai_ml', 'Natural Language Processing (NLP / NLTK)'],
        30 => ['Embedded System', 'embedded_systems', 'embedded_systems', 'Embedded Systems'],
        31 => ['E-Commerce', 'ecommerce', 'fullstack', 'E-Commerce Development'],
        32 => ['Cyber Security', 'cyber_security', 'cyber_security', 'Cyber Security'],
        33 => ['Digital Marketing', 'digital_marketing', 'digital_marketing', 'Digital Marketing'],
        34 => ['Data Engineering', 'data_engineering', 'data_science', 'Data Engineering'],
        35 => ['Software Testing', 'software_testing', 'qa_testing', 'Software Testing (QA)'],
        36 => ['PHP Developer', 'php', 'backend', 'PHP'],
        37 => ['Cloud Computing', 'cloud_computing', 'devops', 'Cloud Computing (AWS / Azure / GCP)'],
        38 => ['Power BI', 'power_bi', 'data_analyst', 'Power BI'],
        39 => ['SEO Specialist', 'seo', 'digital_marketing', 'SEO'],
        40 => ['Docker', 'docker_k8s', 'devops', 'Docker & Kubernetes'],
        41 => ['Cryptography', 'cryptography', 'cyber_security', 'Cryptography'],
        42 => ['Angular Developer', 'angular', 'frontend', 'Angular'],
        43 => ['API', 'api_design', 'backend', 'API Development'],
        44 => ['AI/ML', 'machine_learning', 'ai_ml', 'Machine Learning (AI/ML, ML/DL)'],
        45 => ['ML/DL', 'machine_learning', 'ai_ml', 'Machine Learning (AI/ML, ML/DL)'],
        46 => ['MERN Developer', 'mern', 'fullstack', 'MERN Stack'],
        47 => ['Data Science', 'data_science', 'data_science', 'Data Science'],
        48 => ['BlockChain', 'blockchain', 'emerging_tech', 'Blockchain'],
        49 => ['C++  Developer', 'cpp', 'embedded_systems', 'C++'],
        50 => ['Python Developer', 'python', 'backend', 'Python (FastAPI / Django)'],
        51 => ['UI/UX Design', 'ui_ux', 'frontend', 'UI/UX Design'],
        52 => ['SQL Developer', 'sql', 'data_analyst', 'SQL'],
        53 => ['NLT(Natural Language Toolkit)', 'nlp', 'ai_ml', 'Natural Language Processing (NLP / NLTK)'],
        54 => ['CMS Developer', 'cms', 'backend', 'CMS Development (WordPress)'],
        55 => ['Data Analytics', 'data_analytics', 'data_analyst', 'Data Analytics'],
        56 => ['Ethical Hacking', 'ethical_hacking', 'cyber_security', 'Ethical Hacking'],
        58 => ['Cloud Infrastructure', 'cloud_infrastructure', 'devops', 'Cloud Infrastructure & IaC'],
        59 => ['Games Developer', 'game_development', 'game_dev', 'Game Development'],
        60 => ['Web Developer', 'web_fundamentals', 'frontend', 'Web Development (HTML, CSS, JavaScript)'],
        61 => ['Laravel Developer', 'laravel', 'backend', 'Laravel (PHP)'],
    ];

    public function run(): void
    {
        foreach (self::CANONICAL as $proId => [$heading, $stackKey, $roleKey, $displayName]) {
            MellowVaultStackMapping::updateOrCreate(
                ['pro_id' => $proId],
                [
                    'higher_professional_heading' => $heading,
                    'aptrun_stack_key' => $stackKey,
                    'aptrun_role_key' => $roleKey,
                    'display_name' => $displayName,
                    'is_active' => true,
                ]
            );
        }

        // Also sync any extra entries added directly inside Mellow Vault's higher_professional_tb
        $connName = (string) config('vault.database.connection', 'mellow_vault');
        if (blank(config("database.connections.{$connName}.database"))) {
            return;
        }

        try {
            $syncService = app(MellowVaultProfileSyncService::class);
            $rows = DB::connection($connName)
                ->table('higher_professional_tb')
                ->select('id', 'heading')
                ->orderBy('id')
                ->get();

            foreach ($rows as $row) {
                $id = (int) $row->id;
                $heading = trim((string) ($row->heading ?? ''));
                if ($id <= 0 || $heading === '' || isset(self::CANONICAL[$id])) {
                    continue;
                }

                $resolved = $syncService->matchHeadingToCatalog($heading);

                MellowVaultStackMapping::updateOrCreate(
                    ['pro_id' => $id],
                    [
                        'higher_professional_heading' => $heading,
                        'aptrun_stack_key' => $resolved['stack_key'],
                        'aptrun_role_key' => $resolved['role_key'],
                        'display_name' => $resolved['stack_name'] ?? $heading,
                        'is_active' => true,
                    ]
                );
            }
        } catch (\Throwable) {
            // Skip live external lookup if mellow_vault database is temporarily unreachable.
        }
    }
}
