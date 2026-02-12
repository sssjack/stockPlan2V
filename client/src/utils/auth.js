
export const getCurrentUser = () => {
    try {
        const userStr = localStorage.getItem('currentUser');
        if (userStr) {
            return JSON.parse(userStr);
        }
    } catch (e) {
        console.error('Failed to parse user', e);
    }
    return null;
};

export const getCurrentUserId = () => {
    const user = getCurrentUser();
    return user ? user.id : 1; // Fallback to 1 ONLY if really necessary, but ideally should be null or handle logout
};
