import type { LinearSystem } from '@/types';

/**
 * Результат вычисления двухэтапного метода искусственного базиса
 */
export type CalculationResult = {
  success: boolean;
  solution?: Record<string, number>;
  optimalValue?: number;
  error?: string;
  phase1Result?: {
    solution: Record<string, number>;
    optimalValue: number;
  };
  phase2Result?: {
    solution: Record<string, number>;
    optimalValue: number;
  };
};

/**
 * Парсинг уравнения вида "3x + 2y <= 5" или "x - y >= 10"
 * Поддерживает операторы: <=, >=, =, <, >
 */
function parseEquation(
  expression: string,
  varNames: string[],
): {
  coefficients: number[];
  rhs: number;
  type: '<=' | '>=' | '=' | '<' | '>';
} {
  // Убираем все пробелы для упрощения парсинга
  const expr = expression.replace(/\s+/g, '');

  // Ищем оператор сравнения
  const operatorMatch = expr.match(/(.+?)(<=|>=|[<>=])(.+)/);
  if (!operatorMatch) {
    throw new Error(`Не удалось распарсить уравнение: ${expression}`);
  }

  const lhs = operatorMatch[1];
  const operator = operatorMatch[2] as '<=' | '>=' | '=' | '<' | '>';
  const rhsStr = operatorMatch[3];

  // Парсим правую часть
  const rhs = parseFloat(rhsStr);
  if (isNaN(rhs)) {
    throw new Error(`Неверная правая часть в уравнении: ${expression}`);
  }

  // Нормализуем оператор (< и > преобразуем в <= и >=)
  let normalizedType: '<=' | '>=' | '=';
  if (operator === '<') {
    normalizedType = '<=';
  } else if (operator === '>') {
    normalizedType = '>=';
  } else {
    normalizedType = operator;
  }

  // Парсим коэффициенты для каждой переменной
  const coefficients = varNames.map((varName) => {
    // Ищем паттерн вида: [+-]число*переменная или просто переменная
    const regex = new RegExp(
      `([+-]?)(\\d*\\.?\\d*)${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
      'g',
    );
    const matches = [...lhs.matchAll(regex)];

    if (matches.length === 0) {
      return 0;
    }

    // Берем последнее вхождение (на случай если переменная встречается несколько раз)
    const match = matches[matches.length - 1];
    const sign = match[1] === '-' ? -1 : 1;
    const numberStr = match[2];

    if (numberStr === '' || numberStr === undefined) {
      return sign * 1; // Коэффициент 1
    }

    const number = parseFloat(numberStr);
    if (isNaN(number)) {
      return 0;
    }

    return sign * number;
  });

  return { coefficients, rhs, type: normalizedType };
}

/**
 * Парсинг целевой функции вида "2x + 3y", "x - 2y" или "z=3x1 + 2x2"
 */
function parseObjective(expression: string, varNames: string[]): number[] {
  // Убираем все пробелы
  let expr = expression.replace(/\s+/g, '');

  // Если есть "z=" в начале, удаляем его
  if (/^z\s*=/i.test(expr)) {
    expr = expr.replace(/^z\s*=/i, '');
  }

  // Парсим коэффициенты для каждой переменной
  const coefficients = varNames.map((varName) => {
    // Ищем паттерн вида: [+-]число*переменная или просто переменная
    const regex = new RegExp(
      `([+-]?)(\\d*\\.?\\d*)${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
      'g',
    );
    const matches = [...expr.matchAll(regex)];

    if (matches.length === 0) {
      return 0;
    }

    // Суммируем все вхождения переменной
    let sum = 0;
    for (const match of matches) {
      const sign = match[1] === '-' ? -1 : 1;
      const numberStr = match[2];

      if (numberStr === '' || numberStr === undefined) {
        sum += sign * 1;
      } else {
        const number = parseFloat(numberStr);
        if (!isNaN(number)) {
          sum += sign * number;
        }
      }
    }

    return sum;
  });

  return coefficients;
}

/**
 * Строка симплекс-таблицы
 */
type SimplexRow = {
  coefficients: number[];
  rhs: number;
  basicVar: string;
};

/**
 * Симплекс-таблица
 */
type SimplexTable = {
  rows: SimplexRow[];
  objective: number[];
  varNames: string[];
  isMinimization: boolean;
};

/**
 * Выполнение операции поворота (pivot)
 */
function pivot(table: SimplexTable, rowIdx: number, colIdx: number): void {
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
  row.coefficients = row.coefficients.map((c) => c / pivotElement);
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
    table.rows[i].coefficients = table.rows[i].coefficients.map(
      (c, j) => c - factor * row.coefficients[j],
    );
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
function simplexMethod(table: SimplexTable): {
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
    pivot(table, leavingRow, enteringCol);
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

/**
 * Двухэтапный метод искусственного базиса
 */
export function calculateTwoPhaseMethod(
  system: LinearSystem,
): CalculationResult {
  try {
    // Проверка наличия уравнений
    if (!system.equations || system.equations.length === 0) {
      return {
        success: false,
        error: 'Система уравнений пуста',
      };
    }

    // Проверка валидности уравнений
    const invalidEquations = system.equations.filter((eq) => !eq.isValid);
    if (invalidEquations.length > 0) {
      return {
        success: false,
        error: 'Некоторые уравнения невалидны',
      };
    }

    // Извлекаем все переменные из уравнений (поддерживаем x1, x2, y, z123 и т.д.)
    const varNamesSet = new Set<string>();
    system.equations.forEach((eq) => {
      const matches = eq.expression.match(/[a-zA-Zа-яА-Я]\d*/g);
      if (matches) {
        matches.forEach((v) => varNamesSet.add(v));
      }
    });

    if (system.objective?.expression) {
      const objMatches =
        system.objective.expression.match(/[a-zA-Zа-яА-Я]\d*/g);
      if (objMatches) {
        objMatches.forEach((v) => varNamesSet.add(v));
      }
    }

    const varNames = Array.from(varNamesSet).sort();
    if (varNames.length === 0) {
      return {
        success: false,
        error: 'Не найдено переменных в системе',
      };
    }

    // Парсим уравнения
    const parsedEquations = system.equations.map((eq) =>
      parseEquation(eq.expression, varNames),
    );

    // ========== ЭТАП 1: Минимизация суммы искусственных переменных ==========

    let slackCount = 0;
    let surplusCount = 0;
    let artificialCount = 0;

    const phase1VarNames = [...varNames];
    const phase1Rows: SimplexRow[] = [];

    // Обрабатываем каждое уравнение
    parsedEquations.forEach((parsed) => {
      let coefficients = [...parsed.coefficients];
      let rhs = parsed.rhs;
      let type = parsed.type;

      // Если правая часть отрицательная, умножаем на -1 и меняем тип неравенства
      if (rhs < 0) {
        coefficients = coefficients.map((c) => -c);
        rhs = -rhs;
        if (type === '<=') {
          type = '>=';
        } else if (type === '>=') {
          type = '<=';
        }
        // Для равенства просто меняем знаки
      }

      const row: SimplexRow = {
        coefficients,
        rhs,
        basicVar: '',
      };

      if (type === '<=') {
        // Добавляем slack переменную
        slackCount++;
        const slackVar = `s${slackCount}`;
        phase1VarNames.push(slackVar);
        // Дополняем нулями до текущей длины
        while (row.coefficients.length < phase1VarNames.length - 1) {
          row.coefficients.push(0);
        }
        row.coefficients.push(1);
        row.basicVar = slackVar;
      } else if (parsed.type === '>=') {
        // Добавляем surplus и искусственную переменную
        surplusCount++;
        artificialCount++;
        const surplusVar = `e${surplusCount}`;
        const artificialVar = `a${artificialCount}`;
        phase1VarNames.push(surplusVar, artificialVar);
        // Дополняем нулями до текущей длины
        while (row.coefficients.length < phase1VarNames.length - 2) {
          row.coefficients.push(0);
        }
        row.coefficients.push(-1, 1); // surplus с -1, искусственная с +1
        row.basicVar = artificialVar;
      } else if (parsed.type === '=') {
        // Добавляем только искусственную переменную
        artificialCount++;
        const artificialVar = `a${artificialCount}`;
        phase1VarNames.push(artificialVar);
        // Дополняем нулями до текущей длины
        while (row.coefficients.length < phase1VarNames.length - 1) {
          row.coefficients.push(0);
        }
        row.coefficients.push(1);
        row.basicVar = artificialVar;
      }

      // Убеждаемся, что длина коэффициентов совпадает с количеством переменных
      while (row.coefficients.length < phase1VarNames.length) {
        row.coefficients.push(0);
      }

      phase1Rows.push(row);
    });

    // Целевая функция этапа 1: минимизация суммы искусственных переменных
    let phase1Objective: number[] = phase1VarNames.map((v) => {
      const val = v.startsWith('a') ? 1 : 0;
      if (isNaN(val) || !isFinite(val)) {
        throw new Error(
          `NaN в создании целевой функции этапа 1 для переменной ${v}`,
        );
      }
      return val;
    });

    // Обновляем целевую функцию, чтобы коэффициенты при базисных переменных (искусственных) стали нулевыми
    for (const row of phase1Rows) {
      if (row.basicVar.startsWith('a')) {
        const basicVarIdx = phase1VarNames.indexOf(row.basicVar);
        if (
          basicVarIdx !== -1 &&
          Math.abs(phase1Objective[basicVarIdx]) > 1e-10
        ) {
          // Убеждаемся, что длина коэффициентов строки совпадает
          while (row.coefficients.length < phase1VarNames.length) {
            row.coefficients.push(0);
          }

          const coef = phase1Objective[basicVarIdx];
          phase1Objective = phase1Objective.map((c, idx) => {
            const rowCoef = row.coefficients[idx] || 0;
            const newCoef = c - coef * rowCoef;
            if (isNaN(newCoef) || !isFinite(newCoef)) {
              throw new Error(
                `NaN в обновлении целевой функции этапа 1: c=${c}, coef=${coef}, rowCoef=${rowCoef}`,
              );
            }
            return newCoef;
          });
        }
      }
    }

    const phase1Table: SimplexTable = {
      rows: phase1Rows,
      objective: phase1Objective,
      varNames: phase1VarNames,
      isMinimization: true,
    };

    // Выполняем этап 1
    const phase1Result = simplexMethod(phase1Table);

    // Проверяем, что все искусственные переменные равны нулю
    // Искусственные переменные должны быть либо не в базисе (значение 0), либо в базисе со значением 0
    const artificialVars = phase1VarNames.filter((v) => v.startsWith('a'));
    let hasNonZeroArtificial = false;

    for (const artificialVar of artificialVars) {
      const value = phase1Result.solution[artificialVar] || 0;
      if (Math.abs(value) > 1e-6) {
        hasNonZeroArtificial = true;
        break;
      }
    }

    if (hasNonZeroArtificial) {
      return {
        success: false,
        error: 'Задача не имеет допустимого решения',
        phase1Result,
      };
    }

    // Удаляем искусственные переменные из таблицы для этапа 2
    // Используем строки из обновленной таблицы после этапа 1
    const phase2VarNames = phase1VarNames.filter((v) => !v.startsWith('a'));
    const phase2Rows: SimplexRow[] = [];

    // Создаем маппинг индексов переменных
    const varIndexMap = new Map<number, number>();
    let phase2Idx = 0;
    for (let i = 0; i < phase1VarNames.length; i++) {
      if (!phase1VarNames[i].startsWith('a')) {
        varIndexMap.set(i, phase2Idx++);
      }
    }

    // Используем строки из обновленной таблицы после этапа 1
    for (const row of phase1Table.rows) {
      // Пропускаем строки с искусственными переменными в базисе
      if (row.basicVar.startsWith('a')) {
        // Если искусственная переменная в базисе и равна нулю, можно попробовать использовать строку
        if (Math.abs(row.rhs) < 1e-10) {
          // Ищем первую неискусственную переменную с ненулевым коэффициентом для замены
          let replacementVar: string | null = null;
          let replacementIdx = -1;

          for (let i = 0; i < phase1VarNames.length; i++) {
            const varName = phase1VarNames[i];
            if (
              !varName.startsWith('a') &&
              Math.abs(row.coefficients[i]) > 1e-10
            ) {
              // Проверяем, что эта переменная еще не в базисе
              const alreadyInBasis = phase2Rows.some(
                (r) => r.basicVar === varName,
              );
              if (!alreadyInBasis) {
                replacementVar = varName;
                replacementIdx = i;
                break;
              }
            }
          }

          if (replacementVar && replacementIdx !== -1) {
            // Нормализуем строку по найденной переменной
            const pivotElement = row.coefficients[replacementIdx];
            const newCoefficients = new Array(phase2VarNames.length).fill(0);

            for (let i = 0; i < phase1VarNames.length; i++) {
              if (!phase1VarNames[i].startsWith('a')) {
                const phase2Idx = varIndexMap.get(i)!;
                newCoefficients[phase2Idx] = row.coefficients[i] / pivotElement;
              }
            }

            phase2Rows.push({
              coefficients: newCoefficients,
              rhs: row.rhs / pivotElement,
              basicVar: replacementVar,
            });
          }
        }
        // Если не удалось заменить, просто пропускаем эту строку
        continue;
      }

      // Обычная строка - удаляем коэффициенты искусственных переменных
      const newCoefficients = new Array(phase2VarNames.length).fill(0);
      for (let i = 0; i < phase1VarNames.length; i++) {
        if (!phase1VarNames[i].startsWith('a')) {
          const phase2Idx = varIndexMap.get(i)!;
          newCoefficients[phase2Idx] = row.coefficients[i];
        }
      }

      phase2Rows.push({
        coefficients: newCoefficients,
        rhs: row.rhs,
        basicVar: row.basicVar,
      });
    }

    // ========== ЭТАП 2: Оптимизация исходной целевой функции ==========

    let phase2Objective: number[];

    if (system.objective?.expression) {
      // Парсим исходную целевую функцию для исходных переменных
      const objCoefficients = parseObjective(
        system.objective.expression,
        varNames,
      );

      // Создаем целевую функцию для всех переменных этапа 2 (исходные + slack/surplus)
      phase2Objective = phase2VarNames.map((v) => {
        const varIdx = varNames.indexOf(v);
        if (varIdx !== -1) {
          return objCoefficients[varIdx];
        }
        return 0; // Для slack/surplus переменных коэффициент 0
      });

      // Преобразуем для минимизации (если нужно максимизировать, меняем знаки)
      if (system.objective.type === 'maximize') {
        phase2Objective = phase2Objective.map((c) => -c);
      }
    } else {
      // Если целевая функция не задана, минимизируем сумму исходных переменных
      phase2Objective = phase2VarNames.map((v) =>
        varNames.includes(v) ? 1 : 0,
      );
    }

    // Обновляем целевую функцию, чтобы базисные переменные имели нулевые коэффициенты
    // Это делается путем вычитания строк базисных переменных, умноженных на их коэффициенты в целевой функции
    for (const row of phase2Rows) {
      const basicVarIdx = phase2VarNames.indexOf(row.basicVar);
      if (basicVarIdx === -1) continue;

      const basicVarCoef = phase2Objective[basicVarIdx];
      if (Math.abs(basicVarCoef) > 1e-10) {
        // Вычитаем из целевой функции строку базисной переменной, умноженную на её коэффициент
        phase2Objective = phase2Objective.map(
          (c, idx) => c - basicVarCoef * row.coefficients[idx],
        );
      }
    }

    const phase2Table: SimplexTable = {
      rows: phase2Rows,
      objective: phase2Objective,
      varNames: phase2VarNames,
      isMinimization: true,
    };

    // Выполняем этап 2
    const phase2Result = simplexMethod(phase2Table);

    // Формируем финальное решение (только исходные переменные)
    const finalSolution: Record<string, number> = {};
    for (const varName of varNames) {
      finalSolution[varName] = phase2Result.solution[varName] || 0;
    }

    // Вычисляем оптимальное значение исходной целевой функции
    let finalOptimalValue = 0;
    if (system.objective?.expression) {
      const objCoefficients = parseObjective(
        system.objective.expression,
        varNames,
      );
      for (let i = 0; i < varNames.length; i++) {
        finalOptimalValue += objCoefficients[i] * finalSolution[varNames[i]];
      }
    } else {
      finalOptimalValue = phase2Result.optimalValue;
    }

    return {
      success: true,
      solution: finalSolution,
      optimalValue: finalOptimalValue,
      phase1Result,
      phase2Result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    };
  }
}
