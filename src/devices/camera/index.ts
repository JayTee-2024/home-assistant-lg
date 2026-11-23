/**
 * The camera type: cameras and video doorbells. The card shows a still picture, refreshed
 * every few seconds. The panel fills the screen, and plays live video where Home Assistant
 * offers it (see Panel.tsx).
 */

import type { DeviceType } from '../device-type';
import { CameraCard } from './Card';
import { readCamera } from './model';
import { CameraPanel } from './Panel';

export const cameraType: DeviceType = {
  id: 'camera',
  label: 'Camera',
  icon: 'M23 7l-7 5 7 5V7zM1 5h15v14H1z',
  domains: ['camera'],
  mainOrder: 10,
  cardSize: 'large',
  supports: () => true,

  okAction: (entity) => (readCamera(entity).isAvailable ? 'open-panel' : 'nothing'),
  isActive: () => false,
  summary: () => null,

  Card: CameraCard,
  Panel: CameraPanel,
  panelLayout: 'full-screen',
};
