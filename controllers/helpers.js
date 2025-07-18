exports.prismaErrorHandler = function (error) {
  let errorMessage;
  switch (error.code) {
    case "P2002":
      errorMessage = "Duplicate name detected.";
      break;
  
    default:
      errorMessage = "Database error, please try again."
      break;
  }
  return errorMessage;
}