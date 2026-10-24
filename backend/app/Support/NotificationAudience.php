<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * "Who should hear about this" as a users query, for NotificationService::notifyMany(). Each returns a query on
 * `users` selecting nothing yet — the service plucks the ids and drops blocked accounts itself.
 */
final class NotificationAudience
{
    /** Every student of one college (role user, belonging to it). */
    public static function students(int $collegeId): Builder
    {
        return User::query()->where('role', User::ROLE_USER)->where('college_id', $collegeId);
    }

    /** Every student on the platform that belongs to a college — the audience of an open hackathon. */
    public static function allStudents(): Builder
    {
        return User::query()->where('role', User::ROLE_USER)->whereNotNull('college_id');
    }

    /** Students of the given colleges. @param  list<int>  $collegeIds */
    public static function studentsOfColleges(array $collegeIds): Builder
    {
        return User::query()->where('role', User::ROLE_USER)->whereIn('college_id', $collegeIds);
    }

    /** A college's TPOs. */
    public static function tpos(int $collegeId): Builder
    {
        return User::query()->where('role', User::ROLE_ADMIN_TPO)->where('college_id', $collegeId);
    }

    /** A college's TPOs and section coordinators. */
    public static function collegeStaff(int $collegeId): Builder
    {
        return User::query()->whereIn('role', [User::ROLE_ADMIN_TPO, User::ROLE_SECTION_COORDINATOR])->where('college_id', $collegeId);
    }

    /** The hiring team of one company. */
    public static function companyTeam(int $companyId): Builder
    {
        return User::query()->where('role', User::ROLE_ADMIN_COMPANY)->where('company_id', $companyId);
    }

    /** Every account holding one of these roles. @param  list<string>  $roles */
    public static function roles(array $roles): Builder
    {
        return User::query()->whereIn('role', $roles);
    }

    public static function superadmins(): Builder
    {
        return self::roles([User::ROLE_SUPERADMIN]);
    }

    /** Mellow staff who run the platform day to day (not hiring partners, colleges or students). */
    public static function platformStaff(): Builder
    {
        return self::roles([User::ROLE_SUPERADMIN, User::ROLE_ADMIN_INTERNAL]);
    }
}
