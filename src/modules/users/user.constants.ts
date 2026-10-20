export const USER_CONSTANTS = {
    MESSAGES: {
        NOT_FOUND: 'User not found',
        ALREADY_EXISTS: 'A user with this email already exists',
        CREATED: 'User created successfully',
        UPDATED: 'User updated successfully',
        DELETED: 'User deleted successfully',
        LISTED: 'Users retrieved successfully',
    },

    /** Default Prisma SELECT for user public responses */
    SELECT: {
        uuid: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        is_active: true,
        created_at: true,
        updated_at: true,
    },

    PAGINATION: {
        DEFAULT_PAGE: 1,
        DEFAULT_LIMIT: 20,
        MAX_LIMIT: 100,
    },
} as const;
