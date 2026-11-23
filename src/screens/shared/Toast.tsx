/**
 * A short message at the bottom of the screen, such as the reason a command failed.
 * The app decides when it appears and disappears; this only draws it.
 */

export function Toast(props: { message: string | null }) {
  if (props.message === null) return null;

  return (
    <div class="toast" role="status">
      {props.message}
    </div>
  );
}
