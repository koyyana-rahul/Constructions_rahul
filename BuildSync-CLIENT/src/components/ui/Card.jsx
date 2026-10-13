export function Card({ children, className = "", as: Tag = "div", ...props }) {
  return (
    <Tag
      className={`rounded-lg border border-concrete-200 bg-white shadow-card transition-shadow duration-200 ease-out-expo ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  className = "",
  children,
}) {
  return (
    <div
      className={`flex flex-col gap-2.5 border-b border-concrete-200 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5 sm:py-4 ${className}`}
    >
      <div className="min-w-0">
        {title && (
          <h2 className="font-display text-base font-semibold uppercase leading-tight tracking-wide text-navy-900 break-words">
            {title}
          </h2>
        )}
        {description && (
          <p className="mt-0.5 text-xs leading-relaxed text-concrete-500 break-words">
            {description}
          </p>
        )}
        {children}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

export function CardBody({ children, className = "" }) {
  return <div className={`p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = "" }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-end gap-2 border-t border-concrete-200 bg-concrete-50 px-4 py-3.5 sm:gap-3 sm:px-5 sm:py-4 ${className}`}
    >
      {children}
    </div>
  );
}