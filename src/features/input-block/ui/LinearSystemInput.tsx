import { useState } from 'react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { useAppContext } from '@/app.context';
import type { LinearEquation, ObjectiveFunction, ObjectiveType } from '@/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const generateId = () =>
  `eq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const validateEquation = (
  expression: string,
): { isValid: boolean; error?: string } => {
  if (!expression.trim()) {
    return { isValid: false, error: 'Выражение не может быть пустым' };
  }

  // Разрешенные символы: буквы, цифры, операторы +, -, =, <, >, <=, >=, пробелы
  const allowedPattern = /^[\s\d+\-*/.a-zA-Zа-яА-Я=<>]+$/;

  if (!allowedPattern.test(expression)) {
    return { isValid: false, error: 'Содержит недопустимые символы' };
  }

  // Проверка на наличие оператора сравнения или равенства
  const hasOperator = /[=<>]/.test(expression);
  if (!hasOperator) {
    return {
      isValid: false,
      error: 'Отсутствует оператор сравнения (=, <, >, <=, >=)',
    };
  }

  // Проверка на наличие переменных (букв)
  const hasVariables = /[a-zA-Zа-яА-Я]/.test(expression);
  if (!hasVariables) {
    return { isValid: false, error: 'Отсутствуют переменные' };
  }

  // Проверка на корректность операторов сравнения (не должно быть более 2 символов подряд)
  const invalidOperators = /[<>]{3,}/;
  if (invalidOperators.test(expression)) {
    return { isValid: false, error: 'Некорректный оператор сравнения' };
  }

  return { isValid: true };
};

const validateObjective = (
  expression: string,
): { isValid: boolean; error?: string } => {
  if (!expression.trim()) {
    return { isValid: false, error: 'Целевая функция обязательна' };
  }

  // Поддерживаем формат "z=3x1 + 2x2" или просто "3x1 + 2x2"
  let exprToValidate = expression.trim();

  // Если есть "z=" в начале, удаляем его для валидации
  if (/^z\s*=/i.test(exprToValidate)) {
    exprToValidate = exprToValidate.replace(/^z\s*=/i, '').trim();
  }

  if (!exprToValidate) {
    return { isValid: false, error: 'Целевая функция не может быть пустой' };
  }

  // Разрешенные символы: буквы, цифры, операторы +, -, *, /, пробелы
  const allowedPattern = /^[\s\d+\-*/.a-zA-Zа-яА-Я]+$/;

  if (!allowedPattern.test(exprToValidate)) {
    return { isValid: false, error: 'Содержит недопустимые символы' };
  }

  // Objective функция НЕ должна содержать операторы сравнения (кроме = в начале для z=)
  const hasComparisonOperator = /[<>]/.test(exprToValidate);
  if (hasComparisonOperator) {
    return {
      isValid: false,
      error: 'Целевая функция не должна содержать операторы сравнения',
    };
  }

  // Проверка на наличие переменных (букв)
  const hasVariables = /[a-zA-Zа-яА-Я]/.test(exprToValidate);
  if (!hasVariables) {
    return { isValid: false, error: 'Отсутствуют переменные' };
  }

  return { isValid: true };
};

export const LinearSystemInput = () => {
  const { setLinearSystem, setIsCalculated } = useAppContext();
  const [equations, setEquations] = useState<LinearEquation[]>([
    { id: generateId(), expression: '', isValid: true },
  ]);
  const [objective, setObjective] = useState<ObjectiveFunction>({
    expression: '',
    type: 'minimize',
    isValid: false,
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const updateEquation = (id: string, expression: string) => {
    setEquations((prev) =>
      prev.map((eq) => {
        if (eq.id === id) {
          const validation = validateEquation(expression);
          return {
            ...eq,
            expression,
            isValid: validation.isValid,
            error: validation.error,
          };
        }
        return eq;
      }),
    );
  };

  const addEquation = () => {
    setEquations((prev) => [
      ...prev,
      { id: generateId(), expression: '', isValid: true },
    ]);
  };

  const removeEquation = (id: string) => {
    setEquations((prev) => prev.filter((eq) => eq.id !== id));
  };

  const updateObjective = (expression: string) => {
    const validation = validateObjective(expression);
    setObjective((prev) => ({
      ...prev,
      expression,
      isValid: validation.isValid,
      error: validation.error,
    }));
  };

  const updateObjectiveType = (type: ObjectiveType) => {
    setObjective((prev) => ({ ...prev, type }));
  };

  const handleSubmit = () => {
    // Проверяем, что все уравнения валидны и не пусты
    const allEquationsValid = equations.every(
      (eq) => eq.isValid && eq.expression.trim() !== '',
    );
    const hasAtLeastOne = equations.some((eq) => eq.expression.trim() !== '');

    // Проверяем objective функцию (обязательна и должна быть валидной)
    const objectiveValid =
      objective.expression.trim() !== '' && objective.isValid;

    if (!hasAtLeastOne || !objectiveValid) {
      return;
    }

    if (allEquationsValid && objectiveValid) {
      setIsDialogOpen(true);
    }
  };

  const handleConfirm = () => {
    const validEquations = equations.filter(
      (eq) => eq.isValid && eq.expression.trim() !== '',
    );

    // Очищаем выражение от "z=" если есть
    let objectiveExpression = objective.expression.trim();
    if (/^z\s*=/i.test(objectiveExpression)) {
      objectiveExpression = objectiveExpression.replace(/^z\s*=/i, '').trim();
    }

    const system: {
      equations: LinearEquation[];
      objective: ObjectiveFunction;
    } = {
      equations: validEquations,
      objective: {
        expression: objectiveExpression,
        type: objective.type,
        isValid: true,
      },
    };

    setLinearSystem(system);
    setIsDialogOpen(false);
    setIsCalculated(true);
  };

  const validEquations = equations.filter(
    (eq) => eq.isValid && eq.expression.trim() !== '',
  );

  return (
    <div className="w-full max-w-2xl mx-auto p-6 space-y-4">
      <div className="space-y-2 border-b pb-4">
        <Label className="text-lg font-semibold">Целевая функция</Label>
        <p className="text-sm text-muted-foreground">
          Введите функцию для минимизации или максимизации. Примеры: "z=3x1 +
          2x2" или "3x1 + 2x2"
        </p>
        <div className="flex gap-2">
          <select
            value={objective.type}
            onChange={(e) =>
              updateObjectiveType(e.target.value as ObjectiveType)
            }
            className={cn(
              'flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <option value="maximize">Максимизировать</option>
            <option value="minimize">Минимизировать</option>
          </select>
          <Input
            value={objective.expression}
            onChange={(e) => updateObjective(e.target.value)}
            placeholder="Например: z=3x1 + 2x2"
            className={cn(
              'flex-1',
              !objective.isValid &&
                'border-destructive focus-visible:ring-destructive',
            )}
            aria-invalid={!objective.isValid}
            required
          />
        </div>
        {!objective.isValid && (
          <p className="text-sm text-destructive">
            {objective.error || 'Целевая функция обязательна'}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-lg font-semibold">
          Введите систему линейных уравнений или неравенств
        </Label>
        <p className="text-sm text-muted-foreground">
          Каждое уравнение вводится на отдельной строке. Примеры: "2x + y &gt;
          10", "3y + c = 10"
        </p>
      </div>

      <div className="space-y-3">
        {equations.map((equation, index) => (
          <div key={equation.id} className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={equation.expression}
                onChange={(e) => updateEquation(equation.id, e.target.value)}
                placeholder={`Уравнение ${index + 1} (например: 2x + y > 10)`}
                className={cn(
                  'flex-1',
                  !equation.isValid &&
                    equation.expression.trim() !== '' &&
                    'border-destructive focus-visible:ring-destructive',
                )}
                aria-invalid={
                  !equation.isValid && equation.expression.trim() !== ''
                }
              />
              {equations.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeEquation(equation.id)}
                  aria-label="Удалить уравнение"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            {!equation.isValid && equation.expression.trim() !== '' && (
              <p className="text-sm text-destructive">{equation.error}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={addEquation}>
          <Plus className="h-4 w-4 mr-2" />
          Добавить уравнение
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={
            validEquations.length === 0 ||
            objective.expression.trim() === '' ||
            !objective.isValid
          }
          className="flex-1"
        >
          Подтвердить
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="p-[100px]">
          <DialogHeader>
            <DialogTitle>Подтверждение</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите сохранить следующую систему уравнений?
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[200px] w-[350px] rounded-md border p-4">
            <div className="space-y-2 py-4">
              {objective.expression.trim() !== '' && objective.isValid && (
                <div className="p-2 bg-primary/10 rounded-md border border-primary/20">
                  <span className="font-medium">
                    Целевая функция (
                    {objective.type === 'minimize'
                      ? 'минимизировать'
                      : 'максимизировать'}
                    ):
                  </span>{' '}
                  {/^z\s*=/i.test(objective.expression.trim())
                    ? objective.expression
                    : `z = ${objective.expression}`}
                </div>
              )}
              {validEquations.map((eq, index) => (
                <div key={eq.id} className="p-2 bg-muted rounded-md">
                  <span className="font-medium">Уравнение {index + 1}:</span>{' '}
                  {eq.expression}
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleConfirm}>Подтвердить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
