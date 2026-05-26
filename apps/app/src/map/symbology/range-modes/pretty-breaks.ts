const prettyBaseUnits = [1, 2, 2.5, 5, 10];
const EPSILON = 1e-9;

export const checkPrettyBreaksData = (sortedData: number[]): boolean => {
  return (
    sortedData.length > 1 && sortedData[0] != sortedData[sortedData.length - 1]
  );
};

export function calculatePrettyBreaks(
  sortedValues: number[],
  numBreaksTarget: number,
): number[] {
  const minValue = sortedValues[Math.floor(sortedValues.length * 0.02)];
  const maxValue = sortedValues[Math.ceil(sortedValues.length * 0.98 - 1)];
  const dataRange = maxValue - minValue;

  if (dataRange < EPSILON) {
    return generatePrettyBreaksForTinyRange(minValue, numBreaksTarget);
  }

  const focusedCandidateSteps = generateFocusedPrettySteps(
    dataRange,
    numBreaksTarget,
    prettyBaseUnits,
    EPSILON,
  );

  const sortedStepsDescending = focusedCandidateSteps.sort((a, b) => b - a);

  if (sortedStepsDescending.length === 0) {
    return [];
  }

  for (const currentStep of sortedStepsDescending) {
    let bestSequenceForThisStep: BestSequenceForStep | null = null;

    const maxPrecision =
      Math.max(
        getDecimalPlaces(currentStep),
        getDecimalPlaces(minValue),
        getDecimalPlaces(maxValue),
      ) + 6;

    const initialFirstPossibleBreak = roundToDecimalPlaces(
      Math.ceil((minValue + EPSILON) / currentStep) * currentStep,
      maxPrecision,
    );

    for (let m = 0; ; m++) {
      const firstBreakInSequence = roundToDecimalPlaces(
        initialFirstPossibleBreak + m * currentStep,
        maxPrecision,
      );

      if (firstBreakInSequence >= maxValue - EPSILON) {
        break;
      }

      const potentialBreaks: number[] = [];
      let lastBreakInSequence = firstBreakInSequence;

      for (let i = 0; i < numBreaksTarget; i++) {
        const breakVal = roundToDecimalPlaces(
          firstBreakInSequence + i * currentStep,
          maxPrecision,
        );
        potentialBreaks.push(breakVal);
        if (i === numBreaksTarget - 1) {
          lastBreakInSequence = breakVal;
        }
      }

      if (lastBreakInSequence >= maxValue - EPSILON) {
        break;
      }

      const currentCenteringScore = Math.abs(
        maxValue - lastBreakInSequence - (firstBreakInSequence - minValue),
      );

      if (
        bestSequenceForThisStep === null ||
        currentCenteringScore <
          bestSequenceForThisStep.centeringScore - EPSILON ||
        (Math.abs(
          currentCenteringScore - bestSequenceForThisStep.centeringScore,
        ) < EPSILON &&
          firstBreakInSequence <
            bestSequenceForThisStep.firstBreakValue - EPSILON)
      ) {
        bestSequenceForThisStep = {
          breaks: potentialBreaks,
          centeringScore: currentCenteringScore,
          firstBreakValue: firstBreakInSequence,
        };
      }

      if (
        m * currentStep > dataRange + currentStep * numBreaksTarget &&
        dataRange > EPSILON
      ) {
        break;
      }
      if (m > 200) {
        break;
      }
    }

    if (bestSequenceForThisStep !== null) {
      return bestSequenceForThisStep.breaks;
    }
  }

  return [];
}

function getDecimalPlaces(num: number): number {
  if (!isFinite(num)) return 0;
  const numStr = num.toString();
  const decimalPart = numStr.split(".")[1];
  return decimalPart ? decimalPart.length : 0;
}

function roundToDecimalPlaces(num: number, decimalPlaces: number): number {
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(num * factor) / factor;
}

interface BestSequenceForStep {
  breaks: number[];
  centeringScore: number;
  firstBreakValue: number;
}

function generatePrettyBreaksForTinyRange(
  centerValue: number,
  numBreaksTarget: number,
): number[] {
  const prettyStep = findPrettyStepForValue(centerValue);
  const breaks: number[] = [];

  for (let i = 0; i < numBreaksTarget; i++) {
    breaks.push(centerValue - prettyStep + i * prettyStep);
  }

  return breaks;
}

function findPrettyStepForValue(value: number): number {
  const magnitude = Math.abs(value);
  if (magnitude === 0) return 1;

  const exponent = Math.floor(Math.log10(magnitude));
  return Math.pow(10, exponent);
}

function generateFocusedPrettySteps(
  dataRange: number,
  numBreaksTarget: number,
  prettyBaseUnits: number[],
  epsilon: number,
): number[] {
  const idealRawStep =
    dataRange > epsilon ? dataRange / Math.max(1, numBreaksTarget) : 1.0;

  const candidateStepsSet = new Set<number>();

  let idealExponent: number;
  if (idealRawStep < epsilon) {
    idealExponent = Math.floor(
      Math.log10(Math.max(epsilon, dataRange / Math.max(100, numBreaksTarget))),
    );
  } else {
    idealExponent = Math.floor(Math.log10(idealRawStep));
  }

  for (let expOffset = -1; expOffset <= 1; expOffset++) {
    const currentExponent = idealExponent + expOffset;
    for (const unit of prettyBaseUnits) {
      const step = unit * Math.pow(10, currentExponent);
      if (step > epsilon) {
        if (numBreaksTarget > 1) {
          if (
            step * (numBreaksTarget - 1) > dataRange * 5 &&
            dataRange > epsilon
          )
            continue;
          if (step * numBreaksTarget < dataRange / 100 && dataRange > epsilon)
            continue;
        } else if (numBreaksTarget === 1) {
          if (step > dataRange * 2 && dataRange > epsilon) continue;
        }
        candidateStepsSet.add(parseFloat(step.toPrecision(12)));
      }
    }
  }

  if (candidateStepsSet.size === 0 && dataRange > epsilon) {
    const fallbackExponent = Math.floor(
      Math.log10(dataRange / Math.max(1, numBreaksTarget)),
    );
    for (let expOffset = -1; expOffset <= 1; expOffset++) {
      const currentExponent = fallbackExponent + expOffset;
      for (const unit of prettyBaseUnits) {
        const step = unit * Math.pow(10, currentExponent);
        if (step > epsilon) {
          candidateStepsSet.add(parseFloat(step.toPrecision(12)));
        }
      }
    }
  }
  if (candidateStepsSet.size === 0 && dataRange <= epsilon && dataRange > 0) {
    prettyBaseUnits.forEach((unit) =>
      candidateStepsSet.add(
        unit * Math.pow(10, Math.floor(Math.log10(dataRange)) - 1),
      ),
    );
  }

  return Array.from(candidateStepsSet);
}
