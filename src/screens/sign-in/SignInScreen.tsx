/**
 * The sign-in screen: find the Home Assistant, then ask for a username and password.
 *
 * It shows one form at a time:
 *   looking      trying an address, nothing to fill in yet
 *   address      the address could not be reached, or the person chose "Change"
 *   credentials  username and password
 *   code         the two-step code, when Home Assistant asks for one
 *   token        the "Advanced" route: a long-lived access token
 *
 * The conversation with Home Assistant is src/core/sign-in.ts. This file only shows the
 * right form for each step and passes what was typed along. The password lives in this
 * screen's memory only until it has been sent.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { DEFAULT_ADDRESS, normaliseAddress } from '../../core/address';
import type { HttpSend } from '../../core/http';
import type { SavedSignIn } from '../../core/saved-state';
import {
  beginSignIn,
  signInWithToken,
  submitCode,
  submitCredentials,
  type SignInStep,
} from '../../core/sign-in';
import { focusElement, focusFirst, topScope } from '../shared/focus';
import { TitleBar } from '../shared/TitleBar';

export interface SignInScreenProps {
  /** Sends requests. The app passes the real sender; it already has a time limit. */
  send: HttpSend;
  /** The address to try first: the one saved from last time, or null for the usual default. */
  startAddress: string | null;
  /** A line to show above the form, such as why signing in is needed again. */
  notice: string | null;
  onSignedIn(signIn: SavedSignIn): void;
  onClose(): void;
}

type Form = 'looking' | 'address' | 'credentials' | 'code' | 'token';

