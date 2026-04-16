import React from 'react';

function parseInline(text) {
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
  text = text.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
  text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  return text;
}

export default function MarkdownRenderer({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let i = 0;
  let inCodeBlock = false;
  let codeContent = '';
  let codeLanguage = '';

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLanguage = line.trim().slice(3);
        codeContent = '';
      } else {
        elements.push(
          <pre key={`code-${i}`} className="bg-gray-900/80 border border-gray-700 rounded-xl p-4 my-3 overflow-x-auto">
            {codeLanguage && <div className="text-xs text-gray-500 mb-2 font-mono">{codeLanguage}</div>}
            <code className="text-sm text-green-400 font-mono whitespace-pre">{codeContent.trimEnd()}</code>
          </pre>
        );
        inCodeBlock = false;
        codeContent = '';
      }
      i++;
      continue;
    }

    if (inCodeBlock) {
      codeContent += line + '\n';
      i++;
      continue;
    }

    if (line.trim() === '') {
      elements.push(<div key={`space-${i}`} className="h-2" />);
      i++;
      continue;
    }

    if (line.startsWith('#### ')) {
      elements.push(<h4 key={i} className="text-base font-semibold text-primary-300 mt-3 mb-1">{line.slice(5)}</h4>);
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-lg font-semibold text-primary-300 mt-4 mb-2">{line.slice(4)}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-xl font-bold text-primary-200 mt-5 mb-2">{line.slice(3)}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-2xl font-bold text-white mt-6 mb-3">{line.slice(2)}</h1>);
    }
    else if (/^\s*[-*]\s/.test(line)) {
      const indent = line.search(/\S/);
      const text = line.trim().slice(2);
      elements.push(
        <div key={i} className="flex gap-2 my-0.5" style={{ paddingLeft: `${Math.floor(indent / 2) * 16}px` }}>
          <span className="text-primary-400 mt-0.5 shrink-0">•</span>
          <span className="text-gray-300" dangerouslySetInnerHTML={{ __html: parseInline(text) }} />
        </div>
      );
    }
    else if (/^\s*\d+\.\s/.test(line)) {
      const match = line.trim().match(/^(\d+)\.\s(.*)$/);
      if (match) {
        elements.push(
          <div key={i} className="flex gap-2 my-0.5">
            <span className="text-primary-400 font-medium min-w-[1.5rem] shrink-0">{match[1]}.</span>
            <span className="text-gray-300" dangerouslySetInnerHTML={{ __html: parseInline(match[2]) }} />
          </div>
        );
      }
    }
    else if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} className="border-gray-700 my-4" />);
    }
    else {
      elements.push(
        <p key={i} className="text-gray-300 my-1 leading-relaxed" dangerouslySetInnerHTML={{ __html: parseInline(line) }} />
      );
    }

    i++;
  }

  return <div className="markdown-content">{elements}</div>;
}
