<?php

namespace App\Services\ProblemCodeGenerator;

use App\Models\Problem;
use App\Models\ProblemTestCase;
use Illuminate\Support\Collection;
use InvalidArgumentException;

/**
 * Builds the driver code appended after the student's Solution — one call
 * per test case, each printing its result as canonical JSON on its own
 * line, so JudgeService can json_decode and structurally compare instead of
 * diffing raw stdout strings. Replaces the old per-problem hand-written
 * `test_harness` entirely: every problem gets this from just its
 * function_name/params/return_type + whichever test cases the caller
 * passes in (samples-only for Run, the full set for Submit — see
 * JudgeService).
 */
class HarnessGenerator
{
    /**
     * Lives inside the generated `public class Main` (not config/piston.php's
     * prelude) because Piston's single-file Java launcher picks the first
     * top-level class in the file as the entry point — nothing can precede
     * `public class Main` here. Fixed and shared across every problem;
     * mirrors the C++ toJson(...) overloads in config/piston.php's cpp
     * prelude, which face no such ordering constraint.
     */
    private const JAVA_JSON_HELPERS = <<<'JAVA'
    static String toJson(int v) { return String.valueOf(v); }
    static String toJson(long v) { return String.valueOf(v); }
    static String toJson(double v) { return String.valueOf(v); }
    static String toJson(boolean v) { return String.valueOf(v); }
    static String toJson(String v) {
        StringBuilder sb = new StringBuilder("\"");
        for (char c : v.toCharArray()) {
            // ASCII-only output: the sandbox JVM's stdout has no locale, so a raw non-ASCII char would print as `?`
            // (and a raw control character, like a newline in the result, is invalid JSON).
            if (c == '"' || c == '\\') sb.append('\\').append(c);
            else if (c < ' ' || c > '~') sb.append(String.format("\\u%04x", (int) c));
            else sb.append(c);
        }
        sb.append("\"");
        return sb.toString();
    }
    static String toJson(int[] a) { StringBuilder sb = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(","); sb.append(toJson(a[i])); } sb.append("]"); return sb.toString(); }
    static String toJson(long[] a) { StringBuilder sb = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(","); sb.append(toJson(a[i])); } sb.append("]"); return sb.toString(); }
    static String toJson(double[] a) { StringBuilder sb = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(","); sb.append(toJson(a[i])); } sb.append("]"); return sb.toString(); }
    static String toJson(boolean[] a) { StringBuilder sb = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(","); sb.append(toJson(a[i])); } sb.append("]"); return sb.toString(); }
    static String toJson(String[] a) { StringBuilder sb = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(","); sb.append(toJson(a[i])); } sb.append("]"); return sb.toString(); }
    static String toJson(int[][] a) { StringBuilder sb = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(","); sb.append(toJson(a[i])); } sb.append("]"); return sb.toString(); }
    // A large int[] / int[][] is passed as text and parsed here: listed element by element it would overflow the
    // JVM's 64 KB-per-method limit ("code too large"). See LiteralEmitter::chunkedIntegers().
    static int[] aptrunInts(String... parts) {
        String text = String.join("", parts);
        if (text.isEmpty()) return new int[0];
        String[] tokens = text.split(",", -1);
        int[] out = new int[tokens.length];
        for (int i = 0; i < tokens.length; i++) out[i] = Integer.parseInt(tokens[i]);
        return out;
    }
    static int[][] aptrunIntMatrix(String... parts) {
        String[] rows = String.join("", parts).split(";", -1);
        int[][] out = new int[rows.length][];
        for (int r = 0; r < rows.length; r++) out[r] = rows[r].isEmpty() ? new int[0] : aptrunInts(rows[r]);
        return out;
    }
JAVA;

    /**
     * A PHP array is an ordered map, so one that lost its sequential keys (array_filter(),
     * unset()) would encode as a JSON *object*, not a list — and the judge would call a correct
     * answer wrong. Every array-typed return value is therefore re-listed (recursively, `$dims`
     * levels deep) before encoding. Nothing else needs normalising: json_encode() already prints
     * floor()'s `float(3)` as `3`, which is what the judge's strict comparison expects.
     * json_encode() failing (NAN/INF, invalid UTF-8) throws, which the per-case catch reports as a
     * runtime error instead of printing an empty line that would shift every later case's line.
     */
    private const PHP_JSON_HELPERS = <<<'PHP'
function _aptrun_json($value, int $dims): string {
    return json_encode(_aptrun_relist($value, $dims), JSON_THROW_ON_ERROR);
}
function _aptrun_relist($value, int $dims) {
    if ($dims === 0 || !is_array($value)) return $value;
    $list = [];
    foreach ($value as $item) $list[] = _aptrun_relist($item, $dims - 1);
    return $list;
}
PHP;

    /**
     * C has no overloading or generics, so each shape of value gets its own printer. All of them end
     * with fflush: a later case that crashes (C can't catch a segfault) must not take earlier,
     * already-correct output down with it. Doubles print the shortest of %.15g/%.16g/%.17g that
     * round-trips, and a non-finite one prints `null` (invalid for any expected value, so it fails
     * instead of passing as a number). Strings are escaped byte-wise: UTF-8 passes through.
     */
    private const C_JSON_HELPERS = <<<'C'
static void aptrun_end(void) { putchar('\n'); fflush(stdout); }
static void aptrun_print_int(int v) { printf("%d", v); }
static void aptrun_print_long(long long v) { printf("%lld", v); }
static void aptrun_print_bool(bool v) { fputs(v ? "true" : "false", stdout); }
static void aptrun_print_double(double v) {
    char buf[48];
    if (!isfinite(v)) { fputs("null", stdout); return; }
    for (int p = 15; p <= 17; p++) { snprintf(buf, sizeof buf, "%.*g", p, v); if (strtod(buf, NULL) == v) break; }
    fputs(buf, stdout);
}
static void aptrun_print_string(const char* s) {
    if (s == NULL) { fputs("null", stdout); return; }
    putchar('"');
    for (const unsigned char* c = (const unsigned char*)s; *c; c++) {
        if (*c == '"' || *c == '\\') { putchar('\\'); putchar(*c); }
        else if (*c < 0x20) { printf("\\u%04x", *c); }
        else { putchar(*c); }
    }
    putchar('"');
}
#define APTRUN_ARRAY_PRINTER(NAME, T, PRINT) \
    static void NAME(T* a, int n) { putchar('['); for (int i = 0; i < n; i++) { if (i) putchar(','); PRINT(a[i]); } putchar(']'); }
