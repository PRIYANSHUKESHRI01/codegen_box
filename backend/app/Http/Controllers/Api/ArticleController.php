<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Models\ArticleRead;
use App\Models\ArticleTopic;
use Illuminate\Http\Request;

/**
 * Student-facing (role: user) — read-only access to whatever Mellow Ops has
 * published (see AdminArticleController/AdminArticleTopicController). No
 * scoring, no eligibility gate — every student on the platform sees the
 * same published catalog, unlike Contest/Interview's college/company tiers.
 */
class ArticleController extends Controller
{
    /** Every topic with at least one published article, plus this student's read progress in each. */
    public function topics(Request $request)
    {
        $userId = $request->user()->id;

        $topics = ArticleTopic::withCount(['articles' => fn ($q) => $q->where('status', Article::STATUS_PUBLISHED)])
            ->having('articles_count', '>', 0)
            ->orderBy('display_order')
            ->get();

        return response()->json([
            'topics' => $topics->map(function (ArticleTopic $topic) use ($userId) {
                $readCount = ArticleRead::where('user_id', $userId)
                    ->whereIn('article_id', $topic->articles()->where('status', Article::STATUS_PUBLISHED)->pluck('id'))
                    ->count();

                $totalMinutes = $topic->articles()->where('status', Article::STATUS_PUBLISHED)->sum('reading_time_minutes');

                return [
                    ...$topic->toArray(),
                    'published_articles_count' => $topic->articles_count,
                    'read_count' => $readCount,
                    'total_reading_minutes' => (int) $totalMinutes,
                ];
            }),
        ]);
    }

    /** One topic's published articles, in reading order, each flagged with whether this student has read it. */
    public function topicShow(Request $request, ArticleTopic $articleTopic)
    {
        $userId = $request->user()->id;

        $articles = $articleTopic->articles()
            ->where('status', Article::STATUS_PUBLISHED)
            ->get(['id', 'title', 'slug', 'excerpt', 'icon', 'display_order', 'reading_time_minutes', 'view_count']);

        $readIds = ArticleRead::where('user_id', $userId)
            ->whereIn('article_id', $articles->pluck('id'))
            ->pluck('article_id')
            ->all();

        return response()->json([
            'topic' => $articleTopic,
            'articles' => $articles->map(fn (Article $a) => [
                ...$a->toArray(),
                'is_read' => in_array($a->id, $readIds, true),
            ]),
        ]);
    }

    /** Full article content plus adjacency for the reader's Prev/Next navigation. */
    public function show(Request $request, Article $article)
    {
        abort_unless($article->isPublished(), 404);

        $article->increment('view_count');

        $userId = $request->user()->id;
        $isRead = ArticleRead::where('article_id', $article->id)->where('user_id', $userId)->exists();

        $adjacent = fn (?Article $a) => $a ? ['title' => $a->title, 'slug' => $a->slug, 'icon' => $a->icon] : null;

        return response()->json([
            'article' => [
                ...$article->fresh()->load('articleTopic:id,name,slug,color,icon', 'createdBy:id,name')->toArray(),
                'is_read' => $isRead,
            ],
            'previous' => $adjacent($article->previousInTopic()),
            'next' => $adjacent($article->nextInTopic()),
        ]);
    }

    public function markRead(Request $request, Article $article)
    {
        abort_unless($article->isPublished(), 404);

        ArticleRead::firstOrCreate(
            ['article_id' => $article->id, 'user_id' => $request->user()->id],
            ['read_at' => now()]
        );

        return response()->json(['message' => 'Marked as read.']);
    }
}
