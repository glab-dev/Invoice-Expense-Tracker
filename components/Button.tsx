
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className = '', ...props }) => {
  const baseClasses = 'font-bold uppercase tracking-wider text-sm px-4 py-2 border-2 pixel-corners transition-all duration-150 transform active:translate-y-px';

  const variantClasses = {
    primary: 'bg-green-500 text-black border-green-500 hover:bg-yellow-400',
    secondary: 'bg-red-600 text-yellow-300 border-red-500 hover:bg-red-500 hover:text-white',
    danger: 'bg-red-500 text-white border-red-400 hover:bg-red-400',
  };

  return (
    <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export default Button;
