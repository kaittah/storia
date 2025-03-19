import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import confetti from 'canvas-confetti';
import { useGraphContext } from "@/contexts/GraphContext";

const WORKFLOW_STEPS = [
  "Translate",
  "Grammar Edit",
  "Formatting"
] as const;

export function WorkflowPanel() {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { graphData } = useGraphContext();

  const handleStepComplete = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    // Set the appropriate state flags based on the current step
    const stepName = WORKFLOW_STEPS[currentStep];
    
    if (graphData && typeof graphData.streamMessage === 'function') {
      try {
        if (stepName === "Translate") {
          await graphData.streamMessage({ language: true, copyedit: false, format: false });
        } else if (stepName === "Grammar Edit") {
          await graphData.streamMessage({ copyedit: true, language: false, format: false });
        } else if (stepName === "Formatting") {
          await graphData.streamMessage({ format: true, copyedit: false, language: false });
        }
        
        // Mark the step as completed and move to the next step
        setCompletedSteps([...completedSteps, currentStep]);
        setCurrentStep(currentStep + 1);
      } catch (error) {
        console.error(`Error processing ${stepName}:`, error);
      } finally {
        setIsProcessing(false);
      }
    } else {
      console.error("streamMessage is not available in GraphContext:", graphData);
      setIsProcessing(false);
    }
  };

  const triggerConfetti = () => {
    // Create confetti with specific coordinates
    const duration = 3000;
    const end = Date.now() + duration;

    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'];

    (function frame() {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.8 },
        colors: colors
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.8 },
        colors: colors
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  };

  const isComplete = completedSteps.length === WORKFLOW_STEPS.length;

  if (isComplete) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-md min-w-[200px]">
        <Button 
          className="w-full"
          onClick={() => {
            triggerConfetti();
            console.log("Exporting...");
          }}
        >
          Export
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-md min-w-[200px]">
      <ol className="list-decimal list-inside space-y-2">
        {WORKFLOW_STEPS.map((step, index) => (
          <li 
            key={step}
            className={cn(
              "flex items-center justify-between",
              completedSteps.includes(index) && "text-gray-400 line-through",
              currentStep === index && "font-bold",
              currentStep !== index && !completedSteps.includes(index) && "text-gray-500"
            )}
          >
            <span>{step}</span>
            {currentStep === index && (
              <Button
                size="sm"
                variant="ghost"
                className="p-0 h-6 w-6"
                onClick={handleStepComplete}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                ) : (
                  <PlayCircle className="w-5 h-5 text-blue-500 cursor-pointer hover:text-blue-600" />
                )}
              </Button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
} 