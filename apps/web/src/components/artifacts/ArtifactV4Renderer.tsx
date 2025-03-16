import React from 'react';
import { ArtifactV4, ArtifactMarkdownV4 } from '@storia/shared/types';
import { ArticleContainer } from './ArticleContainer';

interface ArtifactV4RendererProps {
  artifact: ArtifactV4;
}

export const ArtifactV4Renderer: React.FC<ArtifactV4RendererProps> = ({ artifact }) => {
  console.log("ArtifactV4Renderer - received artifact:", artifact);
  
  const currentContent = artifact.contents[artifact.currentIndex - 1];
  console.log("Current content:", currentContent);

  if (!currentContent) {
    console.error("No current content found");
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{currentContent.title}</h1>
        <div className="h-1 w-20 bg-blue-500"></div>
      </div>
      
      <div className="space-y-6">
        {currentContent.articles.map((article) => {
          console.log("Rendering article:", article);
          return (
            <ArticleContainer key={article.index} article={article} />
          );
        })}
      </div>
    </div>
  );
}; 