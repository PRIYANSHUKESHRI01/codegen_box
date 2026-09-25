<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// This is a pure JSON API (the real frontend is the separate Next.js app) —
// there is no server-rendered login page. Named only so Laravel's default
// auth middleware has a valid route('login') to resolve to when an
// unauthenticated request doesn't explicitly ask for JSON (e.g. a bare curl
// call or a health-check probe with no Accept header). Without this, that
// redirect attempt itself throws RouteNotFoundException, turning what
// should be a clean 401 into an unhandled 500. The real frontend always
// sends Accept: application/json (see frontend/src/lib/api.ts) and never
// reaches this route in practice.
Route::get('/login', function () {
    return response()->json(['message' => 'Unauthenticated.'], 401);
})->name('login');
