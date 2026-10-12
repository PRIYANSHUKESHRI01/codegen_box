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

    public const GO_SCALAR_NAME = [
        self::INTEGER => 'int',
        self::LONG => 'int64',
        self::DOUBLE => 'float64',
        self::BOOLEAN => 'bool',
        self::STRING => 'string',
    ];

    public const RUST_SCALAR_NAME = [
        self::INTEGER => 'i32',
        self::LONG => 'i64',
        self::DOUBLE => 'f64',
        self::BOOLEAN => 'bool',
        self::STRING => 'String',
    ];

    public const CSHARP_SCALAR_NAME = [
        self::INTEGER => 'int',
        self::LONG => 'long',
        self::DOUBLE => 'double',
        self::BOOLEAN => 'bool',
        self::STRING => 'string',
    ];

    /** C's element type for each scalar. A string is `char*`, so a string[] is `char**`. */
    public const C_SCALAR_NAME = [
        self::INTEGER => 'int',
        self::LONG => 'long long',
        self::DOUBLE => 'double',
        self::BOOLEAN => 'bool',
        self::STRING => 'char*',
    ];

    /** Kotlin's primitive-array class per scalar; strings use the generic Array<String> instead. */
    public const KOTLIN_SCALAR_NAME = [
        self::INTEGER => 'Int',
        self::LONG => 'Long',
        self::DOUBLE => 'Double',
        self::BOOLEAN => 'Boolean',
        self::STRING => 'String',
    ];

    public const SWIFT_SCALAR_NAME = [
        self::INTEGER => 'Int',
        self::LONG => 'Int', // Swift's Int is 64-bit
        self::DOUBLE => 'Double',
        self::BOOLEAN => 'Bool',
        self::STRING => 'String',
    ];

    public const DART_SCALAR_NAME = [
        self::INTEGER => 'int',
        self::LONG => 'int', // Dart's int is 64-bit on the VM
        self::DOUBLE => 'double',
        self::BOOLEAN => 'bool',
        self::STRING => 'String',
    ];

    public const SCALA_SCALAR_NAME = [
        self::INTEGER => 'Int',
        self::LONG => 'Long',
        self::DOUBLE => 'Double',
        self::BOOLEAN => 'Boolean',
        self::STRING => 'String',
    ];

    /** Swift: `Int`, `[Int]`, `[[Int]]`, `[String]`, ... */
    public static function swiftTypeName(string $type): string
    {
        return self::wrapDimensions(self::SWIFT_SCALAR_NAME[self::scalarOf($type)], $type, fn ($inner) => "[{$inner}]");
    }

    /** Dart: `int`, `List<int>`, `List<List<int>>`, `List<String>`, ... */
    public static function dartTypeName(string $type): string
    {
        return self::wrapDimensions(self::DART_SCALAR_NAME[self::scalarOf($type)], $type, fn ($inner) => "List<{$inner}>");
    }

    /** Scala: `Int`, `Array[Int]`, `Array[Array[Int]]`, `Array[String]`, ... */
    public static function scalaTypeName(string $type): string
    {
        return self::wrapDimensions(self::SCALA_SCALAR_NAME[self::scalarOf($type)], $type, fn ($inner) => "Array[{$inner}]");
    }

    /** Elixir typespec: `integer`, `[integer]`, `[[integer]]`, `[String.t]`, `float`, `boolean`. */
    public static function elixirTypeName(string $type): string
    {
        $scalar = match (self::scalarOf($type)) {
            self::DOUBLE => 'float',
            self::BOOLEAN => 'boolean',
            self::STRING => 'String.t',
            default => 'integer',
        };

        return self::wrapDimensions($scalar, $type, fn ($inner) => "[{$inner}]");
    }

    /** Erlang typespec: `integer()`, `[integer()]`, `[[integer()]]`, `[unicode:unicode_binary()]`, ... (LeetCode's: a string is a binary). */
    public static function erlangTypeName(string $type): string
    {
        $scalar = match (self::scalarOf($type)) {
            self::DOUBLE => 'float()',
            self::BOOLEAN => 'boolean()',
            self::STRING => 'unicode:unicode_binary()',
            default => 'integer()',
        };

        return self::wrapDimensions($scalar, $type, fn ($inner) => "[{$inner}]");
    }

    /** Racket contract: `exact-integer?`, `(listof exact-integer?)`, `(listof (listof exact-integer?))`, `flonum?`, ... */
    public static function racketContract(string $type): string
    {
        $scalar = match (self::scalarOf($type)) {
            self::DOUBLE => 'flonum?',
            self::BOOLEAN => 'boolean?',
            self::STRING => 'string?',
            default => 'exact-integer?',
        };

        return self::wrapDimensions($scalar, $type, fn ($inner) => "(listof {$inner})");
    }

    /** Applies $wrap once per array dimension of $type around $name. */
    private static function wrapDimensions(string $name, string $type, callable $wrap): string
    {
        for ($i = substr_count($type, '[]'); $i > 0; $i--) {
            $name = $wrap($name);
        }

        return $name;
    }

    /**
     * Words a language will not accept as a parameter name (hard keywords only: Dart's `part`, Kotlin's `value` and
     * the like are legal identifiers). A catalog author picks parameter names with Java, C++, Python and JavaScript
     * in mind, so a new language is where one collides: `path-with-maximum-probability` has a parameter called `end`
     * (a syntax error in Ruby and Elixir) and two problems have `val` (Kotlin and Scala keyword). Erlang variables
     * are capitalised, which no keyword is, so it needs no entry; PHP's start with `$`.
     */
    private const RESERVED_PARAMETER_NAMES = [
        'c' => 'auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while bool true false',
        'csharp' => 'abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual void volatile while',
        'go' => 'break default func interface select case defer go map struct chan else goto package switch const fallthrough if range type continue for import return var',
        'kotlin' => 'as break class continue do else false for fun if in interface is null object package return super this throw true try typealias typeof val var when while',
        'rust' => 'as break const continue crate else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while async await dyn abstract become box do final macro override priv typeof unsized virtual yield try',
        'typescript' => 'break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield let static implements interface package private protected public await async',
        'swift' => 'associatedtype class deinit enum extension fileprivate func import init inout internal let open operator private protocol public rethrows static struct subscript typealias var break case continue default defer do else fallthrough for guard if in repeat return switch where while as Any catch false is nil super self Self throw throws true try',
        'ruby' => 'alias and begin BEGIN break case class def defined? do else elsif end END ensure false for if in module next nil not or redo rescue retry return self super then true undef unless until when while yield',
        'dart' => 'assert break case catch class const continue default do else enum extends false final finally for if in is new null rethrow return super switch this throw true try var void while with',
        'scala' => 'abstract case catch class def do else enum export extends false final finally for forSome given if implicit import lazy match new null object override package private protected return sealed super then throw trait true try type val var while with yield',
        'elixir' => 'true false nil when and or not in fn do end catch rescue after else',
        'racket' => 'define lambda let if cond else and or quote set! begin do case when unless require provide struct',
        'python2' => 'and as assert break class continue def del elif else except exec finally for from global if import in is lambda not or pass print raise return try while with yield',
    ];

    /**
     * The name a parameter gets in $language's starter code: itself, unless that word is reserved there, in which
     * case a `_` is appended (`end` -> `end_`). Only the signature shows the name — the harness passes arguments by
     * position — so nothing else needs to know. Compared in the form the language will actually use, since Ruby,
     * Elixir and Racket convert the case first.
     */
    public static function parameterName(string $name, string $language): string
    {
        $reserved = self::RESERVED_PARAMETER_NAMES[$language] ?? null;

        if ($reserved === null) {
            return $name;
        }

        $used = match ($language) {
            'ruby', 'elixir' => self::snakeCase($name),
            'racket' => self::kebabCase($name),
            default => $name,
        };

        return in_array($used, explode(' ', $reserved), true) ? $name.'_' : $name;
    }

    /** twoSum -> two-sum: Racket's naming convention (and LeetCode's Racket starters). */
    public static function kebabCase(string $name): string
    {
        return str_replace('_', '-', self::snakeCase($name));
    }

    /** Go: `int`, `[]int`, `[][]int`, `[]string`, ... */
    public static function goTypeName(string $type): string
    {
        return str_repeat('[]', substr_count($type, '[]')).self::GO_SCALAR_NAME[self::scalarOf($type)];
    }

    /** Rust: `i32`, `Vec<i32>`, `Vec<Vec<i32>>`, `Vec<String>`, ... */
    public static function rustTypeName(string $type): string
    {
        $name = self::RUST_SCALAR_NAME[self::scalarOf($type)];
        for ($i = substr_count($type, '[]'); $i > 0; $i--) {
            $name = "Vec<{$name}>";
        }

        return $name;
    }

    /** C#: `int`, `int[]`, `int[][]`, `string[]`, ... */
    public static function csharpTypeName(string $type): string
    {
        return self::CSHARP_SCALAR_NAME[self::scalarOf($type)].str_repeat('[]', substr_count($type, '[]'));
    }

    /** Kotlin: `Int`, `IntArray`, `Array<IntArray>`, `Array<String>`, ... (LeetCode's own mapping). */
    public static function kotlinTypeName(string $type): string
    {
        $scalar = self::scalarOf($type);
        $element = $scalar === self::STRING ? 'String' : self::KOTLIN_SCALAR_NAME[$scalar].'Array';

        if (self::isMatrix($type)) {
            return "Array<{$element}>";
        }
        if (self::isArray($type)) {
            return $scalar === self::STRING ? 'Array<String>' : $element;
        }

        return self::KOTLIN_SCALAR_NAME[$scalar];
    }

    /** twoSum -> two_sum, lengthOfLIS -> length_of_lis: Rust's naming convention (and LeetCode's Rust starters). */
    public static function snakeCase(string $name): string
    {
        $name = preg_replace('/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/', '_', $name);

        return strtolower($name);
    }

    /** twoSum -> TwoSum: C#'s method naming convention (and LeetCode's C# starters). */
    public static function pascalCase(string $name): string
    {
        return ucfirst($name);
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

    /** The PHPDoc type name PHP starter code uses (LeetCode's convention): Integer, Float, Boolean, String, Integer[], Integer[][], ... */
    public static function phpDocTypeName(string $type): string
    {
        $scalar = match (self::scalarOf($type)) {
            self::DOUBLE => 'Float',
            self::BOOLEAN => 'Boolean',
            self::STRING => 'String',
            default => 'Integer', // integer and long
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
