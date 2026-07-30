"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";

// Monaco must be dynamically imported (no SSR)
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-slate-900 rounded-lg">
      <span className="text-slate-500 font-mono text-sm animate-pulse">
        Loading editor…
      </span>
    </div>
  ),
});

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  height?: string;
  language?: string;
}

export function CodeEditor({
  value,
  onChange,
  readOnly = false,
  height = "380px",
  language = "python",
}: CodeEditorProps) {
  const editorRef = useRef<unknown>(null);

  return (
    <div className="monaco-wrapper" style={{ height }}>
      <MonacoEditor
        height={height}
        language={language}
        theme="vs-dark"
        value={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={(editor) => {
          editorRef.current = editor;
        }}
        options={{
          readOnly,
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontLigatures: true,
          lineNumbers: "on",
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: "on",
          padding: { top: 16, bottom: 16 },
          smoothScrolling: true,
          cursorBlinking: "smooth",
          renderLineHighlight: "gutter",
          bracketPairColorization: { enabled: true },
          tabSize: 4,
          insertSpaces: true,
          automaticLayout: true,
          scrollbar: {
            vertical: "auto",
            horizontal: "auto",
            verticalScrollbarSize: 6,
            horizontalScrollbarSize: 6,
          },
        }}
      />
    </div>
  );
}
