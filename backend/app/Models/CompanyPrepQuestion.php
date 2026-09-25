<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompanyPrepQuestion extends Model
{
    use HasFactory;

    public const CATEGORIES = [
        'Aptitude',
        'Coding',
        'Technical',
        'System Design',
        'HR',
        'Behavioral',
    ];

    protected $fillable = [
        'company_id',
        'asked_year',
        'category',
        'round_name',
        'question',
        'answer_notes',
        'display_order',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
