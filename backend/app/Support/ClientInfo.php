<?php

namespace App\Support;

/**
 * What a browser's User-Agent says about the device, kept deliberately coarse (desktop / mobile / tablet, a browser family, an OS
 * family): enough to tell "opened on a phone in the lab" from "opened on a laptop", and not a fingerprint.
 */
class ClientInfo
{
    /** @return array{device: string, browser: string, os: string} */
    public static function parse(?string $userAgent): array
    {
        $ua = (string) $userAgent;

        $device = match (true) {
            (bool) preg_match('/iPad|Tablet|Nexus 7|SM-T\d/i', $ua) => 'tablet',
            (bool) preg_match('/Mobi|iPhone|Android.+Mobile|Windows Phone/i', $ua) => 'mobile',
            default => 'desktop',
        };

        $browser = match (true) {
            (bool) preg_match('/Edg(e|A|iOS)?\//', $ua) => 'Edge',
            (bool) preg_match('/OPR\/|Opera/', $ua) => 'Opera',
            (bool) preg_match('/SamsungBrowser/', $ua) => 'Samsung Internet',
            (bool) preg_match('/Firefox|FxiOS/', $ua) => 'Firefox',
            (bool) preg_match('/Chrome|CriOS/', $ua) => 'Chrome',
            (bool) preg_match('/Safari/', $ua) => 'Safari',
            default => 'Other',
        };

        $os = match (true) {
            (bool) preg_match('/Windows/i', $ua) => 'Windows',
            (bool) preg_match('/Android/i', $ua) => 'Android',
            (bool) preg_match('/iPhone|iPad|iPod/i', $ua) => 'iOS',
            (bool) preg_match('/Mac OS X|Macintosh/i', $ua) => 'macOS',
            (bool) preg_match('/CrOS/', $ua) => 'ChromeOS',
            (bool) preg_match('/Linux/i', $ua) => 'Linux',
            default => 'Other',
        };

        return ['device' => $device, 'browser' => $browser, 'os' => $os];
    }
}
