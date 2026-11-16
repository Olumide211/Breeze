import React from "react";
import { VIDEO } from "../scenes";
import { Ink } from "../lib/ink";

/** Zoom + pan. (x, y) is the world point shown at the centre of the screen. Cuts are instant: just change the props. */
export const Camera: React.FC<{ zoom: number; x: number; y: number; children: React.ReactNode }> = ({ zoom, x, y, children }) => (
  <g transform={`translate(${VIDEO.width / 2} ${VIDEO.height / 2}) scale(${zoom}) translate(${-x} ${-y})`}>
    <Ink zoom={zoom}>{children}</Ink>
  </g>
);
