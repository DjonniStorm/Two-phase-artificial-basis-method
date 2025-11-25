import { Label } from '@components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@components/ui/card';
import { useCalculationResult } from '../model/use-calculation-result';
import { SimplexTableDisplay } from './SimplexTableDisplay';

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
    <div className="p-6 space-y-4">
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
            <CardDescription>
              Значение целевой функции:{' '}
              {result.phase1Result.optimalValue.toFixed(6)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.phase1Result.table && (
              <SimplexTableDisplay
                table={result.phase1Result.table}
                title="Финальная симплекс-таблица этапа 1"
              />
            )}
          </CardContent>
        </Card>
      )}

      {result.phase2Result && (
        <Card>
          <CardHeader>
            <CardTitle>Этап 2: Оптимизация исходной целевой функции</CardTitle>
            <CardDescription>
              Значение целевой функции:{' '}
              {result.phase2Result.optimalValue.toFixed(6)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.phase2Result.table && (
              <SimplexTableDisplay
                table={result.phase2Result.table}
                title="Финальная симплекс-таблица этапа 2"
              />
            )}
          </CardContent>
        </Card>
      )}

      {result.uncertainties && (
        <Card>
          <CardHeader>
            <CardTitle>Погрешности результатов</CardTitle>
            <CardDescription>
              Абсолютные погрешности вычисленных значений
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-base font-semibold">
                Погрешности переменных
              </Label>
              {result.solution && Object.keys(result.solution).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(result.solution)
                    .filter(
                      ([varName]) =>
                        !varName.startsWith('s') && !varName.startsWith('e'),
                    )
                    .map(([varName, value]) => {
                      const uncertainty =
                        result.uncertainties?.variables[varName] || 0;
                      return (
                        <div
                          key={varName}
                          className="flex items-center justify-between p-2 bg-muted rounded-md"
                        >
                          <span className="font-medium">{varName}:</span>
                          <div className="text-right">
                            <div className="font-mono">
                              {value.toFixed(4)} ± {uncertainty.toFixed(6)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              относительная:{' '}
                              {Math.abs(value) > 1e-10
                                ? (
                                    (uncertainty / Math.abs(value)) *
                                    100
                                  ).toFixed(4)
                                : 'N/A'}
                              %
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Погрешности не вычислены
                </p>
              )}
            </div>

            {result.optimalValue !== undefined &&
              result.uncertainties.optimalValue !== undefined && (
                <div className="space-y-2 border-t pt-4">
                  <Label className="text-base font-semibold">
                    Погрешность оптимального значения
                  </Label>
                  <div className="p-2 bg-muted rounded-md">
                    <div className="font-mono text-lg">
                      z = {result.optimalValue.toFixed(4)} ±{' '}
                      {result.uncertainties.optimalValue.toFixed(6)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      относительная:{' '}
                      {Math.abs(result.optimalValue) > 1e-10
                        ? (
                            (result.uncertainties.optimalValue /
                              Math.abs(result.optimalValue)) *
                            100
                          ).toFixed(4)
                        : 'N/A'}
                      %
                    </div>
                  </div>
                </div>
              )}

            {result.operations && (
              <div className="space-y-2 border-t pt-4">
                <Label className="text-base font-semibold">
                  Количество операций
                </Label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 bg-muted rounded-md">
                    <div className="font-medium">Сложение</div>
                    <div className="text-muted-foreground">
                      {result.operations.additions}
                    </div>
                  </div>
                  <div className="p-2 bg-muted rounded-md">
                    <div className="font-medium">Вычитание</div>
                    <div className="text-muted-foreground">
                      {result.operations.subtractions}
                    </div>
                  </div>
                  <div className="p-2 bg-muted rounded-md">
                    <div className="font-medium">Умножение</div>
                    <div className="text-muted-foreground">
                      {result.operations.multiplications}
                    </div>
                  </div>
                  <div className="p-2 bg-muted rounded-md">
                    <div className="font-medium">Деление</div>
                    <div className="text-muted-foreground">
                      {result.operations.divisions}
                    </div>
                  </div>
                </div>
                <div className="p-2 bg-primary/10 rounded-md border border-primary/20">
                  <div className="text-sm font-medium">
                    Всего операций:{' '}
                    {result.operations.additions +
                      result.operations.subtractions +
                      result.operations.multiplications +
                      result.operations.divisions}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 border-t pt-4">
              <Label className="text-base font-semibold">
                Используемые формулы
              </Label>
              <div className="space-y-2 text-sm">
                <div className="p-2 bg-muted rounded-md">
                  <div className="font-medium mb-1">
                    Абсолютная погрешность суммы:
                  </div>
                  <div className="text-muted-foreground font-mono">
                    ΔS = Δx₁ + Δx₂ + ... + Δxₙ
                  </div>
                </div>
                <div className="p-2 bg-muted rounded-md">
                  <div className="font-medium mb-1">
                    Абсолютная погрешность произведения:
                  </div>
                  <div className="text-muted-foreground font-mono">
                    ΔP = P · (Δx₁/|x₁| + Δx₂/|x₂| + ... + Δxₙ/|xₙ|)
                  </div>
                </div>
                <div className="p-2 bg-muted rounded-md">
                  <div className="font-medium mb-1">
                    Абсолютная погрешность частного:
                  </div>
                  <div className="text-muted-foreground font-mono">
                    ΔQ = |Q| · (Δx/|x| + Δy/|y|)
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

ResultBlock.displayName = 'ResultBlock';

export { ResultBlock };
