<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SoftSkillQuestion;
use App\Services\GeminiSoftSkillQuestionGeneratorService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

/**
 * The shared soft_skill_questions bank — mirrors
 * AdminInterviewQuestionBankController exactly (same filter/paginate shape,
 * same "no hard destroy, is_active toggle instead" posture). Reachable by
 * every authoring role (see routes/api.php — this same controller is
 * registered in the admin_internal/superadmin, admin_tpo and admin_company
 * route groups, same "one shared bank, three creator roles" model as
 * InterviewQuestionGenerationController).
 */
class AdminSoftSkillQuestionBankController extends Controller
{
    public function __construct(private readonly GeminiSoftSkillQuestionGeneratorService $generator) {}

    public function index(Request $request)
    {
        $query = SoftSkillQuestion::query();

        if ($search = $request->query('search')) {
            $query->where('question_text', 'like', "%{$search}%");
        }

        if ($category = $request->query('category')) {
            $query->where('category', $category);
        }

        if ($difficulty = $request->query('difficulty')) {
            $query->where('difficulty', $difficulty);
        }

        $questions = $query->orderByDesc('created_at')->paginate(50);

        return response()->json([
            'questions' => $questions,
            'counts' => collect(SoftSkillQuestion::CATEGORIES)
                ->mapWithKeys(fn (string $category) => [
                    $category => SoftSkillQuestion::where('category', $category)->where('is_active', true)->count(),
                ]),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'category' => ['required', Rule::in(SoftSkillQuestion::CATEGORIES)],
            'difficulty' => ['required', Rule::in(SoftSkillQuestion::DIFFICULTIES)],
            'question_text' => ['required', 'string'],
            'options' => ['required', 'array', 'size:4'],
            'options.*' => ['required', 'string'],
            'correct_index' => ['required', 'integer', 'min:0', 'max:3'],
            'explanation' => ['nullable', 'string'],
        ]);

        $question = SoftSkillQuestion::create([
            ...$validated,
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['question' => $question], 201);
    }

    /** No hard destroy() — a question already attached to a published assessment must never vanish from a candidate's history. Deactivate instead. */
    public function update(Request $request, SoftSkillQuestion $softSkillQuestion)
    {
        $validated = $request->validate([
            'category' => ['sometimes', Rule::in(SoftSkillQuestion::CATEGORIES)],
            'difficulty' => ['sometimes', Rule::in(SoftSkillQuestion::DIFFICULTIES)],
            'question_text' => ['sometimes', 'string'],
            'options' => ['sometimes', 'array', 'size:4'],
            'options.*' => ['string'],
            'correct_index' => ['sometimes', 'integer', 'min:0', 'max:3'],
            'explanation' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $softSkillQuestion->update($validated);

        return response()->json(['question' => $softSkillQuestion->fresh()]);
    }

    /** Generates and immediately persists real bank rows via Gemini — nothing ephemeral, same trust model as a question typed in by hand. */
    public function generate(Request $request)
    {
        $validated = $request->validate([
            'category' => ['required', Rule::in(SoftSkillQuestion::CATEGORIES)],
            'difficulty' => ['required', Rule::in(SoftSkillQuestion::DIFFICULTIES)],
            'count' => ['required', 'integer', 'min:1', 'max:15'],
        ]);

        try {
            $generated = $this->generator->generate($validated['category'], $validated['difficulty'], $validated['count']);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $questions = collect($generated)->map(fn (array $item) => SoftSkillQuestion::create([
            ...$item,
            'category' => $validated['category'],
            'difficulty' => $validated['difficulty'],
            'is_active' => true,
            'created_by' => $request->user()->id,
        ]));

        return response()->json(['questions' => $questions], 201);
    }
}
