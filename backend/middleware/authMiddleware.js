import { getAuth, clerkClient } from '@clerk/express';

// In-memory cache for user profiles to avoid repeated Clerk API roundtrips
const userProfileCache = new Map();

/**
 * Middleware to require a valid Clerk authenticated session.
 * Returns 401 if unauthenticated.
 */
export async function requireAuth(req, res, next) {
  try {
    const auth = getAuth(req);
    if (!auth || !auth.userId) {
      return res.status(401).json({
        error: 'Access denied. Please sign in with Clerk to access this feature.'
      });
    }

    req.auth = auth;
    req.user = {
      userId: auth.userId,
      id: auth.userId
    };

    // Retrieve user details from cache or Clerk API
    if (userProfileCache.has(auth.userId)) {
      const cached = userProfileCache.get(auth.userId);
      req.user.name = cached.name;
      req.user.email = cached.email;
      req.user.avatar = cached.avatar;
    } else {
      try {
        const clerkUser = await clerkClient.users.getUser(auth.userId);
        const email = clerkUser.emailAddresses?.[0]?.emailAddress || '';
        const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || clerkUser.username || email.split('@')[0] || 'User';
        const avatar = clerkUser.imageUrl || '';

        const profile = { name, email, avatar };
        userProfileCache.set(auth.userId, profile);

        req.user.name = name;
        req.user.email = email;
        req.user.avatar = avatar;
      } catch (e) {
        console.warn('[Clerk] Notice: Could not fetch user profile details:', e.message);
      }
    }

    next();
  } catch (err) {
    console.error('[Clerk Auth Error]:', err);
    return res.status(401).json({
      error: 'Invalid or expired session token. Please sign in again.'
    });
  }
}

/**
 * Optional authentication middleware.
 * Attaches req.user if a valid Clerk session is present, but doesn't reject unauthenticated requests.
 */
export async function optionalAuth(req, res, next) {
  try {
    const auth = getAuth(req);
    if (auth && auth.userId) {
      req.auth = auth;
      req.user = {
        userId: auth.userId,
        id: auth.userId
      };

      if (userProfileCache.has(auth.userId)) {
        const cached = userProfileCache.get(auth.userId);
        req.user.name = cached.name;
        req.user.email = cached.email;
        req.user.avatar = cached.avatar;
      } else {
        try {
          const clerkUser = await clerkClient.users.getUser(auth.userId);
          const email = clerkUser.emailAddresses?.[0]?.emailAddress || '';
          const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || clerkUser.username || email.split('@')[0] || 'User';
          const avatar = clerkUser.imageUrl || '';

          userProfileCache.set(auth.userId, { name, email, avatar });
          req.user.name = name;
          req.user.email = email;
          req.user.avatar = avatar;
        } catch {
          // Keep req.user with userId
        }
      }
    } else {
      req.user = null;
    }
  } catch {
    req.user = null;
  }
  next();
}

export default {
  requireAuth,
  optionalAuth
};
