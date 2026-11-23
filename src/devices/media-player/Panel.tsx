/**
 * A media player's panel: play/pause and skip, volume, mute, source, and power, each shown
 * only when the player supports it.
 *
 * Volume − and + change the volume on screen at once; Home Assistant is told once, half a
 * second after the last press, so holding the key does not flood the speaker with changes.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { createDebouncer, type Debouncer } from '../../core/debounce';
import type { PanelProps } from '../device-type';
import { PanelButton, PanelRow, PanelValue } from '../shared/controls';
import { readableName } from '../shared/predict';
import {
  mute,
  next,
  playPause,
  previous,
  selectSource,
  setVolume,
  turnOff,
  turnOn,
} from './actions';
import { nextVolume, readMediaPlayer } from './model';

const VOLUME_SEND_DELAY_MS = 500;

export function MediaPlayerPanel({ entity, run }: PanelProps) {
  const view = readMediaPlayer(entity);
  const off = !view.isAvailable;

  // The volume being chosen, before it is sent (see the heating panel, which works the same way).
  const [chosen, setChosen] = useState<number | null>(null);
  const chosenRef = useRef<number | null>(null);
  const latest = useRef({ entity, run });
  latest.current = { entity, run };

  const debouncer = useRef<Debouncer | null>(null);
  if (debouncer.current === null) {
    debouncer.current = createDebouncer(
      () => {
        const volume = chosenRef.current;
        if (volume !== null) latest.current.run(setVolume(latest.current.entity, volume));
        chosenRef.current = null;
        setChosen(null);
      },
      VOLUME_SEND_DELAY_MS,
      (send, ms) => setTimeout(send, ms),
      (id) => clearTimeout(id),
    );
  }
  useEffect(() => () => debouncer.current?.flush(), []);

  const shownVolume = chosen ?? view.volumePercent;
  const pressVolume = (direction: -1 | 1) => {
    const volume = nextVolume(chosenRef.current ?? view.volumePercent, direction);
    chosenRef.current = volume;
    setChosen(volume);
    debouncer.current?.trigger();
  };

  const isOff = view.state === 'off' || view.state === 'standby';
  const playAction = playPause(entity);
  // Home Assistant drops a player's volume while it is off. − and + would then guess.
  const noVolume = shownVolume === null;

  return (
    <div>
      {view.title !== null && (
        <PanelRow label="Playing">
          <PanelValue text={view.artist === null ? view.title : view.title + ' · ' + view.artist} />
        </PanelRow>
      )}

      {(view.canPlayPause || view.canSkip) && (
        <PanelRow label={readableName(view.state)}>
          {view.canSkip && (
            <PanelButton label="Previous" isDisabled={off} onPress={() => run(previous(entity))} />
          )}
          {view.canPlayPause && (
            <PanelButton
              label={view.isPlaying ? 'Pause' : 'Play'}
              isFirst
              isDisabled={off || playAction === null}
              onPress={() => {
                if (playAction !== null) run(playAction);
              }}
            />
          )}
          {view.canSkip && (
            <PanelButton label="Next" isDisabled={off} onPress={() => run(next(entity))} />
          )}
        </PanelRow>
      )}

      {(view.canSetVolume || view.canMute) && (
        <PanelRow label="Volume">
          {view.canSetVolume && (
            <PanelButton label="−" isDisabled={off || noVolume} onPress={() => pressVolume(-1)} />
          )}
          {view.canSetVolume && (
            <PanelValue text={shownVolume === null ? '–' : shownVolume + '%'} />
          )}
          {view.canSetVolume && (
            <PanelButton label="+" isDisabled={off || noVolume} onPress={() => pressVolume(1)} />
          )}
          {view.canMute && (
            <PanelButton
              label={view.isMuted ? 'Unmute' : 'Mute'}
              isSelected={view.isMuted}
              isDisabled={off}
              onPress={() => run(mute(entity, !view.isMuted))}
            />
          )}
        </PanelRow>
      )}

      {view.canSelectSource && view.sources.length > 0 && (
        <PanelRow label="Source">
          {view.sources.map((source) => (
            <PanelButton
              key={source}
              label={source}
              isSelected={view.source === source}
              isDisabled={off}
              onPress={() => run(selectSource(entity, source))}
            />
          ))}
        </PanelRow>
      )}

      {(view.canTurnOn || view.canTurnOff) && (
        <PanelRow label="Power">
          <PanelButton
            label={isOff ? 'Turn on' : 'Turn off'}
            isDisabled={off || (isOff ? !view.canTurnOn : !view.canTurnOff)}
            onPress={() => run(isOff ? turnOn(entity) : turnOff(entity))}
          />
        </PanelRow>
      )}
    </div>
  );
}
