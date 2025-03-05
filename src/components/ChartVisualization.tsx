
import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area, 
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart2, LineChart as LineChartIcon, PieChart as PieChartIcon, Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type ChartVisualizationProps = {
  data: any[];
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1'];

const ChartVisualization: React.FC<ChartVisualizationProps> = ({ data }) => {
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area' | 'pie'>('bar');
  const [xAxisField, setXAxisField] = useState<string>('');
  const [yAxisField, setYAxisField] = useState<string>('');
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [numericFields, setNumericFields] = useState<string[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isChartGenerated, setIsChartGenerated] = useState(false);

  // Detect field types when data changes
  useEffect(() => {
    if (data && data.length > 0) {
      const firstRow = data[0];
      const fields: string[] = [];
      const numerics: string[] = [];

      // Get all field names and identify numeric fields
      Object.entries(firstRow).forEach(([key, value]) => {
        fields.push(key);
        if (typeof value === 'number') {
          numerics.push(key);
        }
      });

      setAvailableFields(fields);
      setNumericFields(numerics);

      // Set defaults
      if (fields.length > 0 && fields[0] !== xAxisField) {
        setXAxisField(fields[0]);
      }
      
      if (numerics.length > 0 && numerics[0] !== yAxisField) {
        setYAxisField(numerics[0]);
      }
    }
  }, [data]);

  const generateChart = () => {
    if (!xAxisField || !yAxisField) return;

    // Create a copy of the data with just the fields we need
    const processedData = data.map(item => ({
      [xAxisField]: item[xAxisField],
      [yAxisField]: item[yAxisField]
    }));

    setChartData(processedData);
    setIsChartGenerated(true);
  };

  const renderChart = () => {
    if (!isChartGenerated || !chartData.length) {
      return (
        <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-md border border-dashed">
          <p className="text-gray-500 mb-2">Configure and generate chart to visualize data</p>
          <Button onClick={generateChart} className="mt-2">
            Generate Chart
          </Button>
        </div>
      );
    }

    const renderChartContent = () => {
      switch (chartType) {
        case 'bar':
          return (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={xAxisField} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey={yAxisField} fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          );
        case 'line':
          return (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={xAxisField} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey={yAxisField} stroke="#8884d8" />
              </LineChart>
            </ResponsiveContainer>
          );
        case 'area':
          return (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={xAxisField} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey={yAxisField} fill="#8884d8" stroke="#8884d8" />
              </AreaChart>
            </ResponsiveContainer>
          );
        case 'pie':
          return (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey={yAxisField}
                  nameKey={xAxisField}
                  label={(entry) => entry[xAxisField]}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          );
        default:
          return null;
      }
    };

    return renderChartContent();
  };

  const chartTypeIcons = {
    bar: <BarChart2 size={16} />,
    line: <LineChartIcon size={16} />,
    area: <Activity size={16} />,
    pie: <PieChartIcon size={16} />
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          Data Visualization
        </CardTitle>
        <CardDescription>
          Visualize your query results in different chart formats
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Chart Type</label>
            <Select
              value={chartType}
              onValueChange={(value) => setChartType(value as any)}
            >
              <SelectTrigger>
                <SelectValue>
                  <div className="flex items-center gap-2">
                    {chartTypeIcons[chartType]}
                    <span>{chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">
                  <div className="flex items-center gap-2">
                    <BarChart2 size={16} />
                    <span>Bar Chart</span>
                  </div>
                </SelectItem>
                <SelectItem value="line">
                  <div className="flex items-center gap-2">
                    <LineChartIcon size={16} />
                    <span>Line Chart</span>
                  </div>
                </SelectItem>
                <SelectItem value="area">
                  <div className="flex items-center gap-2">
                    <Activity size={16} />
                    <span>Area Chart</span>
                  </div>
                </SelectItem>
                <SelectItem value="pie">
                  <div className="flex items-center gap-2">
                    <PieChartIcon size={16} />
                    <span>Pie Chart</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">X-Axis Field</label>
            <Select
              value={xAxisField}
              onValueChange={setXAxisField}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select field" />
              </SelectTrigger>
              <SelectContent>
                {availableFields.map((field) => (
                  <SelectItem key={field} value={field}>
                    {field}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Y-Axis Field (Value)</label>
            <Select
              value={yAxisField}
              onValueChange={setYAxisField}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select field" />
              </SelectTrigger>
              <SelectContent>
                {numericFields.map((field) => (
                  <SelectItem key={field} value={field}>
                    {field}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-end">
            <Button onClick={generateChart} className="w-full">
              <ArrowRight size={16} className="mr-2" />
              Generate Chart
            </Button>
          </div>
        </div>
        
        {renderChart()}
      </CardContent>
    </Card>
  );
};

export default ChartVisualization;
