<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InterviewQuestionBank;
use Illuminate\Http\Request;

/**
 * Read-only browse of the active question bank, shared by every authoring
 * role (Ops/TPO/Company) to pick questions to attach to their own
 * interview — mirrors ProblemController::index()'s "hand-pick public
 * fields" posture: `notes_for_reviewer` is internal review guidance and
 * never returned here.
 */
class InterviewQuestionBankController extends Controller
{
    public function index(Request $request)
    {
        $query = InterviewQuestionBank::where('is_active', true);

        if ($category = $request->query('category')) {
            $query->where('category', $category);
        }

        return response()->json([
            'questions' => $query->orderBy('category')->orderBy('id')
                ->get(['id', 'question_text', 'category', 'difficulty', 'expected_duration_seconds', 'tags']),
        ]);
    }
}
