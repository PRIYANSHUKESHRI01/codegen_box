<?php

namespace App\Services\ProblemCodeGenerator;

use InvalidArgumentException;

/**
 * A decoded test-case value + its declared ProblemType -> a real source
 * literal for one of the supported languages. JS accepts JSON's array/
 * number/string syntax almost verbatim; Python differs only on booleans
 * (True/False, not true/false); Java/C++ need typed constructor syntax
 * (`new int[]{...}` / `vector<int>{...}`); PHP takes `[...]` arrays but
 * not JSON's string escaping (see emitPhp). Go, Kotlin, Rust and C# each
 * have their own typed array syntax and string escapes; C's arrays need
 * statements, not an expression, so HarnessGenerator lays those out and
 * only borrows this class for the scalar/brace-list pieces.
 */
class LiteralEmitter
{
    public function emit(mixed $value, string $type, string $language): string
    {
        ProblemType::assertValid($type);

        return match ($language) {
            'javascript' => $this->emitJs($value, $type),
            'python' => $this->emitPython($value, $type),
            'java' => $this->emitJava($value, $type),
            'cpp' => $this->emitCpp($value, $type),
            'php' => $this->emitPhp($value, $type),
            'c' => $this->emitC($value, $type),
            'go' => $this->emitGo($value, $type),
            'kotlin' => $this->emitKotlin($value, $type),
            'rust' => $this->emitRust($value, $type),
            'csharp' => $this->emitCsharp($value, $type),
            'typescript' => $this->emitJs($value, $type), // a TypeScript literal is a JavaScript literal
            // A large integer array goes in as text for these (see TEXT_ARRAY_LIMIT); everything else is a literal.
            'swift' => $this->emitListOrText($value, $type, 'swift'),
            'ruby' => $this->emitList($value, $type, 'ruby', '[', ']', ', '),
            'dart' => $this->emitListOrText($value, $type, 'dart'),
            'elixir' => $this->emitListOrText($value, $type, 'elixir'),
            'erlang' => $this->emitListOrText($value, $type, 'erlang'),
            'python2' => $this->emitListOrText($value, $type, 'python2'),
            'scala' => $this->emitScala($value, $type),
            'racket' => $this->emitRacket($value, $type),
            default => throw new InvalidArgumentException("Unsupported language: {$language}"),
        };
    }

    /**
     * Swift, Ruby, Dart, Elixir, Erlang and Python 2 all write an array as `[a, b]` and a matrix as
     * `[[a], [b]]`, so one routine serves them: only the scalar syntax differs (strings above all).
     * The element type comes from the call's declared parameter type, so an empty `[]` is never ambiguous.
     */
    private function emitList(mixed $value, string $type, string $language, string $open, string $close, string $separator): string
    {
        if (ProblemType::isArray($type)) {
            $elementType = ProblemType::isMatrix($type) ? ProblemType::elementTypeOf($type) : ProblemType::scalarOf($type);
            $items = array_map(fn ($v) => $this->emitList($v, $elementType, $language, $open, $close, $separator), $value);

            return $open.implode($separator, $items).$close;
        }

        return match ($type) {
            ProblemType::BOOLEAN => match ($language) {
                'python2' => $value ? 'True' : 'False',
                default => $value ? 'true' : 'false',
            },
            ProblemType::STRING => $this->scalarString((string) $value, $language),
            ProblemType::DOUBLE => $this->formatFloat($value),
            default => (string) $value,
        };
    }

    private function emitListOrText(mixed $value, string $type, string $language): string
    {
        return $this->chunkedIntegers($value, $type, $language) ?? $this->emitList($value, $type, $language, '[', ']', ', ');
    }

    private function scalarString(string $value, string $language): string
    {
        return match ($language) {
            'erlang' => '<<'.$this->escapedString($value, 'erlang').'/utf8>>',
            'python2' => $this->python2String($value),
            default => $this->escapedString($value, $language),
        };
    }

