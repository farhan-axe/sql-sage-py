
import DataDisplay from "../DataDisplay";
import ChartVisualization from "../ChartVisualization";

interface ResultsDisplayProps {
  results: any[] | null;
}

const ResultsDisplay = ({ results }: ResultsDisplayProps) => {
  if (!results) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-gray-700 mb-2">
        Query Results {results.length > 0 && <span className="text-xs text-gray-500">(Limited to 200 rows)</span>}
      </h3>
      <DataDisplay data={results} />
      
      {results.length > 0 && (
        <ChartVisualization data={results} />
      )}
    </div>
  );
};

export default ResultsDisplay;
