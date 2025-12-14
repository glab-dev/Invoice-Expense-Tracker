
import React from 'react';

interface TabButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
}

const TabButton: React.FC<TabButtonProps> = ({ children, onClick, active }) => {
  const baseClasses = 'font-bold uppercase tracking-wider text-xs sm:text-sm px-3 py-2 border-2 pixel-corners transition-all duration-150 transform active:translate-y-px flex-grow text-center';
  const activeClasses = 'bg-yellow-400 text-black border-yellow-400';
  const inactiveClasses = 'bg-black text-green-500 border-green-500 hover:bg-green-500 hover:text-black';

  return (
    <button onClick={onClick} className={`${baseClasses} ${active ? activeClasses : inactiveClasses}`}>
      {children}
    </button>
  );
};

export default TabButton;
