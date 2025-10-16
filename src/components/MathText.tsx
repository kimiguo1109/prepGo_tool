'use client';

import React from 'react';
import 'katex/dist/katex.min.css';

// Dynamic import for KaTeX to avoid SSR issues
let katex: any = null;
if (typeof window !== 'undefined') {
  import('katex').then((module) => {
    katex = module.default;
  });
}

interface MathTextProps {
  children: string;
  className?: string;
}

/**
 * Component to render text with LaTeX formulas
 * Formulas should be wrapped in $$ delimiters
 * Example: "The formula is $$x = \\frac{-b}{2a}$$"
 */
export function MathText({ children, className = '' }: MathTextProps) {
  const renderContent = () => {
    if (!children) return null;

    // Split text by $$ delimiters
    const parts = children.split(/(\$\$[^$]+\$\$)/g);
    
    return parts.map((part, index) => {
      // Check if this part is a formula (wrapped in $$...$$)
      if (part.startsWith('$$') && part.endsWith('$$')) {
        const formula = part.slice(2, -2); // Remove $$ delimiters
        
        try {
          // Render with KaTeX if available
          if (katex) {
            const html = katex.renderToString(formula, {
              throwOnError: false,
              displayMode: true,
            });
            return (
              <span
                key={index}
                dangerouslySetInnerHTML={{ __html: html }}
                className="inline-block my-2"
              />
            );
          } else {
            // Fallback: show formula as-is while KaTeX loads
            return (
              <span key={index} className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                {formula}
              </span>
            );
          }
        } catch (error) {
          console.error('KaTeX rendering error:', error);
          // Fallback: show formula as-is on error
          return (
            <span key={index} className="font-mono text-sm bg-red-50 px-2 py-1 rounded">
              {formula}
            </span>
          );
        }
      } else {
        // Regular text
        return <span key={index}>{part}</span>;
      }
    });
  };

  return <div className={className}>{renderContent()}</div>;
}

/**
 * Hook version for inline rendering
 */
export function useMathText(text: string): React.ReactNode {
  return <MathText>{text}</MathText>;
}


