interface InputLineData {
  id: number;
  value: string;
}

type LinearEquation = {
  id: string;
  expression: string;
  isValid: boolean;
  error?: string;
};

type ObjectiveType = 'minimize' | 'maximize';

type ObjectiveFunction = {
  expression: string;
  type: ObjectiveType;
  isValid: boolean;
  error?: string;
};

type LinearSystem = {
  equations: LinearEquation[];
  objective?: ObjectiveFunction;
};

export type {
  InputLineData,
  LinearEquation,
  LinearSystem,
  ObjectiveFunction,
  ObjectiveType,
};
