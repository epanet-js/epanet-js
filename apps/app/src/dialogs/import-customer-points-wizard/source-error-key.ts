/** The message a source-level parse failure is reported with. Shared by the
 *  step that reads the file and the step that reads it again once the user
 *  has said which attributes hold the coordinates. */
export const sourceErrorKey = (code: string | undefined): string => {
  switch (code) {
    case "coordinateSystemUnsupported":
      return "importCustomerPoints.dataSource.unsupportedCrsError";
    case "coordinateSystemMismatch":
      return "importCustomerPoints.dataSource.projectionConversionError";
    case "coordinateSystemUnknown":
      return "importCustomerPoints.dataSource.coordinateValidationError";
    case "coordinateAttributesUnknown":
      return "importCustomerPoints.dataSource.coordinateAttributesError";
    case "sourceEmpty":
      return "importCustomerPoints.dataSource.noValidPointsError";
    default:
      return "importCustomerPoints.dataSource.parseFileError";
  }
};
