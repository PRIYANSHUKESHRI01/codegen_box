<?php

namespace App\Services\ProblemCodeGenerator;

use InvalidArgumentException;

/**
 * The closed set of types a problem's function signature (`params`/
 * `return_type` on Problem) may declare. Deliberately does NOT include
 * ListNode/TreeNode/graph types — those need real (de)serialization helpers
 * per language and roughly double this generator's surface area. Adding one
 * later is a new case in LiteralEmitter/HarnessGenerator's dispatch, not a
 * schema change — this is a visible, deliberate boundary, not a silent gap.
 */
final class ProblemType
{
    public const INTEGER = 'integer';

    public const LONG = 'long';

    public const DOUBLE = 'double';

    public const BOOLEAN = 'boolean';

    public const STRING = 'string';

    public const INTEGER_ARRAY = 'integer[]';

    public const LONG_ARRAY = 'long[]';

    public const DOUBLE_ARRAY = 'double[]';

    public const BOOLEAN_ARRAY = 'boolean[]';

    public const STRING_ARRAY = 'string[]';

    public const INTEGER_MATRIX = 'integer[][]';

    public const ALL = [
        self::INTEGER, self::LONG, self::DOUBLE, self::BOOLEAN, self::STRING,
        self::INTEGER_ARRAY, self::LONG_ARRAY, self::DOUBLE_ARRAY, self::BOOLEAN_ARRAY, self::STRING_ARRAY,
        self::INTEGER_MATRIX,
    ];

    public static function isValid(string $type): bool
    {
        return in_array($type, self::ALL, true);
    }

    public static function assertValid(string $type): void
    {
        if (! self::isValid($type)) {
            throw new InvalidArgumentException(
                "Unsupported problem type \"{$type}\". Supported: ".implode(', ', self::ALL)
            );
        }
    }

    public static function isArray(string $type): bool
    {
        return str_ends_with($type, '[]');
    }

    public static function isMatrix(string $type): bool
    {
        return str_ends_with($type, '[][]');
    }

    /** integer[] -> integer, integer[][] -> integer (the base scalar, however many dimensions deep). */
    public static function scalarOf(string $type): string
    {
        return rtrim($type, '[]');
    }

    /** One dimension removed: integer[][] -> integer[]. Only meaningful for matrix types. */
    public static function elementTypeOf(string $type): string
    {
        return substr($type, 0, -2);
    }

    public static function isNumeric(string $type): bool
    {
        return in_array(self::scalarOf($type), [self::INTEGER, self::LONG, self::DOUBLE], true);
    }

    public static function isFloatingPoint(string $type): bool
    {
        return self::scalarOf($type) === self::DOUBLE;
    }

    /** Java's element-type keyword for each scalar — shared by LiteralEmitter (array-literal syntax) and StarterCodeGenerator (method signatures). */
    public const JAVA_SCALAR_NAME = [
        self::INTEGER => 'int',
        self::LONG => 'long',
        self::DOUBLE => 'double',
        self::BOOLEAN => 'boolean',
        self::STRING => 'String',
    ];

    public const CPP_SCALAR_NAME = [
        self::INTEGER => 'int',
        self::LONG => 'long long',
        self::DOUBLE => 'double',
        self::BOOLEAN => 'bool',
        self::STRING => 'string',
    ];

    /** The full type name (any dimension) as it appears in a Java method signature: int[], int[][], String, ... */
    public static function javaTypeName(string $type): string
    {
        if (self::isMatrix($type)) {
            return self::JAVA_SCALAR_NAME[self::scalarOf($type)].'[][]';
        }
        if (self::isArray($type)) {
            return self::JAVA_SCALAR_NAME[self::scalarOf($type)].'[]';
        }

        return self::JAVA_SCALAR_NAME[$type];
    }

    /** The full type name as it appears in a C++ method signature: vector<int>, vector<vector<int>>, string, ... */
    public static function cppTypeName(string $type): string
    {
        if (self::isMatrix($type)) {
            return 'vector<vector<'.self::CPP_SCALAR_NAME[self::scalarOf($type)].'>>';
        }
        if (self::isArray($type)) {
            return 'vector<'.self::CPP_SCALAR_NAME[self::scalarOf($type)].'>';
        }

        return self::CPP_SCALAR_NAME[$type];
    }

    /** The JSDoc-comment type name JS starter code uses: number, number[], number[][], ... */
    public static function jsDocTypeName(string $type): string
    {
        $scalar = match (self::scalarOf($type)) {
            self::BOOLEAN => 'boolean',
            self::STRING => 'string',
            default => 'number', // integer, long, and double are all just "number" in JS
        };

        if (self::isMatrix($type)) {
            return "{$scalar}[][]";
        }

        return self::isArray($type) ? "{$scalar}[]" : $scalar;
    }

    /** The Python type-hint name: int, float, bool, str, List[int], List[List[int]], ... */
    public static function pythonTypeName(string $type): string
    {
        $scalar = match (self::scalarOf($type)) {
            self::DOUBLE => 'float',
            self::BOOLEAN => 'bool',
            self::STRING => 'str',
            default => 'int', // integer and long
        };

        if (self::isMatrix($type)) {
            return "List[List[{$scalar}]]";
        }

        return self::isArray($type) ? "List[{$scalar}]" : $scalar;
    }

    /** A compilable placeholder return value for the starter-code stub body — Java/C++ need something type-correct even before the student writes real logic. */
    public static function defaultLiteral(string $type, string $language): string
    {
        if (self::isArray($type)) {
            return match ($language) {
                'java' => 'new '.self::javaTypeName($type).'{}',
                'cpp' => '{}',
                default => '[]',
            };
        }

        return match (self::scalarOf($type)) {
            self::BOOLEAN => 'false',
            self::STRING => '""',
            self::DOUBLE => '0.0',
            default => '0',
        };
    }
}
