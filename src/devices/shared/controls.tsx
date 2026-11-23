/**
 * The building blocks every device type's panel is made from: a labelled row, and a button.
 *
 * Every control is a real <button>, so it takes focus from the remote's arrows, OK presses
 * it, and the Magic Remote pointer can click it, with no extra code in any panel.
 * The styles are in devices.css.
 */

import type { ComponentChildren, JSX } from 'preact';

/** A row of a panel: a label on the left, controls on the right. */
export function PanelRow(props: { label: string; children: ComponentChildren }) {
  return (
    <div class="panel-row">
      <div class="panel-row-label">{props.label}</div>
      <div class="panel-row-controls">{props.children}</div>
    </div>
  );
}

export interface PanelButtonProps {
  label: string;
  onPress(): void;
  /** Marks the choice that is in force now, such as the current effect. */
  isSelected?: boolean;
  isDisabled?: boolean;
  /** For a colour swatch: the label is still read out, but the button shows only the colour. */
  swatch?: string;
}

export function PanelButton(props: PanelButtonProps) {
  let className = 'control';
  if (props.isSelected) className += ' control-selected';
  if (props.swatch !== undefined) className += ' control-swatch';

  const style: JSX.CSSProperties | undefined =
    props.swatch === undefined ? undefined : { backgroundColor: props.swatch };

  return (
    <button
      class={className}
      style={style}
      disabled={props.isDisabled}
      aria-label={props.label}
      title={props.swatch === undefined ? undefined : props.label}
      onClick={props.onPress}
    >
      {props.swatch === undefined ? props.label : ''}
    </button>
  );
}

/** A plain value shown among the controls of a row, such as '70%' between − and +. */
export function PanelValue(props: { text: string }) {
  return <div class="panel-value">{props.text}</div>;
}
