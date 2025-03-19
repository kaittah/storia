import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const ScrollArea = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={className} style={{ overflow: 'auto' }}>{children}</div>
);

interface ProposedChanges {
  currentText: string;
  proposedText: string;
  metadata?: Record<string, any>;
}

interface ApprovalDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  proposedChanges: ProposedChanges;
  onApprove: () => void;
  onReject: () => void;
}

export const ApprovalDialog: React.FC<ApprovalDialogProps> = ({
  isOpen,
  onOpenChange,
  proposedChanges,
  onApprove,
  onReject
}) => {
  const operationTitle = proposedChanges.metadata?.operation || 'text';
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Review Proposed Changes</DialogTitle>
          <DialogDescription>
            Please review the proposed {operationTitle} changes below.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <h3 className="font-medium">Current Text</h3>
            <ScrollArea className="h-[300px] rounded-md border p-4 bg-muted">
              <div className="whitespace-pre-wrap">{proposedChanges.currentText}</div>
            </ScrollArea>
          </div>
          
          <div className="space-y-2">
            <h3 className="font-medium">Proposed Changes</h3>
            <ScrollArea className="h-[300px] rounded-md border p-4 bg-muted">
              <div className="whitespace-pre-wrap">{proposedChanges.proposedText}</div>
            </ScrollArea>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="destructive" onClick={onReject}>
            Reject Changes
          </Button>
          <Button onClick={onApprove}>
            Approve Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ApprovalDialog; 