/* ===== Ikon SVG inline (stroke 1.8, round cap) ===== */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function I(path: string) {
  return function Icon({ size = 18, ...rest }: P) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        {...rest}
      >
        {path.split('|').map((d, i) => (
          <path key={i} d={d} />
        ))}
      </svg>
    );
  };
}

export const IcDash = I('M4 4h6v6H4z|M14 4h6v4h-6z|M14 12h6v8h-6z|M4 14h6v6H4z');
export const IcSantri = I('M12 12a4 4 0 100-8 4 4 0 000 8z|M4 20c1.2-3.4 4.2-5 8-5s6.8 1.6 8 5');
export const IcUsers = I('M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7z|M2.5 19c1-2.9 3.5-4.5 6.5-4.5s5.5 1.6 6.5 4.5|M16 4.6a3.5 3.5 0 010 6.1|M18.5 14.9c1.6.8 2.6 2.2 3 4.1');
export const IcCard = I('M3 7.5A2.5 2.5 0 015.5 5h13A2.5 2.5 0 0121 7.5v9a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 16.5z|M7 15h4|M14.5 9.2a3.4 3.4 0 010 4.4|M17 7a6.6 6.6 0 010 8.8');
export const IcWallet = I('M3 7a2 2 0 012-2h13a1 1 0 011 1v2|M3 7v10a2 2 0 002 2h15a1 1 0 001-1V9a1 1 0 00-1-1H5a2 2 0 01-2-1z|M16.5 13.5h.01');
export const IcCart = I('M4 5h2l2.2 10.2a1.5 1.5 0 001.5 1.3h7.9a1.5 1.5 0 001.5-1.2L21 8H7|M10 20.5h.01|M17.5 20.5h.01');
export const IcBox = I('M12 3l8 4v10l-8 4-8-4V7z|M4 7l8 4 8-4|M12 11v9');
export const IcWasher = I('M4 4h16v16H4z|M8 7h.01|M12 7h4|M12 16.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z|M9.8 13.8c1.4 1 3 1 4.4 0');
export const IcBook = I('M5 4.5A2.5 2.5 0 017.5 2H19v17.5H7.5A2.5 2.5 0 005 22z|M5 19.5A2.5 2.5 0 017.5 17H19|M9 6.5h6');
export const IcClipboard = I('M9 4h6v3H9z|M9 5H6.5A1.5 1.5 0 005 6.5v13A1.5 1.5 0 006.5 21h11a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0017.5 5H15|M9 12l2 2 4-4');
export const IcCap = I('M12 4L2 9l10 5 10-5z|M6 11.5V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5|M22 9v5');
export const IcMoonStar = I('M19 13.5A7.5 7.5 0 0110.5 5 7.5 7.5 0 1019 13.5z|M18.5 3.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z');
export const IcAlert = I('M12 3.5L2.5 20h19z|M12 10v4|M12 17h.01');
export const IcReceipt = I('M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z|M9 8h6|M9 12h6');
export const IcChart = I('M4 20V4|M4 20h16|M8 16v-5|M12 16V7|M16 16v-8|M20 16V10');
export const IcShield = I('M12 3l7 2.8V11c0 4.6-3 8.4-7 9.5C8 19.4 5 15.6 5 11V5.8z|M9 11.5l2 2 4-4');
export const IcBell = I('M6 9.5a6 6 0 1112 0c0 5 1.5 6 1.5 6h-15S6 14.5 6 9.5z|M10 19a2 2 0 004 0');
export const IcSettings = I('M12 15a3 3 0 100-6 3 3 0 000 6z|M19 12a7 7 0 00-.15-1.44l2-1.55-2-3.46-2.35.95A7 7 0 0014 5.06L13.5 2.5h-3L10 5.06a7 7 0 00-2.5 1.44l-2.35-.95-2 3.46 2 1.55A7 7 0 005 12c0 .49.05.97.15 1.44l-2 1.55 2 3.46 2.35-.95A7 7 0 0010 18.94l.5 2.56h3l.5-2.56a7 7 0 002.5-1.44l2.35.95 2-3.46-2-1.55c.1-.47.15-.95.15-1.44z');
export const IcLogout = I('M9 21H5.5A1.5 1.5 0 014 19.5v-15A1.5 1.5 0 015.5 3H9|M16 16l4-4-4-4|M20 12H9');
export const IcSearch = I('M10.5 17a6.5 6.5 0 100-13 6.5 6.5 0 000 13z|M15.5 15.5L21 21');
export const IcPlus = I('M12 5v14|M5 12h14');
export const IcMinus = I('M5 12h14');
export const IcX = I('M6 6l12 12|M18 6L6 18');
export const IcCheck = I('M4.5 12.5l5 5L19.5 7');
export const IcPrinter = I('M7 8V3h10v5|M7 17H4a1 1 0 01-1-1v-6a1 1 0 011-1h16a1 1 0 011 1v6a1 1 0 01-1 1h-3|M7 14h10v7H7z');
export const IcScan = I('M4 8V5.5A1.5 1.5 0 015.5 4H8|M16 4h2.5A1.5 1.5 0 0120 5.5V8|M20 16v2.5a1.5 1.5 0 01-1.5 1.5H16|M8 20H5.5A1.5 1.5 0 014 18.5V16|M3 12h18');
export const IcChevR = I('M9 5l7 7-7 7');
export const IcChevD = I('M5 9l7 7 7-7');
export const IcChevL = I('M15 5l-7 7 7 7');
export const IcDownload = I('M12 4v11|M7.5 11l4.5 4.5L16.5 11|M4.5 20h15');
export const IcUpload = I('M12 20V9|M7.5 13L12 8.5 16.5 13|M4.5 4h15');
export const IcFilter = I('M4 5h16l-6.2 7.2V19l-3.6-2v-4.8z');
export const IcClock = I('M12 21a9 9 0 100-18 9 9 0 000 18z|M12 7v5l3.2 2');
export const IcRefresh = I('M20 12a8 8 0 11-2.3-5.6|M20 3v4h-4');
export const IcKey = I('M14.5 10.5a4.5 4.5 0 10-4.23 6L12 15v2h2v2h2.5l1-1.5V14l-3-3.5z|M14.5 10.5L20 5');
export const IcEdit = I('M4 20h4.5L20 8.5a2.1 2.1 0 00-3-3L5.5 17z|M14.5 7l3 3');
export const IcTrash = I('M4.5 6.5h15|M9 6V4h6v2|M6.5 6.5L7.5 20h9l1-13.5|M10 10.5v6|M14 10.5v6');
export const IcEye = I('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z|M12 15a3 3 0 100-6 3 3 0 000 6z');
export const IcArrowL = I('M19 12H5|M11 6l-6 6 6 6');
export const IcWifi = I('M2.5 9.5a15 15 0 0119 0|M5.5 13a10.5 10.5 0 0113 0|M8.7 16.3a6 6 0 016.6 0|M12 19.5h.01');
export const IcHome = I('M4 11l8-7 8 7v9a1 1 0 01-1 1h-5v-6h-4v6H5a1 1 0 01-1-1z');
export const IcInfo = I('M12 21a9 9 0 100-18 9 9 0 000 18z|M12 11v5|M12 8h.01');
export const IcLock = I('M6 11V8a6 6 0 1112 0v3|M5 11h14v9H5z|M12 15v2');
export const IcTag = I('M3.5 12.5v-9h9L21 12l-8.5 8.5z|M7.5 7.5h.01');
export const IcLayers = I('M12 3l9 5-9 5-9-5z|M3.5 13l8.5 4.7L20.5 13|M3.5 17l8.5 4.7L20.5 17');
export const IcFlask = I('M9.5 3h5|M10.5 3v6L4.8 18.5A1.5 1.5 0 006.2 21h11.6a1.5 1.5 0 001.4-2.5L13.5 9V3|M7.5 15h9');
export const IcStar = I('M12 3.5l2.5 5.4 5.9.6-4.4 4 1.2 5.8L12 16.4l-5.2 2.9 1.2-5.8-4.4-4 5.9-.6z');
export const IcSpark = I('M12 4l1.8 4.8L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.2z|M19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9z');
export const IcSend = I('M21 3L10 14|M21 3l-7 18-4-7-7-4z');
export const IcCal = I('M4.5 5.5h15v15h-15z|M4.5 10h15|M8 3.5v4|M16 3.5v4');
export const IcDot = I('M12 12h.01');
export const IcGrip = I('M4 7h16|M4 12h16|M4 17h16');

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect width="48" height="48" rx="11" fill="#0A1F3E" />
      <path
        d="M24 7l3.7 10.2L38.5 17.5l-8 6.7 3 10.3L24 28.7l-9.5 5.8 3-10.3-8-6.7 10.8-.3z"
        fill="#DBA63E"
      />
      <circle cx="24" cy="24" r="20.5" fill="none" stroke="#DBA63E" strokeOpacity="0.35" strokeDasharray="3 5" />
    </svg>
  );
}
