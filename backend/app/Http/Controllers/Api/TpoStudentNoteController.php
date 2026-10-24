<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CoordinatorNote;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * A college TPO's READ-ONLY view of the follow-up notes its Section Coordinators keep on the college's students — what
 * was done and what is still open. The TPO cannot add, edit or delete them (that is the coordinator's log), and sees only
 * their own college's students: anything else is a 404.
 */
class TpoStudentNoteController extends Controller
{
    public function index(Request $request, User $student)
    {
        abort_unless(
            $student->role === User::ROLE_USER && $student->college_id !== null && (int) $student->college_id === (int) $request->user()->college_id,
            404
        );

        $notes = CoordinatorNote::query()->where('student_id', $student->id)->with('author:id,name')
            ->orderByRaw('resolved_at is null desc')->latest('id')->limit(100)->get();

        return response()->json(['notes' => $notes->map(fn (CoordinatorNote $n) => $n->present($request->user()))->values()]);
    }
}