    /**
     * A Python 2 `str`: bytes. Printable ASCII as is, every other byte (so each byte of a UTF-8
     * sequence) as \xNN. json.dumps() reads a str as UTF-8, so non-ASCII text round-trips, and the
     * source stays ASCII, which Python 2 requires unless the file declares an encoding.
     */
    private function python2String(string $value): string
    {
        $out = '';
        foreach (str_split($value) as $byte) {
            $code = ord($byte);
            $out .= match (true) {
                $byte === '"' => '\\"',
                $byte === '\\' => '\\\\',
                $byte === "\n" => '\\n',
                $byte === "\r" => '\\r',
                $byte === "\t" => '\\t',
                $code < 0x20 || $code > 0x7E => sprintf('\\x%02x', $code),
                default => $byte,
            };
        }

        return '"'.$out.'"';
    }

    /**
     * The catalog's performance cases are integer arrays of up to 100,000 values, and most compilers cannot take
     * that as a source literal: a JVM method holds at most 64 KB of bytecode (about 7 bytes per element: "code too
     * large"), Swift's type checker is super-linear in a literal's size and never finishes on 10,000 elements,
     * Dart writes a kernel file past the sandbox's file-size limit, and Go, Rust, Elixir, Erlang, Racket and
     * Python 2 spend their whole CPU budget just reading it. So past this many values an `integer[]` /
     * `integer[][]` goes in as text and the harness parses it when it runs (the aptrunInts helpers in
     * HarnessGenerator). Smaller arrays stay literal, so ordinary generated code is unchanged; 200 keeps even
     * ten such cases per harness far under every limit. Languages that read big literals fine (JavaScript,
     * Python, PHP, C, C++, C#, Ruby, TypeScript, Scala) keep them.
     */
    private const TEXT_ARRAY_LIMIT = 200;

    /** Text chunks stay well under a class file's 65,535-byte limit on one string constant (the strictest of them). */
    private const TEXT_CHUNK_CHARS = 30000;

    /**
     * `aptrunInts("1,2,3,", "4,5")` / `aptrunIntMatrix("1,2;3,4")` for a large `integer[]` / `integer[][]`, else null.
     * Chunks are cut only after a separator and carry it, so joining them back with "" restores the exact text.
     */
    private function chunkedIntegers(mixed $value, string $type, string $language): ?string
    {
        if (! in_array($type, [ProblemType::INTEGER_ARRAY, ProblemType::INTEGER_MATRIX], true)) {
            return null;
        }

        $matrix = $type === ProblemType::INTEGER_MATRIX;
        if (($matrix ? array_sum(array_map('count', $value)) : count($value)) <= self::TEXT_ARRAY_LIMIT) {
            return null;
        }

        $text = $matrix ? implode(';', array_map(fn ($row) => implode(',', $row), $value)) : implode(',', $value);
        $chunks = [];
        for ($start = 0, $length = strlen($text); $start < $length;) {
            $end = min($length, $start + self::TEXT_CHUNK_CHARS);
            while ($end < $length && $text[$end - 1] !== ',' && $text[$end - 1] !== ';') {
                $end++; // never cut inside a number
            }
            $chunks[] = '"'.substr($text, $start, $end - $start).'"';
            $start = $end;
        }

        // Each language's helper (HarnessGenerator) and its own calling convention for "a list of text pieces".
        $list = implode(', ', $chunks);

        return match ($language) {
            'scala' => ($matrix ? 'AptrunData.intMatrix' : 'AptrunData.ints')."({$list})",
            'dart' => ($matrix ? 'aptrunIntMatrix' : 'aptrunInts')."([{$list}])",
            'rust' => ($matrix ? 'aptrun_int_matrix' : 'aptrun_ints')."(&[{$list}])",
            'elixir' => ($matrix ? 'AptrunData.int_matrix' : 'AptrunData.ints')."([{$list}])",
            // Plain strings, not <<"...">>: the Erlang compiler expands a binary literal one character at a time,
            // which takes minutes at 30,000 characters. iolist_to_binary/1 accepts the strings as they are.
            'erlang' => ($matrix ? 'aptrun_int_matrix' : 'aptrun_ints')."([{$list}])",
            // Racket separates arguments with spaces: a comma is `unquote`.
            'racket' => '('.($matrix ? 'aptrun-int-matrix' : 'aptrun-ints').' '.implode(' ', $chunks).')',
            'python2' => ($matrix ? 'aptrun_int_matrix' : 'aptrun_ints')."({$list})",
            default => ($matrix ? 'aptrunIntMatrix' : 'aptrunInts')."({$list})", // Java, Kotlin, Swift, Go
        };
    }

