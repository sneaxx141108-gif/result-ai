"""App-Symbol und Startbilder von Wettbuch zeichnen: ein Wettschein mit grünem Haken.

Gleiche Form wie logo() in web/app.js (viewBox 0 0 36 36). Läuft nur, wenn sich das Symbol ändert – vom PC aus,
braucht Pillow (pip install pillow). Schreibt nach web/icons/.
"""
import math
import os

from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web', 'icons')
SS = 4  # erst 4-mal so groß zeichnen, dann verkleinern: glatte Kanten

# Wettschein: oben runde Ecken, unten Zacken (wie SLIP_D in app.js)
ZIG = [(29, 32), (27.17, 30), (25.33, 32), (23.5, 30), (21.67, 32), (19.83, 30), (18, 32), (16.17, 30), (14.33, 32),
       (12.5, 30), (10.67, 32), (8.83, 30), (7, 32)]


def slip_points():
    pts = []
    for k in range(9):  # rechts oben: Viertelkreis um (26, 6.5)
        a = math.radians(-90 + k * 90 / 8)
        pts.append((26 + 3 * math.cos(a), 6.5 + 3 * math.sin(a)))
    pts += ZIG
    for k in range(9):  # links oben: Viertelkreis um (10, 6.5)
        a = math.radians(180 + k * 90 / 8)
        pts.append((10 + 3 * math.cos(a), 6.5 + 3 * math.sin(a)))
    return pts


def draw_logo(d, ox, oy, s, col):
    """Logo bei (ox, oy) mit s Pixeln je Einheit; col: slip, cut (Hintergrund), badge, check."""
    P = lambda x, y: (ox + x * s, oy + y * s)
    d.polygon([P(x, y) for x, y in slip_points()], fill=col['slip'])
    for x1, x2, y in ((11.5, 24.5, 10.5), (11.5, 20.5, 15.5)):  # zwei Zeilen Text
        r = 1.3 * s
        a, b = P(x1, y), P(x2, y)
        d.rounded_rectangle([a[0] - r, a[1] - r, b[0] + r, b[1] + r], radius=r, fill=col['cut'])
    cx, cy = P(26.5, 26.5)
    for r, c in ((9.25, col['cut']), (8, col['badge'])):  # Ring in Hintergrundfarbe, dann der grüne Kreis
        d.ellipse([cx - r * s, cy - r * s, cx + r * s, cy + r * s], fill=c)
    pts = [P(22.9, 26.7), P(25.4, 29.2), P(30.0, 24.3)]
    w = 2.4 * s
    d.line(pts, fill=col['check'], width=round(w), joint='curve')
    for x, y in (pts[0], pts[-1]):
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=col['check'])


def font(px):
    for f in ('C:/Windows/Fonts/segoeuib.ttf', '/System/Library/Fonts/SFNS.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'):
        if os.path.exists(f):
            return ImageFont.truetype(f, px)
    return ImageFont.load_default()


def icon(size):
    big = size * SS
    im = Image.new('RGB', (big, big), '#0B0B0C')
    d = ImageDraw.Draw(im)
    s = big * 0.58 / 32.25  # ganzes Zeichen (Schein + Haken) = 58 % der Höhe
    draw_logo(d, big / 2 - 21.375 * s, big / 2 - 19.625 * s, s, {'slip': '#FFFFFF', 'cut': '#0B0B0C', 'badge': '#30D158', 'check': '#FFFFFF'})
    im.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, f'icon-{size}.png'), optimize=True)


def splash(w, h, dark):
    """Wie der Ladebildschirm in index.html: Zeichen 68 pt, darunter „Wettbuch“ 22 pt, Abstand 14 pt (3-fach)."""
    bg, fg = ('#000000', '#FFFFFF') if dark else ('#F2F2F7', '#0B0B0C')
    col = {'slip': fg, 'cut': bg, 'badge': '#30D158' if dark else '#16A34A', 'check': '#00210B' if dark else '#FFFFFF'}
    im = Image.new('RGB', (w * SS // 3, h * SS // 3), bg)  # in Punkten × SS, am Ende auf Pixel
    d = ImageDraw.Draw(im)
    u = SS  # Pixel je Punkt beim Zeichnen
    top = (h / 3 - (68 + 14 + 26)) / 2
    s = 68 * u / 34  # viewBox des Ladebildschirms: 34 × 34 Einheiten, Mitte des Zeichens
    draw_logo(d, (w / 3 / 2) * u - 21.375 * s, top * u + 34 / 2 * s - 19.625 * s, s, col)
    f = font(22 * u)
    text = 'Wettbuch'
    track = -0.03 * 22 * u
    widths = [f.getlength(ch) for ch in text]
    tw = sum(widths) + track * (len(text) - 1)
    x = (w / 3 / 2) * u - tw / 2
    y = (top + 68 + 14 + 13) * u  # Mitte der Textzeile (26 pt hoch)
    for ch, cw in zip(text, widths):
        d.text((x, y), ch, font=f, fill=fg, anchor='lm')
        x += cw + track
    name = f'splash-{w}x{h}{"-dark" if dark else ""}.png'
    im.resize((w, h), Image.LANCZOS).save(os.path.join(OUT, name), optimize=True)


if __name__ == '__main__':
    for n in (180, 192, 512):
        icon(n)
    for w, h in ((1170, 2532), (1284, 2778)):
        for dark in (False, True):
            splash(w, h, dark)
    print('fertig:', sorted(os.listdir(OUT)))
