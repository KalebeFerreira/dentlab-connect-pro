import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "dentlab.hideValues";

export const useHideValues = () => {
  const [hidden, setHidden] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, hidden ? "1" : "0");
    } catch {
      // ignore
    }
  }, [hidden]);

  const toggle = useCallback(() => setHidden((v) => !v), []);

  const mask = useCallback(
    (value: string | number) => (hidden ? "••••••" : typeof value === "number" ? String(value) : value),
    [hidden]
  );

  return { hidden, toggle, mask, setHidden };
};
