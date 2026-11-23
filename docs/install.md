# Installing Home Assist LG on your TV

Home Assist LG shows the devices in your Home Assistant as cards on your LG TV, and lets you control them
with the TV remote. The TV talks straight to your own Home Assistant. Nothing goes through anyone else's
server.

LG's own app store does not carry it, so there are two ways to install it:

- **Route A, Homebrew Channel.** For a TV that is already rooted and has Homebrew Channel. The easiest
  route: the app installs and updates from inside Homebrew Channel.
- **Route B, developer mode.** For any LG webOS TV, using LG's free Developer Mode app and a program on
  your computer. It needs renewing every few days (see the warning in Route B).

If you do not know which you have: if there is no app called Homebrew Channel on your TV, use Route B.

## What you need first

1. **An LG TV with webOS 4.0 or newer** (most LG smart TVs from 2018 onwards). It has been tested on an
   LG C9 with webOS 4.5.
2. **Home Assistant running on the same home network as the TV**, with your devices already added to it.
3. **Home Assistant's address**, for example `http://192.168.1.100:8123`. It is the address you use to
   open Home Assistant in a web browser at home.
4. **A Home Assistant username and password for the TV.** You can use your own, but a separate user
   for the TV is safer, because the TV then cannot change Home Assistant's settings. To make one:
   1. In Home Assistant, open **Settings**, then **People**, then the **Users** tab. (If you do not
      see a Users tab, first turn on **Advanced mode** in your user profile.)
   2. Choose **Add user**. Give it a name such as "Living room TV", a username and a password.
   3. Leave **Administrator** switched off, then choose **Create**.

## Route A: Homebrew Channel (rooted TVs)

1. On the TV, open **Homebrew Channel**.
2. Open its **Settings**, choose **Add repository**, and type this address:

   ```
   https://raw.githubusercontent.com/JayTee-2024/home-assistant-lg/main/webosbrew/apps.json
   ```

3. Go back to the list of apps. **Home Assist LG** is now in it. Select it and choose **Install**.
4. When it has installed, choose **Launch**, or find Home Assist LG among your TV's apps.

New versions appear in Homebrew Channel the same way: open the app's page there and choose **Update**.

## Route B: developer mode (any LG webOS TV)

You need a computer (Windows, Mac or Linux) on the same network as the TV for this route.

> **Warning:** LG switches developer mode off after about 50 hours unless it is renewed, and **apps
> installed this way are removed when it switches off**. Renew it by opening the Developer Mode app on
> the TV and choosing **Extend** before the time runs out, or let webOS Dev Manager on your computer
> renew it for you (see step 4). If the app does disappear, repeat steps 5 and 6. Your sign-in and your
> card layout are kept on the TV only while the app is installed, so you would set those up again.

1. **Make a free LG developer account** at [webostv.developer.lge.com](https://webostv.developer.lge.com)
   (choose **Sign in**, then create an account). webosbrew's
   [developer mode guide](https://www.webosbrew.org/devmode/) shows each screen.
2. **Install the Developer Mode app on the TV:** open the LG Content Store, search for "Developer Mode",
   and install it.
3. **Switch developer mode on:** open the Developer Mode app, sign in with your developer account, and
   switch **Dev Mode Status** on. The TV restarts. Open the Developer Mode app again and switch **Key
   Server** on. Leave this screen open: it shows the TV's address and a passphrase.
4. **Install webOS Dev Manager on your computer** from its
   [releases page](https://github.com/webosbrew/dev-manager-desktop/releases) (under **Assets**, choose
   the file for your computer, such as the `.msi` file for Windows). Open it, add your TV using the
   address and passphrase from the Developer Mode app, and finish. Dev Manager can renew developer mode
   automatically: look under the TV's **Info** for the renew option.
5. **Download the app:** open the
   [Home Assist LG releases page](https://github.com/JayTee-2024/home-assistant-lg/releases/latest)
   and download the file ending in `.ipk`.
6. **Install it:** in webOS Dev Manager, open **Apps**, choose **Install**, and pick the `.ipk` file
   you downloaded. Home Assist LG then appears among your TV's apps.

To update, download the newer `.ipk` and install it the same way. Your sign-in and layout are kept.

## First run

1. Open **Home Assist LG**. It first tries Home Assistant's usual address, `homeassistant.local:8123`.
   If nothing answers there, type the address from "What you need first" into **Home Assistant
   address**.
2. Enter the TV's **Username** and **Password** and choose **Sign in**. If your Home Assistant asks for
   a **Two-step code**, enter the code from your authenticator app. The TV keeps a sign-in pass from
   Home Assistant, never your password.
3. The home screen starts empty. Open **Settings** (top right), go to **Devices**, and choose which
   devices to show. Each chosen device becomes a card.
4. To move cards or add pages, open **Settings** and choose **Reorganise layout**.
5. Select a card and press **OK** for its main action, such as switching a light on or off. Hold **OK**
   for all its controls.

Locks, alarms, and doors, garage doors and gates are deliberately not supported, so nothing on the TV
can open your home. Devices like these are listed in Settings as **Not supported yet**.

To sign in as someone else or change the address, open **Settings**, then **Connection**, and choose
**Sign out**. The back button on the remote leaves the app.

## If something goes wrong

- **"Cannot reach Home Assistant" or "Nothing answered at …":** check the address, including `http://`
  and the port (usually `:8123`), and that the TV and Home Assistant are on the same network. Try the
  same address in a browser on a phone on the same Wi-Fi.
- **Your username or password is refused:** sign in with the same details at Home Assistant's own web
  page to check them. Usernames are case-sensitive.
- **Home Assistant refuses the usual sign-in** (some setups switch it off): choose **Advanced: use an
  access token**. In Home Assistant, open your user profile, the **Security** tab, and create a
  **Long-lived access token** at the bottom. Type it into the TV.
- **A device is missing from Settings:** it must be in Home Assistant first, and not hidden or disabled
  there.
- Anything else: open an issue on
  [GitHub](https://github.com/JayTee-2024/home-assistant-lg/issues).
