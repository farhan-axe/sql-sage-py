import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DataDisplayProps {
  data: any[];
  title?: string;
  maxHeight?: string;
}

const DataDisplay = ({ data, title = "Results", maxHeight = "500px" }: DataDisplayProps) => {
  if (!data || !data.length) return null;

  const columns = Object.keys(data[0]);

  const formatCellValue = (value: any) => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "object") {
      if (value instanceof Date || (typeof value.toLocaleDateString === "function")) {
        return value.toLocaleDateString();
      }
      return JSON.stringify(value);
    }
    return String(value);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className={`rounded-md border max-h-[${maxHeight}]`}>
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column} className="capitalize font-semibold">
                    {column.replace(/_/g, ' ')}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((column) => (
                    <TableCell key={column}>
                      {formatCellValue(row[column])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default DataDisplay;
