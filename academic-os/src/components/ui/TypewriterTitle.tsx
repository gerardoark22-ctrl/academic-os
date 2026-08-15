import { useEffect, useState } from 'react';

interface TypewriterTitleProps {
  text: string;
  className?: string;
}

export function TypewriterTitle({ text, className = '' }: TypewriterTitleProps) {
  const [display, setDisplay] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplay('');
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setDisplay(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        setDone(true);
      }
    }, 45);
    return () => clearInterval(id);
  }, [text]);

  return (
    <p className={`typewriter-title ${className}`}>
      {display}
      {!done && <span className="typewriter-cursor">|</span>}
    </p>
  );
}
