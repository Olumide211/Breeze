import type { Tool } from '../engine/brush';

/** 24x24 stroke icons; the same path data is used by the DOM and the timelapse scene. */
export const TOOL_ICONS: Record<Tool, string> = {
  pencil: 'M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z',
  brush:
    'M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7 M14.5 17.5 4.5 15',
  airbrush: 'M10 11h8v10h-8Z M12 11V8h4v3 M14 8V6 M7 4h.01 M4 6h.01 M7 8h.01 M4 10h.01 M7 12h.01',
  soften: 'M12 2.7l5.66 5.65a8 8 0 1 1-11.32 0Z M8.5 14a3.5 3.5 0 0 0 3.5 3.5',
  eraser: 'M7 21l-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21 M22 21H7 M5 11l9 9',
  eyedropper: 'M2 22l1-1h3l9-9 M3 21v-3l9-9 M15 6l3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z',
};

export const TOOL_NAMES: Record<Tool, string> = {
  pencil: 'Pencil',
  brush: 'Brush',
  airbrush: 'Airbrush',
  soften: 'Soften',
  eraser: 'Eraser',
  eyedropper: 'Eyedropper',
};

export const TOOL_ORDER: Tool[] = ['pencil', 'brush', 'airbrush', 'soften', 'eraser', 'eyedropper'];

export const LOGO_PATH = 'M12 3 4.5 21 M12 3l7.5 18 M12 3v-1.5 M7 15h10 M8.5 7h7v6h-7Z';

export function svgIcon(path: string, size = 20): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
}
