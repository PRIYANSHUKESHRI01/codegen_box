<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\SupportTicketMail;
use App\Models\AptBotFaq;
use App\Models\SupportTicket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class AptBotController extends Controller
{
    /**
     * Return grouped active FAQs for AptBot.
     */
    public function index(): JsonResponse
    {
        $faqs = AptBotFaq::active()->orderBy('display_order')->get();

        $grouped = [];
        foreach ($faqs as $faq) {
            if (! isset($grouped[$faq->category])) {
                $grouped[$faq->category] = [
                    'key' => $faq->category,
                    'label' => $faq->category_label,
                    'icon' => $faq->category_icon,
                    'faqs' => [],
                ];
            }
            $grouped[$faq->category]['faqs'][] = [
                'id' => $faq->id,
                'slug' => $faq->slug,
                'question' => $faq->question,
                'answer' => $faq->answer,
                'action_label' => $faq->action_label,
                'action_url' => $faq->action_url,
                'related_slugs' => $faq->related_slugs ?? [],
            ];
        }

        return response()->json([
            'categories' => array_values($grouped),
        ]);
    }

    /**
     * Submit an escalated support ticket from AptBot.
     */
    public function createTicket(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'message' => ['required', 'string', 'min:3', 'max:3000'],
            'name' => ['nullable', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:150'],
            'category' => ['nullable', 'string', 'max:80'],
            'subject' => ['nullable', 'string', 'max:200'],
            'metadata' => ['nullable', 'array'],
        ]);

        $user = $request->user('sanctum') ?? $request->user();

        if (! $user) {
            return response()->json([
                'message' => 'Please sign in to your AptRun account to submit a query.',
            ], 401);
        }

        // Automatically fetch authenticated student's real name and email
        $name = trim($user->name);
        $email = trim(strtolower($user->email));
        $category = trim((string) ($validated['category'] ?? 'general_inquiry'));

        $subject = trim((string) ($validated['subject'] ?? ''));
        if ($subject === '') {
            $snippet = Str::limit(trim($validated['message']), 60);
            $subject = "AptBot Query from {$name}: {$snippet}";
        }

        $ticketNumber = 'APT-'.date('Y').'-'.strtoupper(Str::random(5));

        $metadata = array_merge($validated['metadata'] ?? [], [
            'roll_number' => $user->roll_number,
            'graduation_year' => $user->graduation_year,
            'department_id' => $user->department_id,
            'college_id' => $user->college_id,
            'college_name' => $user->college?->name,
        ]);

        $ticket = SupportTicket::create([
            'ticket_number' => $ticketNumber,
            'user_id' => $user->id,
            'name' => $name,
            'email' => $email,
            'category' => $category,
            'subject' => $subject,
            'message' => trim($validated['message']),
            'status' => 'open',
            'metadata' => $metadata,
        ]);

        try {
            Mail::to(['support@mellowvault.com', 'priyanshu@mellowvault.com'])->send(new SupportTicketMail($ticket));
        } catch (\Throwable $e) {
            Log::error('AptBot failed sending support ticket email to support@mellowvault.com: '.$e->getMessage(), [
                'ticket_id' => $ticket->id,
                'ticket_number' => $ticketNumber,
            ]);
        }

        return response()->json([
            'success' => true,
            'ticket_number' => $ticket->ticket_number,
            'message' => 'Your query has been submitted. Our support team has been notified and will review your request.',
        ], 201);
    }
}
