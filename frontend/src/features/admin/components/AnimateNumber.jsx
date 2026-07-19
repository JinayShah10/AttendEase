import React, { useState, useEffect } from 'react';

const AnimateNumber = ({ value, suffix = "", duration = 2000, decimals = 0 }) => {
  const [count, setCount] = useState(value);

  useEffect(() => {
    let start = 0;
    const end = parseFloat(value.toString().replace(/,/g, ''));
    if (isNaN(end) || start === end) {
      return;
    }

    let totalDuration = duration;
    let increment = end / (totalDuration / 16);
    
    // Safety check: if increment is invalid or zero, just set to end and return
    if (isNaN(increment) || !isFinite(increment) || increment === 0) {
      // count is already initialized to value/end
      return;
    }

    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(current);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value, duration]);

  return <span>{decimals > 0 ? Number(count).toFixed(decimals) : Math.floor(count).toLocaleString()}{suffix}</span>;
};

export default AnimateNumber;