    /** Scala's arrays are invariant and `Array()` infers badly, so every one is written with its element type. */
    private function emitScala(mixed $value, string $type): string
    {
        if (($chunked = $this->chunkedIntegers($value, $type, 'scala')) !== null) {
            return $chunked;
        }

        if (ProblemType::isArray($type)) {
            $elementType = ProblemType::isMatrix($type) ? ProblemType::elementTypeOf($type) : ProblemType::scalarOf($type);
            $items = array_map(fn ($v) => $this->emitScala($v, $elementType), $value);

            return ProblemType::scalaTypeName($type).'('.implode(', ', $items).')';
        }

        return match ($type) {
            ProblemType::BOOLEAN => $value ? 'true' : 'false',
            ProblemType::STRING => $this->escapedString((string) $value, 'scala'),
            ProblemType::DOUBLE => $this->formatFloat($value),
            ProblemType::LONG => "{$value}L",
            default => (string) $value,
        };
    }

    /** A Racket list is quoted once, at the outside; the datum inside is plain `(1 2 3)` / `((1 2) (3))` / `("a" "b")`. */
    private function emitRacket(mixed $value, string $type): string
    {
        if (($chunked = $this->chunkedIntegers($value, $type, 'racket')) !== null) {
            return $chunked;
        }

        return ProblemType::isArray($type) ? "'".$this->racketDatum($value, $type) : $this->racketDatum($value, $type);
    }

    private function racketDatum(mixed $value, string $type): string
    {
        if (ProblemType::isArray($type)) {
            $elementType = ProblemType::isMatrix($type) ? ProblemType::elementTypeOf($type) : ProblemType::scalarOf($type);

            return '('.implode(' ', array_map(fn ($v) => $this->racketDatum($v, $elementType), $value)).')';
        }

        return match ($type) {
            ProblemType::BOOLEAN => $value ? '#t' : '#f',
            ProblemType::STRING => $this->escapedString((string) $value, 'racket'),
            ProblemType::DOUBLE => $this->formatFloat($value),
            default => (string) $value,
        };
    }

    /**
     * A C string literal: bytes, not characters. Printable ASCII is written as is; everything else
     * (including each byte of a UTF-8 sequence) is a 3-digit octal escape, which can't swallow a
     * following digit the way `\x` or a short octal would. `?` is escaped so `??/` can never be
     * read as a trigraph. The harness builds C's array/pointer layout itself (see HarnessGenerator),
     * so this is public for it to reuse.
     */
    public function cString(string $value): string
    {
        $out = '';
        foreach (str_split($value) as $byte) {
            $code = ord($byte);
            $out .= match (true) {
                $byte === '"' => '\\"',
                $byte === '\\' => '\\\\',
                $byte === '?' => '\\?',
                $byte === "\n" => '\\n',
                $byte === "\r" => '\\r',
                $byte === "\t" => '\\t',
                $code < 0x20 || $code > 0x7E => sprintf('\\%03o', $code),
                default => $byte,
            };
        }

        return '"'.$out.'"';
    }

    private function emitC(mixed $value, string $type): string
    {
        if (ProblemType::isArray($type)) {
            $elementType = ProblemType::isMatrix($type) ? ProblemType::elementTypeOf($type) : ProblemType::scalarOf($type);

            return '{'.implode(',', array_map(fn ($v) => $this->emitC($v, $elementType), $value)).'}';
        }

        return match ($type) {
            ProblemType::BOOLEAN => $value ? 'true' : 'false',
            ProblemType::STRING => $this->cString((string) $value),
            ProblemType::DOUBLE => $this->formatFloat($value),
            ProblemType::LONG => "{$value}LL",
            default => (string) $value,
        };
    }