export function SignInScreen(props: SignInScreenProps) {
  const [form, setForm] = useState<Form>('looking');
  const [address, setAddress] = useState(props.startAddress ?? 'http://' + DEFAULT_ADDRESS);
  const [flowId, setFlowId] = useState('');
  const [message, setMessage] = useState<string | null>(props.notice);
  const [isBusy, setIsBusy] = useState(false);
  /**
   * Numbers each request to Home Assistant. An answer is used only if no newer request was
   * made and the person has not moved to another form meanwhile, so a slow answer can never
   * wipe what they are typing.
   */
  const request = useRef(0);
  /** Counts Home Assistant's answers, so the focus can be put back after each one. */
  const [attempts, setAttempts] = useState(0);

  // What is typed into the fields.
  const [typedAddress, setTypedAddress] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');

  /** Shows the form the step calls for, or hands the finished sign-in to the app. */
  function show(step: SignInStep, triedAddress: string) {
    setIsBusy(false);
    setAttempts((count) => count + 1);

    if (step.kind === 'signed-in') {
      props.onSignedIn(step.signIn);
      return;
    }
    if (step.kind === 'credentials' || step.kind === 'code') {
      setFlowId(step.flowId);
      // Home Assistant's own message for this step, or else the notice the app started with.
      // Never the previous message: that belonged to the step before ("Could not reach ...").
      setMessage(step.message ?? props.notice);
      setPassword('');
      setCode('');
      setForm(step.kind);
      return;
    }
    // Could not reach it, not Home Assistant, or refused: ask for the address.
    setMessage(step.message);
    setTypedAddress(addressToEdit(triedAddress));
    setForm('address');
  }

  /** Sends one request, and hands its answer to `show` only if it is still wanted. */
  function ask(work: Promise<SignInStep>, triedAddress: string) {
    request.current += 1;
    const thisRequest = request.current;
    work.then((step) => {
      if (request.current === thisRequest) show(step, triedAddress);
    });
  }

  /** Moves to another form, dropping any answer still on its way. */
  function goTo(next: Form) {
    request.current += 1;
    setIsBusy(false);
    setMessage(null);
    setForm(next);
  }

  function tryAddress(candidate: string) {
    setAddress(candidate);
    setForm('looking');
    setMessage(props.notice);
    ask(beginSignIn(props.send, candidate), candidate);
  }

  // On first showing, try the starting address straight away.
  useEffect(() => {
    tryAddress(address);
    // The empty list means: run once, when the screen first appears.
  }, []);

  // Each time a form appears, or Home Assistant answers an attempt, put the focus on the
  // first field that is still empty: the username at first, the password after a wrong one.
  useEffect(() => {
    const scope = topScope();
    const fields = Array.prototype.slice.call(
      scope.querySelectorAll('input'),
    ) as HTMLInputElement[];
    const firstEmpty = fields.filter((field) => field.value === '')[0];

    if (firstEmpty !== undefined) focusElement(firstEmpty);
    else focusFirst(scope);
  }, [form, attempts]);

  function connectToTypedAddress() {
    const result = normaliseAddress(typedAddress);
    if (!result.ok) {
      setMessage(result.reason === 'empty' ? 'Enter an address.' : 'That is not a valid address.');
      return;
    }
    tryAddress(result.url);
  }

  /**
   * The access token route from the address form, for when the usual sign-in cannot start
   * (Home Assistant refuses it, or a desktop browser blocks it). The token is used with the
   * address typed in the field.
   */
  function useTokenForTypedAddress() {
    const result = normaliseAddress(typedAddress);
    if (!result.ok) {
      setMessage('Enter the address of your Home Assistant first.');
      return;
    }
    setAddress(result.url);
    goTo('token');
  }

  function signIn() {
    if (username === '' || password === '') {
      setMessage('Enter your username and password.');
      return;
    }
    setIsBusy(true);
    setMessage(null);
    ask(submitCredentials(props.send, address, flowId, username, password, Date.now()), address);
  }

  function verifyCode() {
    setIsBusy(true);
    setMessage(null);
    ask(submitCode(props.send, address, flowId, code, Date.now()), address);
  }

  function useToken() {
    if (token.trim() === '') {
      setMessage('Enter an access token.');
      return;
    }
    props.onSignedIn(signInWithToken(address, token));
  }

  // While waiting for Home Assistant the button looks dimmed and ignores presses. It is not
  // switched off with `disabled`, because a browser takes the focus away from a disabled button.
  const mainButtonClass = 'button button-main' + (isBusy ? ' button-busy' : '');

  return (
    <div class="screen" data-focus-scope>
      <TitleBar onClose={props.onClose} />

      <main class="sign-in">
        <section class="sign-in-intro">
          <h1>Connect to your Home Assistant</h1>
          <p class="sign-in-lead">
            This app shows and controls the devices you already have in Home Assistant.
          </p>
          <div class="sign-in-before">Before you start</div>
          <Step number={1} text="Home Assistant is running, on the same network as this TV." />
          <Step
            number={2}
            text="You have a Home Assistant username and password. A separate user for the TV is a good idea."
          />
          <Step number={3} text="Your devices are already added to Home Assistant." />
        </section>

        <section class="sign-in-form">
          {form !== 'address' && (
            <div class="sign-in-address">
              <div>
                <div class="field-label">
                  {form === 'looking' ? 'Looking for Home Assistant at' : 'Home Assistant found at'}
                </div>
                <div class="sign-in-address-value">{withoutScheme(address)}</div>
              </div>
              <button
                class="button button-outline"
                onClick={() => {
                  setTypedAddress(addressToEdit(address));
                  goTo('address');
                }}
              >
                Change
              </button>
            </div>
          )}

          {message !== null && <div class="sign-in-message">{message}</div>}

          {form === 'address' && (
            <div class="sign-in-fields">
              <Field
                label="Home Assistant address"
                hint="For example 192.168.1.100:8123"
                value={typedAddress}
                onInput={setTypedAddress}
                isFirst
              />
              <button class="button button-main" onClick={connectToTypedAddress}>
                Connect
              </button>
              <button class="button button-link" onClick={useTokenForTypedAddress}>
                Advanced: use an access token
              </button>
            </div>
          )}

          {form === 'credentials' && (
            <div class="sign-in-fields">
              <Field label="Username" value={username} onInput={setUsername} isFirst />
              <Field label="Password" value={password} onInput={setPassword} isPassword />
              <button class={mainButtonClass} onClick={isBusy ? undefined : signIn}>
                {isBusy ? 'Signing in…' : 'Sign in'}
              </button>
              <p class="sign-in-note">
                Your password is not kept on this TV. You can sign out at any time in Settings.
              </p>
              <button class="button button-link" onClick={() => goTo('token')}>
                Advanced: use an access token
              </button>
            </div>
          )}

          {form === 'code' && (
            <div class="sign-in-fields">
              <Field label="Two-step code" value={code} onInput={setCode} isFirst />
              <button class={mainButtonClass} onClick={isBusy ? undefined : verifyCode}>
                {isBusy ? 'Checking…' : 'Verify'}
              </button>
            </div>
          )}

          {form === 'token' && (
            <div class="sign-in-fields">
              <Field
                label="Long-lived access token"
                hint="Made on your profile page in Home Assistant, under Security"
                value={token}
                onInput={setToken}
                isFirst
              />
              <button class="button button-main" onClick={useToken}>
                Connect
              </button>
              <button class="button button-link" onClick={() => tryAddress(address)}>
                Back to username and password
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Step(props: { number: number; text: string }) {
  return (
    <div class="sign-in-step">
      <div class="sign-in-step-number">{props.number}</div>
      <div>{props.text}</div>
    </div>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  value: string;
  onInput(value: string): void;
  isPassword?: boolean;
  /** Marks the field that takes focus when its form appears. */
  isFirst?: boolean;
}

function Field(props: FieldProps) {
  return (
    <label class="field">
      <span class="field-label">{props.label}</span>
      <input
        type={props.isPassword ? 'password' : 'text'}
        value={props.value}
        placeholder={props.hint}
        autocomplete="off"
        autocapitalize="off"
        spellcheck={false}
        data-focus-first={props.isFirst ? '' : undefined}
        onInput={(event) => props.onInput(event.currentTarget.value)}
      />
    </label>
  );
}

/** 'http://192.168.1.100:8123' → '192.168.1.100:8123'. An https address is shown in full. */
function withoutScheme(address: string): string {
  return address.indexOf('http://') === 0 ? address.slice('http://'.length) : address;
}

/**
 * What to put in the address field when it opens. The usual default is left out, so the
 * person does not have to delete it with the remote before typing their own; an address
 * they typed is put back, so a typo can be fixed.
 */
function addressToEdit(address: string): string {
  return address === 'http://' + DEFAULT_ADDRESS ? '' : withoutScheme(address);
}
