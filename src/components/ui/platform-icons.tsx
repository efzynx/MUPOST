import React from "react";

interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number;
}

/**
 * Official Meta Infinity Loop Logo
 */
export function MetaLogo({ className = "w-5 h-5", size, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 100 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      {...props}
    >
      <defs>
        <linearGradient id="meta-gradient" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#0064E0" />
          <stop offset="50%" stopColor="#0081FB" />
          <stop offset="100%" stopColor="#0079F4" />
        </linearGradient>
      </defs>
      <path
        d="M26.4 7C14.7 7 6 16.5 6 29.8C6 43.1 14.6 52.6 26.2 52.6C34.3 52.6 42.1 46.8 48.2 38.6C48.8 37.8 49.6 37.8 50.2 38.6C56.3 46.8 64.1 52.6 72.2 52.6C83.8 52.6 92.4 43.1 92.4 29.8C92.4 16.5 83.7 7 72 7C63.9 7 56 12.9 50 21.2C44 12.9 34.5 7 26.4 7ZM27.1 14.4C33.1 14.4 39.4 19.8 44.5 27.6L44.5 27.7C39.4 35.5 33.3 45.2 26.2 45.2C18.4 45.2 13.4 38.2 13.4 29.8C13.4 21.4 18.5 14.4 27.1 14.4ZM71.3 14.4C79.9 14.4 85 21.4 85 29.8C85 38.2 80 45.2 72.2 45.2C65.1 45.2 59 35.5 53.9 27.7L53.9 27.6C59 19.8 65.3 14.4 71.3 14.4Z"
        fill="url(#meta-gradient)"
      />
    </svg>
  );
}

/**
 * Official Facebook Logo
 */
export function FacebookLogo({ className = "w-5 h-5", size, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      {...props}
    >
      <path
        fill="#1877F2"
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
      />
      <path
        fill="#FFFFFF"
        d="M16.67 15.543l.532-3.47h-3.328v-2.25c0-.949.465-1.874 1.956-1.874h1.514V4.996s-1.374-.235-2.686-.235c-2.741 0-4.533 1.662-4.533 4.669v2.643H7.078v3.47h3.047v8.385a12.1 12.1 0 003.875 0v-8.385h2.67z"
      />
    </svg>
  );
}

/**
 * Official Instagram Logo with Radiant Gradient
 */
export function InstagramLogo({ className = "w-5 h-5", size, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      {...props}
    >
      <defs>
        <radialGradient id="ig-gradient-1" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497" />
          <stop offset="5%" stopColor="#fdf497" />
          <stop offset="45%" stopColor="#fd5949" />
          <stop offset="60%" stopColor="#d6249f" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ig-gradient-1)" />
      <circle cx="12" cy="12" r="3.2" stroke="#ffffff" strokeWidth="1.8" fill="none" />
      <path
        d="M16.8 3.6H7.2C5.2 3.6 3.6 5.2 3.6 7.2v9.6c0 2 1.6 3.6 3.6 3.6h9.6c2 0 3.6-1.6 3.6-3.6V7.2c0-2-1.6-3.6-3.6-3.6zm1.8 13.2c0 1-.8 1.8-1.8 1.8H7.2c-1 0-1.8-.8-1.8-1.8V7.2c0-1 .8-1.8 1.8-1.8h9.6c1 0 1.8.8 1.8 1.8v9.6z"
        fill="#ffffff"
      />
      <circle cx="17.2" cy="6.8" r="1" fill="#ffffff" />
    </svg>
  );
}

/**
 * Official TikTok Logo with Vibrant Cyan/Magenta Separation
 */
