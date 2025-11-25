/**
 * Парсинг уравнения вида "3x + 2y <= 5" или "x - y >= 10"
 * Поддерживает операторы: <=, >=, =, <, >
 */
export function parseEquation(
  expression: string,
  varNames: string[],
): {
  coefficients: number[];
  rhs: number;
  type: '<=' | '>=' | '=';
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
export function parseObjective(
  expression: string,
  varNames: string[],
): number[] {
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

