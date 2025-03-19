"use client";

import { ArtifactRenderer } from "@/components/artifacts/ArtifactRenderer";
import { useGraphContext } from "@/contexts/GraphContext";
import { useToast } from "@/hooks/use-toast";
import { getLanguageTemplate } from "@/lib/get_language_template";
import {
  ArtifactCodeV3,
  ArtifactMarkdownV3,
  ArtifactV3,
  ArtifactV4,
  ArticleContent,
  ArtifactMarkdownV4,
} from "@storia/shared/types";
import React, { useEffect, useState } from "react";
import { Thread } from "@langchain/langgraph-sdk";
import { WandSparkles } from "lucide-react";
import { TooltipIconButton } from "@/components/ui/assistant-ui/tooltip-icon-button";
import { WorkflowPanel } from "@/components/workflow/WorkflowPanel";
import { ApprovalDialog } from "@/components/ApprovalDialog";

export function CanvasComponent() {
  const { graphData } = useGraphContext();
  const { setArtifact, chatStarted, setChatStarted } = graphData;
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(true);
  const [googleDocsUrl, setGoogleDocsUrl] = useState("https://docs.google.com/document/d/1gA3JAGFbKPtZ418m1qQKxaTjhZAg00HYn1tGV2aauys/edit?tab=t.0");
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [isWorkflowOpen, setIsWorkflowOpen] = useState(false);

  const handleGoogleDocsImport = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!googleDocsUrl) {
      toast({ title: "URL Required", description: "Please enter a Google Docs URL", duration: 5000 });
      return;
    }
    
    setIsLoadingDoc(true);
    
    try {
      const response = await fetch("/api/google/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docUrl: googleDocsUrl }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to fetch document: ${errorData.error || response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Received document data:", data);
      
      // First, let's parse the entire document to identify stories and their authors
      const stories: Array<{title: string, author: string, content: string}> = [];
      let currentTitle = '';
      let currentAuthor = '';
      let currentContent: string[] = [];

      // Split by lines to process line by line
      const lines = data.content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('# ')) {
          // This is a new story title
          
          // If we were already processing a story, save it
          if (currentTitle) {
            stories.push({
              title: currentTitle,
              author: currentAuthor || 'Unknown Author',
              content: currentContent.join('\n').trim()
            });
            
            // Reset for the new story
            currentContent = [];
          }
          
          // Set the new title
          currentTitle = line.replace(/^# /, '').trim();
          currentAuthor = ''; // Reset author for the new story
          console.log(`Found story title: "${currentTitle}"`);
          
        } else if (line.startsWith('## ') && currentTitle) {
          // This is an author for the current story
          currentAuthor = line.replace(/^## /, '').trim();
          console.log(`Found author for "${currentTitle}": "${currentAuthor}"`);
          
        } else if (currentTitle) {
          // This is content for the current story
          currentContent.push(line);
        }
      }

      // Don't forget to add the last story if there is one
      if (currentTitle) {
        stories.push({
          title: currentTitle,
          author: currentAuthor || 'Unknown Author',
          content: currentContent.join('\n').trim()
        });
      }

      // Now convert the stories to ArticleContent objects
      const articles: ArticleContent[] = stories.map((story, index) => ({
        index: index + 1,
        type: "text" as const,
        title: story.title,
        author: story.author,
        fullMarkdown: story.content
      }));

      console.log(`Processed ${articles.length} stories from the document`);
      articles.forEach((article, idx) => {
        console.log(`Story ${idx+1}: "${article.title}" by ${article.author} (${article.fullMarkdown.length} chars)`);
      });

      // Create the nested structure
      const artifactContent: ArtifactMarkdownV4 = {
        title: data.title || "Google Doc Import",
        articles
      };
      
      const newArtifact: ArtifactV4 = {
        currentIndex: 1,
        contents: [artifactContent],
      };

      console.log("Created new artifact:", newArtifact);
      
      const { setArtifact, setChatStarted, setUpdateRenderedArtifactRequired } = graphData;
      
      setChatStarted(false);
      setArtifact(undefined); // Clear existing artifact
      
      // Wait for state updates to complete
      setTimeout(() => {
        console.log("Setting new artifact");
        setArtifact(newArtifact as unknown as ArtifactV3);
        
        setTimeout(() => {
          setChatStarted(true);
          setUpdateRenderedArtifactRequired(true);
          
          setTimeout(() => {
            setIsEditing(true);
            
            toast({
              title: "Document Imported",
              description: `Successfully imported "${data.title}" with ${articles.length} articles`,
              duration: 3000,
            });
          }, 100);
        }, 100);
      }, 100);
      
    } catch (error) {
      console.error("Error importing document:", error);
      toast({
        title: "Import Failed",
        description: "Could not import the Google Document",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsLoadingDoc(false);
    }
  };

  const switchSelectedThread = (thread: Thread) => {  
    graphData.switchSelectedThread(thread);
  };

  return (
    <div className="h-screen flex flex-col">
        <div className="w-full bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1 max-w-3xl mx-auto">
            <h2 className="text-sm font-medium text-gray-700">Import Document</h2>
            <form onSubmit={handleGoogleDocsImport} className="flex-1 flex items-center gap-3">
              <input
                id="docsUrl"
                type="text"
                value={googleDocsUrl}
                onChange={(e) => setGoogleDocsUrl(e.target.value)}
                placeholder="Enter Google Docs URL"
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={isLoadingDoc}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 min-w-[120px]"
              >
                {isLoadingDoc ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Importing...
                  </span>
                ) : (
                  "Import Document"
                )}
              </button>
            </form>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          <ArtifactRenderer 
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            chatCollapsed={chatCollapsed}
            setChatCollapsed={setChatCollapsed}
          />
        </div>
        
        {isWorkflowOpen && (
          <div className="fixed bottom-20 right-20 z-50">
            <WorkflowPanel />
          </div>
        )}
        
        <TooltipIconButton
          tooltip="Workflow"
          variant="outline"
          className="fixed bottom-4 right-20 transition-colors w-[48px] h-[48px] p-0 rounded-xl"
          delayDuration={400}
          onClick={() => setIsWorkflowOpen(!isWorkflowOpen)}
        >
          <WandSparkles className="w-[26px] h-[26px] hover:text-gray-900 transition-colors" />
        </TooltipIconButton>
        
        {/* Add approval dialog */}
        {graphData.proposedChanges && (
          <ApprovalDialog
            isOpen={graphData.isApprovalDialogOpen}
            onOpenChange={graphData.setIsApprovalDialogOpen}
            proposedChanges={graphData.proposedChanges}
            onApprove={graphData.approveChanges}
            onReject={graphData.rejectChanges}
          />
        )}
    </div>
  );
}

export const Canvas = React.memo(CanvasComponent);