    private function emitGo(mixed $value, string $type): string
    {
        if (($chunked = $this->chunkedIntegers($value, $type, 'go')) !== null) {
            return $chunked;
        }

        if (ProblemType::isArray($type)) {
            $elementType = ProblemType::isMatrix($type) ? ProblemType::elementTypeOf($type) : ProblemType::scalarOf($type);
            $items = array_map(fn ($v) => $this->emitGo($v, $elementType), $value);

            return ProblemType::goTypeName($type).'{'.implode(',', $items).'}';
        }

        return match ($type) {
            ProblemType::BOOLEAN => $value ? 'true' : 'false',
            ProblemType::STRING => $this->escapedString((string) $value, 'go'),
            ProblemType::DOUBLE => $this->formatFloat($value),
            ProblemType::LONG => "int64({$value})",
            default => (string) $value,
        };
    }

    private function emitKotlin(mixed $value, string $type): string
    {
        if (($chunked = $this->chunkedIntegers($value, $type, 'kotlin')) !== null) {
            return $chunked;
        }

        if (ProblemType::isMatrix($type)) {
            $rows = array_map(fn ($row) => $this->emitKotlin($row, ProblemType::elementTypeOf($type)), $value);

            return 'arrayOf('.implode(',', $rows).')';
        }

        if (ProblemType::isArray($type)) {
            $scalar = ProblemType::scalarOf($type);
            $items = implode(',', array_map(fn ($v) => $this->emitKotlin($v, $scalar), $value));

            return match ($scalar) {
                ProblemType::INTEGER => "intArrayOf({$items})",
                ProblemType::LONG => "longArrayOf({$items})",
                ProblemType::DOUBLE => "doubleArrayOf({$items})",
                ProblemType::BOOLEAN => "booleanArrayOf({$items})",
                default => "arrayOf<String>({$items})",
            };
        }

        return match ($type) {
            ProblemType::BOOLEAN => $value ? 'true' : 'false',
            ProblemType::STRING => $this->escapedString((string) $value, 'kotlin'),
            ProblemType::DOUBLE => $this->formatFloat($value),
            ProblemType::LONG => "{$value}L",
            default => (string) $value,
        };
    }

    private function emitRust(mixed $value, string $type): string
    {
        if (($chunked = $this->chunkedIntegers($value, $type, 'rust')) !== null) {
            return $chunked;
        }

        if (ProblemType::isArray($type)) {
            $elementType = ProblemType::isMatrix($type) ? ProblemType::elementTypeOf($type) : ProblemType::scalarOf($type);
            $items = array_map(fn ($v) => $this->emitRust($v, $elementType), $value);

            return 'vec!['.implode(',', $items).']';
        }

        return match ($type) {
            ProblemType::BOOLEAN => $value ? 'true' : 'false',
            ProblemType::STRING => 'String::from('.$this->escapedString((string) $value, 'rust').')',
            ProblemType::DOUBLE => $this->formatFloat($value),
            ProblemType::LONG => "{$value}i64",
            default => (string) $value,
        };
    }

    private function emitCsharp(mixed $value, string $type): string
    {
        if (ProblemType::isArray($type)) {
            $elementType = ProblemType::isMatrix($type) ? ProblemType::elementTypeOf($type) : ProblemType::scalarOf($type);
            $items = array_map(fn ($v) => $this->emitCsharp($v, $elementType), $value);

            return 'new '.ProblemType::csharpTypeName($type).' {'.implode(',', $items).'}';
        }

        return match ($type) {
            ProblemType::BOOLEAN => $value ? 'true' : 'false',
            ProblemType::STRING => $this->escapedString((string) $value, 'csharp'),
            ProblemType::DOUBLE => $this->formatFloat($value),
            ProblemType::LONG => "{$value}L",
            default => (string) $value,
        };
    }

