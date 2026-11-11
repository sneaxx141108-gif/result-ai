"""App-Symbol und Startbilder von Wettbuch zeichnen: ein „W“ als grüne Kurve, die am Ende steigt, mit weißem Punkt
(wie die Kontostand-Kurve in der App), auf dunklem Verlauf.

Gleiche Form wie logo() in web/app.js und das Zeichen im Ladebildschirm (web/index.html): Raster 100 × 100.
Läuft nur, wenn sich das Symbol ändert – vom PC aus, braucht Pillow (pip install pillow). Schreibt nach web/icons/.
"""
import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web', 'icons')
SS = 4  # erst 4-mal so groß zeichnen, dann verkleinern: glatte Kanten

# das „W“ (Raster 100 × 100) – gleiche Zahlen wie W_D in app.js
W_PTS = [(22.6, 37.7), (36.5, 64.2), (50, 45.1), (63.5, 64.2), (77.4, 30.3)]
LINE_W = 8.2
DOT_RING, DOT = 6.3, 4.4
RADIUS = 23  # Ecken des Zeichens im Ladebildschirm (das App-Symbol rundet iOS selbst)


def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def vgrad(n, top, bottom):
    m = Image.linear_gradient('L').resize((n, n))  # 0 oben, 255 unten
    return Image.composite(Image.new('RGB', (n, n), rgb(bottom)), Image.new('RGB', (n, n), rgb(top)), m)


def mark(n):
    """das ganze Zeichen als quadratisches RGBA-Bild mit n × n Pixeln"""
    u = n / 100
    im = vgrad(n, '#2F3339', '#0A0A0C').convert('RGBA')
    # weicher Lichtschein oben links
    glow = Image.new('L', (n, n), 0)
    r, cx, cy = 62 * u, 18 * u, -5 * u
    ImageDraw.Draw(glow).ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    glow = glow.filter(ImageFilter.GaussianBlur(16 * u)).point(lambda v: int(v * 0.13))
    white = Image.new('RGBA', (n, n), (255, 255, 255, 0))
    white.putalpha(glow)
    im = Image.alpha_composite(im, white)
    # die Kurve: grüner Schein darunter, dann die Linie mit Verlauf
    pts = [(x * u, y * u) for x, y in W_PTS]
    lw = LINE_W * u
    lm = Image.new('L', (n, n), 0)
    ld = ImageDraw.Draw(lm)
    ld.line(pts, fill=255, width=round(lw), joint='curve')
    for x, y in (pts[0], pts[-1]):
        ld.ellipse([x - lw / 2, y - lw / 2, x + lw / 2, y + lw / 2], fill=255)
    halo = Image.new('RGBA', (n, n), rgb('#30D158') + (0,))
    halo.putalpha(lm.filter(ImageFilter.GaussianBlur(3 * u)).point(lambda v: int(v * 0.45)))
    im = Image.alpha_composite(im, halo)
    line = vgrad(n, '#6EE7A0', '#1FB955').convert('RGBA')
    line.putalpha(lm)
    im = Image.alpha_composite(im, line)
    # Punkt am Ende: Ring in Hintergrundfarbe, dann weiß
    ex, ey = pts[-1]
    d = ImageDraw.Draw(im)
    for rr, col in ((DOT_RING, (22, 24, 27, 255)), (DOT, (255, 255, 255, 255))):
        d.ellipse([ex - rr * u, ey - rr * u, ex + rr * u, ey + rr * u], fill=col)
    return im


def tile(n):
    """Zeichen mit runden Ecken und feiner heller Kante (für die Startbilder)"""
    im = mark(n)
    u = n / 100
    mask = Image.new('L', (n, n), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, n - 1, n - 1], radius=RADIUS * u, fill=255)
    edge = Image.new('L', (n, n), 0)
    ImageDraw.Draw(edge).rounded_rectangle([0.75 * u, 0.75 * u, n - 1 - 0.75 * u, n - 1 - 0.75 * u], radius=(RADIUS - 0.75) * u, outline=26, width=round(1.5 * u))
    hl = Image.new('RGBA', (n, n), (255, 255, 255, 0))
    hl.putalpha(edge)
    im = Image.alpha_composite(im, hl)
    im.putalpha(ImageChops.multiply(im.getchannel('A'), mask))
    return im


def icon(size):
    mark(size * SS).convert('RGB').resize((size, size), Image.LANCZOS).save(os.path.join(OUT, f'icon-{size}.png'), optimize=True)


def font(px):
    for f in ('C:/Windows/Fonts/segoeuib.ttf', '/System/Library/Fonts/SFNS.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'):
        if os.path.exists(f):
            return ImageFont.truetype(f, px)
    return ImageFont.load_default()


def splash(w, h, dark):
    """Wie der Ladebildschirm in index.html: Zeichen 72 pt, darunter „Wettbuch“ 22 pt, Abstand 16 pt (3-fach)."""
    bg, fg = ('#000000', '#FFFFFF') if dark else ('#F2F2F7', '#0B0B0C')
    u = SS  # Pixel je Punkt beim Zeichnen
    im = Image.new('RGBA', (w * u // 3, h * u // 3), rgb(bg) + (255,))
    top = (h / 3 - (72 + 16 + 26)) / 2
    t = tile(72 * u)
    im.alpha_composite(t, (round((w / 3 / 2 - 36) * u), round(top * u)))
    d = ImageDraw.Draw(im)
    f = font(22 * u)
    text = 'Wettbuch'
    track = -0.03 * 22 * u
    widths = [f.getlength(ch) for ch in text]
    x = (w / 3 / 2) * u - (sum(widths) + track * (len(text) - 1)) / 2
    y = (top + 72 + 16 + 13) * u  # Mitte der Textzeile (26 pt hoch)
    for ch, cw in zip(text, widths):
        d.text((x, y), ch, font=f, fill=fg, anchor='lm')
        x += cw + track
    name = f'splash-{w}x{h}{"-dark" if dark else ""}.png'
    im.convert('RGB').resize((w, h), Image.LANCZOS).save(os.path.join(OUT, name), optimize=True)


if __name__ == '__main__':
    for n in (180, 192, 512):
        icon(n)
    for w, h in ((1170, 2532), (1284, 2778)):
        for dark in (False, True):
            splash(w, h, dark)
    print('fertig:', sorted(os.listdir(OUT)))
