// Ensure EPSILON, getDecimalPlaces, and roundToDecimalPlaces are defined as before.
const EPSILON = 1e-9;

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
  firstBreakValue: number; // Used for tie-breaking if centering scores are equal
}

/**
 * Generates a focused list of candidate pretty step sizes.
 */
function generateFocusedPrettySteps(
  dataRange: number,
  numBreaksTarget: number,
  prettyBaseUnits: number[],
  epsilon: number
): number[] {
  const idealRawStep =
    dataRange > epsilon ? dataRange / Math.max(1, numBreaksTarget) : 1.0; // Avoid division by zero if dataRange is 0
  const candidateStepsSet = new Set<number>();

  let idealExponent: number;
  if (idealRawStep < epsilon) {
    // If ideal step is tiny (e.g. dataRange is small, numBreaksTarget is large)
    // calculate exponent based on a fraction of the dataRange if possible
    idealExponent = Math.floor(
      Math.log10(Math.max(epsilon, dataRange / Math.max(100, numBreaksTarget)))
    );
  } else {
    idealExponent = Math.floor(Math.log10(idealRawStep));
  }

  for (let expOffset = -1; expOffset <= 1; expOffset++) {
    const currentExponent = idealExponent + expOffset;
    for (const unit of prettyBaseUnits) {
      const step = unit * Math.pow(10, currentExponent);
      if (step > epsilon) {
        // Filter out steps that are clearly too large or too small to be useful
        if (numBreaksTarget > 1) {
          if (
            step * (numBreaksTarget - 1) > dataRange * 5 &&
            dataRange > epsilon
          )
            continue; // Too large
          if (step * numBreaksTarget < dataRange / 100 && dataRange > epsilon)
            continue; // Too small relative to range
        } else if (numBreaksTarget === 1) {
          // Single break
          if (step > dataRange * 2 && dataRange > epsilon) continue; // Step much larger than range
        }
        candidateStepsSet.add(parseFloat(step.toPrecision(12)));
      }
    }
  }

  // Fallback if the focused list is empty (e.g. extreme values)
  if (candidateStepsSet.size === 0 && dataRange > epsilon) {
    const fallbackExponent = Math.floor(
      Math.log10(dataRange / Math.max(1, numBreaksTarget))
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
  // Ensure at least some very basic steps if all else fails and range is small
  if (candidateStepsSet.size === 0 && dataRange <= epsilon && dataRange > 0) {
    prettyBaseUnits.forEach((unit) =>
      candidateStepsSet.add(
        unit * Math.pow(10, Math.floor(Math.log10(dataRange)) - 1)
      )
    );
  }

  return Array.from(candidateStepsSet);
}

/**
 * Calculates "pretty" break points, prioritizing the largest possible pretty step.
 *
 * @param minValue The minimum value of the data range.
 * @param maxValue The maximum value of the data range.
 * @param numBreaksTarget The exact desired number of break points.
 * @returns An array of "pretty" break values, or an empty array if no suitable solution is found.
 */
export function calculatePrettyBreaks(
  minValue: number,
  maxValue: number,
  numBreaksTarget: number
): number[] {
  if (minValue >= maxValue - EPSILON || numBreaksTarget <= 0) {
    return [];
  }

  const prettyBaseUnits = [1, 2, 2.5, 5, 10];
  const dataRange = maxValue - minValue;

  // Handle cases where dataRange is effectively zero
  if (dataRange < EPSILON) {
    if (numBreaksTarget === 1) {
      // Single break requested for a point
      // Attempt to place a "break" at the point if it's for display,
      // but strictly between min/max is impossible. Returning empty.
      return [];
    }
    return []; // Cannot place distinct breaks in a zero-width range
  }

  const focusedCandidateSteps = generateFocusedPrettySteps(
    dataRange,
    numBreaksTarget,
    prettyBaseUnits,
    EPSILON
  );

  // Sort by largest step first
  const sortedStepsDescending = focusedCandidateSteps.sort((a, b) => b - a);

  if (sortedStepsDescending.length === 0) {
    // console.warn("No candidate steps generated.");
    return [];
  }

  for (const currentStep of sortedStepsDescending) {
    let bestSequenceForThisStep: BestSequenceForStep | null = null;

    const maxPrecision =
      Math.max(
        getDecimalPlaces(currentStep),
        getDecimalPlaces(minValue),
        getDecimalPlaces(maxValue)
      ) + 6; // Increased safety buffer for precision

    // Calculate the very first multiple of currentStep that is strictly > minValue
    const initialFirstPossibleBreak = roundToDecimalPlaces(
      Math.ceil((minValue + EPSILON) / currentStep) * currentStep,
      maxPrecision
    );

    // Iterate through possible starting breaks for the sequence (m shifts the window)
    for (let m = 0; ; m++) {
      const firstBreakInSequence = roundToDecimalPlaces(
        initialFirstPossibleBreak + m * currentStep,
        maxPrecision
      );

      // If the first break itself (before forming the sequence) is already too large, stop for this step.
      if (firstBreakInSequence >= maxValue - EPSILON) {
        break; // From m loop for this currentStep
      }

      // Construct the potential sequence
      const potentialBreaks: number[] = [];
      let lastBreakInSequence = firstBreakInSequence; // Initialize

      for (let i = 0; i < numBreaksTarget; i++) {
        const breakVal = roundToDecimalPlaces(
          firstBreakInSequence + i * currentStep,
          maxPrecision
        );
        potentialBreaks.push(breakVal);
        if (i === numBreaksTarget - 1) {
          lastBreakInSequence = breakVal;
        }
      }

      // If the last break of this sequence is too large, then shifting the window
      // further right (increasing m) will also result in an invalid sequence.
      if (lastBreakInSequence >= maxValue - EPSILON) {
        break; // From m loop for this currentStep
      }

      // At this point, the sequence is valid in terms of its start and end points
      // relative to minValue and maxValue.

      const currentCenteringScore = Math.abs(
        maxValue - lastBreakInSequence - (firstBreakInSequence - minValue)
      );

      if (
        bestSequenceForThisStep === null ||
        currentCenteringScore <
          bestSequenceForThisStep.centeringScore - EPSILON ||
        (Math.abs(
          currentCenteringScore - bestSequenceForThisStep.centeringScore
        ) < EPSILON &&
          firstBreakInSequence <
            bestSequenceForThisStep.firstBreakValue - EPSILON) // Tie-break: first break closer to min
      ) {
        bestSequenceForThisStep = {
          breaks: potentialBreaks,
          centeringScore: currentCenteringScore,
          firstBreakValue: firstBreakInSequence,
        };
      }

      // Heuristic safety break for 'm' loop
      // Maximum reasonable m: if firstBreakInSequence has crossed more than, say, dataRange beyond initial.
      if (
        m * currentStep > dataRange + currentStep * numBreaksTarget &&
        dataRange > EPSILON
      ) {
        break;
      }
      if (m > 200) {
        // Absolute upper limit on m iterations, adjust if necessary
        break;
      }
    } // End m loop (iterating start positions for currentStep)

    if (bestSequenceForThisStep !== null) {
      // Found the best sequence for the current LARGEST step that works.
      return bestSequenceForThisStep.breaks;
    }
  } // End currentStep loop (iterating from largest step to smallest)

  return []; // No solution found across any steps
}

// --- Example Usage ---
// const result1 = calculatePrettyBreaksLargestStepFirst(0, 71.9, 2);
// console.log("min:0, max:71.9, numBreaksTarget:2 -> Expected e.g. [25,50] (step 25). Actual:", result1);

// const result2 = calculatePrettyBreaksLargestStepFirst(0, 71.9, 3);
// console.log("min:0, max:71.9, numBreaksTarget:3 -> Expected e.g. [20,40,60] (step 20). Actual:", result2);

// const result3 = calculatePrettyBreaksLargestStepFirst(0, 71.9, 4);
// console.log("min:0, max:71.9, numBreaksTarget:4 -> Expected [20,30,40,50] (step 10). Actual:", result3);

// const result4 = calculatePrettyBreaksLargestStepFirst(1, 9, 3);
// console.log("min:1, max:9, numBreaksTarget:3 -> Expected [2.5,5,7.5] (step 2.5). Actual:", result4);
