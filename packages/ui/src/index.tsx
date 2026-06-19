import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = 'primary', size = 'md', style, ...props }, ref) => {
    const baseStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '8px',
      fontWeight: '600',
      fontFamily: 'system-ui, sans-serif',
      cursor: 'pointer',
      transition: 'all 0.2s ease-in-out',
      border: 'none',
      outline: 'none',
    };

    const variantStyles: Record<string, React.CSSProperties> = {
      primary: {
        backgroundColor: '#4F46E5',
        color: '#FFFFFF',
      },
      secondary: {
        backgroundColor: '#E5E7EB',
        color: '#1F2937',
      },
      danger: {
        backgroundColor: '#EF4444',
        color: '#FFFFFF',
      },
      ghost: {
        backgroundColor: 'transparent',
        color: '#4F46E5',
      },
    };

    const sizeStyles: Record<string, React.CSSProperties> = {
      sm: { padding: '6px 12px', fontSize: '12px' },
      md: { padding: '10px 20px', fontSize: '14px' },
      lg: { padding: '14px 28px', fontSize: '16px' },
    };

    const mergedStyle = {
      ...baseStyle,
      ...variantStyles[variant],
      ...sizeStyles[size],
      ...style,
    };

    return (
      <button ref={ref} style={mergedStyle} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, hoverable = true, style, ...props }) => {
  const cardStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    border: '1px solid #F3F4F6',
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: hoverable ? 'pointer' : 'default',
    ...style,
  };

  return (
    <div style={cardStyle} {...props}>
      {children}
    </div>
  );
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: 'green' | 'blue' | 'yellow' | 'red' | 'gray';
}

export const Badge: React.FC<BadgeProps> = ({ children, color = 'gray', style, ...props }) => {
  const colorMap: Record<string, { bg: string; text: string }> = {
    green: { bg: '#DEF7EC', text: '#03543F' },
    blue: { bg: '#E1EFFE', text: '#1E429F' },
    yellow: { bg: '#FDF6B2', text: '#723B13' },
    red: { bg: '#FDE8E8', text: '#9B1C1C' },
    gray: { bg: '#F3F4F6', text: '#374151' },
  };

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 8px',
    borderRadius: '9999px',
    fontSize: '12px',
    fontWeight: '500',
    backgroundColor: colorMap[color].bg,
    color: colorMap[color].text,
    ...style,
  };

  return (
    <span style={badgeStyle} {...props}>
      {children}
    </span>
  );
};
