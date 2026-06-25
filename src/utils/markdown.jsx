import React from 'react';

export function renderMarkdown(text) {
  if (!text) return null;

  // Split text by code blocks ```
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, idx) => {
    if (part.startsWith('```')) {
      // It's a code block
      const match = part.match(/```(\w*)\n([\s\S]*?)```/);
      const language = match ? match[1] : '';
      const codeContent = match ? match[2] : part.slice(3, -3);

      return (
        <pre key={idx} className="code-block-wrapper">
          {language && <div className="code-block-header">{language}</div>}
          <code className="code-block">{codeContent.trim()}</code>
        </pre>
      );
    } else {
      // Standard text: parse inline elements (bold, italic, lists)
      const lines = part.split('\n');
      const elements = [];
      let currentList = [];

      lines.forEach((line, lIdx) => {
        // Unordered list item
        if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
          const content = line.trim().slice(2);
          currentList.push(<li key={`li-${lIdx}`}>{parseInlineMarkdown(content)}</li>);
        } else {
          // If we had a list active, push it first
          if (currentList.length > 0) {
            elements.push(<ul key={`ul-${lIdx}`} className="markdown-list">{currentList}</ul>);
            currentList = [];
          }

          if (line.trim() === '') {
            elements.push(<div key={`br-${lIdx}`} className="markdown-spacer" />);
          } else {
            elements.push(<p key={`p-${lIdx}`} className="markdown-paragraph">{parseInlineMarkdown(line)}</p>);
          }
        }
      });

      if (currentList.length > 0) {
        elements.push(<ul key={`ul-end`} className="markdown-list">{currentList}</ul>);
      }

      return <React.Fragment key={idx}>{elements}</React.Fragment>;
    }
  });
}

function parseInlineMarkdown(text) {
  // Convert **bold** and `code`
  const boldRegex = /\*\*([\s\S]*?)\*\*/g;
  const codeRegex = /`([^`]+)`/g;

  let parts = [{ text, type: 'text' }];

  // Parse `code` first
  let newParts = [];
  parts.forEach(p => {
    if (p.type === 'text') {
      const split = p.text.split(/`([^`]+)`/g);
      split.forEach((str, sIdx) => {
        if (sIdx % 2 === 1) {
          newParts.push({ text: str, type: 'code' });
        } else if (str) {
          newParts.push({ text: str, type: 'text' });
        }
      });
    } else {
      newParts.push(p);
    }
  });
  parts = newParts;

  // Parse **bold**
  newParts = [];
  parts.forEach(p => {
    if (p.type === 'text') {
      const split = p.text.split(/\*\*([\s\S]*?)\*\*/g);
      split.forEach((str, sIdx) => {
        if (sIdx % 2 === 1) {
          newParts.push({ text: str, type: 'bold' });
        } else if (str) {
          newParts.push({ text: str, type: 'text' });
        }
      });
    } else {
      newParts.push(p);
    }
  });
  parts = newParts;

  // Render elements
  return parts.map((part, idx) => {
    if (part.type === 'bold') {
      return <strong key={idx}>{part.text}</strong>;
    } else if (part.type === 'code') {
      return <code key={idx} className="inline-code">{part.text}</code>;
    } else {
      return part.text;
    }
  });
}
