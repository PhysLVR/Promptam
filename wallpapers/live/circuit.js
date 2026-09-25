/* ═══ مدار الکترونیکی — SVG + نورهای متحرک ═══
   SVG به‌عنوان پس‌زمینه کش می‌شه.
   ده‌ها نقطهٔ نورانی روی مسیرها حرکت می‌کنن، با trail. */

import {
  TAU, clamp, rgba, makeCanvas, fit2d, watchSize, localPointer,
} from "../shared/canvas.js";

/* ── SVG inline ──
   همون محتوای قبلی رو اینجا نگه‌دار (دست نزن) */
const SVG_RAW = String.raw`
<svg id="a" xmlns="http://www.w3.org/2000/svg" width="519.45" height="519.45" viewBox="0 0 519.45 519.45"><path d="M518.45,193.13c-20.21,1.33-42.25-2.67-61.61,1.54-12.97,14.56-30.74,27.15-41.2,42.85-.83,7.18,1.86,15.75-1.28,22.22-14.6,14.21-29.4,28.22-43.83,42.59-56.6,3.61-115.14.06-172.37,1.23-9.25,3-14.97,13.86-22.99,19.58" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M494.93,394.24c-22.29-4.24-16.34,11.48-31.45,13.82-17.88-.17-35.77-.08-53.65-.07-4.42-.06-6.65-5.56-10.05-7.93-2.49-6.11-.65-14.53-.81-21.15h9.06c-1.65-31.57,7.56-28.87-26.21-28.27-3.48,0-2.95.71-2.93,2.9.06,7.58.01,15.15.04,22.73-.83,3.16,1.94,2.75,4.39,2.65,1.33,28.33-1.95,19.98,17.94,40.52,9.35,8.1,49.78,1.64,64.86,3.57,15.63,5.89,5.81,14.1,30.13,11.92" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M518.45,187.58c-88.34,1.81-48.21-13.07-110.2,40.98-53.74-.01-107.47-.02-161.21.02-6.98-2.53-11.28-10.54-16.87-15.4-2.33-2.31-5.61-.91-8.5-1.28-13.36-3.61-19.72,8.01-27.75,16.39" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M518.45,177.27c-81.02,2.51-55.34-15.24-113.61,42.57-50.24,3.72-102.63.04-153.57,1.33-7-2.6-11.36-10.63-17.13-15.41-10.26-3.13-22.7-.68-33.61-1.01" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M209.51,157.19c-12.96-.73-26.1-.03-39.11-.26-1.42,6.32-.08,13.48-.53,20.09.16,3.13,6.67,10.93,9.78,10.04,10.4,0,20.79,0,31.19,0,.87-2.39-1.21-7.12,2.91-6.06,16.33,1.28,34.53-2.63,49.98,1.54,5.77,4.51,9.96,13.1,17.15,14.86,14.65-.06,29.21-.03,43.87-.03-3.49,21.13,14.75,20.19,16.7,9.25-2.14-9.58,7.16-56.87-11.91-46.2-6.75,3.27-3.54,11.5-4.23,17.66.05,1.63-.51,2.17-2.14,2.14-12.87-1.57-27.84,2.14-39.66-2.39-4.9-4.16-8.86-12.01-15.04-13.51-19.03.02-38.06.01-57.1.01-1.05-1.92,1.12-6.72-1.31-7.14" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M256.29,341.65c1.05,13.77-2.13,28.98,1.28,42.06,20.3,19.43,39.7,39.88,59.8,59.44,28.97-.82,58.15.01,87.18-.33,7.37.86,11.15,9.43,16.75,13.62,22.27-2.61,47.26,3.12,68.42-2.16,1.98-2.7,5.47-6.33,9.19-4.58,12.3,7.77-2.94,19.91-9.79,7.96" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M246.51,354.34c1.27,11.83-2.71,25.66,1.82,36.5,18.95,18.85,37.47,38.11,56.54,56.83,29.12,3.6,60.35.1,90.16,1.25,6.51.5,9.95,8.37,15.02,11.96,22.15,4.23,46.84.2,69.81,1.53,1.53,0,2.59.37,3.75,1.55,11.16,12.21,24.92,23.26,34.84,35.99" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M518.45,161.68c-44.57,0-89.15-.01-133.72.04-8.75-2.64-14.37-12.53-21.11-18.57-44.28-7.34-93.46-.2-139.31-2.61" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M518.45,120.72c-37.82-1.88-78.06,3.7-114.75-2.06-14-14.19-28.18-28.21-42.18-42.39-43.74-5.81-91.01-.15-135.89-2.06" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M518.45,170.67c-48.03-1.49-97.97,2.9-145.12-1.55-6.74-5.4-11.29-16.09-19.79-18.05-38.15.07-76.29.05-114.43.05-1.05,4.65-5.28,9.31-10.31,7.4-14.41-7.69,5.87-23.44,10.04-7.66" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M200.26,380.77c-9.61-5.29,1.77-17.38,7.68-8.2,1.33,2.92-.98,6.24-2.97,8.12-2.69-.87-3.13,26.88-1.56,27.58,26.05,27.93,53.44,54.55,80.08,81.93,31.96,2.19,65.18.08,97.55.68,8.01-.82,11.07,14.85,18.47,9.53,5.2-2.24,8.49.63,9.85,5.6,5.08,13.11-17.72,15.96-14.31-2.36" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M252.33,129.97c35.74.75,71.73.03,107.56.22,8.83,2.64,18,16.61,25.87,22.8,29.72,4.4,62.18.11,92.79,1.6,1.63,0,2.88-.32,3.99-1.6,3.42-2.61,5.5-8.17,10.28-7.99,6.52.34,13.1-.38,19.56.04" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M380.5,518.45c4.71-.88,1.38-8.19,2.41-11.63-.1-2.89-7.9-11.18-10.87-10.55-30.7-1.45-63.22,2.78-93.06-1.56-18.43-18.49-37.22-36.6-55.47-55.26-9.6-9.61-19.45-18.96-29.03-28.58-7.83-2.02-16.67-.15-25.04-.76.09,14.63-22.86,13.83-21.5-.79.74-13.15,21.5-12.28,21.4.53" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M445.78,283.78c-9.37,1.43-21.2-3.15-29.12,2.59-11.69,11.74-23.88,22.99-35.61,34.69-53.16,5.96-109.85.11-164.14,2.09" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M518.45,134.46c-39.5-1.89-81.41,3.71-119.77-2.06-14.97-15.16-30.11-30.15-45.09-45.3-1.62-1.64-3.2-2.1-5.34-2.09-14.89.06-29.78.03-44.66.03" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M364.91,404.02c-15.31,9.35,2.32,25.32,10.08,11.12,3.86-8.41-8.15-9.24-7.97-13.76.03-7.31-.09-14.63.38-21.9,1.23-.73,2.78.17,4.16-.74-.2-9.16-.73-18.5-.99-28.1h-29.44v28.31c2.07.56,4.01-.15,6.08.59-1.16,8.88,2.53,20.11-1.82,27.95-1.87,1.62-4.46,4.69-3.41,7.35,4.24,9.96,17.2-.81,8.67-7.11" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M252.06,1.26c4.14,1.95,5.88,7.95,10.84,7.96,15.77-.05,31.54-.02,47.31-.06,36.24,28.58,67.4,66.51,101.17,98.91,15.73,3.45,33.57.19,50,1.28" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M319.72,1.26c32.88,30.69,63.68,63.73,95.63,95.44,1.2,1.24,2.39,1.58,4,1.58,14.98-1.34,31.91,2.6,45.98-1.61,7.98-8.76,16.95-16.53,25.07-25.15,7.31-3.18,16.61-.39,24.62-1.28" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M57.56,340.33c-.54,37.42-1.17,16.52,14.81,40.7-.01,40.88-.01,81.75-.02,122.63.12,4.06-9.54,11.86-12.67,14.8" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M65.22,339.8c1.18,8.55-2.55,19.29,1.83,26.71,4.55,4.96,13.32,8.16,12.44,15.83,0,45.37,0,90.74,0,136.1" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M91.65,202.11c-15.89,12.91-30.92,26.89-46.52,40.16-5.63,6.52-18.55,12.8-21.04,20.35.49,33.91.02,67.83.17,101.75" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M508.41,340.07c-.32,3.28,1,7.13-.52,10.05-2.98,2.14-5.08,6.79-8.73,7.39-18.04-.28-36.22.55-54.18-.29,0-2.26,0-4.56,0-7.11h-30.39v28.74c9.16.31,18.06-.29,26.96.32,3.7-.04,1.25-5.32,2.38-7.61,20.34-.84,40.9-.07,61.31-.24,6.01.04,8.82-6.43,12.69-10.1" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M333.2,255.76c-25.49.02-12.43-2.19-31.45,7.68-11.47,1-24.42-2.11-35.17,1.28-6.26,4.68-10.96,13.86-18.74,15.39-20.61-.05-41.23-.04-61.84-.02-6.1-.77-9-9.14-14.27-11.64" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M445.78,259.99c-6.59-.24-13.87-.87-20.28-.08-14.57,12.27-27.45,27.45-41.34,40.73-4.04,3.29-6.79,9.4-12.64,9.36-25.68.84-52.11-1.92-77.43,1" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M102.22,65.22c1.32,17.73-2.65,37.34,1.55,54.21,6.5,8.07,17.82,14.22,21.46,23.75.88,16.45-1.86,34.09,1.02,49.96,7.21,5.46,12.06,16.73,22.48,14.79" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M518.45,239.38c-6.31,9.58-18.65,16.11-22.75,26.69.39,15.26-.67,30.83.4,45.94-8.93,9.16-18.58,17.22-27.57,26.24-1.53,1.6-3.13,2.15-5.32,2.13-14.01-.1-28.01-.06-42.02-.04-5.1-.18-11.29,2.74-14.54-2.92-7.15-18.67,24.71-14.18,11.89,2.38" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M315.23,272.68c-14.51-.75-29.27.01-43.87-.3-7.19,1.76-11.37,10.36-17.15,14.86-26.71,4.65-56.2.44-83.8,1.83" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M518.45,221.67c-6.21-1.21-7.8,4.91-11.91,7.91-8.42,10.29-21.78,18.51-27.5,30.14-.98,15.4,2.14,32.07-1.22,46.83-5.67,6.05-11.64,11.8-17.22,17.93-12.8,4.08-28.57-.95-41.77,1.97" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M518.45,53.33c-4.67,9.58-17.46,4.28-25.9,5.53-7.16,1.24-11.19,10.05-16.92,14.29-5.52,4.08-9.29,12.62-16.38,13.51-12.6-.07-25.2-.04-37.79-.02-9.59-4.12-15.93-15.57-24.36-22.16-2.35-2.49-.88-5.99-1.28-9.03" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M142.39,350.11c1-5.59-2.33-12.67,1.54-17.23,9.17-6.25,10.85-16.01,1.65-23.23-3.34-2.12-5.54-7.22-9.54-7.64-22.9,0-45.81.01-68.71-.02-5.01.93-7.69,6.82-11.63,9.8" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M189.96,478.81c4.42,3.06,7.16,10.19,12.68,10.85,12.13.86,25.48-1.77,37.03,1.02,8.36,6.77,17.65,23.41,27.99,24.67,15.15-.15,30.31,0,45.46-.13,2.62-.02,4.71.57,6,2.75.44.74.81.26,1.14.48" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M51.21,296.73c28.9-.14,57.79.41,86.68.25,7.75,3.21,13.11,12.13,19.88,17.39,4.12,5.42,1.47,13.44,1.79,19.88" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M497.84,503.66c-10.17-8.85-19.8-19.43-29.82-28.84-30.3-4.34-63.23-.12-94.39-1.55" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M329.5,405.08c12.52,4.47-.77,22.24-6.83,8.98-.07-3.01,2.54-5.62,4.75-7.35,5.01-7.2.54-19.76,2.53-28.59,1.54-.89,3.13.65,4.84-.54v-26.95h-29.6v28.28c1.85,0,3.44,0,4.9,0,.31,5.29,2.49,26.57-2.5,28.32-3.08,2.09-5.69,6.92-3.19,8.94,7.61,8.01,16.43-3.29,8.45-9.77" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M114.64,243.34c15.68,0,31.36.01,47.04-.02,6.24,1.29,9.91,8.8,15.04,12.46,18,2.84,37.55.12,56.05,1.03" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M391.07,380.77c2.48,21.49-2.38,17.02,13.72,34.11,25.31,2.93,52.57.06,78.52,1.04" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M49.89,340.33v109.68" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M463.48,38.53c-1.35-27.11-44.82-22.74-39.29,4.21,4.62,21.52,38.94,17.85,39.29-3.95" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M293.29,310.47c-30.97-1.51-62.82-.02-94.08-.52-4.77.4-8.12,6.42-11.36,9.77" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M34.03,340.33c.75,12.31,0,24.87.28,37.26,0,1.74-.24,3.09-1.83,4.29-2.93,3.02-8.17,5.74-8.52,10.25,2.83,39.62-10.5,11.55-7.38,45.19" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M41.17,219.29c-.16,2.63.79,5.18-1.55,7.17-43.35,42.78-28.23,24.7-30.69,85.06" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M182.82,136.31c9.61-9.24,19.21-18.49,28.51-28.04,29.4-6.8,64.76-.9,95.7-2.35" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M89.53,177.54c-29.4-.75-59.05-.01-88.53-.26" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M40.38,342.18c0,12.6-.01,25.19.01,37.79,0,1.72-.28,3.06-1.81,4.29-2.63,3.19-8.02,5.58-8.27,9.98.05,8.02.02,16.03.02,24.05" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M430.19,39.06c1.98,17.28,24.23,16.62,26.91,1.84,2.53-20.14-26.96-20.12-26.91-2.11" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M516.08,339.54c-.86,4.25,1.12,9.4-.75,13.09-3.55,4.26-8.47,12.02-14.58,11.74-18.21.27-36.58-.49-54.71.27" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M102.75,346.67c-.11,21.04-2.35,21.62,14.31,35.64,4.29,7.77.81,22.8,1.81,32.28" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M252.59,518.45c-5.7-3.91-11.15-10.7-16.26-15.95-6.72-6.95-38.72-.49-50.07-2.55" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M221.94,353.02c1.93,13.88-4.49,37.18,3.91,47.88,20.3,20.2,40.42,40.71,60.31,61.26" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M112.26,442.34c1.39,11.57-3.65,27.27,1.25,37.33,12.84,12.67,24.93,26.81,38.13,38.78" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M138.42,442.61c1.2,12.1-3.55,26.17,1.03,37.29,12.21,12.4,23.34,27.23,35.97,38.56" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M122.04,442.34c1.12,12.08-3.2,25.77.75,37.04,12.48,12.72,23.89,26.9,36.78,38.94" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M163,94.03c-3.61,4.1-11.26,7.47-11.87,12.95-.03,16.47-.02,32.95-.02,49.42" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M60.73,109.88c-7.59.85-16.39-1.81-23.33,1.24-7.51,7.04-14.32,14.76-21.55,22.06-4.22,2.8-10,.62-14.84,1.28" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M211.36,171.99c16.72-.75,33.68.03,50.48-.3,2.45-.01,4.39.66,6.09,2.4,5.08,3.85,8.78,11.62,15.05,12.98,14.18-.02,28.37-.01,42.55-.01" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M72.35,340.86c-1.65,21.02,1.86,21.04,16.16,34.85,3.44,7.11,1.04,16.76,1.28,24.62" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M26.9,30.07c4,7.05,19.14,3.07,12.95-5.29-6.5-8.09-11.15,3.5-18.24,2.42-6.87-.13-13.74-.04-20.61-.04" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M57.82,192.87c-4.99.82-10.72,1.06-13.64-3.8-13.09-3.93-28.72-.29-42.65-1.49" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M129.97,442.61c-.19,11.64-2.03,24.46-.28,35.69,12.85,13.07,25.02,28.29,38.34,40.16" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M120.45,34.03c-1.06,8.08-.82,12.88,6.34,17.71,5.18,7.83.59,26.24,2.12,36.2" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M54.91,160.89c-7.52-1-13.53.39-17.7,7.14-7.78,6.11-25.42,1.02-35.68,2.64" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M16.33,437.59c-10.76.94-11.89,15.17-1.83,17.6,11.34,3.05,16.21-15.99,2.36-17.6" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M317.87,112.79c11.3.56,11.5-18.86-1.58-17.4-10.15,1.45-8.78,17.44,1.32,17.67" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M13.69,503.92c1.42,5.48,11.7,7.3,13.23,1.33,3.49-5.93-5.74-13.6-10.49-7.85-2.05,3.38-14.14,4.9-15.42,1.5" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M50.68,296.46c-.73-12.04-17.63-10.19-17.17.53.85,11.26,16.6,10.26,17.44-.26" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M439.17,512.11c-9.38,11.18-21.52-5.2-9.22-11.3,4.46-1.21,9.35,3.61,9.77,8.13,12.04,1.22,25.83-2.73,36.99.51,3.09,2.85,5.74,7.34,9.5,9" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M115.7,333.2c1.87,10.38-2.32,22.72,1.79,32.31,4.21,4.61,11.23,7.6,13.63,13.4.18,8.6.47,17.43-.09,25.9" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M114.11,243.08c-2.32-11.38-17.97-8.09-16.34,2.37,1.69,10.27,16.88,8.04,16.61-2.11" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M310.2,54.12c.35,9.46,14.31,11.03,16.39,2.11,2.44-10.92-14.32-14.6-16.39-2.38" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M115.96,332.93c11.28-1.22,9.26-16.63-.53-16.39-10.19.74-10.5,15.61.26,16.39" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M309.94,53.86c-15.07-.2-30.13.41-45.19.26" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M278.76,34.3c-14.98-.2-29.95.4-44.93.26" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M142.12,350.37c-8.4.79-11.12,12.93-2.64,15.86,11.96,3.86,14.85-14.44,2.91-15.86" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M44.34,47.25c-11.08-.07-22.24.56-33.29.46-5.46-.75-7.93,2.61-10.05,6.67" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M396.09,55.18c13.08-.91,7.06-20.77-4.23-14.8-6.56,4.39-4.55,13.98,3.97,14.8" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M333.46,256.03c1.18,10.68,17.55,9.19,15.85-1.59-1.95-9.61-15.26-7.79-15.85,1.32" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M92.18,202.38c4.54,9.85,18.01,3.19,14.77-5.8-3.63-8.97-17.48-4.87-15.03,5.54" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M106.18,442.08c.71,11.99-2.71,25.51.25,36.75,12.77,12.82,24.77,27.71,37.81,39.63" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M60.2,1c-1.8,1.13-3.62.59-5.56.33-8.02-2.14-12.83,10.38-4.75,14.21,7.79,3.6,14.85-7.58,7.93-13.21" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M496.52,435.21c1.86,13.43,19.26,6.32,13.48-4.49-4.15-6.74-13.19-3.2-13.48,4.23" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M38.26,146.09c7.86,5.52,15.86-2.52,11.36-9.78-6.47-8.44-18.09,1.91-11.63,9.78" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M446.04,260.26c.68,7.32,10.85,10.64,14.28,2.91,4.91-11.14-13.42-14.8-14.28-3.18" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M164.06,39.58c-10.76-7.34-18.71,10.84-5.55,13.03,7.33.09,10-7.95,5.82-12.76" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M224.05,140.27c.39-7.19-9.86-11.22-13.74-4.76-6.16,10.54,11.16,16.39,13.74,5.02" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M89.53,400.59c-8.55.95-9.31,13.8-.53,15.06,10.45.81,11.47-14.18.79-15.06" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M78.96,4.17c-7.24.64-10.06,11.18-2.91,14.27,11.02,4.69,14.8-13.23,3.17-14.27" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M55.44,161.15c-.21,8.97,13.23,10.18,14.8,1.32.89-9.62-12.71-12.18-15.06-1.59" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M252.06,129.7c-1.3-10.66-17.9-7.31-14.54,2.64,2.54,8.49,14.32,5.87,14.54-2.38" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M185.99,499.69c-.5-7.83-11.81-9.94-14.55-2.65-3.81,10.63,13.55,14.27,14.55,2.91" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M200.26,204.49c-.04-8.14-11.33-10.02-14.27-2.64-4.14,10.24,13.7,14.32,14.27,3.17" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M170.14,288.8c-.76-7.74-12.44-9.17-14.54-1.59-2.54,10.71,13.84,12.45,14.54,1.85" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M171.72,268.18c5.23-8.12-5.35-15.86-11.09-9.24-6.47,7.73,4.87,16.01,10.83,9.51" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M497.84,503.92c-5.07,7.56,3.01,15.5,9.78,10.58,7.76-6.26-2.49-17.14-9.52-10.84" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M182.56,136.31c-9.22-7.72-18.58,7.89-7.14,11.89,6.98,1.87,11.25-6.23,7.4-11.63" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M166.97,1c3.44,2.52,20.36,18.84,19.64,22.21-1.77,7.22,2.79,12.13,7.58,16.9" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M61.26,110.15c1.15,6.97,10.52,8.22,12.66,1.84,4.03-11.29-12.75-14.76-12.93-2.1" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M216.65,322.89c-1.63-10.78-15.12-7.64-14.27,1.06,1.03,8.5,13.77,7.65,14.27-.53" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M151.11,1c7.17,5.58,13.42,13.66,19.5,19.79.41,8.46.41,13.34-6.29,18.8" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M315.49,272.94c-.08,9.98,13.38,9.14,13.99,1.32,1.05-9.2-12.89-10.15-13.99-1.58" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M159.04,1c7.4,6.05,13.07,14.25,20.1,20.87,2.65,5.13-.07,11.79.78,17.45" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M138.42,454.5c4.48.57,8.99.27,13.48.2,7.28-1.44,6.83-11.23-.53-12.07-11.88-.36-23.78-.46-35.67-1.01-9.13,2.13-28.15-6.64-30.66,6,.01,10.77,43.51,4.67,52.86,6.87" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M233.04,257.08c1.1,7.78,12.82,8.8,14.01.26.29-9.76-13.25-9.68-14.01-.53" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M227.22,73.94c-1.15-6.91-11.14-7.84-13.48-1.32-2.78,10.41,13.4,12.55,13.48,1.85" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M41.43,219.03c8.69-1.37,7.76-12.44,1.05-13.46-10.12-1.23-10.56,12.24-1.32,13.46" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M494.93,394.51c1.57,9.58,15.7,6.88,13.48-2.38-2.56-6.33-12.28-6.38-13.21,1.85" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M477.49,228.28c-7.54-9.93-9.89-8.03-21.15-8.43-6.11,1.14-10.25,9.16-15.06,13.18" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M102.48,64.96c6.42-.73,8.66-9.02,2.91-12.69-9.53-4.21-14.1,11.76-3.17,12.69" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M37.73,146.35c-15.94,16.63-12.89,16.09-36.21,15.33" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M469.3,103.01c-9.04,1.33-6.89,13.51,1.06,12.95,8.03-.97,7.43-12.94-.79-12.95" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M381.56,1c-5.06,1.82-6.61,8.02-2.91,11.63,9.81,7.67,19.07-5.97,7.14-11.63" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M475.64,233.83c.22,7.02,9.69,9.85,13.48,3.7,6.49-10.37-13-16.5-13.48-3.96" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M94.82,226.69c-12.07,9.17-23.99,18.55-35.94,27.88" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M455.03,275.32c8.81.44,11.1,13.44,2.64,16.39-12.72,4.07-15.62-15.91-2.91-16.39" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M128.65,88.21c-6.87,1.17-7.5,11.5-.52,12.64,8.69,1.55,10.06-12.36.78-12.64" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M159.3,334.52c-8.79.75-7.79,13.67.79,12.95,7.49-1.45,6.89-11.73-.53-12.95" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M120.72,33.77c5.88-.83,7.99-9.71,2.11-12.16-9.34-3.67-12.49,11.53-2.38,12.16" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M485.16,1c10.88,5.8,20.48,27.68,33.3,26.16" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M58.74,254.44c-5.49-4.99-13.86,1.15-10.17,7.66,5.27,6.68,14.47-.05,10.31-7.4" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M49.63,450.27c-8.68,1.35-6.38,13.92,1.58,12.66,7.13-1.81,6.14-11.98-1.32-12.66" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M118.6,414.86c-8.01,1.26-8.37,10.49-1.32,12.4,7.96,1.37,9.82-11.19,1.58-12.4" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M103.01,346.15c6.72-1.11,6.56-11.45-.26-12.16-8.97-.25-9,11.92,0,12.42" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M130.76,405.08c-5.95.74-8.03,8.98-2.38,11.89,8.5,3.48,12.63-11.07,2.64-11.89" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M194.19,40.38c-4.45,4.55.63,12.85,6.61,10.04,7.86-4.26.69-14.69-6.34-10.31" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M149,208.19c.76,6.38,9.86,8.19,12.16,1.85,2.28-8.46-10.46-10.99-12.16-2.11" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M44.61,47.25c1.12,7.88,11.38,9.94,14.55,3.18,5.17-10.83-13.4-15.65-14.28-3.44" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M156.66,21.88c-8.18,0-8.15,12.01,0,11.89,7.49-.52,7.2-10.55.26-11.89" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M58.08,193.13c.05,6.31,9.17,8.13,11.63,2.38,2.6-7.83-10.19-11.15-11.63-2.64" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M99.31,169.61c10.03,2.92,8.12,15.44-1.06,16.08-11.53-.07-10.35-16.88.8-16.08" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M14.74,202.11c.37,9.44,14.63,7.93,13.2-1.05-1.22-7.02-11.78-7.65-13.2.79" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M36.15,98.25c8.01-.79,8.5-10.62,1.31-12.39-8.64-1.26-9.44,11.68-1.58,12.39" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M31.92,96.93c-9.65,6.98-18.4,25.26-30.92,23.78" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M296.73,78.7c-9.76-.48-8.26,16.42,1.05,14.5,7.34-1.85,7.22-14.12-.78-14.5" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M246.78,353.81c8.49-1.23,4.64-13.95-2.85-10.45-5.25,2.55-2.97,10.16,2.59,10.72" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M256.56,341.39c8.39-.55,5.64-13.4-2.1-10.54-5.49,1.99-3.89,10.45,1.84,10.54" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M102.48,213.48c12.15,1.27,9.18,18.24-1.32,16.36-10.17-1.67-8.94-15.48,1.05-16.36" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M151.37,156.66c6.57.99,9.75,9.27,3.44,13.48-10.48,5.78-15.8-12.05-3.7-13.48" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M171.19,79.75c13.21,2.12,6.41,22.3-5.27,15.82-7.87-5.07-4.08-15.76,5-15.82" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M163.53,409.84c-1.13-6.74-9.76-5.83-10.15.53.3,6.65,9.75,7.01,10.41-.27" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M30.33,418.56c-8.71,1.53-7.36,13.67.26,13.48,7.19-.61,7.81-11.63,0-13.48" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M226.96,28.48c-7.78,1.13-7.69,10.64-1.04,12.37,8.06,1.07,10.51-10.96,1.31-12.37" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M182.03,466.92c-12.54,2.92-2.43,21.4,7.14,12.16,4.57-4.5.11-13.66-6.61-12.16" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M264.48,54.12c-1.3-8.54-13.94-6.66-12.42,1.85,1.89,6.8,12.07,5.71,12.16-1.59" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M441.02,233.04c-7.55-5.54-15.59,2.37-11.36,9.51,6.15,8.17,17.78-1.44,11.63-9.25" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M180.18,39.58c8.33,2.02,6.86,11.52,0,12.16-7.96-.05-7.98-11.06-.26-12.16" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M55.44,311.79c-7.2-4.92-14.86,3.13-10.08,9.54,6.2,7.34,16.75-2.52,10.34-9.27" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M193.92,228.54c5.78,8.65-6.21,16.96-11.63,8.72-5.08-7.22,5.8-14.96,11.36-8.99" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M198.68,19.5c9.51,1.29,4.97,16.01-3.68,11.07-4.62-3.28-2.37-11.05,3.42-11.07" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M1.26,75c12.28,6.17,12.79-14.58-.26-9.78" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M24.52,364.65c5.06,1.64,6.96,9.22,1.06,11.36-10.06,3.3-11.71-10.58-1.59-11.63" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M8.93,311.79c-5.06.75-8.29,7.26-3.17,10.57,7.91,4.2,11.8-8.05,3.44-10.57" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M142.12,363.06c4.11-.24,5.82-5.57,2.37-7.91-5.65-3.95-9.9,6.72-2.63,7.91" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M187.58,319.72c-3.34-2.42-8.17,1.61-6.28,5.26,3.02,5.62,11.64-.48,6.54-4.99" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M175.95,326.59c-.46-4.12-6.06-5.52-7.92-1.58-2.99,5.88,7.07,8.38,7.92,1.84" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M322.63,53.59c-.32-3.93-5.88-5.1-7.65-1.58-2.82,6.54,6.99,8.77,7.91,1.84" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M279.02,34.56c1.06,11.47,18.75,9.82,16.63-1.85-2.42-9.13-15.47-7.65-16.63,1.58" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M1.53,153.22c10.07.3,10.5-15.64,0-14.8" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M1,239.91c.33-1.74,1.5-2.8,2.9-3.7,5.99-3.66,3.97-13.41-2.9-14.53" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M174.37,1c7.27,5.58,12.41,13.95,19.29,20.09" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M428.86,508.15c.35,5.02,6.28,4.58,7.14.53.17-4.47-5.64-6.25-7.4-.79" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M498.9,416.18c-1.06-9.45-14.18-8.83-15.23-.53.05,8.86,14.01,9.48,15.23.79" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M16.33,443.4c-5.61,1.58-3.1,8.17,1.3,7.06,3.75-1.03,2.91-6.83-1.03-7.06" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M5.49,341.65c-.07,7.46,1.45,13.76-4.49,19.29" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M143.18,1c5,2.81,8.03,8.43,12.4,12.18,2.46,2.4,1.51,5.52,1.35,8.43" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M222.46,338.22c8.01,1.47,8.43,12.45.54,14.05-10.55,1.88-11.16-14.64-.8-14.05" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M513.17,337.42c.98-7.15-9.51-6.54-8.41-.54,1.5,3.93,5.91,2.79,8.41.81" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M183.88,477.76c4.05-.57,3.7-6.44-.26-6.87-4.13.1-5.38,6.69,0,6.61" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M502.86,506.03c-4.6,1.47-3.26,6.97.78,6.56,3.59-.47,3.69-6.64-.25-6.56" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M181.77,499.43c-2.5-5.49-8.2-1.92-6.35,2.12,1.49,3.36,6.84,1.87,6.09-1.86" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M366.5,407.99c-5.93,1.35-4.08,10.53,1.32,8.72,3.77-1.91,3.21-7.94-1.06-8.72" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M7.34,339.8c3.19-3.61-1.5-7.27-4.49-4.49-2.92,2.83.86,7.77,4.49,4.76-.14-.44-.46-.76-.79-1.06" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M50.16,313.9c-4.09,1.18-3.26,6.2.53,5.8,3.4-.45,3.23-5.42-.26-5.8" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M16.59,197.09c-3.79-5.38-9.95-3.79-15.59-3.96" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M240.44,259.99c2.61-1.14,2.91-5.72-.26-6.35-3.15.5-3.31,5.17,0,6.35" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M89,405.61c-4.28,2.66-.88,6.82,2.36,5.51,2.63-1.49,1.47-6.35-1.83-5.51" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M163.53,264.48c-.03,2.41,2.96,3.31,4.55,1.37,2.77-3.94-4.01-5.88-4.82-1.63" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M227.22,37.47c4.11-1.77,2.1-5.53-.78-5.24-3.18.64-2.49,4.9.52,5.24" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M11.31,317.34c.18-3.37-4.71-3.4-5.02-.26-.48,3.67,4.69,3.84,5.28.53" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M508.94,228.01c.05,5.26,3.72,10.15,9.51,9.51" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M470.62,112.79c2.64-.53,2.28-4.53.23-5.49-1.66-.84-3.61,2.22-2.44,3.97.56.89,1.17,1.33,1.95,1.79" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M177.27,138.42c-5.75,1.24-2.86,8.11,1.31,6.33,3.13-1.63,2.51-5.91-1.05-6.33" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M44.08,142.92c2.84-.44,2.62-4.47,0-5-4.1.06-3.8,4.35-.26,5.26" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M52.27,44.34c-3.15.59-2.33,5.37.78,4.97,2.89-.38,2.38-4.74-.52-4.97" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M193.13,206.87c4.41-1.58,1.88-6.42-1.33-4.5-2.38,1.49-1.04,3.98,1.07,4.77" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M22.94,501.81c-1.46-3.35-4.94-2.49-4.76.53.7,2.99,4.58,2.62,5.03-.27" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M245.98,346.41c-2.84.13-2.25,4.35.27,4.18,2.49.2,3.04-4.14.26-4.18" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M283.51,34.56c.02,5.15,7.45,5.12,8.19.26.41-5.48-8.03-6.17-8.46-.53" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M156.39,30.07c1.98-.19,2.38-3.94.26-3.96-3-.79-3.62,3.64-.53,3.96" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M28.48,426.75c2.76,5.4,6.22-4.4,1.34-3.67-1.67.71-.72,2.3-1.34,3.41" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M219.29,139.48c-1.96-5.37-7.56-1.12-4.22,1.84,1.38,1.34,3.97.29,3.96-1.58" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M196.04,45.93c1.49,2.58,5.3.22,3.43-2.11-1.44-1.96-3.72-.2-3.17,1.85" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M432.3,238.32c1.45,5.65,8.49,3.66,7.13-1.32-1.11-4.15-6.8-2.89-7.13,1.06" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M518.45,138.69c-8.03,1.5-7.35,12.83,0,14.27" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M22.94,373.1c5.37-1.82.13-6.17-1.84-3.16-1.31,1.92.4,2.43,1.57,3.16" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M63.11,158.51c-4.18,1.41-2.59,5.27.23,5.19,2.97-.59,2.71-4.26.03-5.19" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M158.77,42.76c-4.57,1.86-1.45,7.1,1.59,4.49,1.99-1.5.76-3.76-1.32-4.49" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M296.73,83.98c-3.5.11-2.17,5.94.81,3.72,1.61-1.15.97-2.74-.55-3.72" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M518.45,64.96c-3.42,3.74-4.53,6.66-.26,10.04" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M1.53,143.18c5.86-.64,1.81,7.77-.26,4.23" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M513.43,337.69c1.3,1.7,3.17,1.62,5.02,1.59" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M79.49,1c-.12.97.22,1.97-.26,2.91" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M49.89,454.5c-2.5.16-3.47,3.92-.81,4.81,3.87,1.49,4.83-4.38,1.07-4.81" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M4.17,68.39c-2.78.21-3.32,4.16-.26,4.5,2.9.04,3.26-3.78.53-4.5" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M63.11,190.75c-3.05.92-2.06,5.5,1.05,4.97,3.15-.43,2.6-5.6-.78-4.97" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M21.35,199.21c-3.99,1.43-2.93,5.04.26,5.27,3.28-.21,3.09-5.12,0-5.27" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M154.55,206.61c-4.25,1.7,1.15,5.98,3.51,1.77-.59-1.48-1.74-1.93-3.25-1.77" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M309.94,410.1c-2.79.21-4.23,4.27-1.32,5.55,4.82,2.65,7.8-5.88,1.58-5.55" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M114.9,321.83c-2.79.91-2.9,5.1.26,5.59,4.13.34,5.06-5.64,0-5.59" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M292.23,460.05c-13.65,3.01-7.48,21.01,3.95,17.13,9.88-3.26,6.12-18.1-3.68-17.13" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M328.44,410.1c-4.38,1.66-2.71,6.19.79,5.8,3.51-.5,2.97-5.76-.53-5.8" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M209.25,320.51c-4.18,2.26-1.22,6.13,1.84,5,2.55-1.21,1.41-5.76-1.58-5" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M361.21,462.96c-13.12,3.14-6.07,21.21,5.02,16.91,8.84-4.13,6.15-18.08-4.76-16.91" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M346.94,410.1c-3.74,1.37-1.89,6.98,1.82,5.73,3.22-.89,2-6.45-1.55-5.73" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M490.97,413.54c-2.33.29-2.11,3.88,0,4.23,3.2.43,4.24-3.52.27-4.23" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M292.23,465.33c-4.13.59-3.81,6.85.26,7.13,5.26.52,5.89-7.25,0-7.13" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M101.95,55.18c-5.27,2.87-.42,7.88,2.64,4.76,1.5-1.67-.13-4.72-2.38-4.76" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M118.6,418.03c-4.34.77-4,5.11-.53,5.8,3.69.38,4.36-5.11.79-5.8" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M34.83,24.52c-2.89.21-5.15,3.33-3.17,5.81,4.46,4.58,9.28-3.62,3.44-5.81" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M257.35,52.01c-3.58.92-1.69,6.42,1.59,4.76,3.01-1,1.89-5.53-1.32-4.76" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M504.18,432.04c-3.24,1.7-3.24,3.56,0,5.81,3.26-2.37,3.32-3.64.26-5.81" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M363.06,467.45c-5.42,1.39-4.5,7.32,0,7.64,4.76-.12,4.53-6.56.26-7.64" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M219.56,71.83c-2.36.91-2.26,4.88-.01,6.1,4,1.29,4.18-6.85.28-6.1" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M39.85,208.72c-4.33,2.82-1.39,8.11,2.66,6.11,3.22-1.95,1.38-7.02-2.4-6.11" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M244.13,127.59c-3.25.88-2.36,5.75,1.03,4.95,2.76-.59,2.33-5.22-.77-4.95" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M322.89,270.3c-6.14,1.87-1.31,8.57,2.1,5.01,1.91-1.89.42-4.33-1.84-5.01" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M179.39,43.81c-2.33.44-2.22,4.06.27,4.01,2.64-.03,2.43-3.82,0-4.01" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M443.4,33.51c-6.51,1.13-5.24,9.01.26,8.96,5.47-.31,5.55-8.54,0-8.96" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M441.02,14.74c-47.29,9.45-13.34,68.69,21.42,40.18,17.74-16.25.22-42.81-21.16-40.18" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M78.7,8.66c-4.72,2.04-3.27,7.27,1.06,6.61,3.98-.61,3.31-7.04-.79-6.61" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M441.29,8.14c-49.06,6.6-29.88,73.86,14.49,58.29,34.78-12.3,20.61-61.61-14.23-58.29" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M52.53,5.23c-4.13,2.45-2.46,6.57,1.34,5.86,3.63-.99,2.74-6.43-1.07-5.86" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M161.68,286.16c-3.69,1.04-2.18,6.85,1.6,5.6,3.83-1.08,2.49-6.45-1.34-5.6" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M101.95,217.97c-6.28,2.09-3.56,9.66,1.85,7.94,4.46-1.33,2.86-8.31-1.59-7.94" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M97.73,147.15c-10.59,2.22-5.31,17.89,4.23,14.01,7.23-3.28,3.89-15.03-3.97-14.01" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M130.5,408.25c-4.13,1.59-2.23,6.2,1.04,5.76,3.4-.51,3.11-6.42-.77-5.76" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M231.45,148.73c-2.71.34-3.69,3.8-1.04,5,3.19,1.2,5-4.23,1.31-5" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M317.08,100.1c-7.71,2.62.56,11.39,3.96,5.29,1.1-1.94-1.07-5.65-3.7-5.29" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M187.58,230.66c-3.24.65-2.14,5.49,1.05,4.72,2.73-.67,2.31-5.23-.78-4.72" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M98.52,151.11c-4.51,2.74-2.72,6.73,1.32,6.36,4.17-.8,2.87-6.77-1.06-6.36" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M495.73,453.71c-5,1.98-.69,8.6,2.89,4.74,1.61-1.91-.23-4.97-2.62-4.74" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M159.3,337.69c-5.17,1.1-1.58,8.55,2.38,5.02,2.31-1.64.43-5.29-2.11-5.02" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M453.71,279.55c-5.58,3.94-1.24,10.29,3.71,7.42,4.16-2.5.95-8.5-3.45-7.42" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M101.95,336.9c-5.95,1.66-1.05,7.93,2.11,5.02,1.79-1.51.38-4.88-1.85-5.02" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M453.44,257.61c-4.26,1.7-2.21,6.93,1.6,5.58,3.25-.92,1.87-5.97-1.33-5.58" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M221.14,341.92c-4.64,2.35-1.95,6.64,1.29,6.5,3.97-.78,3.26-6.83-1.03-6.5" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M53.86,256.03c-4.55,1.31-2.64,6.76,1.04,4.99,2.25-1.19,1.63-4.37-.77-4.99" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M42.23,293.55c-5.24,1.54-3.28,7.67,1.04,6.82,3.99-.53,3.3-7.02-.78-6.82" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M255.5,333.99c-2.31.75-1.59,4.05.79,4.01,2.96-.28,3.16-3.93-.53-4.01" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/><path d="M482.25,229.86c-4.77,2.37-2.11,7.99,1.84,7.07,4.68-.86,3.13-8.1-1.57-7.07" style="fill:none; stroke:#000; stroke-linecap:round; stroke-linejoin:round; stroke-width:2px;"/></svg>
`;

