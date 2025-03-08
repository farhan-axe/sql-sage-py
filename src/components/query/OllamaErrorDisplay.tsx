
import { FileWarning, AlertCircle } from "lucide-react";
import { Button } from "../ui/button";

interface OllamaErrorDisplayProps {
  showRestart?: boolean;
  onRestart?: () => void;
}

const OllamaErrorDisplay = ({ showRestart = false, onRestart }: OllamaErrorDisplayProps) => {
  const handleOpenOllamaLink = () => {
    // Open Ollama website
    window.open("https://ollama.ai/download", "_blank");
  };
  
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 my-4">
      <div className="flex items-start gap-4">
        <FileWarning className="h-10 w-10 text-amber-500 flex-shrink-0" />
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-amber-800">
            Ollama Connection Required
          </h3>
          <div className="text-amber-700 space-y-2">
            <p>
              SQL Sage requires Ollama to be running to generate SQL queries. Please make sure:
            </p>
            <ol className="list-decimal list-inside ml-4 space-y-1">
              <li>Ollama is installed on your computer</li>
              <li>The Ollama service is running</li>
              <li>The DeepSeek model is installed via <code className="bg-amber-100 px-1 rounded text-amber-900">ollama pull deepseek-r1:8b</code></li>
            </ol>
            <p className="text-sm mt-2">
              DeepSeek is the AI model that powers SQL Sage's query generation. Without it, SQL Sage cannot
              translate your natural language into SQL queries.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button 
              variant="outline" 
              onClick={handleOpenOllamaLink}
              className="border-amber-300 bg-amber-100 hover:bg-amber-200 text-amber-900"
            >
              Download Ollama
            </Button>
            {showRestart && onRestart && (
              <Button onClick={onRestart}>
                Restart Backend
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OllamaErrorDisplay;
