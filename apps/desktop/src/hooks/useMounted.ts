import { useRef, useEffect } from 'react';

/**
 * Hook to track if a component is currently mounted.
 * Useful for preventing state updates after component unmount.
 *
 * @returns A ref whose .current value is true while mounted, false after unmount
 *
 * @example
 * const mountedRef = useMounted();
 *
 * async function fetchData() {
 *   const data = await api.fetch();
 *   if (mountedRef.current) {
 *     setState(data); // Only update state if still mounted
 *   }
 * }
 */
export function useMounted(): React.MutableRefObject<boolean> {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return mountedRef;
}
