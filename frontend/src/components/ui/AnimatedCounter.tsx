import React, { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  formatter?: (val: number) => string;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 0.8,
  prefix = '',
  suffix = '',
  decimals = 0,
  formatter,
  className = '',
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState<number>(0);

  useEffect(() => {
    if (shouldReduceMotion) return;

    let startTime: number | null = null;
    let animationFrame: number;
    const startValue = 0;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      
      // Decelerating cubic ease-out curve
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (value - startValue) * easeOut;
      setDisplayValue(current);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration, shouldReduceMotion]);

  const resolvedValue = shouldReduceMotion ? value : displayValue;

  const formatted = formatter
    ? formatter(resolvedValue)
    : decimals > 0
    ? resolvedValue.toFixed(decimals)
    : Math.round(resolvedValue).toLocaleString('en-IN');

  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};
