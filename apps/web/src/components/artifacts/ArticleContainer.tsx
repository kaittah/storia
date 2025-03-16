import React, { useState, useEffect } from 'react';
import { ArticleContent } from '@storia/shared/types';
import { TextRenderer } from './TextRenderer';

interface ArticleContainerProps {
  article: ArticleContent;
  isRawView?: boolean;
}

export const ArticleContainer: React.FC<ArticleContainerProps> = ({ article, isRawView = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  
  // Add debugging
  useEffect(() => {
    console.log("ArticleContainer rendering article:", article);
  }, [article]);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="border-b pb-4 mb-4">
        <h2 className="text-2xl font-bold text-gray-800">{article.title}</h2>
        <p className="text-sm text-gray-600 mt-1">By {article.author || 'Unknown Author'}</p>
      </div>
      <div className="prose max-w-none">
        {isRawView ? (
          <pre className="whitespace-pre-wrap font-mono text-sm p-4 bg-gray-50 rounded border border-gray-200 overflow-auto">
            {article.fullMarkdown}
          </pre>
        ) : article.fullMarkdown ? (
          <TextRenderer 
            content={article.fullMarkdown}
            isEditing={isEditing}
            isInputVisible={false}
            isHovering={false}
          />
        ) : (
          <p className="text-gray-500 italic">No content available</p>
        )}
      </div>
    </div>
  );
}; 