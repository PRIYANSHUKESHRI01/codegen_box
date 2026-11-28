<?php

/*
|--------------------------------------------------------------------------
| Who AptRun is, as every outgoing e-mail and PDF says it.
|--------------------------------------------------------------------------
|
| One place for the lines that appear in the e-mail footer and on the PDF reports, so they stay identical to the landing page's
| footer (frontend/src/components/layout/Footer.tsx) and are changed once. AptRun is a product of Mellow Vault, a unit of
| Prayukti Development Private Limited; the legal line is shown exactly as registered.
|
*/

return [
    'name' => 'AptRun',
    'tagline' => 'Campus drives, a personal learning centre for every student, and a path to employers on Mellow Vault.',
    'parent' => 'Mellow Vault',
    'parent_url' => 'https://mellowvault.com',
    'legal_entity' => 'PRAYUKTI DEVELOPMENT PRIVATE LIMITED',
    'cin' => 'U62099UP2024PTC207212',
    'support_email' => env('BRAND_SUPPORT_EMAIL', 'support@mellowvault.com'),
    'support_phone' => '+91 93111 48660',
    'support_phone_href' => 'tel:+919311148660',
    'location' => 'Noida / New Delhi, India',

    // The public website every link and image in an e-mail points at. NOT app.frontend_url: that is wherever the app runs (localhost in
    // development), and an e-mail is opened on someone else's machine, where a localhost link or logo is broken.
    'site_url' => env('BRAND_SITE_URL', 'https://aptrun.com'),

    // The marketing team's shared inbox. Every "Talk to Our Team" enquiry is copied here as well as going to the employee it is assigned to,
    // so one that arrives while nobody can take it is still seen. Leave empty for no copy.
    'enquiry_email' => env('MARKETING_ENQUIRY_EMAIL'),

    'socials' => [
        ['label' => 'LinkedIn', 'url' => 'https://www.linkedin.com/company/mellow-vault/posts/'],
        ['label' => 'Instagram', 'url' => 'https://www.instagram.com/mellowvaultofficial/'],
        ['label' => 'YouTube', 'url' => 'https://www.youtube.com/@mellowvaultofficial'],
        ['label' => 'Facebook', 'url' => 'https://www.facebook.com/p/Mellow-Vault-61581114806433/'],
    ],

    // The four links under the e-mail footer's "why you are receiving this" line — the ones a reader of a transactional e-mail may need.
    'email_links' => [
        ['label' => 'Sign in', 'path' => '/login'],
        ['label' => 'Help & contact', 'path' => '/contact'],
        ['label' => 'Privacy Policy', 'path' => '/privacy'],
        ['label' => 'Terms of Service', 'path' => '/terms'],
    ],

    // Paths on the web app (FRONTEND_URL) linked from the e-mail footer's small print.
    'footer_links' => [
        ['label' => 'About', 'path' => '/about'],
        ['label' => 'Pricing', 'path' => '/pricing'],
        ['label' => 'Contact', 'path' => '/contact'],
        ['label' => 'Privacy', 'path' => '/privacy'],
        ['label' => 'Terms', 'path' => '/terms'],
    ],
];
