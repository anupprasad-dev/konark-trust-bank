# How to make the README screenshots

The README already points to these 6 files. Save your images in `docs/screenshots/` with **exactly** these names:

| File | What to show | Window |
|------|--------------|--------|
| `dashboard.png` | Customer dashboard (balance card, overview cards, spending chart) | desktop |
| `transfer.png` | Fund transfer success screen with the **Download receipt** button | desktop |
| `cards.png` | Cards page (debit card) or Deposits page | desktop |
| `employee.png` | Employee dashboard (requests summary) or customer accounts | desktop |
| `dark.png` | Customer dashboard in dark mode | desktop |
| `mobile.png` | Dashboard on a phone, with the bottom bar | phone |

Extra shots that look good (add them to the README table if you like): `login.png` (the new login page),
`history-mobile.png`, `admin.png` (admin overview with charts).

## 1. Take them on your own computer, not on the live site

Use the local project so no real or private data is on screen, and so the live database stays clean.

```bash
# terminal 1
cd ~/konark-trust-bank/backend && source venv/bin/activate
python manage.py migrate
python manage.py seed_demo        # local only. Never run this on the live site
python manage.py runserver

# terminal 2
cd ~/konark-trust-bank/frontend && npm run dev
```

Log in as `customer1` (password in the README) and make the data look alive before you shoot:

1. Send 3 or 4 transfers between `customer1` and `customer2` with real-looking remarks ("Rent", "Books", "Dinner").
2. Open one fixed deposit, apply for one loan (log in as `employee1` to approve it), request a debit card.
3. Do one transfer and download its receipt, so the receipt button is on screen.

## 2. Take the screenshot (Fedora, Firefox or Chrome)

**Desktop shots.** Make the browser window about 1440 px wide. Press `F11` for full screen, or just resize it.

- **Firefox:** press `Ctrl+Shift+S`, choose *Save visible* (or *Save full page*).
- **Chrome / Chromium:** press `F12`, then `Ctrl+Shift+P`, type `screenshot`, choose *Capture screenshot* (or *Capture full size screenshot*).
- **Any app:** the `PrtSc` key lets you select an area on Fedora.

**Phone shot.**

1. Press `F12`, then `Ctrl+Shift+M` (responsive mode).
2. Set the size to `390 x 844`, zoom 100%.
3. Capture with the camera icon (Firefox) or `Ctrl+Shift+P` > *Capture screenshot* (Chrome).

**Dark mode.** On desktop use the moon button in the sidebar. Then take the same dashboard shot.

## 3. Keep them clean

- Hide bookmarks bar and extensions, or use a fresh browser profile.
- Same demo names and amounts in all shots, nothing real (no real email, phone, photo or password on screen).
- Light mode for all shots except `dark.png`.
- Crop the browser address bar away if you can.

## 4. Make the files small

GitHub pages load faster with small images (aim for under 400 KB each).

```bash
sudo dnf install -y optipng ImageMagick
cd ~/konark-trust-bank/docs/screenshots
mogrify -resize "1400x>" *.png          # shrink anything wider than 1400 px
optipng -o3 *.png                       # lossless squeeze
ls -lh
```

## 5. Add them to GitHub

```bash
cd ~/konark-trust-bank
git add docs/screenshots/*.png
git commit -m "Add README screenshots"
git push
```

Open the repo page on GitHub and check that the images show in the README. If one is broken, the file name is
different (names are case sensitive: `dashboard.png`, not `Dashboard.PNG`).

## 6. Optional: a short GIF

A 10 second GIF of "login > transfer > receipt" is the first thing a recruiter will play. On Fedora:

```bash
sudo dnf install -y peek
```

Record the window, save as `docs/screenshots/demo.gif` (keep it under 5 MB), then add this line at the top of the
Screenshots section in `README.md`:

```markdown
![Demo](docs/screenshots/demo.gif)
```
