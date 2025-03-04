
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface ChartVisualizationProps {
  data: any[];
}

// Define a set of pleasant colors for charts
const CHART_COLORS = [
  "#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088FE", "#00C49F", 
  "#FFBB28", "#FF8042", "#a4de6c", "#d0ed57", "#83a6ed", "#8dd1e1"
];

const ChartVisualization = ({ data }: ChartVisualizationProps) => {
  const [chartType, setChartType] = useState<string>("bar");
  const [xAxisKey, setXAxisKey] = useState<string>("");
  const [yAxisKey, setYAxisKey] = useState<string>("");
  const [showChart, setShowChart] = useState<boolean>(false);

  // Extract available data keys (columns)
  const availableKeys = useMemo(() => {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]);
  }, [data]);

  // Determine the appropriate data keys based on their values
  const getAppropriateDataKeys = useMemo(() => {
    if (!data || data.length === 0) return { numeric: [], categorical: [] };
    
    const numericKeys: string[] = [];
    const categoricalKeys: string[] = [];
    
    // Analyze the first row to find numeric and non-numeric columns
    Object.entries(data[0]).forEach(([key, value]) => {
      if (typeof value === 'number') {
        numericKeys.push(key);
      } else {
        categoricalKeys.push(key);
      }
    });
    
    return { numeric: numericKeys, categorical: categoricalKeys };
  }, [data]);

  // Set default axis keys when data changes
  useMemo(() => {
    if (getAppropriateDataKeys.categorical.length > 0 && getAppropriateDataKeys.numeric.length > 0) {
      setXAxisKey(getAppropriateDataKeys.categorical[0]);
      setYAxisKey(getAppropriateDataKeys.numeric[0]);
    }
  }, [getAppropriateDataKeys]);

  const handleGenerateChart = () => {
    if (xAxisKey && yAxisKey) {
      setShowChart(true);
    }
  };

  // Calculate data for pie chart (aggregating by xAxisKey if needed)
  const getPieChartData = useMemo(() => {
    if (!data || data.length === 0 || !xAxisKey || !yAxisKey) return [];
    
    // Group by xAxisKey and sum yAxisKey values
    const aggregatedData = data.reduce((acc, curr) => {
      const key = curr[xAxisKey];
      if (!acc[key]) {
        acc[key] = { name: key, value: 0 };
      }
      acc[key].value += Number(curr[yAxisKey]) || 0;
      return acc;
    }, {});
    
    return Object.values(aggregatedData);
  }, [data, xAxisKey, yAxisKey]);

  // Check if data is suitable for selected chart
  const isDataSuitable = useMemo(() => {
    if (!data || data.length === 0 || !xAxisKey || !yAxisKey) return false;
    
    // For pie charts, we need numeric values for the yAxisKey
    if (chartType === 'pie' && !getAppropriateDataKeys.numeric.includes(yAxisKey)) {
      return false;
    }
    
    return true;
  }, [data, xAxisKey, yAxisKey, chartType, getAppropriateDataKeys]);

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Chart Visualization</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Chart Type</label>
            <Select value={chartType} onValueChange={setChartType}>
              <SelectTrigger>
                <SelectValue placeholder="Select chart type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Bar Chart</SelectItem>
                <SelectItem value="line">Line Chart</SelectItem>
                <SelectItem value="area">Area Chart</SelectItem>
                <SelectItem value="pie">Pie Chart</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">X-Axis / Category</label>
            <Select value={xAxisKey} onValueChange={setXAxisKey}>
              <SelectTrigger>
                <SelectValue placeholder="Select X-Axis" />
              </SelectTrigger>
              <SelectContent>
                {availableKeys.map((key) => (
                  <SelectItem key={key} value={key}>
                    {key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">Y-Axis / Value</label>
            <Select value={yAxisKey} onValueChange={setYAxisKey}>
              <SelectTrigger>
                <SelectValue placeholder="Select Y-Axis" />
              </SelectTrigger>
              <SelectContent>
                {getAppropriateDataKeys.numeric.map((key) => (
                  <SelectItem key={key} value={key}>
                    {key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <Button 
          onClick={handleGenerateChart} 
          className="w-full mb-4"
          disabled={!xAxisKey || !yAxisKey}
        >
          Generate Chart
        </Button>
        
        {!isDataSuitable && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              The selected data may not be suitable for this chart type. Please select a numeric column for the Y-axis.
            </AlertDescription>
          </Alert>
        )}
        
        {showChart && isDataSuitable && (
          <div className="h-[400px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "bar" && (
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey={xAxisKey} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey={yAxisKey} fill="#8884d8" />
                </BarChart>
              )}
              
              {chartType === "line" && (
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey={xAxisKey} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey={yAxisKey} stroke="#8884d8" activeDot={{ r: 8 }} />
                </LineChart>
              )}
              
              {chartType === "area" && (
                <AreaChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey={xAxisKey} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey={yAxisKey} fill="#8884d8" stroke="#8884d8" />
                </AreaChart>
              )}
              
              {chartType === "pie" && (
                <PieChart>
                  <Pie
                    data={getPieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {getPieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}`, yAxisKey]} />
                  <Legend />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ChartVisualization;
