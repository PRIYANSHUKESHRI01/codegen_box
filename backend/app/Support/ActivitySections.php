<?php

namespace App\Support;

use Illuminate\Support\Str;

/**
 * Turns a page address into the name people know the screen by ("/dashboard/core/practice" -> "Core Prep · Practice"), so Live Activity
 * reads in the product's own words. One table, longest address first: a new page that is not listed still gets a readable name made
 * from its address, so nothing is ever recorded as a bare path.
 */
class ActivitySections
{
    /** @var array<string, string> address (a prefix) => name */
    private const MAP = [
        // Student
        '/dashboard/practice' => 'Practice Arena',
        '/dashboard/core/practice' => 'Core Prep · Practice',
        '/dashboard/core/tests' => 'Core Prep · Tests',
        '/dashboard/core/session' => 'Core Prep · Taking a test',
        '/dashboard/core/result' => 'Core Prep · Test result',
        '/dashboard/core' => 'Core Prep',
        '/dashboard/drills/session' => 'Skill Drills · Sitting',
        '/dashboard/drills' => 'Skill Drills',
        '/dashboard/learning-centre/listening' => 'Learning Centre · Listening',
        '/dashboard/learning-centre/speaking' => 'Learning Centre · Speaking',
        '/dashboard/learning-centre/vocabulary' => 'Learning Centre · Vocabulary',
        '/dashboard/learning-centre' => 'Learning Centre',
        '/dashboard/soft-skills/session' => 'Soft Skills · Taking a test',
        '/dashboard/soft-skills' => 'Soft Skills',
        '/dashboard/projects/workspace' => 'Project Lab · Workspace',
        '/dashboard/projects' => 'Project Lab',
        '/dashboard/reports' => 'Performance Report',
        '/dashboard/drives' => 'Upcoming Drives',
        '/dashboard/company-prep' => 'Company PYQs',
        '/dashboard/interviews/practice' => 'Mock AI Interview · Practice',
        '/dashboard/interviews/session' => 'Mock AI Interview · Live',
        '/dashboard/interviews' => 'Mock AI Interview',
        '/dashboard/interview-tracks' => 'Interview Tracks',
        '/dashboard/vault-interviews/session' => 'Vault AI Interview · Live',
        '/dashboard/vault-interviews' => 'Vault AI Interview',
        '/dashboard/vault' => 'Mellow Vault',
        '/dashboard/talent-pool' => 'Talent Pool',
        '/dashboard/contests/problem' => 'Contests · Solving a problem',
        '/dashboard/contests' => 'Contests',
        '/dashboard/leaderboard' => 'Leaderboard',
        '/dashboard/billing' => 'Plans & Billing',
        '/dashboard/merchant-navy' => 'Merchant Navy',
        '/dashboard/articles' => 'Articles',
        '/dashboard' => 'Student Overview',
        '/arena' => 'Hack Arena',
        // TPO / Mellow Ops / hiring partner
        '/admin/analytics' => 'Analytics',
        '/admin/students' => 'Students',
        '/admin/drives' => 'Drives',
        '/admin/placements' => 'Placements',
        '/admin/contests' => 'Contests (manage)',
        '/admin/mock-contests' => 'Mock Contests',
        '/admin/mock-core-tests' => 'Core Tests',
        '/admin/mock-interviews/results' => 'Mock Interviews · Results',
        '/admin/mock-interviews' => 'Mock Interviews',
        '/admin/mock-soft-skills' => 'Soft Skills Tests',
        '/admin/reports/archive' => 'Report Archive',
        '/admin/reports' => 'Reports',
        '/admin/coordinators' => 'Section Coordinators',
        '/admin/vault' => 'Vault',
        '/admin/talent-pool' => 'Talent Pool (manage)',
        '/admin/proctoring' => 'Proctoring',
        '/admin/interviews' => 'Interviews (manage)',
        '/admin/core-prep' => 'Core Prep (manage)',
        '/admin/soft-skills' => 'Soft Skills (manage)',
        '/admin/hackathons' => 'Hackathons',
        '/admin/projects' => 'Projects (manage)',
        '/admin/customers' => 'Customers',
        '/admin/articles' => 'Articles (manage)',
        '/admin/company' => 'Hiring Partner',
        '/admin' => 'Command Center',
        // Coordinator, marketing, staff
        '/coordinator/reports' => 'Coordinator · Reports',
        '/coordinator/proctoring' => 'Coordinator · Proctoring',
        '/coordinator' => 'Coordinator Dashboard',
        '/marketing/inquiries' => 'Marketing · Inquiries',
        '/marketing' => 'Marketing',
        '/mellow-internal' => 'Mellow Ops',
        // Everyone
        '/settings' => 'Settings',
        '/notifications' => 'Notifications',
    ];

    /** @var list<string>|null addresses, longest first */
    private static ?array $ordered = null;

    /** A path as it is stored: trailing slash removed, "/" for the empty one. */
    public static function normalize(string $path): string
    {
        $path = '/'.ltrim(trim($path), '/');

        return strlen($path) > 1 ? rtrim($path, '/') : $path;
    }

    /** The screen's name. `$tab` is the page's own ?tab= / ?section=, which TPO and superadmin pages use to hold whole sections. */
    public static function label(string $path, ?string $tab = null): string
    {
        $path = self::normalize($path);
        self::$ordered ??= collect(array_keys(self::MAP))->sortByDesc(fn (string $p) => strlen($p))->values()->all();

        $name = null;
        foreach (self::$ordered as $prefix) {
            if ($path === $prefix || str_starts_with($path, $prefix.'/')) {
                $name = self::MAP[$prefix];
                break;
            }
        }

        $name ??= $path === '/' ? 'Home' : Str::of(basename($path))->replace(['-', '_'], ' ')->title()->toString();

        if ($tab !== null && $tab !== '') {
            $name .= ' › '.Str::of($tab)->replace(['-', '_'], ' ')->title();
        }

        return Str::limit($name, 78, '');
    }

    /** Which part of the product an address is in: student, TPO, coordinator, marketing, Mellow staff or shared. */
    public static function area(string $path): string
    {
        $path = self::normalize($path);

        return match (true) {
            str_starts_with($path, '/dashboard'), str_starts_with($path, '/arena') => 'student',
            str_starts_with($path, '/admin/company') => 'company',
            str_starts_with($path, '/admin') => 'tpo',
            str_starts_with($path, '/coordinator') => 'coordinator',
            str_starts_with($path, '/marketing') => 'marketing',
            str_starts_with($path, '/mellow-internal') => 'staff',
            default => 'shared',
        };
    }
}
