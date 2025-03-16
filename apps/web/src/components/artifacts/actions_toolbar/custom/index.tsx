import {
  CirclePlus,
  WandSparkles,
  Trash2,
  LoaderCircle,
  Pencil,
} from "lucide-react";
import { TooltipIconButton } from "@/components/ui/assistant-ui/tooltip-icon-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CustomQuickAction } from "@storia/shared/types";
import { NewCustomQuickActionDialog } from "./NewCustomQuickActionDialog";
import { useEffect, useState } from "react";
import { useStore } from "@/hooks/useStore";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { TighterText } from "@/components/ui/header";
import { GraphInput } from "@storia/shared/types";
import { User } from "@supabase/supabase-js";
import { WorkflowPanel } from "@/components/workflow/WorkflowPanel";


export interface CustomQuickActionsProps {
  isTextSelected: boolean;
  assistantId: string | undefined;
  user: User | undefined;
  streamMessage: (params: GraphInput) => Promise<void>;
}

const DropdownMenuItemWithDelete = ({
  disabled,
  title,
  onDelete,
  onEdit,
  onClick,
}: {
  disabled: boolean;
  title: string;
  onDelete: () => Promise<void>;
  onEdit: () => void;
  onClick: () => Promise<void>;
}) => {
  const [isHovering, setIsHovering] = useState(false);

  return (
    <div
      className="flex flex-row gap-0 items-center justify-between w-full"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <DropdownMenuItem
        disabled={disabled}
        onSelect={onClick}
        className="w-full truncate"
      >
        {title}
      </DropdownMenuItem>
      <TooltipIconButton
        disabled={disabled}
        tooltip="Edit action"
        variant="ghost"
        onClick={onEdit}
        className={cn("ml-1", isHovering ? "visible" : "invisible")}
      >
        <Pencil className="text-[#575757] hover:text-black transition-colors ease-in" />
      </TooltipIconButton>
      <TooltipIconButton
        disabled={disabled}
        tooltip="Delete action"
        variant="ghost"
        onClick={onDelete}
        className={cn(isHovering ? "visible" : "invisible")}
      >
        <Trash2 className="text-[#575757] hover:text-red-500 transition-colors ease-in" />
      </TooltipIconButton>
    </div>
  );
};

export function CustomQuickActions(props: CustomQuickActionsProps) {
  const { user, assistantId, streamMessage } = props;
  const {
    getCustomQuickActions,
    deleteCustomQuickAction,
    isLoadingQuickActions,
  } = useStore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingId, setIsEditingId] = useState<string>();
  const [customQuickActions, setCustomQuickActions] =
    useState<CustomQuickAction[]>();
  const [isWorkflowOpen, setIsWorkflowOpen] = useState(false);

  const getAndSetCustomQuickActions = async (userId: string) => {
    const actions = await getCustomQuickActions(userId);
    setCustomQuickActions(actions);
  };

  useEffect(() => {
    if (typeof window === undefined || !assistantId || !user) return;
    getAndSetCustomQuickActions(user.id);
  }, [assistantId, user]);

  return (
    <>
      {isWorkflowOpen && (
        <div className="fixed bottom-20 right-20 z-50">
          <WorkflowPanel />
        </div>
      )}
      <DropdownMenu
        open={open}
        onOpenChange={(o) => {
          if (props.isTextSelected) return;
          setOpen(o);
        }}
      >
        <DropdownMenuTrigger className="fixed bottom-4 right-20" asChild>
          <TooltipIconButton
            tooltip={
              "Workflow"
            }
            variant="outline"
            className={cn(
              "transition-colors w-[48px] h-[48px] p-0 rounded-xl",
              props.isTextSelected
                ? "cursor-default opacity-50 text-gray-400 hover:bg-background"
                : "cursor-pointer"
            )}
            delayDuration={400}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsWorkflowOpen(!isWorkflowOpen);
              return false; // Prevent dropdown from opening
            }}
          >
            <WandSparkles
              className={cn(
                "w-[26px] h-[26px]",
                props.isTextSelected
                  ? "text-gray-400"
                  : "hover:text-gray-900 transition-colors"
              )}
            />
          </TooltipIconButton>
        </DropdownMenuTrigger>
        
      </DropdownMenu>
    </>
  );
}
