import React from 'react';

interface TabButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
}

const TabButton: React.FC<TabButtonProps> = ({ children, onClick, active }) => {
  // Use skew to give it a dynamic comic feel
  const baseClasses = 'font-comic-title uppercase tracking-wider text-lg sm:text-xl px-4 py-3 border-2 border-black transition-all duration-150 transform flex-grow text-center -skew-x-6 mx-1';
  const activeClasses = 'bg-cyan-400 text-black comic-shadow shadow-black translate-y-[-2px] z-10';
  const inactiveClasses = 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white hover:translate-y-[-1px]';

  return (
    <button onClick={onClick} className={`${baseClasses} ${active ? activeClasses : inactiveClasses}`}>
      <span className="block skew-x-6">{children}</span>
    </button>
  );
};

export default TabButton;