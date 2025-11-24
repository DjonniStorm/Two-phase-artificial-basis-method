/**
 * Вычисление абсолютной погрешности исходных данных
 * Погрешность равна половине последнего знака
 */
export function calculateUncertainty(value: number): number {
  const str = value.toString();
  const decimalIndex = str.indexOf('.');
  if (decimalIndex === -1) {
    return 0.5; // Целое число: 48 → 0.5
  }
  const decimalPlaces = str.length - decimalIndex - 1;
  return 0.5 * Math.pow(10, -decimalPlaces); // 48.01 → 0.005
}

/**
 * Абсолютная погрешность суммы: ΔS = Δx₁ + Δx₂ + ... + Δxₙ
 */
export function addUncertainty(
  uncertainty1: number,
  uncertainty2: number,
): number {
  return uncertainty1 + uncertainty2;
}

/**
 * Абсолютная погрешность произведения: ΔP = P · (Δx₁/|x₁| + Δx₂/|x₂|)
 */
export function multiplyUncertainty(
  value1: number,
  uncertainty1: number,
  value2: number,
  uncertainty2: number,
): number {
  const product = value1 * value2;
  const relative1 =
    Math.abs(value1) > 1e-10 ? uncertainty1 / Math.abs(value1) : 0;
  const relative2 =
    Math.abs(value2) > 1e-10 ? uncertainty2 / Math.abs(value2) : 0;

  return Math.abs(product) * (relative1 + relative2);
}

/**
 * Абсолютная погрешность частного: ΔQ = |Q| · (Δx/|x| + Δy/|y|)
 * Используется для более точного расчета погрешностей (зарезервировано для будущего использования)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function divideUncertainty(
  value1: number,
  uncertainty1: number,
  value2: number,
  uncertainty2: number,
): number {
  if (Math.abs(value2) < 1e-10) {
    return Infinity; // Деление на ноль
  }

  const quotient = value1 / value2;
  const relative1 =
    Math.abs(value1) > 1e-10 ? uncertainty1 / Math.abs(value1) : 0;
  const relative2 = uncertainty2 / Math.abs(value2);

  return Math.abs(quotient) * (relative1 + relative2);
}

/**
 * Счетчик операций для отслеживания накопления погрешностей
 */
export type OperationCount = {
  additions: number;
  subtractions: number;
  multiplications: number;
  divisions: number;
};

/**
 * Вычисление погрешностей результатов на основе входных данных и операций
 */
export function calculateResultUncertainties(
  _solution: Record<string, number>,
  inputUncertainties: Map<string, number>,
  operations: OperationCount,
  varNames: string[],
): Record<string, number> {
  const resultUncertainties: Record<string, number> = {};

  // Вычисляем среднюю погрешность входных данных
  const avgInputUncertainty =
    inputUncertainties.size > 0
      ? Array.from(inputUncertainties.values()).reduce((sum, u) => sum + u, 0) /
        inputUncertainties.size
      : 0.5;

  // Для каждой переменной решения оцениваем погрешность
  // Упрощенная оценка: погрешность растет пропорционально корню из количества операций
  for (const varName of varNames) {
    if (!varName.startsWith('s') && !varName.startsWith('e')) {
      // Базовая оценка: погрешность входных данных * коэффициент накопления
      // Коэффициент учитывает количество операций умножения и деления (наиболее критичных)
      const criticalOps = operations.multiplications + operations.divisions;
      const accumulationFactor = 1 + Math.sqrt(criticalOps) * 0.1;
      resultUncertainties[varName] = avgInputUncertainty * accumulationFactor;
    }
  }

  return resultUncertainties;
}

