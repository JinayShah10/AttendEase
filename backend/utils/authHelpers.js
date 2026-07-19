/**
 * Reusable authorization helper.
 * 
 * @param {Object} user - The req.user object from the JWT.
 * @param {Object} resource - The resource being accessed (optional).
 * @param {String} requiredRole - The role required (e.g., 'admin', 'faculty').
 * @param {Function|Boolean} customScopeCheck - A callback or boolean for specific scopes (e.g., checking if faculty owns the subject).
 * @returns {Boolean} True if authorized, false otherwise.
 */
export const canAccess = (user, resource = null, requiredRole = null, customScopeCheck = null) => {
  if (!user) return false;

  // Admins generally have global access override
  if (user.role === 'admin') {
    return true;
  }

  // Check role requirement
  if (requiredRole && user.role !== requiredRole) {
    return false;
  }

  // Check specific scope (e.g., resource ownership)
  if (typeof customScopeCheck === 'function') {
    return customScopeCheck(user, resource);
  } else if (customScopeCheck !== null && customScopeCheck !== undefined) {
    return !!customScopeCheck;
  }

  return true;
};
