<?php

namespace App\Services\ProblemCodeGenerator;

use InvalidArgumentException;

/**
 * A decoded test-case value + its declared ProblemType -> a real source
 * literal for one of the 4 supported languages. JS accepts JSON's array/
 * number/string syntax almost verbatim; Python differs only on booleans
 * (True/False, not true/false); Java/C++ need typed constructor syntax
 * (`new int[]{...}` / `vector<int>{...}`).
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
            default => throw new InvalidArgumentException("Unsupported language: {$language}"),
        };
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
            ProblemType::STRING => json_encode((string) $value),
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
            ProblemType::STRING => json_encode((string) $value),
            ProblemType::DOUBLE => $this->formatFloat($value),
            default => (string) $value,
        };
    }

    private function emitJava(mixed $value, string $type): string
    {
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
            ProblemType::STRING => json_encode((string) $value),
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
            ProblemType::STRING => json_encode((string) $value),
            ProblemType::DOUBLE => $this->formatFloat($value),
            ProblemType::LONG => "{$value}LL",
            default => (string) $value,
        };
    }

    /** A brace/bracket-wrapped, comma-joined row of scalar literals — shared by Java's `{...}` and C++'s `{...}` array-init syntax. */
    private function literalRow(array $values, string $scalarType, string $language): string
    {
        $items = array_map(fn ($v) => $language === 'java' ? $this->emitJava($v, $scalarType) : $this->emitCpp($v, $scalarType), $values);

        return '{'.implode(',', $items).'}';
    }

    /** Guarantees a decimal point so e.g. Java/C++ don't see a bare integer literal where a double is expected. */
    private function formatFloat(mixed $value): string
    {
        $str = (string) (float) $value;

        return str_contains($str, '.') || str_contains($str, 'e') || str_contains($str, 'E') ? $str : "{$str}.0";
    }
}
