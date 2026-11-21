<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    /**
     * Handle an incoming request and attach production-grade security headers.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Strip server/framework signature headers if present
        if (function_exists('header_remove')) {
            header_remove('X-Powered-By');
        }

        // Prevent MIME type sniffing (stops browsers from interpreting files as a different MIME type)
        $response->headers->set('X-Content-Type-Options', 'nosniff');

        // Prevent Clickjacking / UI Redressing attacks
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');

        // Legacy browser XSS filter instruction
        $response->headers->set('X-XSS-Protection', '1; mode=block');

        // Control referrer information leakage
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Restrict sensitive hardware/APIs to self origin
        $response->headers->set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(), payment=(self)');

        // HSTS (HTTP Strict Transport Security): enforce HTTPS on production / secure connections
        if ($request->isSecure() || app()->environment('production')) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
        }

        return $response;
    }
}
