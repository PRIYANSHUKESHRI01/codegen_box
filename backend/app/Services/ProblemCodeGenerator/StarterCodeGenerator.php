<?php

namespace App\Services\ProblemCodeGenerator;

use App\Models\Problem;
use InvalidArgumentException;

/**
 * Builds the function-stub the editor shows a student, from Problem's
 * function_name/params/return_type — the same visual shape every
 * hand-written starter_code entry used to have (see the pre-migration
 * ProblemSeeder), now generated instead of authored per problem per
 * language. Called on every GET /problems/{slug}, not stored — cheap,
 * deterministic, and can never drift from the signature it's generated from.
 */
class StarterCodeGenerator
{
    public function generate(Problem $problem, string $language): string
    {
        $params = $problem->params;
        $returnType = $problem->return_type;
        $name = $problem->function_name;

        return match ($language) {
            'javascript' => $this->generateJs($name, $params, $returnType),
            'python' => $this->generatePython($name, $params, $returnType),
            'java' => $this->generateJava($name, $params, $returnType),
            'cpp' => $this->generateCpp($name, $params, $returnType),
            default => throw new InvalidArgumentException("Unsupported language: {$language}"),
        };
    }

    /** One map per language, {slug => generated starter code} — what ProblemController's response shape has always been. */
    public function generateAll(Problem $problem): array
    {
        $languages = ['javascript', 'python', 'java', 'cpp'];

        return array_combine($languages, array_map(fn ($l) => $this->generate($problem, $l), $languages));
    }

    private function generateJs(string $name, array $params, string $returnType): string
    {
        $lines = ['/**'];
        foreach ($params as $p) {
            $lines[] = " * @param {".ProblemType::jsDocTypeName($p['type'])."} {$p['name']}";
        }
        $lines[] = ' * @return {'.ProblemType::jsDocTypeName($returnType).'}';
        $lines[] = ' */';
        $argList = implode(', ', array_column($params, 'name'));
        $lines[] = "function {$name}({$argList}) {";
        $lines[] = '  // TODO: implement';
        $lines[] = '}';

        return implode("\n", $lines)."\n";
    }

    private function generatePython(string $name, array $params, string $returnType): string
    {
        $argList = 'self';
        foreach ($params as $p) {
            $argList .= ", {$p['name']}: ".ProblemType::pythonTypeName($p['type']);
        }

        $paramTypesNeedList = array_filter($params, fn ($p) => str_contains(ProblemType::pythonTypeName($p['type']), 'List'));
        $needsListImport = str_contains(ProblemType::pythonTypeName($returnType), 'List') || $paramTypesNeedList !== [];

        $lines = [];
        if ($needsListImport) {
            $lines[] = 'from typing import List';
            $lines[] = '';
        }
        $lines[] = 'class Solution:';
        $lines[] = "    def {$name}({$argList}) -> ".ProblemType::pythonTypeName($returnType).':';
        $lines[] = '        # TODO: implement';
        $lines[] = '        pass';

        return implode("\n", $lines)."\n";
    }

    private function generateJava(string $name, array $params, string $returnType): string
    {
        $argList = implode(', ', array_map(fn ($p) => ProblemType::javaTypeName($p['type']).' '.$p['name'], $params));

        $lines = ['class Solution {'];
        $lines[] = '    public '.ProblemType::javaTypeName($returnType)." {$name}({$argList}) {";
        $lines[] = '        // TODO: implement';
        $lines[] = '        return '.ProblemType::defaultLiteral($returnType, 'java').';';
        $lines[] = '    }';
        $lines[] = '}';

        return implode("\n", $lines)."\n";
    }

    private function generateCpp(string $name, array $params, string $returnType): string
    {
        $argList = implode(', ', array_map(function ($p) {
            $type = ProblemType::cppTypeName($p['type']);
            // Non-scalar params are taken by reference, matching the existing hand-written convention (e.g. `vector<int>& nums`).
            $suffix = ProblemType::isArray($p['type']) ? '&' : '';

            return "{$type}{$suffix} {$p['name']}";
        }, $params));

        $lines = ['class Solution {', 'public:'];
        $lines[] = '    '.ProblemType::cppTypeName($returnType)." {$name}({$argList}) {";
        $lines[] = '        // TODO: implement';
        $lines[] = '        return '.ProblemType::defaultLiteral($returnType, 'cpp').';';
        $lines[] = '    }';
        $lines[] = '};';

        return implode("\n", $lines)."\n";
    }
}