/* ── SVG مخفی برای اندازه‌گیری طول مسیرها ──
   getPointAtLength در بعضی مرورگرها نیاز داره که path
   تو یه SVG متصل به DOM باشه. */
let _measureSvg = null;
function _getMeasureSvg() {
  if (_measureSvg) return _measureSvg;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.cssText =
    "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;left:-9999px;top:0";
  document.body.appendChild(svg);
  _measureSvg = svg;
  return svg;
}

/* ── پارس یک‌بار در module scope ── */
let _parsed = null;
function parseCircuitSVG() {
  if (_parsed) return _parsed;
  try {
    const doc = new DOMParser().parseFromString(SVG_RAW, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) throw new Error("no svg");

    const vbRaw = svg.getAttribute("viewBox") || "0 0 100 100";
    const p = vbRaw.split(/[\s,]+/).map(Number);
    const viewBox = {
      x: p[0] || 0,
      y: p[1] || 0,
      w: p[2] || 100,
      h: p[3] || 100,
    };

    const paths = [];       /* Path2D برای رندر پس‌زمینه */
    const measurers = [];   /* SVGPathElement در DOM برای getPointAtLength */
    const totals = [];      /* طول کل هر مسیر (واحد SVG) */

    const measureSvg = _getMeasureSvg();

    doc.querySelectorAll("path").forEach((el) => {
      const d = el.getAttribute("d");
      if (!d) return;
      try {
        paths.push(new Path2D(d));

        const mp = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path"
        );
        mp.setAttribute("d", d);
        measureSvg.appendChild(mp);

        const total = mp.getTotalLength();
        if (total > 0) {
          measurers.push(mp);
          totals.push(total);
        }
      } catch (_) {}
    });

    _parsed = { paths, measurers, totals, viewBox };
  } catch (e) {
    console.warn("circuit SVG parse failed", e);
    _parsed = {
      paths: [],
      measurers: [],
      totals: [],
      viewBox: { x: 0, y: 0, w: 100, h: 100 },
    };
  }
  return _parsed;
}

