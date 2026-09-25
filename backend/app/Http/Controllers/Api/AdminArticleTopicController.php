<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ArticleTopic;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Mellow-internal-staff-only (role: admin_internal, superadmin; permission:
 * articles) — topics are the reading-path groupings articles live in (e.g.
 * "DSA", "Go Programming"). See ArticleTopic's docblock.
 */
class AdminArticleTopicController extends Controller
{
    public function index()
    {
        return response()->json([
            'topics' => ArticleTopic::withCount('articles')->orderBy('display_order')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'icon' => ['nullable', Rule::in(ArticleTopic::ICONS)],
            'color' => ['nullable', Rule::in(ArticleTopic::COLORS)],
            'display_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $topic = ArticleTopic::create([
            'name' => $validated['name'],
            'slug' => ArticleTopic::uniqueSlug($validated['name']),
            'description' => $validated['description'] ?? null,
            'icon' => $validated['icon'] ?? null,
            'color' => $validated['color'] ?? null,
            'display_order' => $validated['display_order'] ?? 0,
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['topic' => $topic], 201);
    }

    public function update(Request $request, ArticleTopic $articleTopic)
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'icon' => ['nullable', Rule::in(ArticleTopic::ICONS)],
            'color' => ['nullable', Rule::in(ArticleTopic::COLORS)],
            'display_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $articleTopic->update($validated);

        return response()->json(['topic' => $articleTopic->fresh()]);
    }

    public function destroy(ArticleTopic $articleTopic)
    {
        if ($articleTopic->articles()->exists()) {
            return response()->json([
                'message' => 'This topic still has articles in it. Delete or move them first.',
            ], 422);
        }

        $articleTopic->delete();

        return response()->json(['message' => 'Topic deleted.']);
    }
}
