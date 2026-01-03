import React from 'react';
import ReactMarkdown from 'react-markdown';

interface StyledMarkdownProps {
  content: string;
}

export const StyledMarkdown: React.FC<StyledMarkdownProps> = ({ content }) => {
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown
        components={{
          // Headers with gradients/colors
          h1: ({node, ...props}) => <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-cyan to-accent-blue mb-4 mt-6 border-b border-border-primary pb-2" {...props} />,
          h2: ({node, ...props}) => <h2 className="text-lg font-bold text-accent-cyan mb-3 mt-5 flex items-center gap-2" {...props} />,
          h3: ({node, ...props}) => <h3 className="text-base font-bold text-text-primary mb-2 mt-4" {...props} />,
          
          // Bold text with accent color
          strong: ({node, ...props}) => <strong className="font-bold text-accent-yellow" {...props} />,
          
          // Lists with custom markers
          ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-1 my-2 text-text-secondary" {...props} />,
          ol: ({node, ...props}) => <ol className="list-decimal pl-5 space-y-1 my-2 text-text-secondary" {...props} />,
          li: ({node, ...props}) => <li className="pl-1" {...props} />,
          
          // Blockquotes for insights
          blockquote: ({node, ...props}) => (
            <blockquote className="border-l-4 border-accent-purple bg-accent-purple/5 pl-4 py-2 my-4 rounded-r italic text-text-secondary" {...props} />
          ),
          
          // Code blocks (if any)
          code: ({node, inline, className, children, ...props}: any) => {
             return inline ? (
               <code className="bg-bg-tertiary px-1 py-0.5 rounded text-accent-pink font-mono text-xs" {...props}>
                 {children}
               </code>
             ) : (
               <pre className="bg-bg-tertiary p-3 rounded-lg overflow-x-auto my-3 text-xs" {...props}>
                 <code>{children}</code>
               </pre>
             );
          },

          // Paragraphs
          p: ({node, ...props}) => <p className="leading-relaxed mb-3 text-text-secondary" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
