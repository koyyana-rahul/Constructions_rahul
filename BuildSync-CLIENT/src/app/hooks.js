import { useDispatch, useSelector } from "react-redux";

/**
 * Typed-by-convention hooks. The project is plain JavaScript, so instead of
 * TypeScript generics these wrappers exist purely so components never import
 * `useDispatch` / `useSelector` directly and every store access goes through
 * one named entry point.
 */
export const useAppDispatch = () => useDispatch();

export const useAppSelector = (selector) => useSelector(selector);