APTRUN_ARRAY_PRINTER(aptrun_print_int_array, int, aptrun_print_int)
APTRUN_ARRAY_PRINTER(aptrun_print_long_array, long long, aptrun_print_long)
APTRUN_ARRAY_PRINTER(aptrun_print_double_array, double, aptrun_print_double)
APTRUN_ARRAY_PRINTER(aptrun_print_bool_array, bool, aptrun_print_bool)
static void aptrun_print_string_array(char** a, int n) { putchar('['); for (int i = 0; i < n; i++) { if (i) putchar(','); aptrun_print_string(a[i]); } putchar(']'); }
static void aptrun_print_int_matrix(int** m, int rows, int* cols) {
    putchar('[');
    for (int r = 0; r < rows; r++) { if (r) putchar(','); aptrun_print_int_array(m[r], cols[r]); }
    putchar(']');
}
C;

    /**
     * Go's encoding/json does the printing; the one thing it gets wrong for a judge is that a nil slice
     * encodes as `null`, not `[]` — and `return nil` is idiomatic Go for "no results". Every slice in
     * the result is therefore rebuilt non-nil (recursively) first. A panic in one case prints the
     * sentinel and moves on; a Go stack overflow is fatal, not a panic, and ends the run like in C++.
     */
    private const GO_JSON_HELPERS = <<<'GO'
func aptrunNorm(v reflect.Value) reflect.Value {
	if v.Kind() != reflect.Slice {
		return v
	}
	out := reflect.MakeSlice(v.Type(), v.Len(), v.Len())
	for i := 0; i < v.Len(); i++ {
		out.Index(i).Set(aptrunNorm(v.Index(i)))
	}
	return out
}

func aptrunCase(f func() interface{}) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Println("__RUNTIME_ERROR__")
		}
	}()
	b, err := json.Marshal(aptrunNorm(reflect.ValueOf(f())).Interface())
	if err != nil {
		panic(err)
	}
	fmt.Println(string(b))
}

// A large []int / [][]int is passed as text and parsed here: a source literal of 100,000 elements takes `go run`
// longer to build than a submission may use. See LiteralEmitter::chunkedIntegers().
func aptrunInts(parts ...string) []int {
	text := strings.Join(parts, "")
	if text == "" {
		return []int{}
	}
	fields := strings.Split(text, ",")
	out := make([]int, len(fields))
	for i, f := range fields {
		out[i], _ = strconv.Atoi(f)
	}
	return out
}

func aptrunIntMatrix(parts ...string) [][]int {
	rows := strings.Split(strings.Join(parts, ""), ";")
	out := make([][]int, len(rows))
	for i, r := range rows {
		out[i] = aptrunInts(r)
	}
	return out
}
GO;

    /**
     * Kotlin/JVM stdout may be ASCII-only in the sandbox (no locale), so every non-ASCII character is
     * written as \uXXXX rather than risking `?`. println() flushes, like Java's System.out.
     */
    private const KOTLIN_JSON_HELPERS = <<<'KOTLIN'
fun aptrunJson(v: Int): String = v.toString()
fun aptrunJson(v: Long): String = v.toString()
fun aptrunJson(v: Boolean): String = v.toString()
fun aptrunJson(v: Double): String {
    if (v.isNaN() || v.isInfinite()) throw ArithmeticException("non-finite double")
    return v.toString()
}
fun aptrunJson(v: String): String {
    val sb = StringBuilder("\"")
    for (c in v) {
        when {
            c == '"' -> sb.append("\\\"")
            c == '\\' -> sb.append("\\\\")
            c < ' ' || c > '~' -> sb.append(String.format("\\u%04x", c.code))
            else -> sb.append(c)
        }
    }
    return sb.append('"').toString()
}
fun aptrunJson(v: IntArray): String = v.joinToString(",", "[", "]")
fun aptrunJson(v: LongArray): String = v.joinToString(",", "[", "]")
fun aptrunJson(v: BooleanArray): String = v.joinToString(",", "[", "]")
fun aptrunJson(v: DoubleArray): String = v.joinToString(",", "[", "]") { aptrunJson(it) }
fun aptrunJson(v: Array<String>): String = v.joinToString(",", "[", "]") { aptrunJson(it) }
fun aptrunJson(v: Array<IntArray>): String = v.joinToString(",", "[", "]") { aptrunJson(it) }

// A large IntArray / Array<IntArray> is passed as text and parsed here: listed element by element it would
// overflow the JVM's 64 KB-per-method limit. See LiteralEmitter::chunkedIntegers().
fun aptrunInts(vararg parts: String): IntArray {
    val text = parts.joinToString("")
    return if (text.isEmpty()) IntArray(0) else text.split(',').map { it.toInt() }.toIntArray()
}
fun aptrunIntMatrix(vararg parts: String): Array<IntArray> =
    parts.joinToString("").split(';').map { if (it.isEmpty()) IntArray(0) else aptrunInts(it) }.toTypedArray()
KOTLIN;

    /**
     * One blanket impl covers every Vec<T>, so the matrix and string-list cases need no code of their own.
     * f64 uses Display (never an exponent, always valid JSON); a non-finite one prints `null` so it fails.
     */
    private const RUST_JSON_HELPERS = <<<'RUST'
