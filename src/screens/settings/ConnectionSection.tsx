/**
 * The Connection section of Settings: which Home Assistant this TV is signed in to, and
 * Sign out. Signing out, then in again, is how the address or the user is changed.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { focusFirst, topScope } from '../shared/focus';

export interface ConnectionSectionProps {
  address: string;
  userName: string;
  onSignOut(): void;
}

export function ConnectionSection(props: ConnectionSectionProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  // Asking "are you sure?" replaces the button that had the focus, so put the focus on the
  // new buttons (and back again on Cancel). Not when the section first appears: then the
  // focus is still in the list of sections.
  const hasAppeared = useRef(false);
  useEffect(() => {
    if (hasAppeared.current) focusFirst(topScope());
    hasAppeared.current = true;
  }, [isConfirming]);

  return (
    <div>
      <div class="settings-fact">
        <div class="settings-fact-label">Home Assistant address</div>
        <div class="settings-fact-value">{props.address}</div>
      </div>
      <div class="settings-fact">
        <div class="settings-fact-label">Signed in as</div>
        <div class="settings-fact-value">{props.userName}</div>
      </div>

      {isConfirming ? (
        <div>
          <p class="settings-note">
            Sign out of Home Assistant on this TV? Your layout is kept for the next time you sign
            in.
          </p>
          <div class="settings-buttons" data-focus-row>
            <button class="button button-main" onClick={props.onSignOut}>
              Sign out
            </button>
            <button
              class="button button-outline"
              data-focus-first
              onClick={() => setIsConfirming(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          class="button button-outline"
          data-focus-first
          onClick={() => setIsConfirming(true)}
        >
          Sign out
        </button>
      )}
    </div>
  );
}
