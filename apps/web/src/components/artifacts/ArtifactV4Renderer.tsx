import React, { useState } from 'react';
import { ArtifactV4, ArtifactMarkdownV4 } from '@storia/shared/types';
import { ArticleContainer } from './ArticleContainer';
import { Button } from '@/components/ui/button';
import { RotateCcw, RotateCw, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { useGraphContext } from '@/contexts/GraphContext';
import { TooltipIconButton } from '@/components/ui/assistant-ui/tooltip-icon-button';
import { cn } from '@/lib/utils';

interface ArtifactV4RendererProps {
  artifact: ArtifactV4;
}

export const ArtifactV4Renderer: React.FC<ArtifactV4RendererProps> = ({ artifact }) => {
  console.log("ArtifactV4Renderer - received artifact:", artifact);
  const { graphData } = useGraphContext();
  const { setArtifact } = graphData;
  const [isRawView, setIsRawView] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  
  const currentContent = artifact.contents[artifact.currentIndex - 1];
  console.log("Current content:", currentContent);

  if (!currentContent) {
    console.error("No current content found");
    return null;
  }

  const canUndo = artifact.currentIndex > 1;
  const canRedo = artifact.currentIndex < artifact.contents.length;

  const handleUndo = () => {
    if (!canUndo) return;
    setArtifact({
      ...artifact,
      currentIndex: artifact.currentIndex - 1
    });
  };

  const handleRedo = () => {
    if (!canRedo) return;
    setArtifact({
      ...artifact,
      currentIndex: artifact.currentIndex + 1
    });
  };

  const handleCopyText = async () => {
    // Create a string with all article content
    const textToCopy = currentContent.articles
      .map(article => `# ${article.title}\n## ${article.author || 'Unknown'}\n\n${article.fullMarkdown}`)
      .join('\n\n');
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{currentContent.title}</h1>
          <div className="h-1 w-20 bg-blue-500"></div>
        </div>
        
        <div className="flex items-center space-x-2">
          <TooltipIconButton
            tooltip={canUndo ? "Previous version" : "No previous version"}
            variant="outline"
            onClick={handleUndo}
            disabled={!canUndo}
          >
            <RotateCcw className="w-4 h-4" />
          </TooltipIconButton>
          
          <TooltipIconButton
            tooltip={canRedo ? "Next version" : "No next version"}
            variant="outline"
            onClick={handleRedo}
            disabled={!canRedo}
          >
            <RotateCw className="w-4 h-4" />
          </TooltipIconButton>
          
          <TooltipIconButton
            tooltip={`View ${isRawView ? "rendered" : "raw"} text`}
            variant="outline"
            onClick={() => setIsRawView(!isRawView)}
          >
            {isRawView ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </TooltipIconButton>
          
          <TooltipIconButton
            tooltip={isCopied ? "Copied!" : "Copy all text"}
            variant="outline"
            onClick={handleCopyText}
          >
            {isCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </TooltipIconButton>
        </div>
      </div>
      
      <div className="space-y-6">
        {currentContent.articles.map((article) => {
          console.log("Rendering article:", article);
          return (
            <ArticleContainer 
              key={article.index} 
              article={article} 
              isRawView={isRawView}
            />
          );
        })}
      </div>
    </div>
  );
}; 