trait AptrunJson { fn aptrun_json(&self) -> String; }
impl AptrunJson for i32 { fn aptrun_json(&self) -> String { self.to_string() } }
impl AptrunJson for i64 { fn aptrun_json(&self) -> String { self.to_string() } }
impl AptrunJson for bool { fn aptrun_json(&self) -> String { self.to_string() } }
impl AptrunJson for f64 {
    fn aptrun_json(&self) -> String { if self.is_finite() { format!("{}", self) } else { "null".to_string() } }
}
impl AptrunJson for String {
    fn aptrun_json(&self) -> String {
        let mut out = String::from("\"");
        for c in self.chars() {
            match c {
                '"' => out.push_str("\\\""),
                '\\' => out.push_str("\\\\"),
                c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
                c => out.push(c),
            }
        }
        out.push('"');
        out
    }
}
impl<T: AptrunJson> AptrunJson for Vec<T> {
    fn aptrun_json(&self) -> String {
        format!("[{}]", self.iter().map(|x| x.aptrun_json()).collect::<Vec<_>>().join(","))
    }
}

// A large Vec<i32> / Vec<Vec<i32>> is passed as text and parsed here: rustc spends minutes on a `vec![...]` of
// 100,000 elements. See LiteralEmitter::chunkedIntegers().
fn aptrun_ints(parts: &[&str]) -> Vec<i32> {
    let text: String = parts.concat();
    if text.is_empty() { return Vec::new(); }
    text.split(',').map(|x| x.parse().unwrap()).collect()
}
fn aptrun_int_matrix(parts: &[&str]) -> Vec<Vec<i32>> {
    let text: String = parts.concat();
    text.split(';').map(|row| aptrun_ints(&[row])).collect()
}
RUST;

    /** Output is ASCII-only (\uXXXX for the rest) for the same locale reason as Kotlin's, and numbers use the invariant culture. */
    private const CSHARP_JSON_HELPERS = <<<'CSHARP'
public static class AptrunJson {
    static readonly System.Globalization.CultureInfo Inv = System.Globalization.CultureInfo.InvariantCulture;
    public static string ToJson(int v) { return v.ToString(Inv); }
    public static string ToJson(long v) { return v.ToString(Inv); }
    public static string ToJson(bool v) { return v ? "true" : "false"; }
    public static string ToJson(double v) {
        if (double.IsNaN(v) || double.IsInfinity(v)) throw new ArithmeticException("non-finite double");
        return v.ToString("R", Inv);
    }
    public static string ToJson(string v) {
        var sb = new StringBuilder("\"");
        foreach (char c in v) {
            if (c == '"') sb.Append("\\\"");
            else if (c == '\\') sb.Append("\\\\");
            else if (c < ' ' || c > '~') sb.Append("\\u").Append(((int)c).ToString("x4"));
            else sb.Append(c);
        }
        return sb.Append('"').ToString();
    }
    public static string ToJson(int[] v) { return "[" + string.Join(",", Array.ConvertAll(v, x => ToJson(x))) + "]"; }
    public static string ToJson(long[] v) { return "[" + string.Join(",", Array.ConvertAll(v, x => ToJson(x))) + "]"; }
    public static string ToJson(double[] v) { return "[" + string.Join(",", Array.ConvertAll(v, x => ToJson(x))) + "]"; }
    public static string ToJson(bool[] v) { return "[" + string.Join(",", Array.ConvertAll(v, x => ToJson(x))) + "]"; }
    public static string ToJson(string[] v) { return "[" + string.Join(",", Array.ConvertAll(v, x => ToJson(x))) + "]"; }
    public static string ToJson(int[][] v) { return "[" + string.Join(",", Array.ConvertAll(v, x => ToJson(x))) + "]"; }
}
CSHARP;

    /**
     * Swift can't catch a trap (array index out of range, integer overflow, force-unwrapping nil), so
     * a case that does one ends the run like a C segfault; the cases before it already printed, and
     * fflush after each print is what keeps them (stdout is block-buffered when it isn't a terminal).
     * Output is ASCII-only, \uXXXX per UTF-16 unit, so no locale can turn text into `?`.
     */
    private const SWIFT_JSON_HELPERS = <<<'SWIFT'
protocol AptrunJson { func aptrunJson() -> String }
extension Int: AptrunJson { func aptrunJson() -> String { return String(self) } }
extension Bool: AptrunJson { func aptrunJson() -> String { return self ? "true" : "false" } }
extension Double: AptrunJson { func aptrunJson() -> String { return self.isFinite ? "\(self)" : "null" } }
extension String: AptrunJson {
    func aptrunJson() -> String {
        var out = "\""
        for u in self.utf16 {
            switch u {
            case 34: out += "\\\""
            case 92: out += "\\\\"
            case 32...126: out += String(UnicodeScalar(UInt8(u)))
            default: out += String(format: "\\u%04x", Int(u))
            }
        }
        return out + "\""
    }
}
extension Array: AptrunJson where Element: AptrunJson {
    func aptrunJson() -> String { return "[" + self.map { $0.aptrunJson() }.joined(separator: ",") + "]" }
}
func aptrunCase(_ f: () -> String) { print(f()); fflush(stdout) }

// A large [Int] / [[Int]] is passed as text and parsed here: Swift's type checker never finishes on a literal of
// ~10,000 elements. See LiteralEmitter::chunkedIntegers().
func aptrunInts(_ parts: String...) -> [Int] {
    let text = parts.joined()
    return text.isEmpty ? [] : text.split(separator: ",").map { Int($0)! }
}
func aptrunIntMatrix(_ parts: String...) -> [[Int]] {
    return parts.joined().split(separator: ";", omittingEmptySubsequences: false).map { row in
        row.isEmpty ? [] : row.split(separator: ",").map { Int($0)! }
    }
}
SWIFT;

    /**
     * Scala has no JSON in its standard library. The overloads on Array[Int] / Array[String] / Array[Array[Int]]
     * erase to different JVM signatures (int[], String[], int[][]), so plain overloading works. ASCII-only
     * output, as in Kotlin's helpers, for the same locale reason.
     */
    private const SCALA_JSON_HELPERS = <<<'SCALA'
