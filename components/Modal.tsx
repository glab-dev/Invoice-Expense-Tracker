import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`bg-gray-800 border-[3px] border-black comic-shadow w-full ${maxWidth} text-white animate-fade-in relative`}>
        <header className="p-4 border-b-[3px] border-black flex justify-between items-center bg-yellow-400">
          <h2 className="text-2xl sm:text-3xl text-black transform rotate-1">{title}</h2>
          <button 
            onClick={onClose} 
            className="font-comic-title text-2xl text-black hover:text-red-600 border-2 border-black bg-white w-8 h-8 flex items-center justify-center rounded-full hover:scale-110 transition-transform"
          >
            &times;
          </button>
        </header>
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;