export function TikTokLogo({ className = "w-5 h-5", size, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      {...props}
    >
      <rect width="24" height="24" rx="6" fill="#000000" />
      <path
        d="M16.6 8.2c-.8-.5-1.4-1.2-1.7-2.1-.1-.3-.2-.7-.2-1.1h-2.5v11.3c0 1.4-1.1 2.5-2.5 2.5-1.4 0-2.5-1.1-2.5-2.5 0-1.4 1.1-2.5 2.5-2.5.3 0 .5 0 .8.1V11c-.3 0-.5-.1-.8-.1-2.8 0-5 2.2-5 5 0 2.8 2.2 5 5 5 2.8 0 5-2.2 5-5V9.9c1.1.8 2.5 1.3 3.9 1.3v-2.5c-.8 0-1.6-.2-2.2-.5z"
        fill="#25F4EE"
        transform="translate(-0.6, -0.6)"
      />
      <path
        d="M16.6 8.2c-.8-.5-1.4-1.2-1.7-2.1-.1-.3-.2-.7-.2-1.1h-2.5v11.3c0 1.4-1.1 2.5-2.5 2.5-1.4 0-2.5-1.1-2.5-2.5 0-1.4 1.1-2.5 2.5-2.5.3 0 .5 0 .8.1V11c-.3 0-.5-.1-.8-.1-2.8 0-5 2.2-5 5 0 2.8 2.2 5 5 5 2.8 0 5-2.2 5-5V9.9c1.1.8 2.5 1.3 3.9 1.3v-2.5c-.8 0-1.6-.2-2.2-.5z"
        fill="#FE2C55"
        transform="translate(0.6, 0.6)"
      />
      <path
        d="M16.6 8.2c-.8-.5-1.4-1.2-1.7-2.1-.1-.3-.2-.7-.2-1.1h-2.5v11.3c0 1.4-1.1 2.5-2.5 2.5-1.4 0-2.5-1.1-2.5-2.5 0-1.4 1.1-2.5 2.5-2.5.3 0 .5 0 .8.1V11c-.3 0-.5-.1-.8-.1-2.8 0-5 2.2-5 5 0 2.8 2.2 5 5 5 2.8 0 5-2.2 5-5V9.9c1.1.8 2.5 1.3 3.9 1.3v-2.5c-.8 0-1.6-.2-2.2-.5z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

/**
 * Official Threads Logo
 */
export function ThreadsLogo({ className = "w-5 h-5", size, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      {...props}
    >
      <rect width="24" height="24" rx="6" fill="#101010" stroke="#27272a" strokeWidth="0.8" />
      <path
        d="M16.4 11.2c-.1-.4-.3-1.6-1.1-2.5-1-1.1-2.3-1.6-3.9-1.6-3.2 0-5.5 2.1-5.5 5.5s2.3 5.5 5.5 5.5c2.3 0 4.1-1.2 4.9-3.1.2-.5-.1-1.1-.6-1.3-.5-.2-1.1.1-1.3.6-.6 1.4-1.9 2.2-3.6 2.2-2.3 0-3.9-1.5-3.9-3.9 0-.4.1-.9.2-1.3 1.1 1.6 2.8 2.4 4.7 2.4 2.4 0 4.2-1.4 4.2-3.4 0-1.8-1.5-3.1-3.6-3.1-1.2 0-2.2.4-2.8 1-.5.5-.8 1.2-.9 2-.2 1.5.3 2.9 1.4 3.7.8.6 1.8.8 2.8.5.5-.1.8-.7.7-1.2-.1-.5-.7-.8-1.2-.7-.6.2-1.2 0-1.7-.3-.6-.5-.9-1.2-.8-2.1.1-.5.3-.9.6-1.2.4-.4 1-.6 1.8-.6 1.3 0 2.2.8 2.2 1.9 0 1.2-1 2-2.6 2-1.3 0-2.5-.6-3.3-1.8 0-.2.1-.5.1-.7 0-1.8 1.4-3.3 3.5-3.3 1.1 0 2 .3 2.6 1 .5.6.7 1.4.8 1.7.2.7.9 1.1 1.6.9.7-.2 1.1-.9.9-1.6z"
        fill="#FFFFFF"
      />
    </svg>
  );
}
