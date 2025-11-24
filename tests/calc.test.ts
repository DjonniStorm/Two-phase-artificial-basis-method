import { expect, test, describe } from 'bun:test';
import { calculateTwoPhaseMethod } from '../src/lib/calc';
import type { LinearSystem } from '../src/types';

describe('calculateTwoPhaseMethod', () => {
  // Найти максимум функции:Z = 3x₁ + 2x₂
  // При ограничениях:
  // x₁ + x₂ ≤ 8
  // 2x₁ + x₂ ≥ 6
  // x₁ + 2x₂ = 10
  // Условие неотрицательности:x₁, x₂ ≥ 0
  test('должен решить задачу: максимизация Z = 3x₁ + 2x₂ при ограничениях x₁ + x₂ ≤ 8, 2x₁ + x₂ ≥ 6, x₁ + 2x₂ = 10', () => {
    const system: LinearSystem = {
      equations: [
        {
          id: 'eq1',
          expression: 'x1+x2<=8',
          isValid: true,
        },
        {
          id: 'eq2',
          expression: '2x1+x2>=6',
          isValid: true,
        },
        {
          id: 'eq3',
          expression: 'x1+2x2=10',
          isValid: true,
        },
      ],
      objective: {
        expression: 'z=3x1+2x2',
        type: 'maximize',
        isValid: true,
      },
    };

    const result = calculateTwoPhaseMethod(system);

    if (!result.success) {
      console.log('Ошибка:', result.error);
      console.log('Phase1 result:', result.phase1Result);
      console.log('Phase2 result:', result.phase2Result);
    }

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    if (result.success && result.solution) {
      // Проверяем конкретные значения
      const x1 = result.solution.x1 || 0;
      const x2 = result.solution.x2 || 0;

      // Ожидаемые значения: x1 = 6, x2 = 2
      expect(Math.abs(x1 - 6)).toBeLessThan(1e-6);
      expect(Math.abs(x2 - 2)).toBeLessThan(1e-6);

      // Проверяем оптимальное значение Z = 22
      if (result.optimalValue !== undefined) {
        expect(Math.abs(result.optimalValue - 22)).toBeLessThan(1e-6);
      }

      // Проверяем ограничения
      // x1 + x2 <= 8
      expect(x1 + x2).toBeLessThanOrEqual(8 + 1e-6);

      // 2x1 + x2 >= 6
      expect(2 * x1 + x2).toBeGreaterThanOrEqual(6 - 1e-6);

      // x1 + 2x2 = 10
      expect(Math.abs(x1 + 2 * x2 - 10)).toBeLessThan(1e-6);

      // Неотрицательность
      expect(x1).toBeGreaterThanOrEqual(-1e-6);
      expect(x2).toBeGreaterThanOrEqual(-1e-6);
    }
  });

  // Найти максимум функции:Z = 3x₁ + 7x₂
  // При ограничениях:
  // x₁ + x₂ ≤ 11
  // 2x₁ + x₂ ≥ 10
  // x₁ + 2x₂ = 14
  // Условие неотрицательности:x₁, x₂ ≥ 0

  test('должен решить задачу: максимизация Z = 3x₁ + 7x₂ при ограничениях x₁ + x₂ ≤ 11, 2x₁ + x₂ ≥ 10, x₁ + 2x₂ = 14', () => {
    const system: LinearSystem = {
      equations: [
        {
          id: 'eq1',
          expression: 'x1+x2<=11',
          isValid: true,
        },
        {
          id: 'eq2',
          expression: '2x1+x2>=10',
          isValid: true,
        },
        {
          id: 'eq3',
          expression: 'x1+2x2=14',
          isValid: true,
        },
      ],
      objective: {
        expression: 'Z=3x1+7x2',
        type: 'maximize',
        isValid: true,
      },
    };

    const result = calculateTwoPhaseMethod(system);

    if (!result.success) {
      console.log('Ошибка:', result.error);
      console.log('Phase1 result:', result.phase1Result);
      console.log('Phase2 result:', result.phase2Result);
    }

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    if (result.success && result.solution) {
      // Проверяем конкретные значения
      const x1 = result.solution.x1 || 0;
      const x2 = result.solution.x2 || 0;

      // Ожидаемые значения: x1 = 6, x2 = 2
      expect(Math.abs(x1 - 2)).toBeLessThan(1e-6);
      expect(Math.abs(x2 - 6)).toBeLessThan(1e-6);

      // Проверяем оптимальное значение Z = 48
      if (result.optimalValue !== undefined) {
        expect(Math.abs(result.optimalValue - 48)).toBeLessThan(1e-6);
      }

      // Проверяем ограничения
      // x1 + x2 <= 11
      expect(x1 + x2).toBeLessThanOrEqual(11 + 1e-6);

      // 2x1 + x2 >= 10
      expect(2 * x1 + x2).toBeGreaterThanOrEqual(10 - 1e-6);

      // x1 + 2x2 = 14
      expect(Math.abs(x1 + 2 * x2 - 14)).toBeLessThan(1e-6);

      // Неотрицательность
      expect(x1).toBeGreaterThanOrEqual(-1e-6);
      expect(x2).toBeGreaterThanOrEqual(-1e-6);
    }
  });

  //   Найти максимум функции:Z = 5x₁ + 4x₂
  // При ограничениях:
  // x₁ + 3x₂ ≤ 12
  // 2x₁ + x₂ ≥ 8
  // x₁ + x₂ = 6
  // Условие неотрицательности:x₁, x₂ ≥ 0
});
