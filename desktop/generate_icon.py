"""Build an original 256x256 Windows Blorp icon without extra Python packages."""
from pathlib import Path
import struct
import zlib

size = 256
dest = Path(__file__).resolve().parent / "blorp.ico"

def rounded(x, y):
    left, right, radius = 12, 244, 50
    if not (left <= x < right and left <= y < right):
        return False
    cx = min(max(x, left + radius), right - radius)
    cy = min(max(y, left + radius), right - radius)
    return (x-cx)**2 + (y-cy)**2 <= radius*radius

def mark(x, y):
    # Lowercase b and small orange dot: Blorp visual mark.
    stem = 77 <= x < 106 and 57 <= y < 199
    outer = ((x-126)/56)**2 + ((y-151)/49)**2 < 1
    inner = ((x-126)/29)**2 + ((y-151)/25)**2 < 1
    dot = (x-197)**2 + (y-189)**2 < 11**2
    return stem or (outer and not inner), dot

pixels = bytearray()
for y in range(size):
    pixels.append(0)
    for x in range(size):
        cover = ink = orange = 0
        for dx in (0.25, 0.75):
            for dy in (0.25, 0.75):
                xx, yy = x+dx, y+dy
                if rounded(xx, yy):
                    cover += 1
                    ltr, dot = mark(xx, yy)
                    ink += int(ltr and not dot)
                    orange += int(dot)
        ink /= 4
        orange /= 4
        bg = (9, 48, 47)
        foreground = (238, 251, 241)
        accent = (242, 145, 89)
        pixels.extend((
            int(bg[0]*(1-ink-orange) + foreground[0]*ink + accent[0]*orange),
            int(bg[1]*(1-ink-orange) + foreground[1]*ink + accent[1]*orange),
            int(bg[2]*(1-ink-orange) + foreground[2]*ink + accent[2]*orange),
            cover*255//4
        ))

def chunk(tag, data):
    return struct.pack('>I',len(data)) + tag + data + struct.pack('>I',zlib.crc32(tag+data)&0xffffffff)

png=(b'\x89PNG\r\n\x1a\n'
     +chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,6,0,0,0))
     +chunk(b'IDAT',zlib.compress(bytes(pixels),9))
     +chunk(b'IEND',b''))
dest.write_bytes(struct.pack('<HHH',0,1,1)+struct.pack('<BBBBHHII',0,0,0,0,1,32,len(png),22)+png)
print(f'Generated Blorp AI desktop icon: {dest}')
