"use client";

import SyntaxHighlighter from "react-syntax-highlighter/dist/esm/prism-light";
import vscDarkPlus from "react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import java from "react-syntax-highlighter/dist/esm/languages/prism/java";
import cpp from "react-syntax-highlighter/dist/esm/languages/prism/cpp";
import php from "react-syntax-highlighter/dist/esm/languages/prism/php";
import c from "react-syntax-highlighter/dist/esm/languages/prism/c";
import csharp from "react-syntax-highlighter/dist/esm/languages/prism/csharp";
import go from "react-syntax-highlighter/dist/esm/languages/prism/go";
import kotlin from "react-syntax-highlighter/dist/esm/languages/prism/kotlin";
import rust from "react-syntax-highlighter/dist/esm/languages/prism/rust";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import swift from "react-syntax-highlighter/dist/esm/languages/prism/swift";
import ruby from "react-syntax-highlighter/dist/esm/languages/prism/ruby";
import dart from "react-syntax-highlighter/dist/esm/languages/prism/dart";
import scala from "react-syntax-highlighter/dist/esm/languages/prism/scala";
import elixir from "react-syntax-highlighter/dist/esm/languages/prism/elixir";
import erlang from "react-syntax-highlighter/dist/esm/languages/prism/erlang";
import racket from "react-syntax-highlighter/dist/esm/languages/prism/racket";

SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("java", java);
SyntaxHighlighter.registerLanguage("cpp", cpp);
SyntaxHighlighter.registerLanguage("php", php);
SyntaxHighlighter.registerLanguage("c", c);
SyntaxHighlighter.registerLanguage("csharp", csharp);
SyntaxHighlighter.registerLanguage("go", go);
SyntaxHighlighter.registerLanguage("kotlin", kotlin);
SyntaxHighlighter.registerLanguage("rust", rust);
SyntaxHighlighter.registerLanguage("typescript", typescript);
SyntaxHighlighter.registerLanguage("swift", swift);
SyntaxHighlighter.registerLanguage("ruby", ruby);
SyntaxHighlighter.registerLanguage("dart", dart);
SyntaxHighlighter.registerLanguage("scala", scala);
SyntaxHighlighter.registerLanguage("elixir", elixir);
SyntaxHighlighter.registerLanguage("erlang", erlang);
SyntaxHighlighter.registerLanguage("racket", racket);

export default function HighlightedCode({ language, code }: { language: string; code: string }) {
  return (
    <SyntaxHighlighter
      language={language}
      style={vscDarkPlus}
      customStyle={{
        margin: 0,
        padding: "18px 16px",
        fontSize: "13px",
        lineHeight: 1.6,
        background: "#1e1e1e",
        fontFamily: "var(--font-mono), monospace",
      }}
      showLineNumbers
      wrapLongLines
    >
      {code}
    </SyntaxHighlighter>
  );
}
