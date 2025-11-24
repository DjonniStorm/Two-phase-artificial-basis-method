import { Label } from '@components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@components/ui/card';
import { useCalculationResult } from '../model/use-calculation-result';

const ResultBlock = () => {
  const { linearSystem, isCalculated, result } = useCalculationResult();

  if (!linearSystem) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-muted-foreground">Введите систему уравнений</p>
      </div>
    );
  }

  if (!isCalculated || !result) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-muted-foreground">
          Нажмите "Подтвердить" для вычисления
        </p>
      </div>
    );
  }

  if (!result.success) {
    return (
      <div className="p-6 space-y-4">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">
              Ошибка вычисления
            </CardTitle>
            <CardDescription>
              {result.error || 'Неизвестная ошибка'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 overflow-auto">
      <div className="space-y-2">
        <Label className="text-2xl font-bold">Результат вычисления</Label>
        <p className="text-sm text-muted-foreground">
          Решение задачи линейного программирования методом искусственного
          базиса
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Оптимальное решение</CardTitle>
          <CardDescription>Значения переменных</CardDescription>
        </CardHeader>
        <CardContent>
          {result.solution && Object.keys(result.solution).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(result.solution)
                .filter(
                  ([varName]) =>
                    !varName.startsWith('s') && !varName.startsWith('e'),
                )
                .map(([varName, value]) => (
                  <div
                    key={varName}
                    className="flex items-center justify-between p-2 bg-muted rounded-md"
                  >
                    <span className="font-medium">{varName}:</span>
                    <span className="font-mono">{value.toFixed(4)}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Решение не найдено</p>
          )}
        </CardContent>
      </Card>

      {result.optimalValue !== undefined && (
        <Card>
          <CardHeader>
            <CardTitle>Оптимальное значение целевой функции</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              z = {result.optimalValue.toFixed(4)}
            </div>
          </CardContent>
        </Card>
      )}

      {result.phase1Result && (
        <Card>
          <CardHeader>
            <CardTitle>
              Этап 1: Минимизация суммы искусственных переменных
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Значение: {result.phase1Result.optimalValue.toFixed(6)}
            </p>
          </CardContent>
        </Card>
      )}

      {result.phase2Result && (
        <Card>
          <CardHeader>
            <CardTitle>Этап 2: Оптимизация исходной целевой функции</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Значение: {result.phase2Result.optimalValue.toFixed(6)}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

ResultBlock.displayName = 'ResultBlock';

export { ResultBlock };
