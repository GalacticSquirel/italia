import sys
from pathlib import Path

BACKSLASH = chr(92)
p = Path(sys.argv[1])
s = p.read_text(encoding="utf-8")
for code in (0x2018, 0x2019, 0x201C, 0x201D, 0x00AB, 0x00BB):
    s = s.replace(chr(code), BACKSLASH + "u%04x" % code)
p.write_text(s, encoding="utf-8")
print("escaped")
