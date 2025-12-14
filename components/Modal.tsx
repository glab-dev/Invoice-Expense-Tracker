
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
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className={`bg-black border-4 border-green-500 pixel-corners w-full ${maxWidth} text-green-500 shadow-lg animate-fade-in`}>
        <header className="p-4 border-b-4 border-green-500 flex justify-between items-center">
          <h2 className="font-press-start text-lg text-yellow-400">{title}</h2>
          <button onClick={onClose} className="font-press-start text-2xl text-green-500 hover:text-yellow-400">&times;</button>
        </header>
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
