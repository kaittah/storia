import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function POST(request: NextRequest) {
  try {
    const { docUrl } = await request.json();
    
    // Extract document ID from the URL
    const docIdMatch = docUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!docIdMatch || !docIdMatch[1]) {
      return NextResponse.json(
        { error: "Invalid Google Docs URL" },
        { status: 400 }
      );
    }
    
    const docId = docIdMatch[1];
    
    // Initialize Google Docs API with individual credentials
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY,
      },
      scopes: ["https://www.googleapis.com/auth/documents.readonly"],
    });
    
    const docs = google.docs({ version: "v1", auth });
    
    // Fetch document content
    const document = await docs.documents.get({ documentId: docId });
    
    // Extract title and content
    const title = document.data.title || "Untitled Document";
    let content = "";
    
    // Add better debugging
    console.log("Document structure:", JSON.stringify(document.data, null, 2));
    
    // Enhanced document processing
    if (document.data.body?.content) {
      const formattedBlocks = [];
      
      for (const element of document.data.body.content) {
        if (element.paragraph) {
          // Handle paragraph styles
          const paragraphStyle = element.paragraph.paragraphStyle || {};
          let paragraphType = "paragraph";
          
          // Convert Google Docs headings to markdown headings
          if (paragraphStyle.namedStyleType && paragraphStyle.namedStyleType.includes('HEADING')) {
            const headingLevel = parseInt(paragraphStyle.namedStyleType.replace('HEADING_', ''), 10) || 1;
            paragraphType = 'heading';
            
            const headingText = element.paragraph.elements
              ? element.paragraph.elements
                .filter((el: any) => el.textRun && el.textRun.content)
                .map((el: any) => el.textRun.content)
                .join("")
              : "";
              
            // Create properly formatted heading
            if (headingText.trim()) {
              formattedBlocks.push(`${'#'.repeat(headingLevel)} ${headingText.trim()}`);
            }
          } else {
            // Regular paragraph
            const paragraphText = element.paragraph.elements
              ? element.paragraph.elements
                .filter((el: any) => el.textRun && el.textRun.content)
                .map((el: any) => {
                  // Extract formatting if available
                  const textRun = el.textRun;
                  const content = textRun.content;
                  let formattedText = content;
                  
                  // Apply basic text formatting
                  if (textRun.textStyle) {
                    if (textRun.textStyle.bold) formattedText = `**${formattedText}**`;
                    if (textRun.textStyle.italic) formattedText = `*${formattedText}*`;
                    if (textRun.textStyle.underline) formattedText = `__${formattedText}__`;
                  }
                  
                  return formattedText;
                })
                .join("")
              : "";
              
            if (paragraphText.trim()) {
              formattedBlocks.push(paragraphText);
            }
          }
        } else if (element.table) {
          // Handle tables by converting to markdown format
          formattedBlocks.push("<!-- Table detected - converting to markdown format -->");
          // Table processing code would go here
        } else if ('listItem' in element) {
          // Handle list items
          const listItemElement = element as any; // Type assertion for listItem
          const listText = listItemElement.listItem.content
            .filter((content: any) => content.paragraph)
            .map((content: any) => {
              return content.paragraph.elements
                .filter((el: any) => el.textRun && el.textRun.content)
                .map((el: any) => el.textRun.content)
                .join("");
            })
            .join("");
            
          if (listText.trim()) {
            const listType = listItemElement.listItem.listId ? "- " : "1. "; // Simple distinction between bullet and numbered
            formattedBlocks.push(`${listType}${listText.trim()}`);
          }
        }
      }
      
      // Join all formatted blocks with double newlines for markdown
      content = formattedBlocks.join("\n\n");
      
      console.log(`Extracted ${formattedBlocks.length} formatted blocks with total length: ${content.length}`);
    } else {
      console.log("No content found in document body");
      // Fallback to raw text extraction
      content = "No content could be extracted from the document.";
    }
    
    // Return both title and content for debugging
    return NextResponse.json({ 
      title, 
      content,
      contentLength: content.length
    });
  } catch (error) {
    console.error("Error fetching Google Doc:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch document", 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}
