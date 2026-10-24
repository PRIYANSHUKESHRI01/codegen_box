<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CoordinatorNote;
use App\Models\User;
use App\Services\SectionCoordinatorService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * A Section Coordinator's follow-up log on the students they look after: what they did ("called the parent"), when the
 * next conversation is due, and whether it is done. The point is that "who still needs a call?" has an answer that
 * survives a holiday, a handover to a new coordinator and a TPO asking what happened.
 *
 * Reachable only for students in the coordinator's scope — the same query as everything else a coordinator does (404 for
 * anyone else, never a hint the student exists). Notes are the coordinator's and the college TPO's: nothing here is ever
 * returned to the student. A coordinator may delete only a note they wrote; anyone who covers the student may mark one done.
 */
class CoordinatorNoteController extends Controller
{
    public function __construct(private readonly SectionCoordinatorService $coordinators) {}

    public function index(Request $request, User $student)
    {
        $this->authorizeStudent($request, $student);

        $notes = CoordinatorNote::query()->where('student_id', $student->id)->with('author:id,name')
            ->orderByRaw('resolved_at is null desc')->latest('id')->limit(100)->get();

        return response()->json(['notes' => $notes->map(fn (CoordinatorNote $n) => $n->present($request->user()))->values()]);
    }

    public function store(Request $request, User $student)
    {
        $this->authorizeStudent($request, $student);

        $validated = $request->validate([
            'body' => ['required', 'string', 'min:2', 'max:1000'],
            'kind' => ['nullable', Rule::in(CoordinatorNote::KINDS)],
            // A follow-up is something still ahead (or today); a year out is the furthest a log should plan.
            'follow_up_on' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:today', 'before_or_equal:'.now()->addYear()->toDateString()],
        ]);

        abort_if(
            CoordinatorNote::where('student_id', $student->id)->count() >= CoordinatorNote::MAX_PER_STUDENT,
            422,
            'This student already has the most notes a log can hold. Resolve or delete old ones first.'
        );

        $note = CoordinatorNote::create([
            'college_id' => $student->college_id,
            'student_id' => $student->id,
            'author_id' => $request->user()->id,
            'kind' => $validated['kind'] ?? 'note',
            'body' => trim($validated['body']),
            'follow_up_on' => $validated['follow_up_on'] ?? null,
        ]);

        return response()->json(['note' => $note->load('author:id,name')->present($request->user())], 201);
    }

    /** Mark a note done, or reopen it. */
    public function update(Request $request, CoordinatorNote $note)
    {
        $this->authorizeNote($request, $note);

        $validated = $request->validate(['resolved' => ['required', 'boolean']]);

        $note->forceFill($validated['resolved']
            ? ['resolved_at' => now(), 'resolved_by' => $request->user()->id]
            : ['resolved_at' => null, 'resolved_by' => null])->save();

        return response()->json(['note' => $note->load('author:id,name')->present($request->user())]);
    }

    public function destroy(Request $request, CoordinatorNote $note)
    {
        $this->authorizeNote($request, $note);

        abort_unless($note->author_id !== null && (int) $note->author_id === (int) $request->user()->id, 403, 'You can only delete a note you wrote.');

        $note->delete();

        return response()->json(['deleted' => true]);
    }

    private function authorizeStudent(Request $request, User $student): void
    {
        abort_unless($this->coordinators->covers($request->user(), $student), 404);
    }

    private function authorizeNote(Request $request, CoordinatorNote $note): void
    {
        $student = $note->student;

        abort_unless($student !== null && $this->coordinators->covers($request->user(), $student), 404);
    }
}