object AptrunJson {
  def json(v: Int): String = v.toString
  def json(v: Long): String = v.toString
  def json(v: Boolean): String = v.toString
  def json(v: Double): String = { if (v.isNaN || v.isInfinity) throw new ArithmeticException("non-finite double"); v.toString }
  def json(v: String): String = {
    val sb = new StringBuilder("\"")
    for (c <- v) {
      if (c == '"') sb.append("\\\"")
      else if (c == '\\') sb.append("\\\\")
      else if (c < ' ' || c > '~') sb.append("\\u").append("%04x".format(c.toInt))
      else sb.append(c)
    }
    sb.append('"').toString
  }
  def json(v: Array[Int]): String = v.map(x => json(x)).mkString("[", ",", "]")
  def json(v: Array[Long]): String = v.map(x => json(x)).mkString("[", ",", "]")
  def json(v: Array[Boolean]): String = v.map(x => json(x)).mkString("[", ",", "]")
  def json(v: Array[Double]): String = v.map(x => json(x)).mkString("[", ",", "]")
  def json(v: Array[String]): String = v.map(x => json(x)).mkString("[", ",", "]")
  def json(v: Array[Array[Int]]): String = v.map(x => json(x)).mkString("[", ",", "]")
}

// A large Array[Int] / Array[Array[Int]] is passed as text and parsed here: listed element by element it would
// overflow the JVM's 64 KB-per-method limit. See LiteralEmitter::chunkedIntegers().
object AptrunData {
  def ints(parts: String*): Array[Int] = {
    val text = parts.mkString
    if (text.isEmpty) Array[Int]() else text.split(",").map(_.toInt)
  }
  def intMatrix(parts: String*): Array[Array[Int]] =
    parts.mkString.split(";", -1).map(row => if (row.isEmpty) Array[Int]() else ints(row))
}
SCALA;

    /**
     * No JSON in Elixir's standard library, so a small encoder. A string is a binary, an array a list,
     * so the two never get confused. Non-ASCII goes out as \uXXXX (a surrogate pair above the BMP).
     */
    private const ELIXIR_JSON_HELPERS = <<<'ELIXIR'
defmodule AptrunJson do
  def encode(v) when is_integer(v), do: Integer.to_string(v)
  def encode(v) when is_float(v), do: Float.to_string(v)
  def encode(true), do: "true"
  def encode(false), do: "false"
  def encode(v) when is_binary(v), do: "\"" <> escape(v, "") <> "\""
  def encode(v) when is_list(v), do: "[" <> Enum.map_join(v, ",", &encode/1) <> "]"

  defp escape(<<>>, acc), do: acc
  defp escape(<<?", rest::binary>>, acc), do: escape(rest, acc <> "\\\"")
  defp escape(<<?\\, rest::binary>>, acc), do: escape(rest, acc <> "\\\\")
  defp escape(<<c::utf8, rest::binary>>, acc) when c >= 32 and c <= 126, do: escape(rest, acc <> <<c>>)
  defp escape(<<c::utf8, rest::binary>>, acc), do: escape(rest, acc <> unicode(c))

  defp unicode(c) when c > 65535 do
    v = c - 65536
    unicode(55296 + div(v, 1024)) <> unicode(56320 + rem(v, 1024))
  end

  defp unicode(c), do: "\\u" <> String.pad_leading(Integer.to_string(c, 16), 4, "0")
end

# A large [integer] / [[integer]] is passed as text and parsed here: compiling a 100,000-element list literal
# takes longer than a submission may use. See LiteralEmitter::chunkedIntegers().
defmodule AptrunData do
  def ints(parts), do: parts |> Enum.join("") |> to_ints()
  def int_matrix(parts), do: parts |> Enum.join("") |> String.split(";") |> Enum.map(&to_ints/1)

  defp to_ints(""), do: []
  defp to_ints(text), do: text |> String.split(",") |> Enum.map(&String.to_integer/1)
end
ELIXIR;

    /** Erlang: the same job done with pattern matching; a string is a binary, a list is an array. `~p` prints the shortest round-trip float. */
    private const ERLANG_JSON_HELPERS = <<<'ERLANG'
aptrun_case(F) ->
    try io:format("~s~n", [aptrun_json(F())])
    catch _:_ -> io:format("__RUNTIME_ERROR__~n")
    end.

aptrun_json(V) when is_integer(V) -> integer_to_list(V);
aptrun_json(V) when is_float(V) -> lists:flatten(io_lib:format("~p", [V]));
aptrun_json(true) -> "true";
aptrun_json(false) -> "false";
aptrun_json(V) when is_binary(V) -> [$", [aptrun_ch(C) || C <- unicode:characters_to_list(V)], $"];
aptrun_json(V) when is_list(V) ->
    case lists:all(fun erlang:is_integer/1, V) of
        true -> [$[, lists:join($,, lists:map(fun erlang:integer_to_list/1, V)), $]];
        false -> [$[, lists:join($,, lists:map(fun(X) -> aptrun_json(X) end, V)), $]]
    end.

