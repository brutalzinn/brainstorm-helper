import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const renderMarkdown = (text: string) => {
    // Simple markdown renderer for basic formatting
    return text
      .split('\n')
      .map((line, index) => {
        // Headers
        if (line.startsWith('# ')) {
          return (
            <h1 key={index} style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '1rem 0 0.5rem 0', color: '#f9fafb' }}>
              {line.substring(2)}
            </h1>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <h2 key={index} style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: '0.75rem 0 0.5rem 0', color: '#f9fafb' }}>
              {line.substring(3)}
            </h2>
          );
        }
        if (line.startsWith('### ')) {
          return (
            <h3 key={index} style={{ fontSize: '1.125rem', fontWeight: 'bold', margin: '0.5rem 0 0.25rem 0', color: '#f9fafb' }}>
              {line.substring(4)}
            </h3>
          );
        }
        
        // Lists
        if (line.startsWith('- ')) {
          return (
            <li key={index} style={{ margin: '0.25rem 0', paddingLeft: '1rem', color: '#d1d5db' }}>
              {line.substring(2)}
            </li>
          );
        }
        if (line.match(/^\d+\. /)) {
          return (
            <li key={index} style={{ margin: '0.25rem 0', paddingLeft: '1rem', color: '#d1d5db' }}>
              {line}
            </li>
          );
        }
        
        // Bold text
        if (line.includes('**')) {
          const parts = line.split('**');
          return (
            <p key={index} style={{ margin: '0.5rem 0', color: '#d1d5db' }}>
              {parts.map((part, i) => 
                i % 2 === 1 ? (
                  <strong key={i} style={{ fontWeight: 'bold', color: '#f9fafb' }}>
                    {part}
                  </strong>
                ) : part
              )}
            </p>
          );
        }
        
        // Italic text
        if (line.includes('*') && !line.includes('**')) {
          const parts = line.split('*');
          return (
            <p key={index} style={{ margin: '0.5rem 0', color: '#d1d5db' }}>
              {parts.map((part, i) => 
                i % 2 === 1 ? (
                  <em key={i} style={{ fontStyle: 'italic', color: '#9ca3af' }}>
                    {part}
                  </em>
                ) : part
              )}
            </p>
          );
        }
        
        // Horizontal rule
        if (line.startsWith('---')) {
          return (
            <hr key={index} style={{ border: 'none', borderTop: '1px solid #374151', margin: '1rem 0' }} />
          );
        }
        
        // Regular paragraphs
        if (line.trim()) {
          return (
            <p key={index} style={{ margin: '0.5rem 0', color: '#d1d5db', lineHeight: '1.5' }}>
              {line}
            </p>
          );
        }
        
        // Empty lines
        return <br key={index} />;
      });
  };

  return (
    <div style={{ 
      fontFamily: 'system-ui, -apple-system, sans-serif',
      lineHeight: '1.6',
      color: '#d1d5db'
    }}>
      {renderMarkdown(content)}
    </div>
  );
};
