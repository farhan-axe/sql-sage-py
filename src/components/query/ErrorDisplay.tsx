
import { AlertCircle } from "lucide-react";

interface ErrorDisplayProps {
  error: string;
}

const ErrorDisplay = ({ error }: ErrorDisplayProps) => {
  if (!error) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-red-700 flex items-center gap-2">
        <AlertCircle size={16} className="text-red-600" />
        Unable to Generate SQL Query
      </h3>
      <div className="bg-red-50 p-4 rounded-lg border border-red-200">
        <p className="text-sm text-red-800">{error}</p>
      </div>
    </div>
  );
};

export default ErrorDisplay;
