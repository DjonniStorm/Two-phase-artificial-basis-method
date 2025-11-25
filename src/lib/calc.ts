import type { LinearSystem } from '@/types';
import {
  calculateUncertainty,
  addUncertainty,
  multiplyUncertainty,
  calculateResultUncertainties,
  type OperationCount,
} from './uncertainty';
import { parseEquation, parseObjective } from './parsing';
import { simplexMethod, type SimplexRow, type SimplexTable } from './simplex';

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
    table?: SimplexTable;
  };
  phase2Result?: {
    solution: Record<string, number>;
    optimalValue: number;
    table?: SimplexTable;
  };
  uncertainties?: {
    variables: Record<string, number>;
    optimalValue: number;
  };
  operations?: {
    additions: number;
    subtractions: number;
    multiplications: number;
    divisions: number;
  };
};

export function calculateTwoPhaseMethod(
  system: LinearSystem,
): CalculationResult {
  try {
    // Инициализируем счетчик операций
    const operationCount: OperationCount = {
      additions: 0,
      subtractions: 0,
      multiplications: 0,
      divisions: 0,
    };

    // Собираем погрешности входных данных
    const inputUncertainties = new Map<string, number>();

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

    // Парсим уравнения и собираем погрешности входных данных
    const parsedEquations = system.equations.map((eq) => {
      const parsed = parseEquation(eq.expression, varNames);

      // Сохраняем погрешности коэффициентов и правой части
      parsed.coefficients.forEach((coef, idx) => {
        if (Math.abs(coef) > 1e-10) {
          const key = `eq_${eq.id}_coef_${idx}`;
          inputUncertainties.set(key, calculateUncertainty(coef));
        }
      });
      inputUncertainties.set(
        `eq_${eq.id}_rhs`,
        calculateUncertainty(parsed.rhs),
      );

      return parsed;
    });

    // Сохраняем погрешности целевой функции
    if (system.objective?.expression) {
      const objCoefficients = parseObjective(
        system.objective.expression,
        varNames,
      );
      objCoefficients.forEach((coef, idx) => {
        if (Math.abs(coef) > 1e-10) {
          inputUncertainties.set(`obj_coef_${idx}`, calculateUncertainty(coef));
        }
      });
    }

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
      let { type } = parsed;

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
      } else if (type === '>=') {
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
      } else if (type === '=') {
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
    const phase1Result = simplexMethod(phase1Table, operationCount);

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
        phase1Result: {
          ...phase1Result,
          table: {
            rows: phase1Table.rows.map((row) => ({
              coefficients: [...row.coefficients],
              rhs: row.rhs,
              basicVar: row.basicVar,
            })),
            objective: [...phase1Table.objective],
            varNames: [...phase1Table.varNames],
            isMinimization: phase1Table.isMinimization,
          },
        },
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
    const phase2Result = simplexMethod(phase2Table, operationCount);

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

    // Вычисляем погрешности результатов
    const resultUncertainties = calculateResultUncertainties(
      finalSolution,
      inputUncertainties,
      operationCount,
      varNames,
    );

    // Вычисляем погрешность оптимального значения
    let optimalValueUncertainty = 0;
    if (system.objective?.expression) {
      const objCoefficients = parseObjective(
        system.objective.expression,
        varNames,
      );
      // Погрешность суммы: ΔS = Δx₁ + Δx₂ + ...
      for (let i = 0; i < varNames.length; i++) {
        const varUncertainty = resultUncertainties[varNames[i]] || 0;
        const coefUncertainty = inputUncertainties.get(`obj_coef_${i}`) || 0;
        // Погрешность произведения: Δ(coef * var) = |coef| * Δvar + |var| * Δcoef
        const productUncertainty = multiplyUncertainty(
          objCoefficients[i],
          coefUncertainty,
          finalSolution[varNames[i]],
          varUncertainty,
        );
        optimalValueUncertainty = addUncertainty(
          optimalValueUncertainty,
          productUncertainty,
        );
      }
    }

    return {
      success: true,
      solution: finalSolution,
      optimalValue: finalOptimalValue,
      phase1Result: {
        ...phase1Result,
        table: {
          rows: phase1Table.rows.map((row) => ({
            coefficients: [...row.coefficients],
            rhs: row.rhs,
            basicVar: row.basicVar,
          })),
          objective: [...phase1Table.objective],
          varNames: [...phase1Table.varNames],
          isMinimization: phase1Table.isMinimization,
        },
      },
      phase2Result: {
        ...phase2Result,
        table: {
          rows: phase2Table.rows.map((row) => ({
            coefficients: [...row.coefficients],
            rhs: row.rhs,
            basicVar: row.basicVar,
          })),
          objective: [...phase2Table.objective],
          varNames: [...phase2Table.varNames],
          isMinimization: phase2Table.isMinimization,
        },
      },
      uncertainties: {
        variables: resultUncertainties,
        optimalValue: optimalValueUncertainty,
      },
      operations: { ...operationCount },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    };
  }
}
