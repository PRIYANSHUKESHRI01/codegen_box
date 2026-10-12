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
        // A parameter named after a reserved word of the target language (`end` in Ruby, `val` in Kotlin) is renamed
        // here, once, for every generator below; only this signature shows the name.
        $params = array_map(fn ($p) => [...$p, 'name' => ProblemType::parameterName($p['name'], $language)], $problem->params);
        $returnType = $problem->return_type;
        $name = $problem->function_name;

        return match ($language) {
            'javascript' => $this->generateJs($name, $params, $returnType),
            'python' => $this->generatePython($name, $params, $returnType),
            'java' => $this->generateJava($name, $params, $returnType),
            'cpp' => $this->generateCpp($name, $params, $returnType),
            'php' => $this->generatePhp($name, $params, $returnType),
            'c' => $this->generateC($name, $params, $returnType),
            'go' => $this->generateGo($name, $params, $returnType),
            'kotlin' => $this->generateKotlin($name, $params, $returnType),
            'rust' => $this->generateRust($name, $params, $returnType),
            'csharp' => $this->generateCsharp($name, $params, $returnType),
            'typescript' => $this->generateTypescript($name, $params, $returnType),
            'swift' => $this->generateSwift($name, $params, $returnType),
            'ruby' => $this->generateRuby($name, $params, $returnType),
            'dart' => $this->generateDart($name, $params, $returnType),
            'scala' => $this->generateScala($name, $params, $returnType),
            'elixir' => $this->generateElixir($name, $params, $returnType),
            'erlang' => $this->generateErlang($name, $params, $returnType),
            'racket' => $this->generateRacket($name, $params, $returnType),
            'python2' => $this->generatePython2($name, $params, $returnType),
            default => throw new InvalidArgumentException("Unsupported language: {$language}"),
        };
    }

    /**
     * One map per language, {slug => generated starter code} — what ProblemController's response shape has always been.
     * Order is the editor's language-dropdown order; the first key is also the language a student starts in, so
     * JavaScript stays first.
     */
    public function generateAll(Problem $problem): array
    {
        $languages = ['javascript', 'python', 'java', 'cpp', 'c', 'csharp', 'go', 'kotlin', 'rust', 'php', 'typescript', 'swift', 'ruby', 'dart', 'scala', 'elixir', 'erlang', 'racket', 'python2'];

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

    /**
     * LeetCode's PHP shape: an untyped method documented with PHPDoc types, so students aren't
     * fighting PHP's strict-type coercion rules on top of the problem. It opens with `<?php`
     * because the editor's PHP highlighting only applies inside the tag; a student who deletes the
     * tag is fine too (CodeExecutionService adds it back).
     */
    private function generatePhp(string $name, array $params, string $returnType): string
    {
        $lines = ['<?php', '', 'class Solution {', '    /**'];
        foreach ($params as $p) {
            $lines[] = '     * @param '.ProblemType::phpDocTypeName($p['type']).' $'.$p['name'];
        }
        $lines[] = '     * @return '.ProblemType::phpDocTypeName($returnType);
        $lines[] = '     */';
        $argList = implode(', ', array_map(fn ($p) => '$'.$p['name'], $params));
        $lines[] = "    public function {$name}({$argList}) {";
        $lines[] = '        // TODO: implement';
        $lines[] = '        return '.ProblemType::defaultLiteral($returnType, 'php').';';
        $lines[] = '    }';
        $lines[] = '}';

        return implode("\n", $lines)."\n";
    }

    /**
     * LeetCode's C convention, which the harness (HarnessGenerator::generateC) calls exactly:
     * an array parameter is a pointer plus its length (`int* nums, int numsSize`), a matrix adds a
     * per-row length array (`int** grid, int gridSize, int* gridColSize`), and a function returning
     * an array/matrix reports its length through `int* returnSize` (and `int** returnColumnSizes`).
     * Returned memory is the student's to malloc.
     */
    private function generateC(string $name, array $params, string $returnType): string
    {
        $args = [];
        foreach ($params as $p) {
            $scalar = ProblemType::C_SCALAR_NAME[ProblemType::scalarOf($p['type'])];

            if (ProblemType::isMatrix($p['type'])) {
                array_push($args, "{$scalar}** {$p['name']}", "int {$p['name']}Size", "int* {$p['name']}ColSize");
            } elseif (ProblemType::isArray($p['type'])) {
                array_push($args, "{$scalar}* {$p['name']}", "int {$p['name']}Size");
            } else {
                $args[] = "{$scalar} {$p['name']}";
            }
        }

        $scalar = ProblemType::C_SCALAR_NAME[ProblemType::scalarOf($returnType)];
        $doc = [];

        if (ProblemType::isMatrix($returnType)) {
            array_push($args, 'int* returnSize', 'int** returnColumnSizes');
            $returns = "{$scalar}**";
            $doc = [
                'Return an array of arrays of size *returnSize.',
                'The sizes of the arrays are returned as *returnColumnSizes array.',
                'Note: Both returned array and *returnColumnSizes array must be malloced, assume caller calls free().',
            ];
            $body = ['    *returnSize = 0;', '    *returnColumnSizes = NULL;', '    return NULL;'];
        } elseif (ProblemType::isArray($returnType)) {
            $args[] = 'int* returnSize';
            $returns = "{$scalar}*";
            $doc = ['Note: The returned array must be malloced, assume caller calls free().'];
            $body = ['    *returnSize = 0;', '    return NULL;'];
        } else {
            $returns = $scalar;
            if (ProblemType::scalarOf($returnType) === ProblemType::STRING) {
                $doc = ['Note: a returned string must stay valid after the function returns (a literal or malloced).'];
            }
            $body = ['    return '.match (ProblemType::scalarOf($returnType)) {
                ProblemType::BOOLEAN => 'false',
                ProblemType::STRING => '""',
                ProblemType::DOUBLE => '0.0',
                default => '0',
            }.';'];
        }

        $lines = $doc === [] ? [] : ['/**', ...array_map(fn ($line) => " * {$line}", $doc), ' */'];
        $lines[] = "{$returns} {$name}(".implode(', ', $args).') {';
        $lines[] = '    // TODO: implement';
        array_push($lines, ...$body);
        $lines[] = '}';

        return implode("\n", $lines)."\n";
    }

    /**
     * `package main` opens the file so the editor shows a complete Go source; a student who deletes it
     * is fine (CodeExecutionService adds it back). No imports: a student adds the ones they use, and
     * an unused import is a Go compile error, so none are pre-filled.
     */
    private function generateGo(string $name, array $params, string $returnType): string
    {
        $argList = implode(', ', array_map(fn ($p) => $p['name'].' '.ProblemType::goTypeName($p['type']), $params));
        $default = ProblemType::isArray($returnType) ? 'nil' : match ($returnType) {
            ProblemType::BOOLEAN => 'false',
            ProblemType::STRING => '""',
            default => '0',
        };

        return implode("\n", [
            'package main',
            '',
            "func {$name}({$argList}) ".ProblemType::goTypeName($returnType).' {',
            "\t// TODO: implement",
            "\treturn {$default}",
            '}',
        ])."\n";
    }

    private function generateKotlin(string $name, array $params, string $returnType): string
    {
        $argList = implode(', ', array_map(fn ($p) => $p['name'].': '.ProblemType::kotlinTypeName($p['type']), $params));
        $type = ProblemType::kotlinTypeName($returnType);
        $default = match (true) {
            ProblemType::isMatrix($returnType) => 'arrayOf<'.substr($type, 6, -1).'>()',
            ProblemType::isArray($returnType) => ProblemType::scalarOf($returnType) === ProblemType::STRING ? 'arrayOf<String>()' : lcfirst($type).'Of()',
            default => match (ProblemType::scalarOf($returnType)) {
                ProblemType::LONG => '0L',
                ProblemType::DOUBLE => '0.0',
                ProblemType::BOOLEAN => 'false',
                ProblemType::STRING => '""',
                default => '0',
            },
        };

        return implode("\n", [
            'class Solution {',
            "    fun {$name}({$argList}): {$type} {",
            '        // TODO: implement',
            "        return {$default}",
            '    }',
            '}',
        ])."\n";
    }

    /**
     * LeetCode's Rust shape: `struct Solution;` plus an `impl` of associated functions (no `self`), with
     * snake_case names and by-value parameters. `struct Solution;` is shown here so the file is complete,
     * but CodeExecutionService adds it for a student who pastes only the `impl` (as LeetCode itself hides it).
     */
    private function generateRust(string $name, array $params, string $returnType): string
    {
        $argList = implode(', ', array_map(fn ($p) => ProblemType::snakeCase($p['name']).': '.ProblemType::rustTypeName($p['type']), $params));
        $default = ProblemType::isArray($returnType) ? 'vec![]' : match ($returnType) {
            ProblemType::BOOLEAN => 'false',
            ProblemType::STRING => 'String::new()',
            ProblemType::DOUBLE => '0.0',
            default => '0',
        };

        return implode("\n", [
            'struct Solution;',
            '',
            'impl Solution {',
            '    pub fn '.ProblemType::snakeCase($name)."({$argList}) -> ".ProblemType::rustTypeName($returnType).' {',
            '        // TODO: implement',
            "        {$default}",
            '    }',
            '}',
        ])."\n";
    }

    /** LeetCode's C# shape: PascalCase method on `public class Solution`; System/Linq/Collections.Generic come from the prelude, as there. */
    private function generateCsharp(string $name, array $params, string $returnType): string
    {
        $argList = implode(', ', array_map(fn ($p) => ProblemType::csharpTypeName($p['type']).' '.$p['name'], $params));
        $type = ProblemType::csharpTypeName($returnType);
        $default = match (true) {
            ProblemType::isMatrix($returnType) => 'new '.ProblemType::CSHARP_SCALAR_NAME[ProblemType::scalarOf($returnType)].'[0][]',
            ProblemType::isArray($returnType) => 'new '.ProblemType::CSHARP_SCALAR_NAME[ProblemType::scalarOf($returnType)].'[0]',
            default => match (ProblemType::scalarOf($returnType)) {
                ProblemType::LONG => '0L',
                ProblemType::DOUBLE => '0.0',
                ProblemType::BOOLEAN => 'false',
                ProblemType::STRING => '""',
                default => '0',
            },
        };

        return implode("\n", [
            'public class Solution {',
            '    public '.$type.' '.ProblemType::pascalCase($name)."({$argList}) {",
            '        // TODO: implement',
            "        return {$default};",
            '    }',
            '}',
        ])."\n";
    }

    private function generateTypescript(string $name, array $params, string $returnType): string
    {
        $argList = implode(', ', array_map(fn ($p) => $p['name'].': '.ProblemType::jsDocTypeName($p['type']), $params));
        $default = ProblemType::isArray($returnType) ? '[]' : match ($returnType) {
            ProblemType::BOOLEAN => 'false',
            ProblemType::STRING => '""',
            default => '0',
        };

        return implode("\n", [
            "function {$name}({$argList}): ".ProblemType::jsDocTypeName($returnType).' {',
            '    // TODO: implement',
            "    return {$default};",
            '}',
        ])."\n";
    }

    /** LeetCode's Swift shape: a class with unlabeled (`_`) parameters, so the call reads `sol.twoSum([2, 7], 9)`. */
    private function generateSwift(string $name, array $params, string $returnType): string
    {
        $argList = implode(', ', array_map(fn ($p) => "_ {$p['name']}: ".ProblemType::swiftTypeName($p['type']), $params));
        $default = ProblemType::isArray($returnType) ? '[]' : match ($returnType) {
            ProblemType::BOOLEAN => 'false',
            ProblemType::STRING => '""',
            ProblemType::DOUBLE => '0.0',
            default => '0',
        };

        return implode("\n", [
            'class Solution {',
            "    func {$name}({$argList}) -> ".ProblemType::swiftTypeName($returnType).' {',
            '        // TODO: implement',
            "        return {$default}",
            '    }',
            '}',
        ])."\n";
    }

    /** LeetCode's Ruby shape: a plain snake_case method (no class), documented with YARD-style types. */
    private function generateRuby(string $name, array $params, string $returnType): string
    {
        $lines = [];
        foreach ($params as $p) {
            $lines[] = '# @param {'.ProblemType::phpDocTypeName($p['type']).'} '.ProblemType::snakeCase($p['name']);
        }
        $lines[] = '# @return {'.ProblemType::phpDocTypeName($returnType).'}';
        $argList = implode(', ', array_map(fn ($p) => ProblemType::snakeCase($p['name']), $params));
        $lines[] = 'def '.ProblemType::snakeCase($name)."({$argList})";
        $lines[] = '  # TODO: implement';
        $lines[] = '  '.(ProblemType::isArray($returnType) ? '[]' : match ($returnType) {
            ProblemType::BOOLEAN => 'false',
            ProblemType::STRING => '""',
            ProblemType::DOUBLE => '0.0',
            default => '0',
        });
        $lines[] = 'end';

        return implode("\n", $lines)."\n";
    }

    private function generateDart(string $name, array $params, string $returnType): string
    {
        $argList = implode(', ', array_map(fn ($p) => ProblemType::dartTypeName($p['type']).' '.$p['name'], $params));
        $default = ProblemType::isArray($returnType) ? '[]' : match ($returnType) {
            ProblemType::BOOLEAN => 'false',
            ProblemType::STRING => "''",
            ProblemType::DOUBLE => '0.0',
            default => '0',
        };

        return implode("\n", [
            'class Solution {',
            '  '.ProblemType::dartTypeName($returnType)." {$name}({$argList}) {",
            '    // TODO: implement',
            "    return {$default};",
            '  }',
            '}',
        ])."\n";
    }

    /** LeetCode's Scala shape: an `object Solution` (so the harness calls `Solution.twoSum`). */
    private function generateScala(string $name, array $params, string $returnType): string
    {
        $argList = implode(', ', array_map(fn ($p) => $p['name'].': '.ProblemType::scalaTypeName($p['type']), $params));
        $default = match (true) {
            ProblemType::isArray($returnType) => ProblemType::scalaTypeName($returnType).'()',
            default => match ($returnType) {
                ProblemType::LONG => '0L',
                ProblemType::DOUBLE => '0.0',
                ProblemType::BOOLEAN => 'false',
                ProblemType::STRING => '""',
                default => '0',
            },
        };

        return implode("\n", [
            'object Solution {',
            "    def {$name}({$argList}): ".ProblemType::scalaTypeName($returnType).' = {',
            '        // TODO: implement',
            "        {$default}",
            '    }',
            '}',
        ])."\n";
    }

    /** LeetCode's Elixir shape: a module with an `@spec` and a snake_case `def`. */
    private function generateElixir(string $name, array $params, string $returnType): string
    {
        $specArgs = implode(', ', array_map(fn ($p) => ProblemType::snakeCase($p['name']).' :: '.ProblemType::elixirTypeName($p['type']), $params));
        $argList = implode(', ', array_map(fn ($p) => ProblemType::snakeCase($p['name']), $params));
        $function = ProblemType::snakeCase($name);
        $default = ProblemType::isArray($returnType) ? '[]' : match ($returnType) {
            ProblemType::BOOLEAN => 'false',
            ProblemType::STRING => '""',
            ProblemType::DOUBLE => '0.0',
            default => '0',
        };

        return implode("\n", [
            'defmodule Solution do',
            "  @spec {$function}({$specArgs}) :: ".ProblemType::elixirTypeName($returnType),
            "  def {$function}({$argList}) do",
            '    # TODO: implement',
            "    {$default}",
            '  end',
            'end',
        ])."\n";
    }

    /** LeetCode's Erlang shape: a `-spec` and a snake_case function, with CamelCase variables. Strings are binaries. */
    private function generateErlang(string $name, array $params, string $returnType): string
    {
        $function = ProblemType::snakeCase($name);
        $variables = array_map(fn ($p) => ucfirst(ProblemType::snakeCase($p['name'])), $params);
        $specArgs = implode(', ', array_map(fn ($p, $v) => "{$v} :: ".ProblemType::erlangTypeName($p['type']), $params, $variables));
        $default = ProblemType::isArray($returnType) ? '[]' : match ($returnType) {
            ProblemType::BOOLEAN => 'false',
            ProblemType::STRING => '<<"">>',
            ProblemType::DOUBLE => '0.0',
            default => '0',
        };

        return implode("\n", [
            "-spec {$function}({$specArgs}) -> ".ProblemType::erlangTypeName($returnType).'.',
            "{$function}(".implode(', ', $variables).') ->',
            '  % TODO: implement',
            "  {$default}.",
        ])."\n";
    }

    /**
     * LeetCode's Racket shape: a kebab-case `define/contract`. `#lang racket` is shown so the file is a
     * complete module; a student who deletes it is fine (CodeExecutionService adds it back).
     */
    private function generateRacket(string $name, array $params, string $returnType): string
    {
        $argList = implode(' ', array_map(fn ($p) => ProblemType::kebabCase($p['name']), $params));
        $contract = implode(' ', array_map(fn ($p) => ProblemType::racketContract($p['type']), $params)).' '.ProblemType::racketContract($returnType);
        $default = ProblemType::isArray($returnType) ? "'()" : match ($returnType) {
            ProblemType::BOOLEAN => '#f',
            ProblemType::STRING => '""',
            ProblemType::DOUBLE => '0.0',
            default => '0',
        };

        return implode("\n", [
            '#lang racket',
            '',
            '(define/contract ('.ProblemType::kebabCase($name)." {$argList})",
            "  (-> {$contract})",
            '  ;; TODO: implement',
            "  {$default})",
        ])."\n";
    }

    /** LeetCode's legacy Python 2 shape: `class Solution(object)` with a `:type` docstring. */
    private function generatePython2(string $name, array $params, string $returnType): string
    {
        $argList = implode(', ', array_merge(['self'], array_column($params, 'name')));
        $lines = ['class Solution(object):', "    def {$name}({$argList}):", '        """'];
        foreach ($params as $p) {
            $lines[] = "        :type {$p['name']}: ".ProblemType::pythonTypeName($p['type']);
        }
        $lines[] = '        :rtype: '.ProblemType::pythonTypeName($returnType);
        $lines[] = '        """';
        $lines[] = '        # TODO: implement';
        $lines[] = '        pass';

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
