import { Link } from "react-router";

interface Props {
  title: string;
  image: string;
  description: string;
  link?: string;
  /** Set to -1 when the card lives inside a decorative, aria-hidden region. */
  tabIndex?: number;
  /** Hide content when this card is only visible as a layer in a deck. */
  concealed?: boolean;
}

/**
 * iOS-style Hark notification preview: service avatar with the Hark app-icon
 * badge, a bold title, and a one-line description on a glass surface.
 */
export function NotificationCard({
  title,
  image,
  description,
  link,
  tabIndex,
  concealed = false,
}: Props) {
  const contentVisibility = concealed ? "opacity-0" : "opacity-100";
  const card = (
    <span className="relative flex min-h-[72px] w-full items-center gap-3.5 overflow-hidden rounded-[24px] border border-media-line bg-surface px-4 py-3.5 shadow-xs transition-colors group-hover:bg-surface-hover sm:min-h-[98px] sm:gap-[18px] sm:rounded-[31px] sm:px-5 sm:py-[18px]">
      <span
        className={`relative shrink-0 transition-opacity duration-200 motion-reduce:transition-none ${contentVisibility}`}
      >
        <img
          src={image}
          alt=""
          width={57}
          height={57}
          className="size-11 rounded-full object-cover sm:size-[57px]"
        />
        <img
          src="/favicon.png"
          alt=""
          aria-hidden="true"
          width={24}
          height={24}
          className="absolute -right-[4px] -bottom-[4px] size-[18px] rounded-[5px] sm:-right-[5px] sm:-bottom-[5px] sm:size-6 sm:rounded-[7px]"
        />
      </span>
      <span
        className={`relative min-w-0 flex-1 transition-opacity duration-200 motion-reduce:transition-none ${contentVisibility}`}
      >
        <span className="block truncate text-[17px] leading-[21px] font-bold tracking-[-0.01em] sm:text-[21px] sm:leading-[26px]">
          {title}
        </span>
        <span className="mt-0.5 block text-[15px] leading-[19px] font-medium tracking-[-0.01em] text-pretty sm:text-[20px] sm:leading-[22px]">
          {description}
        </span>
      </span>
    </span>
  );

  const wrapperClassName =
    "group focus-visible:outline-accent block w-full max-w-[559px] focus-visible:outline-2 focus-visible:outline-offset-2";

  if (!link) {
    return <div className="w-full max-w-[559px]">{card}</div>;
  }

  if (link.startsWith("/")) {
    return (
      <Link to={link} className={wrapperClassName} tabIndex={tabIndex}>
        {card}
      </Link>
    );
  }

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className={wrapperClassName}
      tabIndex={tabIndex}
    >
      {card}
    </a>
  );
}
