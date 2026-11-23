/**
 * The button type: buttons, button helpers, scenes and scripts. All four are "do this
 * now" with nothing to show afterwards, so they share one card and one panel.
 */

import type { DeviceType } from '../device-type';
import { press } from './actions';
import { ButtonCard } from './Card';
import { readButton } from './model';
import { ButtonPanel } from './Panel';

export const buttonType: DeviceType = {
  id: 'button',
  label: 'Button',
  domains: ['button', 'input_button', 'scene', 'script'],
  mainOrder: 90,
  cardSize: 'small',
  supports: () => true,

  okAction: (entity) => (readButton(entity).canPress ? press(entity) : 'nothing'),
  isActive: () => false,
  summary: () => null,

  Card: ButtonCard,
  Panel: ButtonPanel,
};
