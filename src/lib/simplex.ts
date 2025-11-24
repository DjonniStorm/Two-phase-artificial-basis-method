import type { OperationCount } from './uncertainty';

/**
 * Строка симплекс-таблицы
 */
export type SimplexRow = {
  coefficients: number[];
  rhs: number;
  basicVar: string;
};

/**
 * Симплекс-таблица
 */
export type SimplexTable = {
  rows: SimplexRow[];
  objective: number[];
  varNames: string[];
  isMinimization: boolean;
};

/**
 * Выполнение операции поворота (pivot)
 */
export function pivot(
  table: SimplexTable,
  rowIdx: number,
  colIdx: number,
  operationCount?: OperationCount,
): void {
  const row = table.rows[rowIdx];

  // Убеждаемся, что длина коэффициентов совпадает с количеством переменных
  while (row.coefficients.length < table.varNames.length) {
    row.coefficients.push(0);
  }

  const pivotElement = row.coefficients[colIdx];

  if (Math.abs(pivotElement) < 1e-10) {
    throw new Error('Попытка поворота на нулевом элементе');
  }

  // Нормализуем ведущую строку
  row.coefficients = row.coefficients.map((c) => {
    if (operationCount) operationCount.divisions++;
    return c / pivotElement;
  });
  if (operationCount) operationCount.divisions++;
  row.rhs = row.rhs / pivotElement;
  row.basicVar = table.varNames[colIdx];

  // Обновляем остальные строки
  for (let i = 0; i < table.rows.length; i++) {
    if (i === rowIdx) continue;

    // Убеждаемся, что длина коэффициентов совпадает
    while (table.rows[i].coefficients.length < table.varNames.length) {
      table.rows[i].coefficients.push(0);
    }

    const factor = table.rows[i].coefficients[colIdx];
    table.rows[i].coefficients = table.rows[i].coefficients.map((c, j) => {
      if (operationCount) {
        operationCount.multiplications++;
        operationCount.subtractions++;
      }
      return c - factor * row.coefficients[j];
    });
    if (operationCount) {
      operationCount.multiplications++;
      operationCount.subtractions++;
    }
    table.rows[i].rhs = table.rows[i].rhs - factor * row.rhs;
  }

  // Обновляем целевую функцию
  const factor = table.objective[colIdx];
  if (!isNaN(factor) && isFinite(factor)) {
    table.objective = table.objective.map((c, j) => {
      const rowCoef = row.coefficients[j];
      if (rowCoef === undefined) {
        throw new Error(
          `Недостаточно коэффициентов в строке: j=${j}, длина=${row.coefficients.length}, varNames=${table.varNames.length}`,
        );
      }
      if (operationCount) {
        operationCount.multiplications++;
        operationCount.subtractions++;
      }
      const newCoef = c - factor * rowCoef;
      if (isNaN(newCoef) || !isFinite(newCoef)) {
        throw new Error(
          `NaN или Infinity в целевой функции при обновлении: c=${c}, factor=${factor}, coef=${rowCoef}`,
        );
      }
      return newCoef;
    });
  }
}

/**
 * Симплекс-метод для минимизации или максимизации
 */
export function simplexMethod(
  table: SimplexTable,
  operationCount?: OperationCount,
): {
  solution: Record<string, number>;
  optimalValue: number;
} {
  const maxIterations = 1000;
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    // Определяем входящую переменную
    let enteringCol = -1;
    if (table.isMinimization) {
      // Для минимизации ищем отрицательные коэффициенты
      enteringCol = table.objective.findIndex((c) => c < -1e-10);
    } else {
      // Для максимизации ищем положительные коэффициенты
      enteringCol = table.objective.findIndex((c) => c > 1e-10);
    }

    // Если не найдено, достигнуто оптимальное решение
    if (enteringCol === -1) {
      break;
    }

    // Определяем выходящую переменную (минимальное отношение)
    let minRatio = Infinity;
    let leavingRow = -1;

    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i];
      const pivotElement = row.coefficients[enteringCol];

      if (pivotElement > 1e-10) {
        const ratio = row.rhs / pivotElement;
        if (ratio >= 0 && ratio < minRatio) {
          minRatio = ratio;
          leavingRow = i;
        }
      }
    }

    if (leavingRow === -1) {
      throw new Error('Задача неограничена');
    }

    // Выполняем поворот
    pivot(table, leavingRow, enteringCol, operationCount);
  }

  if (iterations >= maxIterations) {
    throw new Error('Превышено максимальное количество итераций');
  }

  // Формируем решение
  const solution: Record<string, number> = {};
  for (const varName of table.varNames) {
    const row = table.rows.find((r) => r.basicVar === varName);
    solution[varName] = row ? row.rhs : 0;
  }

  // Вычисляем оптимальное значение целевой функции
  let optimalValue = 0;
  for (let i = 0; i < table.varNames.length; i++) {
    const coef = table.objective[i];
    const val = solution[table.varNames[i]];
    if (isNaN(coef) || isNaN(val)) {
      throw new Error(
        `NaN в вычислениях: coef=${coef}, val=${val} для переменной ${table.varNames[i]}`,
      );
    }
    optimalValue += coef * val;
  }

  if (isNaN(optimalValue)) {
    throw new Error('Оптимальное значение равно NaN');
  }

  return { solution, optimalValue };
}
