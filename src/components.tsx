import type { FC, PropsWithChildren } from "hono/jsx";

// 基础类型定义
export interface BaseProps {
  className?: string;
}

export interface ButtonProps extends BaseProps {
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  onClick?: () => void;
}

export interface InputProps extends BaseProps {
  type?: string;
  name?: string;
  value?: string;
  placeholder?: string;
  required?: boolean;
  maxlength?: number;
  minlength?: number;
  pattern?: string;
  disabled?: boolean;
  accept?: string;
}

export interface TextareaProps extends BaseProps {
  name?: string;
  value?: string;
  placeholder?: string;
  required?: boolean;
  maxlength?: number;
  rows?: number;
  disabled?: boolean;
}

export interface CardProps extends BaseProps {
  variant?: "default" | "notification" | "post";
  padding?: "sm" | "md" | "lg";
  href?: string;
}

export interface BadgeProps extends BaseProps {
  variant?: "primary" | "secondary" | "danger" | "success";
  size?: "sm" | "md" | "lg";
}

export interface AvatarProps extends BaseProps {
  src?: string;
  alt?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export interface ContainerProps extends BaseProps {
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
}

export interface FlexProps extends BaseProps {
  direction?: "row" | "col";
  justify?: "start" | "center" | "end" | "between" | "around" | "evenly";
  align?: "start" | "center" | "end" | "stretch";
  wrap?: boolean;
  gap?:
    | "0"
    | "1"
    | "2"
    | "3"
    | "4"
    | "5"
    | "6"
    | "8"
    | "10"
    | "12"
    | "16"
    | "20";
}

export interface ErrorMessageProps extends BaseProps {
  message: string;
}

export interface FormFieldProps extends BaseProps {
  label?: string;
  error?: string;
  required?: boolean;
}

// 基础 UI 组件

export const Button: FC<PropsWithChildren<ButtonProps>> = ({
  children,
  type = "button",
  variant = "primary",
  size = "md",
  disabled = false,
  className = "",
  onClick,
  ...props
}) => {
  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variantClasses = {
    primary: "bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-400",
    secondary:
      "bg-slate-500 text-white hover:bg-slate-600 focus:ring-slate-400",
    outline:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:ring-blue-400",
    danger: "bg-red-500 text-white hover:bg-red-600 focus:ring-red-400",
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  return (
    <button
      type={type}
      disabled={disabled}
      class={classes}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
};

export const Input: FC<InputProps> = ({
  type = "text",
  className = "",
  ...props
}) => {
  const baseClasses =
    "block w-full px-3 py-2 border border-slate-200 rounded-md placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500";
  const classes = `${baseClasses} ${className}`;

  return <input type={type} class={classes} {...props} />;
};

export const Textarea: FC<TextareaProps> = ({
  className = "",
  rows = 3,
  ...props
}) => {
  const baseClasses =
    "block w-full px-3 py-2 border border-slate-200 rounded-md placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 resize-vertical";
  const classes = `${baseClasses} ${className}`;

  return <textarea class={classes} rows={rows} {...props} />;
};

export const Card: FC<PropsWithChildren<CardProps>> = ({
  children,
  variant = "default",
  padding = "md",
  className = "",
  href,
}) => {
  const baseClasses = "bg-white rounded-lg border";

  const variantClasses = {
    default: "border-slate-200",
    notification: "border-l-4 border-slate-200",
    post: "border-slate-200 hover:border-slate-300 transition-colors",
  };

  const paddingClasses = {
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${paddingClasses[padding]} ${className}`;

  if (href) {
    return (
      <a
        href={href}
        class={`${classes} block no-underline text-inherit cursor-pointer`}
      >
        {children}
      </a>
    );
  }

  return <div class={classes}>{children}</div>;
};

export const Badge: FC<PropsWithChildren<BadgeProps>> = ({
  children,
  variant = "primary",
  size = "md",
  className = "",
}) => {
  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-full";

  const variantClasses = {
    primary: "bg-blue-100 text-blue-800",
    secondary: "bg-gray-100 text-gray-800",
    danger: "bg-red-100 text-red-800",
    success: "bg-green-100 text-green-800",
  };

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
    lg: "px-3 py-1.5 text-base",
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  return <span class={classes}>{children}</span>;
};

export const Avatar: FC<AvatarProps> = ({
  src,
  alt = "Avatar",
  size = "md",
  className = "",
}) => {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
    xl: "w-20 h-20",
  };

  const baseClasses = "rounded-full object-cover";
  const classes = `${baseClasses} ${sizeClasses[size]} ${className}`;

  if (!src) {
    return (
      <div class={`${classes} bg-slate-200 flex items-center justify-center`}>
        <span class="text-slate-600 font-medium">
          {alt.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return <img src={src} alt={alt} class={classes} />;
};

export const Container: FC<PropsWithChildren<ContainerProps>> = ({
  children,
  maxWidth = "lg",
  className = "",
}) => {
  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
    full: "max-w-full",
  };

  const baseClasses = "mx-auto px-4 sm:px-6 lg:px-8";
  const classes = `${baseClasses} ${maxWidthClasses[maxWidth]} ${className}`;

  return <div class={classes}>{children}</div>;
};

export const Flex: FC<PropsWithChildren<FlexProps>> = ({
  children,
  direction = "row",
  justify = "start",
  align = "start",
  wrap = false,
  gap = "0",
  className = "",
}) => {
  const directionClasses = {
    row: "flex-row",
    col: "flex-col",
  };

  const justifyClasses = {
    start: "justify-start",
    center: "justify-center",
    end: "justify-end",
    between: "justify-between",
    around: "justify-around",
    evenly: "justify-evenly",
  };

  const alignClasses = {
    start: "items-start",
    center: "items-center",
    end: "items-end",
    stretch: "items-stretch",
  };

  const gapClasses = {
    "0": "gap-0",
    "1": "gap-1",
    "2": "gap-2",
    "3": "gap-3",
    "4": "gap-4",
    "5": "gap-5",
    "6": "gap-6",
    "8": "gap-8",
    "10": "gap-10",
    "12": "gap-12",
    "16": "gap-16",
    "20": "gap-20",
  };

  const baseClasses = "flex";
  const wrapClass = wrap ? "flex-wrap" : "";
  const classes = `${baseClasses} ${directionClasses[direction]} ${justifyClasses[justify]} ${alignClasses[align]} ${gapClasses[gap]} ${wrapClass} ${className}`;

  return <div class={classes}>{children}</div>;
};

export const ErrorMessage: FC<ErrorMessageProps> = ({
  message,
  className = "",
}) => {
  const classes = `bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md ${className}`;

  return (
    <p class={classes} role="alert">
      {message}
    </p>
  );
};

export const FormField: FC<PropsWithChildren<FormFieldProps>> = ({
  children,
  label,
  error,
  required = false,
  className = "",
}) => {
  return (
    <div class={`space-y-1 ${className}`}>
      {label && (
        // biome-ignore lint/a11y/noLabelWithoutControl: label is associated with input via form structure
        <label class="block text-sm font-medium text-slate-700">
          {label}
          {required && <span class="text-red-500 ml-1">*</span>}
        </label>
      )}
      {children}
      {error && <ErrorMessage message={error} />}
    </div>
  );
};

export interface NotificationBadgeProps {
  count: number;
  className?: string;
}

export const NotificationBadge: FC<NotificationBadgeProps> = ({
  count,
  className = "",
}) => {
  return (
    <Flex align="center" gap="2" className={className}>
      <span class="text-xl">🔔</span>
      {count > 0 && (
        <Badge variant="danger" size="sm">
          {count > 99 ? "99+" : count.toString()}
        </Badge>
      )}
    </Flex>
  );
};

export interface HeaderImageProps {
  src: string;
  alt: string;
  className?: string;
}

export const HeaderImage: FC<HeaderImageProps> = ({
  src,
  alt,
  className = "",
}) => {
  const classes = `w-full h-48 object-cover rounded-lg ${className}`;
  return <img src={src} alt={alt} class={classes} />;
};

export interface LinkButtonProps extends BaseProps {
  href: string;
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
}

export const LinkButton: FC<PropsWithChildren<LinkButtonProps>> = ({
  children,
  href,
  variant = "primary",
  size = "md",
  className = "",
}) => {
  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 no-underline";

  const variantClasses = {
    primary: "bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-400",
    secondary:
      "bg-slate-500 text-white hover:bg-slate-600 focus:ring-slate-400",
    outline:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:ring-blue-400",
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  return (
    // biome-ignore lint/a11y/useSemanticElements: <a> is used as a button
    <a href={href} class={classes} role="button">
      {children}
    </a>
  );
};

// 消息显示组件
export interface MessageDisplayProps extends BaseProps {
  title?: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  showBackButton?: boolean;
  backUrl?: string;
  backText?: string;
}

export const MessageDisplay: FC<MessageDisplayProps> = ({
  title,
  message,
  type = "info",
  showBackButton = true,
  backUrl = "/",
  backText = "返回",
  className = "",
}) => {
  const typeClasses = {
    info: "bg-blue-50 border-blue-200 text-blue-800",
    success: "bg-green-50 border-green-200 text-green-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    error: "bg-red-50 border-red-200 text-red-800",
  };

  const iconMap = {
    info: "ℹ️",
    success: "✅",
    warning: "⚠️",
    error: "❌",
  };

  return (
    <Container maxWidth="md">
      <Card className={`${typeClasses[type]} ${className}`}>
        <Flex
          direction="col"
          align="center"
          gap="4"
          className="text-center py-8"
        >
          <div class="text-4xl mb-2">{iconMap[type]}</div>

          {title && <h1 class="text-2xl font-bold mb-2">{title}</h1>}

          <p class="text-lg leading-relaxed max-w-md">{message}</p>

          {showBackButton && (
            <div class="mt-6">
              <LinkButton href={backUrl} variant="primary">
                ← {backText}
              </LinkButton>
            </div>
          )}
        </Flex>
      </Card>
    </Container>
  );
};

// 页面消息组件 - 用于显示操作结果
export interface PageMessageProps extends BaseProps {
  title: string;
  message: string;
  type?: "success" | "error" | "info";
  actions?: Array<{
    text: string;
    href: string;
    variant?: "primary" | "secondary" | "outline";
  }>;
}

export const PageMessage: FC<PageMessageProps> = ({
  title,
  message,
  type = "info",
  actions = [],
  className = "",
}) => {
  const typeConfig = {
    success: {
      icon: "🎉",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      textColor: "text-green-800",
    },
    error: {
      icon: "😞",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      textColor: "text-red-800",
    },
    info: {
      icon: "💡",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      textColor: "text-blue-800",
    },
  };

  const config = typeConfig[type];

  return (
    <Container maxWidth="md">
      <Card
        className={`${config.bgColor} ${config.borderColor} ${config.textColor} ${className}`}
      >
        <Flex
          direction="col"
          align="center"
          gap="6"
          className="text-center py-12"
        >
          <div class="text-6xl">{config.icon}</div>

          <div>
            <h1 class="text-3xl font-bold mb-4">{title}</h1>
            <p class="text-lg leading-relaxed max-w-lg">{message}</p>
          </div>

          {actions.length > 0 && (
            <Flex gap="4" wrap className="mt-4">
              {actions.map((action, index) => (
                <LinkButton
                  // biome-ignore lint/suspicious/noArrayIndexKey: using index as key is acceptable here
                  key={index}
                  href={action.href}
                  variant={action.variant || "primary"}
                >
                  {action.text}
                </LinkButton>
              ))}
            </Flex>
          )}
        </Flex>
      </Card>
    </Container>
  );
};
