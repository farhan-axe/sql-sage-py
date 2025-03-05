
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
  const [processedData, setProcessedData] = useState<any[]>([]);
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
    const rawData = data.map(item => ({
      [xAxisField]: item[xAxisField],
      [yAxisField]: item[yAxisField]
    }));

    setChartData(rawData);

    // For pie charts, aggregate data by dimension (e.g., country)
    if (chartType === 'pie') {
      const aggregatedData = aggregateDataByDimension(rawData, xAxisField, yAxisField);
      setProcessedData(aggregatedData);
    } else {
      setProcessedData(rawData);
    }

    setIsChartGenerated(true);
  };

  // Aggregate data by dimension (e.g., country)
  const aggregateDataByDimension = (data: any[], dimensionField: string, valueField: string) => {
    const aggregated: Record<string, number> = {};
    let total = 0;

    // Sum values by dimension
    data.forEach(item => {
      const dimension = item[dimensionField];
      const value = Number(item[valueField]) || 0;
      
      if (!aggregated[dimension]) {
        aggregated[dimension] = 0;
      }
      
      aggregated[dimension] += value;
      total += value;
    });

    // Convert to array with percentage
    return Object.entries(aggregated).map(([name, value]) => ({
      name,
      value,
      percentage: ((value / total) * 100).toFixed(1)
    }));
  };

  // Custom pie chart tooltip to show percentage
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border border-gray-200 shadow-sm rounded-md">
          <p className="font-medium">{payload[0].name}</p>
          <p>{`${yAxisField}: ${payload[0].value.toLocaleString()}`}</p>
          <p>{`Percentage: ${payload[0].payload.percentage}%`}</p>
        </div>
      );
    }
    return null;
  };

  // Custom pie chart label that shows percentage
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 25;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill={COLORS[index % COLORS.length]}
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${name} (${(percent * 100).toFixed(1)}%)`}
      </text>
    );
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
              <BarChart data={processedData}>
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
              <LineChart data={processedData}>
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
              <AreaChart data={processedData}>
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
                  data={processedData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label={renderCustomizedLabel}
                >
                  {processedData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
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
