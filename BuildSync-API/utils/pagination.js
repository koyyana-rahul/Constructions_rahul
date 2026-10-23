/** Consistent pagination for every list endpoint. */
export const getPagination = (query = {}, { defaultLimit = 25, maxLimit = 100 } = {}) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const rawLimit = parseInt(query.limit, 10) || defaultLimit;
  const limit = Math.min(Math.max(rawLimit, 1), maxLimit);
  return { page, limit, skip: (page - 1) * limit };
};

export const paginationMeta = ({ page, limit }, total) => ({
  page,
  limit,
  total,
  pages: Math.max(1, Math.ceil(total / limit)),
});

export default { getPagination, paginationMeta };