    /**
     * A double-quoted string literal for Go, Kotlin, Rust or C#, written in plain ASCII so it
     * can't be mangled by a source-encoding or locale difference anywhere in the toolchain.
     * Not json_encode(): its `\/` isn't a legal escape in any of these, and Rust spells a
     * code point `\u{XXXX}` rather than `\uXXXX`. Kotlin additionally treats `$` as the start of
     * a string template, so a `$` in test data must be escaped or it becomes a variable reference.
     */
    private function escapedString(string $value, string $language): string
    {
        $out = '';
        foreach (preg_split('//u', $value, -1, PREG_SPLIT_NO_EMPTY) ?: str_split($value) as $char) {
            $code = mb_ord($char, 'UTF-8');
            $out .= match (true) {
                $char === '"' => '\\"',
                $char === '\\' => '\\\\',
                $char === "\n" => '\\n',
                $char === "\r" => '\\r',
                $char === "\t" => '\\t',
                // `$` starts a template in Kotlin and Dart; `#` starts an interpolation (`#{`) in Ruby and Elixir.
                in_array($language, ['kotlin', 'dart'], true) && $char === '$' => '\\$',
                in_array($language, ['ruby', 'elixir'], true) && $char === '#' => '\\#',
                $code < 0x20 || $code > 0x7E => $this->codePointEscape($code, $language),
                default => $char,
            };
        }

        return '"'.$out.'"';
    }

    private function codePointEscape(int $code, string $language): string
    {
        if (in_array($language, ['rust', 'swift', 'ruby', 'dart', 'elixir'], true)) {
            return sprintf('\\u{%X}', $code);
        }

        if ($language === 'erlang') {
            return sprintf('\\x{%X}', $code);
        }

        if ($code <= 0xFFFF) {
            return sprintf('\\u%04X', $code);
        }

        // Go and Racket have a 32-bit escape; Kotlin, Scala and C# are written as a UTF-16 surrogate pair.
        if (in_array($language, ['go', 'racket'], true)) {
            return sprintf('\\U%08X', $code);
        }

        $offset = $code - 0x10000;

        return sprintf('\\u%04X\\u%04X', 0xD800 + ($offset >> 10), 0xDC00 + ($offset & 0x3FF));
    }

    private function emitJs(mixed $value, string $type): string
    {
        if (ProblemType::isArray($type)) {
            $elementType = ProblemType::isMatrix($type) ? ProblemType::elementTypeOf($type) : ProblemType::scalarOf($type);
            $items = array_map(fn ($v) => $this->emitJs($v, $elementType), $value);

            return '['.implode(',', $items).']';
        }

        return match ($type) {
            ProblemType::BOOLEAN => $value ? 'true' : 'false',
            ProblemType::STRING => $this->jsonString((string) $value),
            ProblemType::DOUBLE => $this->formatFloat($value),
            default => (string) $value,
        };
    }

    private function emitPython(mixed $value, string $type): string
    {
        if (ProblemType::isArray($type)) {
            $elementType = ProblemType::isMatrix($type) ? ProblemType::elementTypeOf($type) : ProblemType::scalarOf($type);
            $items = array_map(fn ($v) => $this->emitPython($v, $elementType), $value);

            return '['.implode(',', $items).']';
        }

        return match ($type) {
            ProblemType::BOOLEAN => $value ? 'True' : 'False',
            ProblemType::STRING => $this->jsonString((string) $value),
            ProblemType::DOUBLE => $this->formatFloat($value),
            default => (string) $value,
        };
    }

