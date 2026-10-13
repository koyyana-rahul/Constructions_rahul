import { Link } from "react-router-dom";
import { LuChevronRight } from "react-icons/lu";

/**
 * Breadcrumbs + page title + contextual actions, used at the top of every
 * dashboard content page so hierarchy is identical across roles.
 */
const PageHeader = ({
  title,
  description,
  breadcrumbs = [],
  actions,
  meta,
}) => (
  <div className="mb-4 flex flex-col gap-3 border-b border-concrete-200 pb-4 sm:mb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:pb-5">
    <div className="min-w-0">
      {breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-1.5">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-concrete-500">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <li key={crumb.label} className="flex items-center gap-1">
                  {index > 0 && (
                    <LuChevronRight
                      className="h-3 w-3 text-concrete-300"
                      aria-hidden="true"
                    />
                  )}
                  {crumb.to && !isLast ? (
                    <Link
                      to={crumb.to}
                      className="rounded transition-colors hover:text-navy-700"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current={isLast ? "page" : undefined} className="text-navy-700">
                      {crumb.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}
      <h1 className="font-display text-[1.6rem] font-semibold uppercase leading-tight tracking-wide text-navy-900 break-words sm:text-3xl">
        {title}
      </h1>
      {description && (
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-concrete-600 break-words">
          {description}
        </p>
      )}
      {meta && <div className="mt-2">{meta}</div>}
    </div>
    {/* Actions drop below the title on mobile and go full width so a primary
        button gets a comfortable touch target instead of squeezing beside it. */}
    {actions && (
      <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">{actions}</div>
    )}
  </div>
);

export default PageHeader;