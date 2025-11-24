import type { SimplexTable } from '@/lib/simplex';

interface SimplexTableDisplayProps {
  table: SimplexTable;
  title?: string;
}

export const SimplexTableDisplay = ({
  table,
  title,
}: SimplexTableDisplayProps) => {
  return (
    <div className="space-y-2">
      {title && <h4 className="font-semibold text-sm">{title}</h4>}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th className="border-r p-2 text-left font-semibold bg-muted">
                Базис
              </th>
              {table.varNames.map((varName) => (
                <th
                  key={varName}
                  className="border-r p-2 text-center font-semibold bg-muted min-w-[60px]"
                >
                  {varName}
                </th>
              ))}
              <th className="p-2 text-center font-semibold bg-muted min-w-[60px]">
                RHS
              </th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, idx) => (
              <tr key={idx} className="border-b hover:bg-muted/50">
                <td className="border-r p-2 font-medium">{row.basicVar}</td>
                {row.coefficients.map((coef, coefIdx) => (
                  <td
                    key={coefIdx}
                    className="border-r p-2 text-center font-mono"
                  >
                    {coef.toFixed(4)}
                  </td>
                ))}
                <td className="p-2 text-center font-mono font-semibold">
                  {row.rhs.toFixed(4)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-primary bg-primary/5">
              <td className="border-r p-2 font-semibold">
                {table.isMinimization ? 'min' : 'max'}
              </td>
              {table.objective.map((coef, idx) => (
                <td
                  key={idx}
                  className="border-r p-2 text-center font-mono font-semibold"
                >
                  {coef.toFixed(4)}
                </td>
              ))}
              <td className="p-2"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
