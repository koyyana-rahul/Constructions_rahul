/**
 * Password-hashing cost.
 *
 * The environment may request a cost, but it is clamped to a safe range so a
 * typo cannot make hashing unusably slow or dangerously cheap. The default
 * stays at 10 for tests and local runs; production can set 12.
 */
export const bcryptSaltRounds = () => {
  const configured = Number(process.env.BCRYPT_SALT_ROUNDS);
  if (!Number.isInteger(configured)) return 10;
  return Math.min(15, Math.max(10, configured));
};

export default bcryptSaltRounds;
