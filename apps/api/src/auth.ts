export const bearerAuthErrorResponses = {
  noAuthenticationHeader: {
    message: { error: { code: "UNAUTHORIZED", message: "Unauthorized." } },
  },
  invalidAuthenticationHeader: {
    message: { error: { code: "INVALID_REQUEST", message: "Invalid request." } },
  },
  invalidToken: { message: { error: { code: "UNAUTHORIZED", message: "Unauthorized." } } },
};