function bgColor(pal) {
  return pal.light ? pal.bg : "#05080d";
}

/* ── ساخت یه dot روی مسیر ── */
function makeDot(parsed) {
  const pi = Math.floor(Math.random() * parsed.totals.length);
  return {
    pathIndex: pi,
    pos: Math.random() * parsed.totals[pi],
    /* SVG units per second — می‌شه تنظیمش کرد */
    speed: 45 + Math.random() * 85,
    dir: Math.random() < 0.5 ? 1 : -1,
    color: Math.random() < 0.6 ? "acc" : "cyn",
    trail: [],
    trailLen: 8 + Math.floor(Math.random() * 6),
    size: 1.5 + Math.random() * 0.9,
    /* یه تأخیر کوچیک برای شروع غیرهم‌زمان */
    delay: Math.random() * 2,
  };
}

export default {
  meta: {
    title: "مدار الکترونیکی",
    category: "tech",
    tags: ["canvas", "circuit", "pcb", "svg", "signals"],
    engine: "Canvas 2D",
    cost: "light",
  },

  mount(container, ctx) {
    const cv = makeCanvas(container);
    const g = cv.getContext("2d");
    const RM = ctx.RM;
    let pal = ctx.pal;

    let W = 0, H = 0, raf = 0, last = 0;
    let off = null;
    let scale = 1, ox = 0, oy = 0;
    let pulse = 0;
    let dots = [];

    function build() {
      const { paths, viewBox } = parseCircuitSVG();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      off = document.createElement("canvas");
      off.width = Math.max(1, Math.round(W * dpr));
      off.height = Math.max(1, Math.round(H * dpr));
      const og = off.getContext("2d");
      og.scale(dpr, dpr);

      og.fillStyle = bgColor(pal);
      og.fillRect(0, 0, W, H);

      if (!paths.length) return;

      scale = Math.max(W / viewBox.w, H / viewBox.h) * 1.02;
      const drawW = viewBox.w * scale;
      const drawH = viewBox.h * scale;
      ox = (W - drawW) / 2;
      oy = (H - drawH) / 2;

      og.save();
      og.translate(ox, oy);
      og.scale(scale, scale);
      og.translate(-viewBox.x, -viewBox.y);

      const baseStroke = 2;
      const bright = pal.cyn;
      const mid = pal.acc;
      const dim = pal.blu;

      const layers = [
        { mul: 2.6, alpha: 0.06, color: mid },
        { mul: 2.6, alpha: 0.04, color: bright },
        { mul: 1.0, alpha: 0.24, color: mid },
        { mul: 1.0, alpha: 0.12, color: bright },
        { mul: 0.35, alpha: 0.45, color: bright },
      ];

      og.lineCap = "round";
      og.lineJoin = "round";

      for (const layer of layers) {
        og.strokeStyle = rgba(layer.color, layer.alpha);
        og.lineWidth = (baseStroke * layer.mul) / scale;
        for (const path of paths) og.stroke(path);
      }

      og.strokeStyle = rgba(dim, 0.16);
      og.lineWidth = baseStroke / scale;
      for (let i = 0; i < paths.length; i += 5) {
        og.stroke(paths[i]);
      }

      og.restore();
    }

    /* ── ساخت dots ── */
    function buildDots() {
      const parsed = parseCircuitSVG();
      if (!parsed.totals.length) {
        dots = [];
        return;
      }
      const n = RM
        ? 8
        : clamp(Math.round((W * H) / 100), 10, 100);
      dots = [];
      for (let i = 0; i < n; i++) dots.push(makeDot(parsed));
    }

    function resize() {
      const f = fit2d(cv, g);
      W = f.w; H = f.h;
      build();
      buildDots();
    }
    const stopWatch = watchSize(container, resize);
    resize();

    function frame(t) {
      raf = requestAnimationFrame(frame);
      const dt = clamp((t - last) || 16, 1, 50) / 1000;
      last = t;

      pulse += dt * 0.5;

      /* پاک + پس‌زمینه */
      g.clearRect(0, 0, W, H);
      g.drawImage(off, 0, 0, W, H);

      /* نفس ملایم روی کل مدار */
      const breath = 0.5 + 0.5 * Math.sin(pulse);
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = breath * 0.03;
      g.fillStyle = pal.cyn;
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;

      /* ── حرکت و رندر dots ── */
      const parsed = _parsed;
      if (parsed && parsed.measurers.length && dots.length) {
        for (const dot of dots) {
          /* تأخیر شروع */
          if (dot.delay > 0) {
            dot.delay -= dt;
            continue;
          }

          const total = parsed.totals[dot.pathIndex];

          /* حرکت */
          dot.pos += dot.speed * dot.dir * dt;

          /* برگشت از دو سر مسیر */
          if (dot.pos >= total) {
            dot.pos = total;
            dot.dir = -1;
            dot.trail.length = 0;
          } else if (dot.pos <= 0) {
            dot.pos = 0;
            dot.dir = 1;
            dot.trail.length = 0;
          }

          /* نقطهٔ فعلی در فضای SVG */
          let pt;
          try {
            pt = parsed.measurers[dot.pathIndex].getPointAtLength(dot.pos);
          } catch (_) {
            continue;
          }

          /* به‌روزرسانی trail */
          dot.trail.unshift({ x: pt.x, y: pt.y });
          if (dot.trail.length > dot.trailLen) dot.trail.pop();

          /* تبدیل به مختصات canvas */
          const cxx = ox + (pt.x - parsed.viewBox.x) * scale;
          const cyy = oy + (pt.y - parsed.viewBox.y) * scale;

          const col = dot.color === "acc" ? pal.acc : pal.cyn;

          /* trail — از قدیمی به جدید */
          const L = dot.trail.length;
          for (let i = L - 1; i >= 1; i--) {
            const tp = dot.trail[i];
            const tx = ox + (tp.x - parsed.viewBox.x) * scale;
            const ty = oy + (tp.y - parsed.viewBox.y) * scale;
            const a = (1 - i / L) * 0.5;
            const r = dot.size * (1 - i / (L + 1)) * 0.85;
            if (r <= 0.2) continue;
            g.fillStyle = rgba(col, a);
            g.beginPath();
            g.arc(tx, ty, r, 0, TAU);
            g.fill();
          }

          /* halo */
          const haloR = 10 * dot.size;
          const grd = g.createRadialGradient(cxx, cyy, 0, cxx, cyy, haloR);
          grd.addColorStop(0, rgba(col, 0.55));
          grd.addColorStop(0.4, rgba(col, 0.15));
          grd.addColorStop(1, rgba(col, 0));
          g.fillStyle = grd;
          g.beginPath();
          g.arc(cxx, cyy, haloR, 0, TAU);
          g.fill();

          /* core سفید */
          g.fillStyle = rgba("#ffffff", 0.95);
          g.beginPath();
          g.arc(cxx, cyy, dot.size * 0.85, 0, TAU);
          g.fill();
        }
      }

      /* ── هالهٔ موس ── */
      const ptr = localPointer(container, ctx.pointer);
      if (ptr.active) {
        const R = 180;
        const grd = g.createRadialGradient(ptr.x, ptr.y, 0, ptr.x, ptr.y, R);
        grd.addColorStop(0, rgba(pal.cyn, 0.10));
        grd.addColorStop(0.5, rgba(pal.acc, 0.045));
        grd.addColorStop(1, rgba(pal.acc, 0));
        g.fillStyle = grd;
        g.beginPath();
        g.arc(ptr.x, ptr.y, R, 0, TAU);
        g.fill();
      }

      g.globalCompositeOperation = "source-over";
    }

    return {
      start() {
        if (!raf) {
          last = performance.now();
          raf = requestAnimationFrame(frame);
        }
      },
      stop() {
        cancelAnimationFrame(raf);
        raf = 0;
      },
      resize,
      pal(newPal) {
        pal = newPal;
        build();
        /* dots رنگ رو از pal می‌گیرن، پس نیازی به rebuild نیست */
      },
      unmount() {
        this.stop();
        cv.remove();
        stopWatch();
      },
    };
  },
};