aptrun_ch($") -> "\\\"";
aptrun_ch($\\) -> "\\\\";
aptrun_ch(C) when C >= 32, C =< 126 -> [C];
aptrun_ch(C) when C > 65535 -> W = C - 65536, [aptrun_u(55296 + (W bsr 10)), aptrun_u(56320 + (W band 1023))];
aptrun_ch(C) -> aptrun_u(C).

aptrun_u(C) -> io_lib:format("\\u~4.16.0b", [C]).

% A large [integer] / [[integer]] is passed as text and parsed here: compiling a 100,000-element list literal takes
% longer than a submission may use. See LiteralEmitter::chunkedIntegers(). The per-element work is done by lists:map with
% built-in funs (compiled code) and not by a comprehension: this file is interpreted (see ERLANG_LOADER), and an
% interpreted loop over 300,000 numbers is the difference between 1 s and 7.
aptrun_ints(Parts) ->
    case iolist_to_binary(Parts) of
        <<>> -> [];
        Text -> lists:map(fun erlang:binary_to_integer/1, binary:split(Text, <<",">>, [global]))
    end.

aptrun_int_matrix(Parts) ->
    lists:map(fun(Row) -> aptrun_ints([Row]) end, binary:split(iolist_to_binary(Parts), <<";">>, [global])).
ERLANG;

    /**
     * Compiles the student's module (solution.erl) at run time and loads it. Why a separate module compiled by us,
     * instead of one escript file: escript prints compiler *warnings* to stdout — an unused variable, the most common
     * thing in any Erlang program, would put a line in front of the first test case's output and shift every verdict.
     * `compile:file/2` with `return_errors` prints nothing, so warnings vanish and a real error comes back as data,
     * which becomes the stderr + exit code 3 that CodeExecutionService reports as a compile error (config/piston.php).
     * The shebang line is not decoration: escript discards the first line of the file whatever it says, so a file
     * that began with `main(_) ->` lost it and failed to parse. `-mode(interpret)` keeps escript from *compiling* this
     * file: for a problem with 100,000-value cases it is a megabyte or more of text, and compiling that took 7-14 s
     * (interpreting it 3 s) for what is only a loop and some parsing. Only the harness is interpreted; the student's
     * `solution` module is compiled by compile:file/2 above and runs at full speed. escript still lints the file when
     * interpreting and prints warnings to stdout, so the one it would raise (a helper a given problem does not use) is
     * switched off.
     */
    private const ERLANG_LOADER = <<<'ERLANG'
#!/usr/bin/env escript
-mode(interpret).
-compile(nowarn_unused_function).
main(_) ->
    case compile:file("solution.erl", [binary, return_errors]) of
        {ok, Module, Binary} ->
            {module, Module} = code:load_binary(Module, "solution.erl", Binary),
            aptrun_cases();
        {error, Errors, _Warnings} ->
            aptrun_report(Errors),
            halt(3);
        error ->
            io:format(standard_error, "solution.erl could not be compiled~n", []),
            halt(3)
    end.

aptrun_report(Errors) ->
    lists:foreach(
        fun({File, Infos}) ->
            lists:foreach(
                fun({Line, Mod, Reason}) -> io:format(standard_error, "~s:~p: ~s~n", [File, Line, Mod:format_error(Reason)]) end,
                Infos)
        end,
        Errors).
ERLANG;

    /**
     * One line of stdout per test case is load-bearing: JudgeService lines up printed output
     * with test cases by index. Each case is therefore its own try/catch — a case that throws
     * (bad input assumption, deep recursion, division by zero...) prints the sentinel instead of
     * crashing the process, so every later case still gets to run and print its own line.
     */
    private const RUNTIME_ERROR_SENTINEL = '__RUNTIME_ERROR__';

    public function __construct(private readonly LiteralEmitter $literals) {}

    public function generate(Problem $problem, string $language, Collection $testCases): string
    {
        return match ($language) {
            'javascript' => $this->generateJs($problem, $testCases),
            'python' => $this->generatePython($problem, $testCases),
            'java' => $this->generateJava($problem, $testCases),
            'cpp' => $this->generateCpp($problem, $testCases),
            'php' => $this->generatePhp($problem, $testCases),
            'c' => $this->generateC($problem, $testCases),
            'go' => $this->generateGo($problem, $testCases),
            'kotlin' => $this->generateKotlin($problem, $testCases),
            'rust' => $this->generateRust($problem, $testCases),
            'csharp' => $this->generateCsharp($problem, $testCases),
            'typescript' => $this->generateJs($problem, $testCases), // identical: JSON.stringify and the same literals
            'swift' => $this->generateSwift($problem, $testCases),
            'ruby' => $this->generateRuby($problem, $testCases),
            'dart' => $this->generateDart($problem, $testCases),
            'scala' => $this->generateScala($problem, $testCases),
            'elixir' => $this->generateElixir($problem, $testCases),
            'erlang' => $this->generateErlang($problem, $testCases),
            'racket' => $this->generateRacket($problem, $testCases),
            'python2' => $this->generatePython2($problem, $testCases),
            default => throw new InvalidArgumentException("Unsupported language: {$language}"),
        };
    }

    private function generateJs(Problem $problem, Collection $testCases): string
    {
        $lines = [];
        foreach ($testCases as $tc) {
            $args = implode(', ', $this->argLiterals($problem, $tc, 'javascript'));
            $lines[] = 'try { console.log(JSON.stringify('.$problem->function_name."({$args}))); } catch (e) { console.log(\"".self::RUNTIME_ERROR_SENTINEL.'"); }';
        }

        return implode("\n", $lines)."\n";
    }

    private function generatePython(Problem $problem, Collection $testCases): string
    {
        // flush=True on every print: stdout is block-buffered (not line-buffered) when it isn't
        // a TTY, which it never is under Piston. Without it, a case that finishes in milliseconds
        // can still have its output sitting in Python's userspace buffer, unflushed, when a LATER
        // case's infinite loop gets SIGKILLed — losing even cases that genuinely already passed.
        $lines = ['_sol = Solution()'];
        foreach ($testCases as $tc) {
            $args = implode(', ', $this->argLiterals($problem, $tc, 'python'));
            $lines[] = 'try:';
            $lines[] = "    print(json.dumps(_sol.{$problem->function_name}({$args})), flush=True)";
            // BaseException, not Exception: a stack-overflow-deep recursive student solution
            // raises RecursionError (an Exception, caught either way), but this also guards
            // against the rarer case of a student catching/re-raising SystemExit etc.
            $lines[] = 'except BaseException:';
            $lines[] = '    print("'.self::RUNTIME_ERROR_SENTINEL.'", flush=True)';
        }

        return implode("\n", $lines)."\n";
    }

    /**
     * Appended to config/piston.php's `php` prelude to form PHP's entry file; the student's
     * `Solution` class is in the solution.php that prelude requires. `\Throwable` (not
     * `\Exception`) so a TypeError / DivisionByZeroError from student code is a per-case runtime
     * error too. `new Solution()` sits outside any try on purpose: a missing class should end the
     * run with PHP's own "Class Solution not found" message, as Python's `Solution()` does.
     * No flush needed (unlike Python): PHP CLI writes `echo` straight to stdout.
     */
    private function generatePhp(Problem $problem, Collection $testCases): string
    {
        $dims = substr_count($problem->return_type, '[]');

        $lines = [self::PHP_JSON_HELPERS, '', '$_sol = new Solution();'];
        foreach ($testCases as $tc) {
            $args = implode(', ', $this->argLiterals($problem, $tc, 'php'));
            $lines[] = 'try { echo _aptrun_json($_sol->'.$problem->function_name."({$args}), {$dims}), \"\\n\"; } catch (\\Throwable \$e) { echo \"".self::RUNTIME_ERROR_SENTINEL.'\n"; }';
        }

        return implode("\n", $lines)."\n";
    }

    /**
     * Calls the student's function the way the starter code declares it (StarterCodeGenerator::generateC):
     * each array argument becomes a local array plus its length, a matrix adds per-row lengths, and an
     * array/matrix result comes back with its length through `returnSize`/`returnColumnSizes`. C has no
     * way to catch a crash, so a case that segfaults ends the run; the cases before it already printed
     * and were flushed (see C_JSON_HELPERS). Every local is `aptrun_`-prefixed so it can't clash with
     * anything the student's own file declares at file scope.
     */
    private function generateC(Problem $problem, Collection $testCases): string
    {
        $returnType = $problem->return_type;
        $returnScalar = ProblemType::scalarOf($returnType);
        $returnC = ProblemType::C_SCALAR_NAME[$returnScalar];
        $kind = [
            ProblemType::INTEGER => 'int', ProblemType::LONG => 'long', ProblemType::DOUBLE => 'double',
            ProblemType::BOOLEAN => 'bool', ProblemType::STRING => 'string',
        ][$returnScalar];

        $lines = [self::C_JSON_HELPERS, '', 'int main(void) {'];

        foreach ($testCases as $tc) {
            $lines[] = '    {';
            $callArgs = [];

            foreach ($problem->params as $i => $p) {
                $value = $tc->inputs[$p['name']];
                $type = $p['type'];
                $scalar = ProblemType::scalarOf($type);
                $c = ProblemType::C_SCALAR_NAME[$scalar];
                $v = "aptrun_a{$i}";

                if (ProblemType::isMatrix($type)) {
                    $rowNames = [];
                    foreach ($value as $r => $row) {
                        $lines[] = "        {$c} {$v}r{$r}[".max(count($row), 1).'] = '.$this->cBraceList($row, $scalar).';';
                        $rowNames[] = "{$v}r{$r}";
                    }
                    $lines[] = "        {$c}* {$v}[".max(count($rowNames), 1).'] = {'.($rowNames ? implode(',', $rowNames) : 'NULL').'};';
                    $lines[] = "        int {$v}c[".max(count($value), 1).'] = {'.($value ? implode(',', array_map('count', $value)) : '0').'};';
                    array_push($callArgs, $v, (string) count($value), "{$v}c");
                } elseif (ProblemType::isArray($type)) {
                    if ($scalar === ProblemType::STRING) {
                        $elementNames = [];
                        foreach ($value as $j => $item) {
                            $lines[] = "        char {$v}e{$j}[] = ".$this->literals->cString((string) $item).';';
                            $elementNames[] = "{$v}e{$j}";
                        }
                        $lines[] = "        char* {$v}[".max(count($elementNames), 1).'] = {'.($elementNames ? implode(',', $elementNames) : 'NULL').'};';
                    } else {
                        $lines[] = "        {$c} {$v}[".max(count($value), 1).'] = '.$this->cBraceList($value, $scalar).';';
                    }
                    array_push($callArgs, $v, (string) count($value));
                } elseif ($scalar === ProblemType::STRING) {
                    $lines[] = "        char {$v}[] = ".$this->literals->cString((string) $value).';';
                    $callArgs[] = $v;
                } else {
                    $callArgs[] = $this->literals->emit($value, $type, 'c');
                }
            }

            if (ProblemType::isMatrix($returnType)) {
                $lines[] = '        int aptrun_n = 0;';
                $lines[] = '        int* aptrun_cols = NULL;';
                $lines[] = "        {$returnC}** aptrun_r = {$problem->function_name}(".implode(', ', [...$callArgs, '&aptrun_n', '&aptrun_cols']).');';
                $lines[] = '        aptrun_print_int_matrix(aptrun_r, aptrun_n, aptrun_cols);';
            } elseif (ProblemType::isArray($returnType)) {
                $lines[] = '        int aptrun_n = 0;';
                $lines[] = "        {$returnC}* aptrun_r = {$problem->function_name}(".implode(', ', [...$callArgs, '&aptrun_n']).');';
                $lines[] = "        aptrun_print_{$kind}_array(aptrun_r, aptrun_n);";
            } else {
                $lines[] = "        {$returnC} aptrun_r = {$problem->function_name}(".implode(', ', $callArgs).');';
                $lines[] = "        aptrun_print_{$kind}(aptrun_r);";
            }

            $lines[] = '        aptrun_end();';
            $lines[] = '    }';
        }

        $lines[] = '    return 0;';
        $lines[] = '}';

        return implode("\n", $lines)."\n";
    }

    /** `{1,2,3}` for a C array initialiser; an empty list is `{0}` since C has no zero-length array (the length passed is still 0). */
    private function cBraceList(array $values, string $scalar): string
    {
        if ($values === []) {
            return '{0}';
        }

        return '{'.implode(',', array_map(fn ($v) => $this->literals->emit($v, $scalar, 'c'), $values)).'}';
    }

    /** Appended to main.go's prelude (package + imports in config/piston.php); the student's code is the separate solution.go. */
    private function generateGo(Problem $problem, Collection $testCases): string
    {
        $lines = [self::GO_JSON_HELPERS, '', 'func main() {'];
        foreach ($testCases as $tc) {
            $args = implode(', ', $this->argLiterals($problem, $tc, 'go'));
            $lines[] = "\taptrunCase(func() interface{} { return {$problem->function_name}({$args}) })";
        }
        $lines[] = '}';

        return implode("\n", $lines)."\n";
    }

    private function generateKotlin(Problem $problem, Collection $testCases): string
    {
        $lines = [self::KOTLIN_JSON_HELPERS, '', 'fun main() {', '    val sol = Solution()'];
        foreach ($testCases as $tc) {
            $args = implode(', ', $this->argLiterals($problem, $tc, 'kotlin'));
            $lines[] = '    try { println(aptrunJson(sol.'.$problem->function_name."({$args}))) } catch (t: Throwable) { println(\"".self::RUNTIME_ERROR_SENTINEL.'") }';
        }
        $lines[] = '}';

        return implode("\n", $lines)."\n";
    }

    /**
     * catch_unwind turns a panic (index out of bounds, overflow in a debug build, unwrap on None...)
     * into the per-case sentinel; the silenced panic hook keeps its message off stderr, where it would
     * only be noise next to a verdict. Arguments are built inside the closure, so it captures nothing
     * and is trivially UnwindSafe.
     */
    private function generateRust(Problem $problem, Collection $testCases): string
    {
        $function = ProblemType::snakeCase($problem->function_name);

        $lines = [self::RUST_JSON_HELPERS, '', 'fn main() {', '    std::panic::set_hook(Box::new(|_| {}));'];
        foreach ($testCases as $tc) {
            $args = implode(', ', $this->argLiterals($problem, $tc, 'rust'));
            $lines[] = "    match std::panic::catch_unwind(|| Solution::{$function}({$args}).aptrun_json()) { Ok(s) => println!(\"{}\", s), Err(_) => println!(\"".self::RUNTIME_ERROR_SENTINEL.'") }';
        }
        $lines[] = '}';

        return implode("\n", $lines)."\n";
    }

    private function generateCsharp(Problem $problem, Collection $testCases): string
    {
        $method = ProblemType::pascalCase($problem->function_name);

        $lines = [self::CSHARP_JSON_HELPERS, '', 'public static class AptrunMain {', '    public static void Main() {', '        var sol = new Solution();'];
        foreach ($testCases as $tc) {
            $args = implode(', ', $this->argLiterals($problem, $tc, 'csharp'));
            $lines[] = "        try { Console.WriteLine(AptrunJson.ToJson(sol.{$method}({$args}))); } catch (Exception) { Console.WriteLine(\"".self::RUNTIME_ERROR_SENTINEL.'"); }';
        }
        $lines[] = '    }';
        $lines[] = '}';

        return implode("\n", $lines)."\n";
    }

    private function generateSwift(Problem $problem, Collection $testCases): string
    {
        $lines = [self::SWIFT_JSON_HELPERS, '', 'let sol = Solution()'];
        foreach ($testCases as $tc) {
            $args = implode(', ', $this->argLiterals($problem, $tc, 'swift'));
            $lines[] = "aptrunCase { sol.{$problem->function_name}({$args}).aptrunJson() }";
        }

        return implode("\n", $lines)."\n";
    }

    /** Ruby method names are snake_case (see StarterCodeGenerator::generateRuby). `rescue Exception`, not StandardError, so SystemStackError is a per-case error too. */
    private function generateRuby(Problem $problem, Collection $testCases): string
    {
        $function = ProblemType::snakeCase($problem->function_name);

        // $stdout.sync: stdout is block-buffered when it isn't a terminal, so without it a later case that
        // gets killed would take the earlier, already-correct output with it.
        $lines = ["require 'json'", '$stdout.sync = true'];
        foreach ($testCases as $tc) {
            $args = implode(', ', $this->argLiterals($problem, $tc, 'ruby'));
            $lines[] = "begin; puts JSON.generate({$function}({$args})); rescue Exception; puts \"".self::RUNTIME_ERROR_SENTINEL.'"; end';
        }

        return implode("\n", $lines)."\n";
    }

    /**
     * A large List<int> / List<List<int>> is passed as text and parsed here: `dart run` writes a kernel file for the
     * program, and a 100,000-element literal makes it bigger than the sandbox's file-size limit.
     * See LiteralEmitter::chunkedIntegers().
     */
    private const DART_HELPERS = <<<'DART'
List<int> aptrunInts(List<String> parts) {
  final text = parts.join('');
  return text.isEmpty ? <int>[] : text.split(',').map(int.parse).toList();
}

List<List<int>> aptrunIntMatrix(List<String> parts) =>
    parts.join('').split(';').map((row) => aptrunInts([row])).toList();
DART;

    private function generateDart(Problem $problem, Collection $testCases): string
    {
        $lines = [self::DART_HELPERS, '', 'void main() {', '  final sol = Solution();'];
        foreach ($testCases as $tc) {
            $args = implode(', ', $this->argLiterals($problem, $tc, 'dart'));
            $lines[] = '  try { print(jsonEncode(sol.'.$problem->function_name."({$args}))); } catch (e) { print(\"".self::RUNTIME_ERROR_SENTINEL.'"); }';
        }
        $lines[] = '}';

        return implode("\n", $lines)."\n";
    }

    /** `@main` is what Piston's Scala package looks for to build the jar's entry point (it greps the first file for it). */
    private function generateScala(Problem $problem, Collection $testCases): string
    {
        $lines = [self::SCALA_JSON_HELPERS, '', '@main def aptrunMain(): Unit = {', '  def run(f: => String): Unit = println(try f catch { case _: Throwable => "'.self::RUNTIME_ERROR_SENTINEL.'" })'];
        foreach ($testCases as $tc) {
            $args = implode(', ', $this->argLiterals($problem, $tc, 'scala'));
            $lines[] = "  run(AptrunJson.json(Solution.{$problem->function_name}({$args})))";
        }
        $lines[] = '}';

        return implode("\n", $lines)."\n";
    }

    private function generateElixir(Problem $problem, Collection $testCases): string
    {
        $function = ProblemType::snakeCase($problem->function_name);

        $lines = [self::ELIXIR_JSON_HELPERS, '', 'run = fn f ->', '  try do', '    IO.puts(AptrunJson.encode(f.()))', '  rescue', '    _ -> IO.puts("'.self::RUNTIME_ERROR_SENTINEL.'")', '  catch', '    _, _ -> IO.puts("'.self::RUNTIME_ERROR_SENTINEL.'")', '  end', 'end', ''];
        foreach ($testCases as $tc) {
            $args = implode(', ', $this->argLiterals($problem, $tc, 'elixir'));
            $lines[] = "run.(fn -> Solution.{$function}({$args}) end)";
        }

        return implode("\n", $lines)."\n";
    }

    /** An escript (`main/1` is the entry point) that compiles and loads the student's solution.erl, then calls `solution:Function`. */
    private function generateErlang(Problem $problem, Collection $testCases): string
    {
        $function = ProblemType::snakeCase($problem->function_name);

        $lines = [self::ERLANG_LOADER, '', 'aptrun_cases() ->'];
        foreach ($testCases as $tc) {
            $args = implode(', ', $this->argLiterals($problem, $tc, 'erlang'));
            $lines[] = "    aptrun_case(fun() -> solution:{$function}({$args}) end),";
        }
        $lines[] = '    ok.';
        $lines[] = '';
        $lines[] = self::ERLANG_JSON_HELPERS;

        return implode("\n", $lines)."\n";
    }

    private function generateRacket(Problem $problem, Collection $testCases): string
    {
        $function = ProblemType::kebabCase($problem->function_name);

        // aptrun-ints / aptrun-int-matrix: a large list is passed as text and parsed here (see LiteralEmitter::chunkedIntegers()).
        $lines = [
            '(require json)',
            '(define (aptrun-ints . parts)',
            '  (define text (apply string-append parts))',
            '  (if (string=? text "") \'() (map string->number (string-split text "," #:trim? #f))))',
            '(define (aptrun-int-matrix . parts)',
            '  (map (lambda (row) (aptrun-ints row)) (string-split (apply string-append parts) ";" #:trim? #f)))',
            '(define (aptrun-case thunk)',
            '  (with-handlers ([(lambda (e) #t) (lambda (e) (displayln "'.self::RUNTIME_ERROR_SENTINEL.'") (flush-output))])',
            '    (displayln (jsexpr->string (thunk)))',
            '    (flush-output)))',
        ];
        foreach ($testCases as $tc) {
            $args = implode(' ', $this->argLiterals($problem, $tc, 'racket'));
            $lines[] = "(aptrun-case (lambda () ({$function} {$args})))";
        }

        return implode("\n", $lines)."\n";
    }

    /** Python 2: `print(x)` with one argument is the same in both; flush for the reason given in generatePython. */
    private function generatePython2(Problem $problem, Collection $testCases): string
    {
        // aptrun_ints / aptrun_int_matrix: a large list is passed as text and parsed here (see LiteralEmitter::chunkedIntegers()).
        $lines = [
            'def aptrun_ints(*parts):',
            '    text = "".join(parts)',
            '    return [int(x) for x in text.split(",")] if text else []',
            'def aptrun_int_matrix(*parts):',
            '    return [aptrun_ints(row) for row in "".join(parts).split(";")]',
            '_sol = Solution()',
        ];
        foreach ($testCases as $tc) {
            $args = implode(', ', $this->argLiterals($problem, $tc, 'python2'));
            $lines[] = 'try:';
            $lines[] = "    print(json.dumps(_sol.{$problem->function_name}({$args}))); sys.stdout.flush()";
            $lines[] = 'except BaseException:';
            $lines[] = '    print("'.self::RUNTIME_ERROR_SENTINEL.'"); sys.stdout.flush()';
        }

        return implode("\n", $lines)."\n";
    }

    private function generateJava(Problem $problem, Collection $testCases): string
    {
        $lines = ['public class Main {', self::JAVA_JSON_HELPERS, '', '    public static void main(String[] args) {', '        Solution sol = new Solution();'];
        foreach ($testCases as $tc) {
            $args = implode(', ', $this->argLiterals($problem, $tc, 'java'));
            $lines[] = '        try { System.out.println(toJson(sol.'.$problem->function_name."({$args}))); } catch (Throwable t) { System.out.println(\"".self::RUNTIME_ERROR_SENTINEL.'"); }';
        }
        $lines[] = '    }';
        $lines[] = '}';

        return implode("\n", $lines)."\n";
    }

    /**
     * C++ needs one thing Java doesn't: array params are taken by reference
     * in the starter-code signature (`vector<int>& nums`), and a non-const
     * reference can't bind to a temporary — `sol.twoSum({2,7,11,15}, 9)`
     * simply doesn't compile. Each test case gets a braced block declaring
     * a named local for every array argument first, then calls through
     * those — braces give each case its own scope so the reused
     * `__argN` names across cases never collide.
     */
    private function generateCpp(Problem $problem, Collection $testCases): string
    {
        $params = $problem->params;
        $lines = ['int main() {', '    Solution sol;'];

        foreach ($testCases as $tc) {
            $lines[] = '    {';
            $lines[] = '    try {';
            $callArgs = [];

            foreach ($params as $i => $p) {
                $literal = $this->literals->emit($tc->inputs[$p['name']], $p['type'], 'cpp');

                if (ProblemType::isArray($p['type'])) {
                    $varName = "__arg{$i}";
                    $lines[] = '        '.ProblemType::cppTypeName($p['type'])." {$varName} = {$literal};";
                    $callArgs[] = $varName;
                } else {
                    $callArgs[] = $literal;
                }
            }

            $args = implode(', ', $callArgs);
            $lines[] = "        cout << toJson(sol.{$problem->function_name}({$args})) << endl;";
            // catch(...) rather than catch (const std::exception&): also catches a thrown
            // non-exception type. A segfault/UB from unchecked indexing still can't be caught
            // here (it never throws in the first place) — an accepted, documented gap.
            $lines[] = '    } catch (...) { cout << "'.self::RUNTIME_ERROR_SENTINEL.'" << endl; }';
            $lines[] = '    }';
        }

        $lines[] = '    return 0;';
        $lines[] = '}';

        return implode("\n", $lines)."\n";
    }

    /** @return string[] one literal per param, in declared order, for languages with no by-reference concerns. */
    private function argLiterals(Problem $problem, ProblemTestCase $tc, string $language): array
    {
        return array_map(
            fn ($p) => $this->literals->emit($tc->inputs[$p['name']], $p['type'], $language),
            $problem->params
        );
    }
}
