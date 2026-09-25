<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Models\ArticleTopic;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Mellow-internal-staff-only (role: admin_internal, superadmin; permission:
 * articles) — authoring surface for the Articles knowledge base. See
 * Article's docblock: markdown-authored, human-written, no auto-scoring or
 * generation involved.
 */
class AdminArticleController extends Controller
{
    /** List view intentionally omits `content` — the full markdown body isn't needed until an author actually opens one to edit. */
    public function index(Request $request)
    {
        $query = Article::query()->with('articleTopic:id,name,slug,color')->orderByDesc('created_at');

        if ($request->filled('topic')) {
            $query->whereHas('articleTopic', fn ($q) => $q->where('slug', $request->query('topic')));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        return response()->json([
            'articles' => $query->get()->makeHidden('content'),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validated($request);

        $article = Article::create([
            'article_topic_id' => $validated['article_topic_id'],
            'title' => $validated['title'],
            'slug' => Article::uniqueSlug($validated['title']),
            'excerpt' => $validated['excerpt'],
            'content' => $validated['content'],
            'icon' => $validated['icon'] ?? null,
            'status' => $validated['status'],
            'display_order' => $validated['display_order'] ?? 0,
            'reading_time_minutes' => Article::estimateReadingTimeMinutes($validated['content']),
            'created_by' => $request->user()->id,
            'published_at' => $validated['status'] === Article::STATUS_PUBLISHED ? now() : null,
        ]);

        return response()->json(['article' => $article->load('articleTopic:id,name,slug,color')], 201);
    }

    public function show(Article $article)
    {
        return response()->json(['article' => $article->load('articleTopic:id,name,slug,color')]);
    }

    public function update(Request $request, Article $article)
    {
        $validated = $this->validated($request, $article);

        $wasPublished = $article->isPublished();
        $willBePublished = ($validated['status'] ?? $article->status) === Article::STATUS_PUBLISHED;

        if (array_key_exists('content', $validated)) {
            $validated['reading_time_minutes'] = Article::estimateReadingTimeMinutes($validated['content']);
        }

        if (! $wasPublished && $willBePublished) {
            $validated['published_at'] = now();
        } elseif ($wasPublished && ! $willBePublished) {
            $validated['published_at'] = null;
        }

        $article->update($validated);

        return response()->json(['article' => $article->fresh()->load('articleTopic:id,name,slug,color')]);
    }

    public function destroy(Article $article)
    {
        $article->delete();

        return response()->json(['message' => 'Article deleted.']);
    }

    private function validated(Request $request, ?Article $article = null): array
    {
        $isUpdate = $article !== null;
        $required = $isUpdate ? 'sometimes' : 'required';

        return $request->validate([
            'article_topic_id' => [$required, 'integer', 'exists:article_topics,id'],
            'title' => [$required, 'string', 'max:255'],
            'excerpt' => [$required, 'string', 'max:500'],
            'content' => [$required, 'string', 'min:100'],
            'icon' => ['nullable', Rule::in(ArticleTopic::ICONS)],
            'status' => [$required, Rule::in(Article::STATUSES)],
            'display_order' => ['nullable', 'integer', 'min:0'],
        ]);
    }
}