    private function emitJava(mixed $value, string $type): string
    {
        if (($chunked = $this->chunkedIntegers($value, $type, 'java')) !== null) {
            return $chunked;
        }

        if (ProblemType::isMatrix($type)) {
            $rowType = ProblemType::elementTypeOf($type); // e.g. integer[]
            $rows = array_map(fn ($row) => $this->literalRow($row, ProblemType::scalarOf($rowType), 'java'), $value);
            $elementType = ProblemType::JAVA_SCALAR_NAME[ProblemType::scalarOf($rowType)];

            return "new {$elementType}[][]{".implode(',', $rows).'}';
        }

        if (ProblemType::isArray($type)) {
            $scalar = ProblemType::scalarOf($type);
            $items = $this->literalRow($value, $scalar, 'java');
            $elementType = ProblemType::JAVA_SCALAR_NAME[$scalar];

            return "new {$elementType}[]{$items}";
        }

        return match ($type) {
            ProblemType::BOOLEAN => $value ? 'true' : 'false',
            ProblemType::STRING => $this->jsonString((string) $value),
            ProblemType::DOUBLE => $this->formatFloat($value),
            ProblemType::LONG => "{$value}L",
            default => (string) $value,
        };
    }

    private function emitCpp(mixed $value, string $type): string
    {
        if (ProblemType::isMatrix($type)) {
            $rowType = ProblemType::elementTypeOf($type);
            $rows = array_map(fn ($row) => $this->literalRow($row, ProblemType::scalarOf($rowType), 'cpp'), $value);
            $elementType = ProblemType::CPP_SCALAR_NAME[ProblemType::scalarOf($rowType)];

            return "vector<vector<{$elementType}>>{".implode(',', $rows).'}';
        }

        if (ProblemType::isArray($type)) {
            $scalar = ProblemType::scalarOf($type);
            $items = $this->literalRow($value, $scalar, 'cpp');
            $elementType = ProblemType::CPP_SCALAR_NAME[$scalar];

            return "vector<{$elementType}>{$items}";
        }

        return match ($type) {
            ProblemType::BOOLEAN => $value ? 'true' : 'false',
            ProblemType::STRING => $this->jsonString((string) $value),
            ProblemType::DOUBLE => $this->formatFloat($value),
            ProblemType::LONG => "{$value}LL",
            default => (string) $value,
        };
    }

    /**
     * Strings are single-quoted, not json_encode()d like the other languages': PHP interpolates
     * `$var`/`{$expr}` in double quotes, and JSON's `\/` and `é` escapes aren't PHP escapes
     * (they'd stay as a literal backslash sequence). Inside single quotes only `\` and `'` are special.
     */
    private function emitPhp(mixed $value, string $type): string
    {
        if (ProblemType::isArray($type)) {
            $elementType = ProblemType::isMatrix($type) ? ProblemType::elementTypeOf($type) : ProblemType::scalarOf($type);
            $items = array_map(fn ($v) => $this->emitPhp($v, $elementType), $value);

            return '['.implode(',', $items).']';
        }

        return match ($type) {
            ProblemType::BOOLEAN => $value ? 'true' : 'false',
            ProblemType::STRING => "'".str_replace(['\\', "'"], ['\\\\', "\\'"], (string) $value)."'",
            ProblemType::DOUBLE => $this->formatFloat($value),
            default => (string) $value,
        };
    }

    /** A brace/bracket-wrapped, comma-joined row of scalar literals — shared by Java's `{...}` and C++'s `{...}` array-init syntax. */
    private function literalRow(array $values, string $scalarType, string $language): string
    {
        $items = array_map(fn ($v) => $language === 'java' ? $this->emitJava($v, $scalarType) : $this->emitCpp($v, $scalarType), $values);

        return '{'.implode(',', $items).'}';
    }

    /**
     * A JSON string is also a valid string literal in JavaScript, Python, Java and C++ — except for one thing
     * PHP's json_encode() does by default: it writes `/` as `\/`. Java rejects that ("illegal escape character")
     * and Python keeps the backslash, so the student's function would receive `\/a\/b` instead of `/a/b`.
     * Eight catalog problems have a slash or two in their test strings (simplify-path, ...).
     */
    private function jsonString(string $value): string
    {
        return json_encode($value, JSON_UNESCAPED_SLASHES);
    }

    /** Guarantees a decimal point so e.g. Java/C++ don't see a bare integer literal where a double is expected. */
    private function formatFloat(mixed $value): string
    {
        $str = (string) (float) $value;

        return str_contains($str, '.') || str_contains($str, 'e') || str_contains($str, 'E') ? $str : "{$str}.0";
    }
}
