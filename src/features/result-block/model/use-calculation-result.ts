import { useMemo } from 'react';
import { useAppContext } from '@/app.context';
import { calculateTwoPhaseMethod, type CalculationResult } from '@/lib/calc';

export const useCalculationResult = () => {
  const { linearSystem, isCalculated } = useAppContext();

  const result = useMemo<CalculationResult | null>(() => {
    if (!isCalculated || !linearSystem) {
      return null;
    }

    try {
      return calculateTwoPhaseMethod(linearSystem);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
      };
    }
  }, [isCalculated, linearSystem]);

  return {
    linearSystem,
    isCalculated,
    result,
  };
};
