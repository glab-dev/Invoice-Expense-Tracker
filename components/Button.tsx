import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className = '', ...props }) => {
  const baseClasses = 'font-comic-title uppercase text-lg sm:text-xl tracking-wider px-6 py-2 border-2 border-black transition-all duration-200 comic-shadow-sm hover:comic-shadow-hover active:comic-shadow-active';

  const variantClasses = {
    primary: 'bg-yellow-400 text-black hover:bg-yellow-300',
    secondary: 'bg-gray-700 text-white hover:bg-gray-600', // Dark mode secondary
    danger: 'bg-red-600 text-white hover:bg-red-500',
  };

  return (
    <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export default Button;