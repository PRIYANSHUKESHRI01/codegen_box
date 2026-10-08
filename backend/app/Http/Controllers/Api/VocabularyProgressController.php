<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VocabularyWordProgress;
use App\Services\VocabularyProgressService;
use App\Support\VocabularyDecks;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Read-only views over a student's vocabulary standing: the Vocabulary Sprint
 * home (totals, today's goal, next sprint, decks) and the Word Bank. The write
 * path is VocabularyController. See VocabularyProgressService.
 */
class VocabularyProgressController extends Controller
{
    public function __construct(private readonly VocabularyProgressService $progress) {}

    public function overview(Request $request)
    {
        return response()->json($this->progress->overview($request->user()));
    }

    public function words(Request $request)
    {
        $validated = $request->validate([
            'status' => ['nullable', Rule::in([
                'all', 'weak',
                VocabularyWordProgress::STATUS_NEW,
                VocabularyWordProgress::STATUS_LEARNING,
                VocabularyWordProgress::STATUS_FAMILIAR,
                VocabularyWordProgress::STATUS_MASTERED,
            ])],
            'deck' => ['nullable', 'string', Rule::in(array_merge(VocabularyDecks::slugs(), ['mine']))],
            'q' => ['nullable', 'string', 'max:60'],
            'page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        return response()->json($this->progress->words($request->user(), $validated));
    }
}
