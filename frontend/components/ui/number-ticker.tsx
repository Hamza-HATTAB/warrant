"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

interface NumberTickerProps {
  value: number;
  direction?: "up" | "down";
  className?: string;
  delay?: number;
  decimalPlaces?: number;
  suffix?: string;
  prefix?: string;
}

export const NumberTicker: React.FC<NumberTickerProps> = ({
  value,
  direction = "up",
  className,
  delay = 0,
  decimalPlaces = 0,
  suffix = "",
  prefix = "",
}) => {
  const [displayValue, setDisplayValue] = useState<number>(direction === "down" ? value : 0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    let animationFrameId: number;
    const duration = 1200; // ms
    const startVal = direction === "down" ? value * 1.5 : 0;
    const endVal = value;

    const timeout = setTimeout(() => {
      const step = (timestamp: number) => {
        if (!startTimeRef.current) startTimeRef.current = timestamp;
        const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
        // easeOutExpo
        const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const current = startVal + (endVal - startVal) * easeProgress;
        setDisplayValue(current);

        if (progress < 1) {
          animationFrameId = requestAnimationFrame(step);
        } else {
          setDisplayValue(endVal);
        }
      };
      animationFrameId = requestAnimationFrame(step);
    }, delay * 1000);

    return () => {
      clearTimeout(timeout);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [value, direction, delay]);

  return (
    <span className={cn("inline-block tabular-nums tracking-wider", className)}>
      {prefix}
      {displayValue.toFixed(decimalPlaces)}
      {suffix}
    </span>
  );
};
