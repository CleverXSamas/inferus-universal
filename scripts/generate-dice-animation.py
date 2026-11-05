"""Generate the original one-shot Discord dice flourish. Requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw
from math import sin, cos, pi
scale, size = 3, 96
frames = []
for frame in range(12):
    t = frame / 11
    angle = (-150 * (1 - t) ** 2 + 12 * sin(t * pi * 4) * (1 - t)) * pi / 180
    bounce = -8 * abs(sin(t * pi * 3)) * (1 - t)
    image = Image.new('RGBA', (size * scale, size * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    def point(x, y):
        return ((48 + x*cos(angle)-y*sin(angle))*scale, (44 + bounce + x*sin(angle)+y*cos(angle))*scale)
    draw.ellipse((28*scale, 79*scale, 68*scale, 85*scale), fill=(59, 36, 79, 170))
    vertices = [point(0,-29),point(25,-14.5),point(25,14.5),point(0,29),point(-25,14.5),point(-25,-14.5)]
    center = point(0,0)
    draw.polygon(vertices, fill=(49, 32, 65, 255))
    for a,b,color in [(0,1,(111,76,142,255)),(1,2,(82,53,111,255)),(2,3,(70,44,99,255)),(3,4,(59,38,85,255)),(4,5,(89,57,119,255)),(5,0,(130,90,158,255))]:
        draw.polygon([center,vertices[a],vertices[b]], fill=color)
    draw.line(vertices+[vertices[0]], fill=(215,179,243,255), width=2*scale)
    for vertex in vertices:
        draw.line([vertex,center],fill=(200,161,231,255),width=scale)
    draw.line([vertices[0],vertices[2],vertices[4],vertices[0]],fill=(200,161,231,255),width=scale)
    image = image.resize((size,size),Image.Resampling.LANCZOS)
    palette = image.convert('RGB').quantize(colors=127)
    colors = palette.getpalette()[:381]
    result = Image.new('P',(size,size),0)
    result.putpalette([0,0,0]+colors+[0]*(768-3-len(colors)))
    result.putdata([index+1 if alpha>110 else 0 for index,alpha in zip(palette.tobytes(),image.getchannel('A').tobytes())])
    result.info['transparency'] = 0
    frames.append(result)
output=Path(__file__).resolve().parent.parent/'public/assets/inferus-roll.gif'
output.parent.mkdir(parents=True, exist_ok=True)
# No loop extension: play once, then leave the settled die visible.
frames[0].save(output,save_all=True,append_images=frames[1:],duration=70,transparency=0,disposal=2,optimize=False)
print(f'Created {output.name}: {output.stat().st_size} bytes, {len(frames)} frames')
